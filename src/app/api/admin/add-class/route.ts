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



    const firestoreBatch = adminDb.batch();
    const batchesEncountered = new Set<string>();
    const departmentsEncountered = new Set<string>();

    const regularRollsToUnion = new Map<string, string[]>();
    const lateralRollsToUnion = new Map<string, string[]>();

    let count = 0;
    for (const student of students) {
      if (!student.batch || !student.branch || !student.rollNo) {

        continue;
      }
      

      
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

      count++;

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

    if (count > 0) {
      try {
        await firestoreBatch.commit();

      } catch (commitError) {
        console.error("Firestore error while committing batch:", commitError);
        throw new Error('Failed to commit student data to Firestore.');
      }
    } else {

    }

    if (batchesEncountered.size > 0) {
      const mapRef = adminDb.doc(`yearToRegulation/${courseType}`);
      const updates: Record<string, string> = {};
      batchesEncountered.forEach(b => {
        updates[b] = regulation;
      });
      await mapRef.set(updates, { merge: true });
    }

    return NextResponse.json({ success: true, processed: count });
  } catch (e: any) {
    console.error('Error in add-class route:', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
