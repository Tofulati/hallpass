import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// TODO: Replace with your Firebase config
// Get this from Firebase Console: Project Settings > General > Your apps
const firebaseConfig = {
  apiKey: "AIzaSyDF8-vfKGAW9axZv18YxKSmwOclRGEpcEk",
  authDomain: "hallpass-f88d4.firebaseapp.com",
  projectId: "hallpass-f88d4",
  storageBucket: "hallpass-f88d4.firebasestorage.app",
  messagingSenderId: "155519914568",
  appId: "1:155519914568:web:86a9f6439e082b6296be7d",
  measurementId: "G-59T63CT49S"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth with AsyncStorage persistence
// This ensures auth state persists between app sessions
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

// Initialize Firestore
export const db = getFirestore(app);

// Note: Firebase Storage is not used. See src/services/imageService.ts for image upload alternatives.

export default app;
