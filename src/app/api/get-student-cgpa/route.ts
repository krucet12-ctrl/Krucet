import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getRegulationForRollNumber, parseRollNumber } from '../../../lib/firebaseService';
import { StudentData } from '../../../lib/types';
import { getGradePoint, isSubjectPassed } from '../../../lib/gradingUtils';
import { safeTrim } from '@/lib/utils';

export const dynamic = 'force-dynamic';

import { buildCurriculumMap } from '../../../lib/curriculumHelper';

export async function POST(req: NextRequest) {
  try {
    const { rollNo: rawRoll } = await req.json();
    if (!rawRoll) return NextResponse.json({ error: 'Missing rollNo' }, { status: 400 });

    const rollNo = safeTrim(rawRoll).toUpperCase();

    // 1. Fetch student document
    const studentRef  = doc(db, 'students', rollNo);
    const studentSnap = await getDoc(studentRef);

    if (!studentSnap.exists()) {
      return NextResponse.json({ error: 'No results found for this roll number.' }, { status: 404 });
    }

    const student        = studentSnap.data() as StudentData;
    const subjectResults = student.subjectResults || {};

    if (Object.keys(subjectResults).length === 0) {
      return NextResponse.json({
        student: { name: student.name, roll: rollNo, branch: 'Unknown' },
        cgpa: 'NA',
        message: 'No marks found for this student.',
      });
    }

    // 2. Resolve regulation & department
    const { batch, branch: department, courseType: parsedCourseType } = parseRollNumber(rollNo);
    const courseType  = parsedCourseType || 'BTech';
    const regulation  = await getRegulationForRollNumber(rollNo, courseType);

    const curriculumMap = await buildCurriculumMap(courseType, regulation || '', department);

    // Build reverse map from existing semesterResults to handle subjects missing from curriculum
    const semesterResults = student.semesterResults || {};
    const fallbackSemKeyMap = new Map<string, string>();
    for (const [key, semObj] of Object.entries(semesterResults)) {
      if (semObj && (semObj as Record<string, any>).subjects) {
        for (const code of Object.keys((semObj as Record<string, any>).subjects)) {
          fallbackSemKeyMap.set(code.trim().toUpperCase(), key.toUpperCase());
        }
      }
    }

    // 4. Map subject results → semester buckets
    const resultsData: Record<string, any> = {};

    for (const [subCode, subInfo] of Object.entries(subjectResults) as any[]) {
      const normalizedCode = subCode.trim().toUpperCase();
      const cur = curriculumMap.get(normalizedCode);

      if (!cur) {
        // Subject not in curriculum — use defaults
      }

      const semKey   = cur?.semKey   ?? (fallbackSemKeyMap.get(normalizedCode) || 'SEM1');
      const credits  = cur?.credits  ?? Number(subInfo.credits || 0);
      const maxMarks = cur?.maxMarks ?? Number(subInfo.maxMarks || 100);

      if (!resultsData[semKey]) {
        resultsData[semKey] = { subjects: [], sgpa: null, hasFailed: false, earnedCredits: 0, totalPoints: 0 };
      }

      const total = Number(subInfo.total || 0);
      const pass  = subInfo.pass !== undefined
        ? subInfo.pass
        : isSubjectPassed(Number(subInfo.intMarks || 0), Number(subInfo.extMarks || 0), total, maxMarks);

      resultsData[semKey].subjects.push({ code: normalizedCode, total, pass, credits, maxMarks });
    }

    // 5. Compute per-semester SGPA and aggregate totals
    let totalCredits     = 0;
    let totalGradePoints = 0;
    const semestersWithResults: string[] = [];
    const semesterDetails: any = {};

    for (const semKey of Object.keys(resultsData)) {
      let semTotalPoints = 0;
      let semCredits     = 0;
      let hasFailed      = false;

      for (const res of resultsData[semKey].subjects) {
        if (!res.pass) {
          hasFailed = true;
        } else {
          // Use per-subject maxMarks from map — no secondary lookup needed
          const gp = getGradePoint(res.total, res.maxMarks);
          semTotalPoints += gp * res.credits;
          semCredits     += res.credits;
        }
      }

      const sgpa = !hasFailed && semCredits > 0 ? semTotalPoints / semCredits : null;
      resultsData[semKey].sgpa          = sgpa !== null ? sgpa.toFixed(2) : 'NA';
      resultsData[semKey].hasFailed     = hasFailed;
      resultsData[semKey].earnedCredits = semCredits;
      resultsData[semKey].totalPoints   = semTotalPoints;

      semestersWithResults.push(semKey);

      if (!hasFailed && semCredits > 0) {
        semesterDetails[semKey] = {
          credits:     semCredits,
          gradePoints: Number(semTotalPoints.toFixed(2)),
          gpa:         Number((semTotalPoints / semCredits).toFixed(2)),
        };
        totalCredits     += semCredits;
        totalGradePoints += semTotalPoints;
      } else {
        semesterDetails[semKey] = { credits: null, gradePoints: null, gpa: null };
      }
    }

    const cgpaVal      = totalCredits > 0 ? totalGradePoints / totalCredits : null;
    const cgpaStr      = cgpaVal !== null ? (Math.round(cgpaVal * 100) / 100).toFixed(2) : 'NA';
    const percentageStr = cgpaVal !== null ? (Math.round((cgpaVal - 0.75) * 10 * 100) / 100).toFixed(2) : 'NA';
    const sortedSems   = semestersWithResults.sort((a, b) => parseInt(a.replace('SEM', '')) - parseInt(b.replace('SEM', '')));

    return NextResponse.json({
      student: { name: student.name || 'Unknown', roll: rollNo, branch: department },
      cgpa: cgpaStr,
      percentage: percentageStr,
      semestersWithResults: sortedSems,
      semesterDetails,
      totalCredits,
    });

  } catch (error: any) {
    console.error('❌ CGPA API Error:', error);
    return NextResponse.json({ error: 'An internal error occurred while calculating CGPA.' }, { status: 500 });
  }
}