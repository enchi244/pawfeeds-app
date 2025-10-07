import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// TODO: Replace the following with your app's Firebase project configuration
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