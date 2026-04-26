import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getRegulationForRollNumber, parseRollNumber } from '../../../lib/firebaseService';
import { getGradePoint, getGrade, isSubjectPassed } from '../../../lib/gradingUtils';
import { safeTrim } from '@/lib/utils';

export const dynamic = 'force-dynamic';

import { buildCurriculumMap } from '../../../lib/curriculumHelper';

export async function POST(req: NextRequest) {
  try {
    const { rollNo: rawRoll } = await req.json();
    if (!rawRoll) return NextResponse.json({ error: 'Missing rollNo' }, { status: 400 });

    const rollNo = safeTrim(rawRoll).toUpperCase();

    // 2. Fetch student document
    const studentRef = doc(db, 'students', rollNo);
    const studentSnap = await getDoc(studentRef);

    if (!studentSnap.exists()) {
      return NextResponse.json({ error: 'No results found for this roll number.' }, { status: 404 });
    }

    const studentData = studentSnap.data();
    const subjectResults = studentData.subjectResults || {};
    const { branch: parsedBranch, courseType: parsedCourseType } = parseRollNumber(rollNo);
    // Use the explicitly saved branch from the student document if available, fallback to regex parsed branch
    let department = (studentData.branch || parsedBranch || '').trim().toUpperCase();
    const courseType: string = parsedCourseType || 'BTech'; // Override saved courseType with robust detection

    const regulation = await getRegulationForRollNumber(rollNo, courseType);

    const curriculumMap = await buildCurriculumMap(courseType, regulation || '', department);

    // Build reverse map from existing semesterResults to handle subjects missing from curriculum
    const semesterResults = studentData.semesterResults || {};
    const fallbackSemKeyMap = new Map<string, string>();
    for (const [key, semObj] of Object.entries(semesterResults)) {
      if (semObj && (semObj as Record<string, any>).subjects) {
        const normalizedSemKey = key.toUpperCase().replace(/\s+/g, '');
        for (const subCode of Object.keys((semObj as Record<string, any>).subjects)) {
          fallbackSemKeyMap.set(subCode.trim().toUpperCase(), normalizedSemKey);
        }
      }
    }

    // 5. Map subject results → semester buckets
    const resultsData: Record<string, any> = {};

    for (const [subCode, subInfo] of Object.entries(subjectResults) as any[]) {
      const normalizedCode = subCode.trim().toUpperCase();
      const cur = curriculumMap.get(normalizedCode);

      if (!cur) {
        // Subject not in curriculum — use defaults
      }

      const semKey  = cur?.semKey      ?? (fallbackSemKeyMap.get(normalizedCode) || 'SEM1');
      const credits = cur?.credits     ?? Number(subInfo.credits || 0);
      const maxMarks = cur?.maxMarks   ?? Number(subInfo.maxMarks || 100);
      const subjectName = cur?.subjectName ?? '';
      const order   = cur?.order       ?? 999;

      if (!resultsData[semKey]) {
        resultsData[semKey] = { subjects: [], sgpa: null, hasFailed: false, earnedCredits: 0, totalPoints: 0 };
      }

      const total = Number(subInfo.total || 0);
      const pass  = subInfo.pass !== undefined
        ? subInfo.pass
        : isSubjectPassed(Number(subInfo.intMarks || 0), Number(subInfo.extMarks || 0), total, maxMarks);

      // Re-compute grade using correct maxMarks (overrides any stale stored value)
      const grade = getGrade(total, pass, maxMarks);

      resultsData[semKey].subjects.push({
        code:      normalizedCode,
        name:      subInfo.subjectName || subjectName,
        extMarks:  subInfo.extMarks,
        intMarks:  subInfo.intMarks,
        total,
        maxMarks,
        grade,
        pass,
        attempts:  subInfo.attempts || 1,
        credits,
        order,
      });
    }

    // 6. Compute SGPA per semester (uses pre-built map — no extra fetches)
    for (const semKey of Object.keys(resultsData)) {
      resultsData[semKey].subjects.sort((a: any, b: any) => (a.order ?? 999) - (b.order ?? 999));

      let semTotalPoints = 0;
      let semCredits = 0;
      let hasFailed = false;

      for (const res of resultsData[semKey].subjects) {
        if (!res.pass) {
          hasFailed = true;
        } else {
          const gp = getGradePoint(res.total, res.maxMarks);
          semTotalPoints += gp * res.credits;
          semCredits     += res.credits;
        }
      }

      const sgpa = !hasFailed && semCredits > 0 ? semTotalPoints / semCredits : null;
      resultsData[semKey].sgpa         = sgpa !== null ? sgpa.toFixed(2) : 'NA';
      resultsData[semKey].hasFailed    = hasFailed;
      resultsData[semKey].earnedCredits = semCredits;
      resultsData[semKey].totalPoints  = semTotalPoints;
    }

    return NextResponse.json({
      student: { name: studentData.name || 'Unknown', roll: rollNo, branch: department },
      results: resultsData,
    });

  } catch (error) {
    console.error('❌ Error in get-student-data API:', error);
    return NextResponse.json({ error: 'An internal error occurred while fetching results.' }, { status: 500 });
  }
}
