import * as admin from 'firebase-admin';

// ─── Singleton Guard ───────────────────────────────────────────────────────────
let isInitialized = false;

if (!admin.apps.length) {
  const projectId   = process.env.FIREBASE_PROJECT_ID?.trim().replace(/^"(.*)"$/, '$1');
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim().replace(/^"(.*)"$/, '$1');
  const rawKey      = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !rawKey) {
    // During `next build` on Vercel env vars are injected at runtime, not build time.
    // Log a warning but do NOT throw — API routes are server-rendered on demand.
    console.warn(
      '[Firebase Admin] Missing env vars:',
      [
        !projectId   && 'FIREBASE_PROJECT_ID',
        !clientEmail && 'FIREBASE_CLIENT_EMAIL',
        !rawKey      && 'FIREBASE_PRIVATE_KEY',
      ].filter(Boolean).join(', '),
      '— Admin SDK will be unavailable until env vars are set.'
    );
  } else {
    try {
      // ── Private Key Normalization ──────────────────────────────────────────
      // Vercel stores the key as a single-line string with literal \n sequences.
      // Strip surrounding quotes (if any) then replace \n → real newlines.
      let privateKey = rawKey
        .trim()
        .replace(/^"([\s\S]*)"$/, '$1')  // Remove surrounding double-quotes (multiline-safe)
        .replace(/\\n/g, '\n')            // Convert literal \n → real newline
        .trim();

      // Validate PEM structure
      const pemMatch = privateKey.match(/-----BEGIN PRIVATE KEY-----[\s\S]+?-----END PRIVATE KEY-----/);
      if (!pemMatch) {
        throw new Error(
          'FIREBASE_PRIVATE_KEY has an invalid PEM format. ' +
          'Ensure it contains the full -----BEGIN PRIVATE KEY----- block.'
        );
      }

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
export const adminDb   = isInitialized ? admin.firestore() : (null as any);
export const adminAuth = isInitialized ? admin.auth()      : (null as any);
export { admin };
