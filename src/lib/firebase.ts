import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, enableNetwork } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase only if no apps exist
let app;
try {
  app = initializeApp(firebaseConfig);
} catch {
  // If app already exists, get the existing one
  const { getApps, getApp } = await import('firebase/app');
  const apps = getApps();
  app = apps.length > 0 ? getApp() : initializeApp(firebaseConfig);
}

const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);
const storage = getStorage(app);

// Connect to emulator in development if needed
if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_USE_FIRESTORE_EMULATOR === 'true') {
  try {
    connectFirestoreEmulator(db, 'localhost', 8080);
    console.log('Connected to Firestore emulator');
  } catch {
    console.log('Firestore emulator already connected or not available');
  }
}

// Helper function to check Firebase connectivity
export const checkFirebaseConnection = async () => {
  try {
    await enableNetwork(db);
    return true;
  } catch {
    console.error('Firebase connection error');
    return false;
  }
};

export { auth, db, rtdb, storage };
export default app; 