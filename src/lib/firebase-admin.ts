import * as admin from 'firebase-admin';

// ─── Singleton Guard ──────────────────────────────────────────────────────────
// Prevents re-initialization across Next.js hot reloads and worker processes.
// admin.apps.length is the official Firebase-recommended check.

let isInitialized = false;

if (!admin.apps.length) {
  const projectId   = process.env.FIREBASE_PROJECT_ID?.trim().replace(/^"(.*)"$/, '$1');
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim().replace(/^"(.*)"$/, '$1');
  const rawKey      = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !rawKey) {
    console.error(
      '[Firebase Admin] Missing required env vars:',
      [
        !projectId   && 'FIREBASE_PROJECT_ID',
        !clientEmail && 'FIREBASE_CLIENT_EMAIL',
        !rawKey      && 'FIREBASE_PRIVATE_KEY',
      ].filter(Boolean).join(', ')
    );
  } else {
    try {
      // ── Private Key Normalization ────────────────────────────────────────────
      // On Vercel and most CI platforms, the key is stored as a single-line
      // string with literal "\n" characters. We must replace them with real
      // newlines so the PEM parser accepts the key.
      // The outer quotes are stripped first in case the value was stored with
      // surrounding double-quotes (common in some .env files).
      let privateKey = rawKey
        .trim()
        .replace(/^"(.*)"$/, '$1')       // Remove surrounding quotes if any
        .replace(/\\n/g, '\n')            // Convert literal \n → real newline
        .trim();

      // Validate PEM structure
      const pemMatch = privateKey.match(/-----BEGIN PRIVATE KEY-----[\s\S]+?-----END PRIVATE KEY-----/);
      if (!pemMatch) {
        throw new Error(
          'FIREBASE_PRIVATE_KEY has an invalid PEM format. Ensure it contains the full -----BEGIN PRIVATE KEY----- block.'
        );
      }

      // Normalize: exactly one PEM block with a trailing newline
      privateKey = pemMatch[0].trim() + '\n';

      admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
        projectId,
      });

      isInitialized = true;
    } catch (error) {
      console.error('[Firebase Admin] Initialization failed:', error);
    }
  }
} else {
  // App already initialized (hot-reload / multi-worker scenario)
  isInitialized = true;
}

// ─── Exports ──────────────────────────────────────────────────────────────────
// null! cast keeps TypeScript happy without requiring callers to null-check.
// Calls will throw at runtime only if initialization genuinely failed.
export const adminDb   = isInitialized ? admin.firestore() : (null as any);
export const adminAuth = isInitialized ? admin.auth()      : (null as any);
export { admin };
