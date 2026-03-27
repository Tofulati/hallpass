import { initializeApp } from 'firebase/app';
import { initializeAuth } from 'firebase/auth';
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

// Initialize Auth
// NOTE: `firebase@10.x` no longer exports `getReactNativePersistence` from `firebase/auth`.
// We try to load the React Native persistence helper dynamically, and fall back to
// default persistence if it's unavailable.
let authOptions: any = undefined;
try {
  // We import the RN build of `@firebase/auth` directly because `firebase/auth`
  // typings in this project don't expose `getReactNativePersistence`.
  // Runtime-wise, `@firebase/auth/dist/rn` DOES export it.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const rnAuth = require('@firebase/auth/dist/rn');
  if (rnAuth && typeof rnAuth.getReactNativePersistence === 'function') {
    authOptions = { persistence: rnAuth.getReactNativePersistence(AsyncStorage) };
  } else {
    authOptions = undefined;
  }
} catch {
  // Ignore if the helper module doesn't exist in this firebase build/version.
}

export const auth = initializeAuth(app, authOptions);

// Initialize Firestore
export const db = getFirestore(app);

// Note: Firebase Storage is not used. See src/services/imageService.ts for image upload alternatives.

export default app;
