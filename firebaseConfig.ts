import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from "firebase/app";
import { getReactNativePersistence, initializeAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your app's Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyCXmmtqLFGWB4nkeMXJ3eOD4r71llAFnYY",
  authDomain: "pawfeeds-app.firebaseapp.com",
  projectId: "pawfeeds-app",
  storageBucket: "pawfeeds-app.firebasestorage.app",
  messagingSenderId: "641645557069",
  appId: "1:641645557069:web:3481b2024f7416f6943304"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Initialize Firebase Authentication with React Native persistence
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});