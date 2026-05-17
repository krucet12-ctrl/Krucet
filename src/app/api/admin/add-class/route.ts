import { NextResponse } from 'next/server';
import { adminDb, admin } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ success: false, message: 'Use POST for adding class data' }, { status: 405 });
}

export async function POST(req: Request) {


  try {
    const payload = await req.json();
    const { courseType, regulation, students, tuitionFees } = payload;

    if (!adminDb) {
      throw new Error('Firestore not initialized');
    }

    if (!courseType || !regulation || !students || !Array.isArray(students)) {

      return NextResponse.json({ success: false, error: 'Invalid payload provided' }, { status: 400 });
    }



    let totalParsed = students.length;
    let successfullyUploaded = 0;
    let skipped = 0;
    let failed = 0;

    // 1. Data Validation: Filter out invalid rows before processing
    const validStudents = [];
    const allBatchesEncountered = new Set<string>();

    for (const student of students) {
      if (!student || !student.rollNo || !student.batch || !student.branch) {
        console.warn(`Skipped invalid or empty student row:`, student);
        skipped++;
        continue;
      }
      validStudents.push(student);
      allBatchesEncountered.add(student.batch);
    }

    // 2. Automatic Batch Splitting (Firestore max is 500 operations per batch)
    // We use 300 to leave ample room for the batch and department metadata updates
    const MAX_BATCH_SIZE = 300; 
    
    for (let i = 0; i < validStudents.length; i += MAX_BATCH_SIZE) {
      const chunk = validStudents.slice(i, i + MAX_BATCH_SIZE);
      const firestoreBatch = adminDb.batch();
      
      const batchesEncountered = new Set<string>();
      const departmentsEncountered = new Set<string>();
      const regularRollsToUnion = new Map<string, string[]>();
      const lateralRollsToUnion = new Map<string, string[]>();

      for (const student of chunk) {
        batchesEncountered.add(student.batch);
        const combo = `${student.batch}_${student.branch}`;
        departmentsEncountered.add(combo);

        const docRef = adminDb.doc(`classes/${courseType}/batches/${student.batch}/departments/${student.branch}/students/${student.rollNo}`);

        firestoreBatch.set(docRef, {
          ...student,
          rollNo: student.rollNo,
          batch: student.batch,
          department: student.branch,
          courseType: courseType,
          regulation: regulation,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        if (student.batch.startsWith('L') || student.rollNo.toUpperCase().startsWith('L')) {
          if (!lateralRollsToUnion.has(combo)) lateralRollsToUnion.set(combo, []);
          lateralRollsToUnion.get(combo)!.push(student.rollNo);
        } else {
          if (!regularRollsToUnion.has(combo)) regularRollsToUnion.set(combo, []);
          regularRollsToUnion.get(combo)!.push(student.rollNo);
        }
      }

      batchesEncountered.forEach(b => {
        const batchDoc = adminDb.doc(`classes/${courseType}/batches/${b}`);
        const batchUpdate: any = { exists: true, updatedAt: admin.firestore.FieldValue.serverTimestamp() };
        if (tuitionFees) {
          batchUpdate.tuitionFees = tuitionFees;
        }
        firestoreBatch.set(batchDoc, batchUpdate, { merge: true });
      });

      departmentsEncountered.forEach(combo => {
        const [b, branch] = combo.split('_');
        const branchDoc = adminDb.doc(`classes/${courseType}/batches/${b}/departments/${branch}`);
        const updateData: any = { exists: true, updatedAt: admin.firestore.FieldValue.serverTimestamp() };

        if (regularRollsToUnion.has(combo) && regularRollsToUnion.get(combo)!.length > 0) {
          updateData.regularRollNos = admin.firestore.FieldValue.arrayUnion(...regularRollsToUnion.get(combo)!);
        }
        if (lateralRollsToUnion.has(combo) && lateralRollsToUnion.get(combo)!.length > 0) {
          updateData.lateralRollNos = admin.firestore.FieldValue.arrayUnion(...lateralRollsToUnion.get(combo)!);
        }

        firestoreBatch.set(branchDoc, updateData, { merge: true });
      });

      try {
        await firestoreBatch.commit();
        successfullyUploaded += chunk.length;
        console.log(`[Batch Upload] Successfully committed batch of ${chunk.length} students (Batch ${Math.floor(i / MAX_BATCH_SIZE) + 1})`);
      } catch (commitError) {
        console.error(`[Batch Upload] Firestore error in batch ${Math.floor(i / MAX_BATCH_SIZE) + 1}. Falling back to individual processing. Error:`, commitError);
        
        // Error Handling: If one batch fails (e.g., one malformed student), fall back to individual uploads 
        // to ensure valid students are still processed without stopping the whole upload.
        for (const student of chunk) {
          let attempt = 0;
          let success = false;
          const MAX_ATTEMPTS = 2;

          while (attempt < MAX_ATTEMPTS && !success) {
            attempt++;
            try {
              const docRef = adminDb.doc(`classes/${courseType}/batches/${student.batch}/departments/${student.branch}/students/${student.rollNo}`);
              await docRef.set({
                ...student,
                rollNo: student.rollNo,
                batch: student.batch,
                department: student.branch,
                courseType: courseType,
                regulation: regulation,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              }, { merge: true });
              successfullyUploaded++;
              success = true;
            } catch (individualError) {
              if (attempt >= MAX_ATTEMPTS) {
                console.error(`[Upload Error] Failed permanently to upload student ${student.rollNo}:`, individualError);
                failed++;
              } else {
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
          }
        }
      }
    }

    // Update global mappings only if there were successfully parsed batches
    if (allBatchesEncountered.size > 0) {
      try {
        const mapRef = adminDb.doc(`yearToRegulation/${courseType}`);
        const updates: Record<string, string> = {};
        allBatchesEncountered.forEach(b => {
          updates[b] = regulation;
        });
        await mapRef.set(updates, { merge: true });
      } catch (mapError) {
        console.error("Error updating yearToRegulation mapping:", mapError);
      }
    }

    // Upload Summary
    console.log(`\n=== Upload Summary ===`);
    console.log(`Total Parsed: ${totalParsed}`);
    console.log(`Uploaded Successfully: ${successfullyUploaded}`);
    console.log(`Failed: ${failed}`);
    console.log(`Skipped Empty Rows: ${skipped}`);
    console.log(`======================\n`);

    return NextResponse.json({ 
      success: true, 
      processed: successfullyUploaded,
      summary: {
        totalParsed,
        successfullyUploaded,
        skipped,
        failed
      }
    });
  } catch (e: any) {
    console.error('Error in add-class route:', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
