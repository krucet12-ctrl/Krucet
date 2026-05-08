import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore, connectFirestoreEmulator, enableNetwork } from 'firebase/firestore';
import { getDatabase, Database } from 'firebase/database';
import { getStorage, FirebaseStorage } from 'firebase/storage';


const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId:     process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};


const app: FirebaseApp = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApp();


const auth: Auth             = getAuth(app);
const db: Firestore          = getFirestore(app);
const rtdb: Database         = getDatabase(app);
const storage: FirebaseStorage = getStorage(app);


if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_USE_FIRESTORE_EMULATOR === 'true') {
  try {
    connectFirestoreEmulator(db, 'localhost', 8080);
  } catch {
    // Already connected — safe to ignore
  }
}

if (typeof window !== 'undefined') {
  const REQUIRED = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_APP_ID',
  ] as const;
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.warn(`[Firebase] Missing env vars: ${missing.join(', ')}. Check your .env.local or Vercel environment settings.`);
  }
}

export const checkFirebaseConnection = async (): Promise<boolean> => {
  try {
    await enableNetwork(db);
    return true;
  } catch {
    return false;
  }
};

export { app, auth, db, rtdb, storage };
export default app;