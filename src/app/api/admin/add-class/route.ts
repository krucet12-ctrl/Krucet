import { NextResponse } from 'next/server';
import { adminDb, admin } from '@/lib/firebase-admin';

console.log('/api/admin/add-class route loaded');

export async function GET() {
  return NextResponse.json({ success: false, message: 'Use POST for adding class data' }, { status: 405 });
}

export async function POST(req: Request) {
  console.log('/api/admin/add-class POST received');

  try {
    const payload = await req.json();
    const { courseType, regulation, students } = payload;

    if (!adminDb) {
      throw new Error('Firestore not initialized');
    }

    if (!courseType || !regulation || !students || !Array.isArray(students)) {
      console.error("Invalid payload provided. Students array missing or invalid.");
      return NextResponse.json({ success: false, error: 'Invalid payload provided' }, { status: 400 });
    }

    console.log(`Incoming students: ${students.length} valid entries received.`);

    const firestoreBatch = adminDb.batch();
    const batchesEncountered = new Set<string>();
    const departmentsEncountered = new Set<string>();

    const regularRollsToUnion = new Map<string, string[]>();
    const lateralRollsToUnion = new Map<string, string[]>();

    let count = 0;
    for (const student of students) {
      if (!student.batch || !student.branch || !student.rollNo) {
        console.warn(`Skipping invalid student record:`, student);
        continue;
      }
      
      console.log(`Saving student: ${student.rollNo} to classes/${courseType}/batches/${student.batch}/departments/${student.branch}/students`);
      
      batchesEncountered.add(student.batch);
      const combo = `${student.batch}_${student.branch}`;
      departmentsEncountered.add(combo);

      const docRef = adminDb.doc(`classes/${courseType}/batches/${student.batch}/departments/${student.branch}/students/${student.rollNo}`);

      console.log("Student object:", student);
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
      firestoreBatch.set(batchDoc, { exists: true, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
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
        console.log(`Successfully committed ${count} records.`);
      } catch (commitError) {
        console.error("Firestore error while committing batch:", commitError);
        throw new Error('Failed to commit student data to Firestore.');
      }
    } else {
      console.warn("No valid students found to save. Count is 0.");
    }

    if (batchesEncountered.size > 0) {
      const mapRef = adminDb.doc('yearToRegulation/map');
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
