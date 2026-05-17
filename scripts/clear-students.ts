import * as admin from 'firebase-admin';
import { loadEnvConfig } from '@next/env';
import * as path from 'path';

// Load environment variables from .env.local
loadEnvConfig(process.cwd());

// Manually initialize Firebase Admin to ensure it runs completely detached from Next.js context
const projectId = process.env.FIREBASE_PROJECT_ID?.trim().replace(/^"(.*)"$/, '$1');
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim().replace(/^"(.*)"$/, '$1');
const rawKey = process.env.FIREBASE_PRIVATE_KEY;

if (!projectId || !clientEmail || !rawKey) {
  console.error("\n❌ ERROR: Missing Firebase environment variables in .env.local");
  console.error("Please ensure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY are set.");
  process.exit(1);
}

let privateKey = rawKey
  .trim()
  .replace(/^"([\s\S]*)"$/, '$1')
  .replace(/\\n/g, '\n')
  .trim();

admin.initializeApp({
  credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  projectId,
});

const db = admin.firestore();

/**
 * Temporarily clear the entirely of the 'students' collection without dropping the collection itself
 * or modifying any structural/core rules. 
 */
async function clearStudentsCollection() {
  console.log("\n🚀 Starting bulk deletion of 'students' collection...");
  console.log("⚠️ This will ONLY delete documents inside 'students'. Other collections are untouched.\n");

  const collectionRef = db.collection('students');
  const batchSize = 100; // Decreased from 500 to prevent "Transaction too big" limit due to large docs
  let totalDeleted = 0;

  async function deleteBatch() {
    // We only fetch the document references to save memory and bandwidth
    const snapshot = await collectionRef.select().limit(batchSize).get();

    if (snapshot.size === 0) {
      return 0; // Collection is empty
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    return snapshot.size;
  }

  try {
    let deletedCount = await deleteBatch();
    while (deletedCount > 0) {
      totalDeleted += deletedCount;
      console.log(`✅ Deleted ${totalDeleted} student records so far...`);
      deletedCount = await deleteBatch();
    }

    console.log("\n=========================================");
    console.log(`🎉 SUCCESS: Collection 'students' is now empty.`);
    console.log(`🗑️ Total records securely deleted: ${totalDeleted}`);
    console.log("=========================================\n");
  } catch (error) {
    console.error("\n❌ ERROR: Failed while clearing 'students' collection.");
    console.error(error);
  }
}

// Execute
clearStudentsCollection().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
