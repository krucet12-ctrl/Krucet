import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getRegulationForRollNumber, parseRollNumber } from '../../../lib/firebaseService';
import { StudentData } from '../../../lib/types';

export const dynamic = 'force-dynamic';

// Simple in-memory cache for curriculum data
const curriculumCache: Record<string, { data: any, timestamp: number }> = {};
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

import {
  validateRollNumberFormat,
  getGradePoint,
  getGrade,
  isSubjectPassed
} from '../../../lib/gradingUtils';

export async function POST(req: NextRequest) {
  try {
    const { rollNo, semester } = await req.json();

    if (!rollNo || !semester) {
      return NextResponse.json({ error: 'Missing rollNo or semester' }, { status: 400 });
    }

    // Validate roll number format first
    const validation = validateRollNumberFormat(rollNo);
    if (!validation.isValid) {
      console.log('Invalid roll number format:', rollNo);
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // 1. Fetch student data
    const studentRef = doc(db, 'students', rollNo);
    const studentSnap = await getDoc(studentRef);
    if (!studentSnap.exists()) {
      return NextResponse.json({ error: 'Student not found. Please check your roll number and try again.' }, { status: 404 });
    }
    const student = studentSnap.data() as StudentData;

    // 2. Determine regulation and branch
    const regulation = await getRegulationForRollNumber(rollNo);
    if (!regulation) {
      return NextResponse.json({ error: 'Regulation not found for this student' }, { status: 404 });
    }
    const { branch } = parseRollNumber(rollNo);

    // 3. Fetch curriculum for the specific semester
    let curriculumData;
    const cacheKey = `${regulation}-${branch}-${semester}`;
    if (curriculumCache[cacheKey] && (Date.now() - curriculumCache[cacheKey].timestamp < CACHE_TTL)) {
      curriculumData = curriculumCache[cacheKey].data;
    } else {
      const curriculumDocRef = doc(db, 'curriculum', regulation, branch, semester);
      const curriculumSnap = await getDoc(curriculumDocRef);
      if (!curriculumSnap.exists()) {
        return NextResponse.json({ results: [], error: `Curriculum not found for ${semester}.` });
      }
      curriculumData = curriculumSnap.data();
      curriculumCache[cacheKey] = { data: curriculumData, timestamp: Date.now() };
    }

    const curriculumSubjects = curriculumData?.Subjects || [];
    const semesterSubjectCodes = curriculumSubjects.map((s: { code: string; maxMarks?: number }) => ({ code: s.code, maxMarks: s.maxMarks || 100 }));

    // 4. Get all of the student's results
    const allStudentResults = student.subjectResults || {};

    // 5. Filter the student's results to include only subjects for the selected semester
    const semesterResults = semesterSubjectCodes.map(({ code, maxMarks }: { code: string; maxMarks: number }) => {
      const curriculumSubject = curriculumSubjects.find((s: { code: string }) => s.code === code);
      const studentResult = allStudentResults[code];
      const resultData = studentResult || { intMarks: 0, extMarks: 0, total: 0, grade: 'N/A', pass: false, attempts: 0 };

      const internalMarks = Number(resultData.intMarks) || 0;
      const externalMarks = Number(resultData.extMarks) || 0;
      const computedTotal = Number(resultData.total) || internalMarks + externalMarks;
      const resultMaxMarks = maxMarks || Number(resultData.maxMarks) || 100;

      const passed = typeof resultData.pass === 'boolean'
        ? resultData.pass
        : isSubjectPassed(internalMarks, externalMarks, computedTotal, resultMaxMarks);

      const grade = typeof resultData.grade === 'string' && resultData.grade !== '' && resultData.grade !== 'N/A'
        ? resultData.grade
        : getGrade(computedTotal, passed, resultMaxMarks);

      return {
        code,
        intMarks: internalMarks,
        extMarks: externalMarks,
        total: computedTotal,
        grade,
        pass: passed,
        attempts: resultData.attempts,
        credits: (curriculumSubject?.credit ?? curriculumSubject?.Credit ?? curriculumSubject?.credits ?? 0),
        maxMarks: resultMaxMarks,
      };
    });

    // 6. Calculate GPA for the filtered semester results
    let totalCredits = 0;
    let totalGradePoints = 0;
    let hasFailedAnySubject = false;

    semesterResults.forEach((res: { pass: boolean; total: number; code: string; credits: number; maxMarks: number }) => {
      if (!res.pass) {
        hasFailedAnySubject = true;
      } else {
        const gradePoint = getGradePoint(res.total, res.maxMarks);
        totalCredits += res.credits;
        totalGradePoints += gradePoint * res.credits;
      }
    });

    const gpa = !hasFailedAnySubject && totalCredits > 0 ? (totalGradePoints / totalCredits) : null;

    return NextResponse.json({
      student: {
        name: student.name || 'N/A',
        roll: student.roll,
        branch: student.branch
      },
      results: semesterResults,
      gpa: gpa !== null ? gpa.toFixed(2) : 'NA',
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error in get-semester-results API:', error);
    return NextResponse.json({ error: message || 'An unknown error occurred' }, { status: 500 });
  }
} 