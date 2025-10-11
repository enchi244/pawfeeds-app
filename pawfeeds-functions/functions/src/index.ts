import { initializeApp } from "firebase-admin/app";
import { getDatabase, ServerValue } from "firebase-admin/database";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onRequest, Request } from "firebase-functions/v2/https";
 
// Initialize Firebase Admin SDK
initializeApp();

// Define the structure of the expected request body for type safety
interface RegisterFeederRequest {
  feederId: string;
  owner_uid: string;
}

/**
 * HTTP Cloud Function to register a new feeder device.
 * Deployed to the asia-southeast1 region for lower latency.
 */
export const registerFeeder = onRequest(
  // NEW: Add the region and CORS settings here
  { region: "asia-southeast1", cors: true },
  async (req: Request, res) => {
    // We only accept POST requests
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const { feederId, owner_uid } = req.body as RegisterFeederRequest;

    // Validate the incoming data
    if (!feederId || !owner_uid) {
      logger.error("Missing feederId or owner_uid in request body", req.body);
      res.status(400).send("Bad Request: Missing feederId or owner_uid.");
      return;
    }

    logger.info(`Attempting to register feeder: ${feederId} for owner: ${owner_uid}`);

    try {
      const db = getFirestore();
      const feederDocRef = db.collection("feeders").doc(feederId);

      // Create the new feeder document in Firestore
      await feederDocRef.set({
        owner_uid: owner_uid,
        createdAt: Timestamp.now(),
        status: "online",
        foodLevels: { "1": 100, "2": 100 }, // Set initial default values
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
 * Firestore trigger to notify the feeder device when a schedule is changed.
 * This is triggered on any write (create, update, delete) to a schedule document.
 * It sends a command to the Realtime Database, which the device is listening to.
 */
export const onScheduleChange = onDocumentWritten(
  // The path to the documents to listen to
  { document: "feeders/{feederId}/schedules/{scheduleId}", region: "asia-southeast1" },
  async (event) => {
    // Extract the feederId from the path parameters
    const feederId = event.params.feederId;
    const scheduleId = event.params.scheduleId;

    // Safely check for event.data. The 'event.data' can be undefined on first invocation.
    // A 'delete' event will have 'event.data.after' as undefined.
    // A 'create' or 'update' will have 'event.data.after' defined.
    // We only need to send a notification if a schedule is created, updated, or deleted.
    // An undefined event.data means we can't determine the change, so we exit.
    if (!event.data) {
      logger.warn(`onScheduleChange triggered for ${feederId} with no event data. Exiting.`);
      return;
    }

    // The scheduleId is now used in the log message, resolving the warning.
    logger.info(`Schedule ${scheduleId} changed for feeder ${feederId}. Notifying device.`);

    try {
      // Get a reference to the Realtime Database
      const rtdb = getDatabase();
      const commandRef = rtdb.ref(`commands/${feederId}`);

      // Set the command for the device to refetch its schedules
      await commandRef.set({ command: "refetch_schedules", timestamp: ServerValue.TIMESTAMP });

      logger.info(`Successfully sent 'refetch_schedules' command to feeder ${feederId}.`);
    } catch (error) {
      logger.error(`Failed to send 'refetch_schedules' command for feeder ${feederId}:`, error);
    }
  }
);