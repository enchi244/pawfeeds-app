/*
 * Full file: enchi244/pawfeeds-app/pawfeeds-app-c6c6d3af53f9130a3abd84ae570f3bd8b45a9b11/pawfeeds-functions/functions/src/index.ts
 */

import { Expo, ExpoPushMessage } from "expo-server-sdk";
import { initializeApp } from "firebase-admin/app";
import { getDatabase, ServerValue } from "firebase-admin/database";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { onRequest, Request } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";

// Initialize Firebase Admin SDK
initializeApp();
const firestore = getFirestore();
const rtdb = getDatabase(); // Existing RTDB admin instance

// Initialize Expo SDK
const expo = new Expo();

// Define the structure of the expected request body for type safety
interface RegisterFeederRequest {
  feederId: string;
  owner_uid: string;
}

/**
 * HTTP Cloud Function to register a new feeder device.
 */
export const registerFeeder = onRequest(
  { region: "asia-southeast1", cors: true },
  async (req: Request, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const { feederId, owner_uid } = req.body as RegisterFeederRequest;

    if (!feederId || !owner_uid) {
      logger.error("Missing feederId or owner_uid in request body", req.body);
      res.status(400).send("Bad Request: Missing feederId or owner_uid.");
      return;
    }

    logger.info(`Attempting to register feeder: ${feederId} for owner: ${owner_uid}`);

    try {
      const db = getFirestore();
      const feederDocRef = db.collection("feeders").doc(feederId);

      await feederDocRef.set({
        owner_uid: owner_uid,
        createdAt: Timestamp.now(),
        status: "online",
        foodLevels: { "1": 100, "2": 100 },
        streamStatus: { "1": "offline", "2": "offline" },
      });

      logger.info(`Successfully registered feeder: ${feederId}`);
      res.status(200).send({ status: "success", message: `Feeder ${feederId} registered.` });
    } catch (error) {
      logger.error(`Error registering feeder ${feederId}:`, error);
      res.status(500).send("Internal Server Error");
    }
  }
);

/**
 * Scheduled Cloud Function that runs every minute to check all schedules.
 */
export const scheduledFeedChecker = onSchedule(
  {
    schedule: "every 1 minutes",
    timeZone: "Asia/Singapore", // PHT is GMT+8, same as Singapore
    region: "asia-southeast1",
  },
  async (event) => {
    logger.info("Running scheduled feed checker...");

    // **FIX: Get current time adjusted for the correct timezone**
    const now = new Date();
    const timeZone = "Asia/Singapore";
    
    // Get hours and minutes in the specified timezone
    const formatterHour = new Intl.DateTimeFormat('en-US', { hour: '2-digit', hour12: false, timeZone });
    const formatterMinute = new Intl.DateTimeFormat('en-US', { minute: '2-digit', timeZone });
    
    const currentHour = formatterHour.format(now).padStart(2, '0');
    // The hour '24' should be '00' for midnight comparison
    const formattedHour = currentHour === '24' ? '00' : currentHour;

    const currentMinute = formatterMinute.format(now).padStart(2, '0');
    const currentTime = `${formattedHour}:${currentMinute}`;
    
    // Get the current day of the week
    const dayMap = ["U", "M", "T", "W", "R", "F", "S"];
    const currentDay = dayMap[now.getDay()];

    logger.info(`Current time in ${timeZone}: ${currentTime}, Day: ${currentDay}`);

    try {
      const feedersSnapshot = await firestore.collection("feeders").get();
      if (feedersSnapshot.empty) {
        logger.info("No feeders found.");
        return;
      }

      const promises: Promise<any>[] = [];

      for (const feederDoc of feedersSnapshot.docs) {
        const feederId = feederDoc.id;
        const feederData = feederDoc.data();
        const ownerUid = feederData.owner_uid;
        
        const schedulesRef = feederDoc.ref.collection("schedules");
        const q = schedulesRef.where("isEnabled", "==", true);

        const promise = q.get().then((scheduleSnapshot) => {
          if (scheduleSnapshot.empty) {
            return;
          }

          scheduleSnapshot.forEach((scheduleDoc) => {
            const schedule = scheduleDoc.data();
            
            if (schedule.time === currentTime && schedule.repeatDays && schedule.repeatDays.includes(currentDay)) {
              logger.info(`MATCH FOUND: Triggering schedule ${scheduleDoc.id} for feeder ${feederId}`);

              // 1. Send command to RTDB for the feeder
              const command = {
                command: "feed",
                bowl: schedule.bowlNumber,
                amount: schedule.portionGrams,
                timestamp: ServerValue.TIMESTAMP,
              };

              const commandRef = rtdb.ref(`commands/${feederId}`);
              commandRef.set(command).catch((err) => {
                logger.error(`Failed to send command to feeder ${feederId} for schedule ${scheduleDoc.id}`, err);
              });

              // 2. Send push notification to the owner
              if (ownerUid) {
                // We make this non-blocking
                sendPushNotification(ownerUid, schedule.bowlNumber, schedule.portionGrams)
                  .catch(err => logger.error(`Failed to send push notification for ${ownerUid}`, err));
              }
            }
          });
        }).catch(err => {
            logger.error(`Error querying schedules for feeder ${feederId}:`, err);
        });
        promises.push(promise);
      }

      await Promise.all(promises);
      logger.info("Scheduled feed checker finished.");

    } catch (error) {
      logger.error("Error running scheduled feed checker:", error);
    }
  }
);

/**
 * Helper function to send a push notification to a user.
 * NOW ATTEMPTS BOTH EXPO PUSH AND RTDB LOCAL NOTIFICATION TRIGGER.
 */
async function sendPushNotification(uid: string, bowl: number, amount: number) {
  const title = "🐾 Feeding Time!";
  const body = `Dispensing ${amount}g of food to Bowl ${bowl}.`;
  const data = { screen: "schedules" }; // Optional data

  // --- NEW: 1. Write to Realtime Database to trigger local notification ---
  // This will be picked up by the app if it's running.
  try {
    const notificationRef = rtdb.ref(`user_notifications/${uid}`).push();
    await notificationRef.set({
      title,
      body,
      data,
      timestamp: ServerValue.TIMESTAMP,
    });
    logger.info(`RTDB notification message sent to user: ${uid}`);
  } catch (rtdbError) {
    logger.error(`Error sending RTDB notification message to ${uid}:`, rtdbError);
  }

  // --- EXISTING: 2. Attempt to send Expo Push Notification ---
  // This will work for GMS devices (Google/Samsung) and iOS.
  // It will gracefully fail for Huawei devices without GMS.
  try {
    // Get the user's push token from Firestore
    const userDocRef = firestore.collection("users").doc(uid);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      logger.warn(`User document not found for uid: ${uid}. Cannot send Expo notification.`);
      return;
    }

    const pushToken = userDoc.data()?.pushToken;

    if (!pushToken) {
      logger.warn(`No pushToken found for uid: ${uid}. Cannot send Expo notification.`);
      return; // No token, so just return (RTDB message was already sent)
    }

    if (!Expo.isExpoPushToken(pushToken)) {
      logger.error(`Push token ${pushToken} is not a valid Expo push token.`);
      return;
    }

    const message: ExpoPushMessage = {
      to: pushToken,
      sound: "default",
      title: title,
      body: body,
      data: data,
    };

    // Send the notification
    const chunks = expo.chunkPushNotifications([message]);
    const tickets: Promise<any>[] = [];
    for (const chunk of chunks) {
      tickets.push(expo.sendPushNotificationsAsync(chunk));
    }

    await Promise.all(tickets);
    logger.info(`Expo push notification sent successfully to user: ${uid}`);

  } catch (error) {
    logger.error(`Error sending Expo push notification to ${uid}:`, error);
  }
}