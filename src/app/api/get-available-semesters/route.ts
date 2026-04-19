import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getRegulationForRollNumber, parseRollNumber } from '../../../lib/firebaseService';
import { StudentData } from '../../../lib/types';
import { safeTrim } from '@/lib/utils';

// Simple in-memory cache for curriculum data across requests
const curriculumCache: Record<string, { data: any, timestamp: number }> = {};
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

const validateRollNumberFormat = (rollNo: string): { isValid: boolean; error?: string } => {
  const format = /^[A-Z]\d{2}[A-Z]+\d{3}\d{3}$/;
  if (!rollNo || typeof rollNo !== 'string' || safeTrim(rollNo) === '') {
    return { isValid: false, error: 'Roll number is required' };
  }
  if (!format.test(rollNo)) {
    return { isValid: false, error: 'Invalid roll number format. Expected format: Y22CSE279001' };
  }
  return { isValid: true };
};

export async function POST(req: NextRequest) {
  try {
    const { rollNo } = await req.json();

    if (!rollNo) {
      return NextResponse.json({ error: 'Missing rollNo' }, { status: 400 });
    }

    const validation = validateRollNumberFormat(rollNo);
    if (!validation.isValid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const studentRef = doc(db, 'students', rollNo);
    const studentSnap = await getDoc(studentRef);

    if (!studentSnap.exists()) {
      return NextResponse.json({ error: 'Student not found. Please check your roll number and try again.' }, { status: 404 });
    }

    const student = studentSnap.data() as StudentData;
    const regulation = await getRegulationForRollNumber(rollNo);

    if (!regulation) {
      return NextResponse.json({ error: 'Regulation not found for this student' }, { status: 404 });
    }

    const { branch } = parseRollNumber(rollNo);
    const allStudentResults = student.subjectResults || {};
    const studentSubjectCodes = Object.keys(allStudentResults);
    const availableSemesters: string[] = [];

    const semesterPromises = [];
    for (let sem = 1; sem <= 8; sem++) {
      const semesterKey = `SEM${sem}`;
      const cacheKey = `${regulation}-${branch}-${semesterKey}`;

      if (curriculumCache[cacheKey] && (Date.now() - curriculumCache[cacheKey].timestamp < CACHE_TTL)) {
        semesterPromises.push(Promise.resolve({ semesterKey, snap: { exists: () => true, data: () => curriculumCache[cacheKey].data } }));
      } else {
        const curriculumDocRef = doc(db, 'curriculum', regulation, branch, semesterKey);
        semesterPromises.push(
          getDoc(curriculumDocRef)
            .then(snap => {
              if (snap.exists()) {
                curriculumCache[cacheKey] = { data: snap.data(), timestamp: Date.now() };
              }
              return { semesterKey, snap };
            })
            .catch(() => null)
        );
      }
    }

    const curriculumResults = await Promise.all(semesterPromises);

    for (const result of curriculumResults) {
      if (result && result.snap.exists()) {
        const curriculumData = result.snap.data();
        const curriculumSubjects = curriculumData?.Subjects || [];
        const semesterSubjectCodes = curriculumSubjects.map((s: { code: string }) => s.code);
        const hasResults = semesterSubjectCodes.some((code: string) => studentSubjectCodes.includes(code));
        if (hasResults) availableSemesters.push(result.semesterKey);
      }
    }

    return NextResponse.json({
      student: {
        name: student.name || 'N/A',
        roll: student.roll,
        branch: student.branch
      },
      availableSemesters: availableSemesters.sort((a, b) => {
        const aNum = parseInt(a.replace('SEM', ''));
        const bNum = parseInt(b.replace('SEM', ''));
        return aNum - bNum;
      })
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('get-available-semesters error:', error);
    return NextResponse.json({ error: message || 'An unknown error occurred' }, { status: 500 });
  }
}