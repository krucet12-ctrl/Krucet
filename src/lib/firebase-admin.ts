import * as admin from 'firebase-admin';

let isInitialized = false;

if (!admin.apps.length) {
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID?.trim().replace(/^"(.*)"$/, '$1');
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim().replace(/^"(.*)"$/, '$1');

    const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;

    let privateKey = rawPrivateKey
      ?.trim()
      .replace(/^"(.*)"$/, '$1')
      .replace(/\\n/g, '\n')
      .trim();

    // Final PEM safety check
    if (privateKey && !privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
      console.warn('⚠️ Private key missing header, this may fail.');
    }

    // Ensure exactly one PEM block; remove any accidental prefix/suffix and trailing garbage
    if (privateKey) {
      const pemMatch = privateKey.match(/-----BEGIN PRIVATE KEY-----[\s\S]+?-----END PRIVATE KEY-----/);
      if (pemMatch) {
        privateKey = pemMatch[0].trim() + '\n';
      } else {
        console.error('❌ Firebase Admin initialization failed: Invalid PEM format for FIREBASE_PRIVATE_KEY.');
        throw new Error('Invalid PEM format for FIREBASE_PRIVATE_KEY');
      }
    }

    if (!projectId || !clientEmail || !privateKey) {
      console.error('❌ Firebase Admin initialization failed: Missing environment variables (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, or FIREBASE_PRIVATE_KEY).');
    } else {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        projectId,
      });
      isInitialized = true;
    }
  } catch (error) {
    console.error('❌ Firebase Admin initialization error:', error);
  }
} else {
  isInitialized = true;
}

export const adminDb = isInitialized ? admin.firestore() : null!;
export const adminAuth = isInitialized ? admin.auth() : null!;
export { admin };
