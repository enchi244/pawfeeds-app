import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { Auth, getAuth, getReactNativePersistence, initializeAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions"; // 1. Import getFunctions
import { getStorage } from "firebase/storage";

// Your app's Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyD6qqin2W1UpqCbtudFN6cMHo8S3jtqz0c",
  authDomain: "pawfeeds-v2.firebaseapp.com",
  projectId: "pawfeeds-v2",
  storageBucket: "pawfeeds-v2.firebasestorage.app",
  messagingSenderId: "847280230673",
  appId: "1:847280230673:web:e82d2fa686e31775bbfcb0",
  databaseURL: "https://pawfeeds-v2-default-rtdb.asia-southeast1.firebasedatabase.app"
};

// Declare variables to hold the app and auth instances.
let app: FirebaseApp;
let auth: Auth;

if (!getApps().length) {
  app = initializeApp(firebaseConfig);
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage)
  });
} else {
  app = getApp();
  auth = getAuth(app);
}

// Initialize other Firebase services
const db = getFirestore(app);
const database = getDatabase(app);
const storage = getStorage(app);
// 2. Initialize Functions (Ensure region matches your backend)
const functions = getFunctions(app, 'asia-southeast1');

// 3. Export functions
export { auth, database, db, functions, storage };
