import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getRegulationForRollNumber, parseRollNumber } from '../../../lib/firebaseService';
import { StudentData } from '../../../lib/types';
import { safeTrim } from '@/lib/utils';

// Simple in-memory cache for curriculum data across requests
const curriculumCache: Record<string, { data: any, timestamp: number }> = {};
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// Helper function to validate roll number format
const validateRollNumberFormat = (rollNo: string): { isValid: boolean; error?: string } => {
  // Expected format: Y22CSE279001 (e.g., Y22 + CSE + 279 + 001)
  const format = /^[A-Z]\d{2}[A-Z]+\d{3}\d{3}$/;

  if (!rollNo || typeof rollNo !== 'string' || safeTrim(rollNo) === '') {
    return { isValid: false, error: 'Roll number is required' };
  }

  if (!format.test(rollNo)) {
    return {
      isValid: false,
      error: 'Invalid roll number format. Expected format: Y22CSE279001 (e.g., Y(batch) + Branch + College + Number)'
    };
  }

  return { isValid: true };
};

export async function POST(req: NextRequest) {
  try {
    console.log('get-available-semesters API called');

    const { rollNo } = await req.json();
    console.log('Received rollNo:', rollNo);

    if (!rollNo) {
      console.log('Missing rollNo parameter');
      return NextResponse.json({ error: 'Missing rollNo' }, { status: 400 });
    }

    // Validate roll number format first
    const validation = validateRollNumberFormat(rollNo);
    if (!validation.isValid) {
      console.log('Invalid roll number format:', rollNo);
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // 1. Fetch student data using Firebase client
    console.log('Fetching student data for:', rollNo);
    const studentRef = doc(db, 'students', rollNo);
    const studentSnap = await getDoc(studentRef);

    if (!studentSnap.exists()) {
      console.log('Student not found:', rollNo);
      return NextResponse.json({ error: 'Student not found. Please check your roll number and try again.' }, { status: 404 });
    }

    const student = studentSnap.data() as StudentData;
    console.log('Student data retrieved:', { name: student.name, branch: student.branch });

    // 2. Determine regulation and branch
    console.log('Determining regulation and branch');
    const regulation = await getRegulationForRollNumber(rollNo);
    if (!regulation) {
      console.log('Regulation not found for rollNo:', rollNo);
      return NextResponse.json({ error: 'Regulation not found for this student' }, { status: 404 });
    }
    const { branch } = parseRollNumber(rollNo);
    console.log('Regulation and branch:', { regulation, branch });

    // 3. Get all of the student's results
    const allStudentResults = student.subjectResults || {};
    const studentSubjectCodes = Object.keys(allStudentResults);
    console.log('Student subject codes:', studentSubjectCodes);

    // 4. Check each semester (1-8) to see if it has results simultaneously using batched requests
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
            .catch(error => {
              console.error(`Error checking semester ${semesterKey}:`, error);
              return null;
            })
        );
      }
    }

    const curriculumResults = await Promise.all(semesterPromises);

    for (const result of curriculumResults) {
      if (result && result.snap.exists()) {
        const curriculumData = result.snap.data();
        const curriculumSubjects = curriculumData?.Subjects || [];
        const semesterSubjectCodes = curriculumSubjects.map((s: { code: string }) => s.code);

        // Check if any subjects from this semester exist in student results
        const hasResults = semesterSubjectCodes.some((code: string) =>
          studentSubjectCodes.includes(code)
        );

        if (hasResults) {
          console.log(`Semester ${result.semesterKey} has results`);
          availableSemesters.push(result.semesterKey);
        }
      }
    }

    console.log('Available semesters:', availableSemesters);

    return NextResponse.json({
      student: {
        name: student.name || 'N/A',
        roll: student.roll,
        branch: student.branch
      },
      availableSemesters: availableSemesters.sort((a, b) => {
        // Sort by semester number
        const aNum = parseInt(a.replace('SEM', ''));
        const bNum = parseInt(b.replace('SEM', ''));
        return aNum - bNum;
      })
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error in get-available-semesters API:', error);
    return NextResponse.json({ error: message || 'An unknown error occurred' }, { status: 500 });
  }
} 