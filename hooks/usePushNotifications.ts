import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { doc, setDoc } from 'firebase/firestore';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebaseConfig';

// Configure notification handling when app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function registerForPushNotificationsAsync(uid: string): Promise<string | null> {
  let token: string | null = null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push token: Permissions not granted.');
      return null;
    }

    try {
      // Use the EAS project ID from app.json
      const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync({
        projectId: '1b09b532-3580-4573-b26a-5431b090252b',
      });
      token = expoPushToken;
    } catch (e) {
      console.error("Error getting Expo push token:", e);
      return null;
    }

  } else {
    console.log('Must use physical device for Push Notifications');
  }

  if (token && uid) {
    try {
      // Save the token to a 'users' collection, creating or merging the document.
      const userDocRef = doc(db, 'users', uid);
      await setDoc(userDocRef, { pushToken: token, updatedAt: new Date() }, { merge: true });
      console.log('Push token saved to Firestore for user:', uid);
    } catch (e) {
      console.error('Error saving push token to Firestore:', e);
    }
  }

  return token;
}

export const usePushNotifications = () => {
  const { user } = useAuth();
  // **FIX:** Changed NotificationSubscription to Subscription
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    if (user) {
      // User is authenticated, register for notifications
      registerForPushNotificationsAsync(user.uid);

      // Listener for when a notification is received while the app is foregrounded
      notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
        // console.log('Notification received:', notification);
      });

      // Listener for when a user taps on a notification (app was backgrounded or killed)
      responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
        // console.log('Notification response received:', response);
        // Here you could navigate to a specific screen based on notification data
        // e.g., router.push('/(tabs)/schedules');
      });

      // Cleanup listeners on unmount
      return () => {
        if (notificationListener.current) {
          Notifications.removeNotificationSubscription(notificationListener.current);
        }
        if (responseListener.current) {
          Notifications.removeNotificationSubscription(responseListener.current);
        }
      };
    }
  }, [user]); // Re-run effect if user changes
};