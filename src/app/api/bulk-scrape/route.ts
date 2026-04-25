import { NextRequest, NextResponse } from 'next/server';
import { 
  convertParsedResultToStudentData, 
  saveResultUrl,
  parseRollNumber,
  getRegulationForRollNumber,
  getCurriculumMaxMarks,
  computeResultFromMarks,
  normalizeSubjectCode
} from '../../../lib/firebaseService';
import { adminDb } from '../../../lib/firebase-admin';
import { StudentData } from '../../../lib/types';
import { parseResultHTML } from '../../../lib/utils';

export const dynamic = 'force-dynamic';

// Generate roll numbers in range
const generateRollNumbers = (startRoll: string, endRoll: string): string[] => {
  const rollNumbers: string[] = [];
  
  try {
    const start = parseRollNumber(startRoll);
    const end = parseRollNumber(endRoll);
    
    if (start.batch !== end.batch || start.branch !== end.branch || start.college !== end.college) {
      throw new Error('Start and end roll numbers must be from same batch, branch, and college');
    }
    
    const startNum = parseInt(start.number);
    const endNum = parseInt(end.number);
    
    for (let i = startNum; i <= endNum; i++) {
      const number = i.toString().padStart(3, '0');
      rollNumbers.push(`${start.batch}${start.branch}${start.college}${number}`);
    }
  } catch (error) {
    console.error('Error generating roll numbers:', error);
    throw error;
  }
  
  return rollNumbers;
};

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type');
    let body;
    
    if (contentType?.includes('application/json')) {
      body = await req.json();
    } else {
      const formData = await req.formData();
      body = {
        startRoll: formData.get('startRoll'),
        endRoll: formData.get('endRoll'),
        rsurl: formData.get('rsurl'),
        resultType: formData.get('resultType'),
        courseType: formData.get('courseType'),
        batch: formData.get('batch'),
        semester: formData.get('semester'),
        scrapeType: formData.get('scrapeType'),
      };
    }

    const { startRoll, endRoll, rsurl, resultType, courseType: ctField, batch: batchField, semester: semField, scrapeType: scrapeTypeField } = body;
    
    if (!startRoll || !endRoll || !rsurl || !resultType) {
      return NextResponse.json({ 
        error: 'Missing required fields: startRoll, endRoll, rsurl, resultType' 
      }, { status: 400 });
    }

    try {
      parseRollNumber(startRoll);
      parseRollNumber(endRoll);
    } catch  {
      return NextResponse.json({ 
        error: 'Invalid roll number format. Expected format: Y22CSE279001' 
      }, { status: 400 });
    }

    // Start scraping in background
    setTimeout(async () => {
      try {
        await performBulkScrape("", startRoll, endRoll, rsurl, resultType, {
          courseType: ctField || '',
          batch: batchField || '',
          semester: semField || '',
          scrapeType: scrapeTypeField || '',
        });
      } catch (error: unknown) {
        console.error('Background scraping error:', error);
      }
    }, 100);

    return NextResponse.json({ 
      success: true, 
      message: 'Bulk scraping job started successfully' 
    });

  } catch (error: unknown) {
    console.error('Bulk scrape error:', error);
    
    if (error instanceof Error && error.message?.includes('permission')) {
      return NextResponse.json({ 
        error: 'Firestore permission denied.' 
      }, { status: 403 });
    }
    
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }, { status: 500 });
  }
}

async function performBulkScrape(
  jobId: string, 
  startRoll: string, 
  endRoll: string, 
  rsurl: string,
  resultType: string,
  meta?: { courseType: string; batch: string; semester: string; scrapeType: string }
) {
  const rollStatus: Record<string, 'pending' | 'success' | 'error'> = {};

  let { branch: department, courseType: parsedCourseType } = parseRollNumber(startRoll);
  
  // Determine curriculum context once
  const courseType = parsedCourseType || meta?.courseType || 'BTech';
  const semMatch = (resultType || '').match(/-Sem(\d+)/i);
  const semesterKey = meta?.semester ? `SEM${meta.semester}` : (semMatch ? `SEM${semMatch[1]}` : 'SEM1');

  // Map MTech branch alias back to CSE for curriculum matching
  if (courseType === 'MTech' && department === 'MTH') {
    department = 'CSE';
  }

  const regulation = await getRegulationForRollNumber(startRoll, courseType);
  const subjectMaxMarks = regulation ? await getCurriculumMaxMarks(courseType, regulation, department, semesterKey) : {};

  try {
    // Generate roll numbers
    const rollNumbers = generateRollNumbers(startRoll, endRoll);
    rollNumbers.forEach(rollNo => { rollStatus[rollNo] = 'pending'; });

    // Process roll numbers in smaller parallel chunks to speed up while avoiding blocks
    const CHUNK_SIZE = 5; 
    for (let i = 0; i < rollNumbers.length; i += CHUNK_SIZE) {
      const chunk = rollNumbers.slice(i, i + CHUNK_SIZE);
      
      await Promise.all(chunk.map(async (rollNo) => {
        try {
          const url = process.env.RESULTS_URL || 'https://upiqpbank.com/kvrrms/home/getresults';
          const payload = new URLSearchParams({ hno: rollNo, rsurl });
          const response = await fetch(url, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' }, 
            body: payload.toString() 
          });
          
          if (!response.ok) return;

          const html = await response.text();
          const parsedResult = parseResultHTML(html);
          if (parsedResult) {
            let rollCourseType = 'BTech';
            try {
              const parsed = parseRollNumber(rollNo);
              rollCourseType = parsed.courseType;
            } catch {
              // fallback
            }
            const studentData = convertParsedResultToStudentData(parsedResult, resultType, subjectMaxMarks);
            await saveStudentResultAdmin(studentData, subjectMaxMarks, { ...meta, courseType: rollCourseType } as any);
            rollStatus[rollNo] = 'success';
          } else {
            rollStatus[rollNo] = 'error';
          }
        } catch {
          rollStatus[rollNo] = 'error';
        }
      }));

      // Small delay between chunks
      if (i + CHUNK_SIZE < rollNumbers.length) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

  } catch (error: unknown) {
    console.error('Bulk scrape error:', error);
    throw error;
  }
}

async function saveStudentResultAdmin(
  studentData: StudentData, 
  subjectMaxMarks: Record<string, { maxMarks: number, credits: number }> = {},
  meta?: { courseType: string; batch: string; semester: string; scrapeType: string }
): Promise<void> {
  if (!adminDb) {
    throw new Error('Admin DB not initialized');
  }
  
  const normalizedRoll = (studentData.roll || '').trim().toUpperCase();
  studentData.roll = normalizedRoll;
  console.log(`[saveStudentResultAdmin] Normalized Roll Number: ${normalizedRoll}`);

  const studentRef = adminDb.collection('students').doc(normalizedRoll);
  const studentSnap = await studentRef.get();

  if (studentSnap.exists) {
    const existingData = studentSnap.data() as StudentData;
    const existingResults = existingData.subjectResults || {};
    const newResults = studentData.subjectResults;

    const updatedResults = { ...existingResults };
    const semKey = `sem${meta?.semester || '1'}`;
    const existingSemesterData: any = existingData.semesterResults?.[semKey] || { subjects: {} };
    const updatedSemesterSubjects: any = { ...(existingSemesterData.subjects || {}) };

    if (Object.keys(newResults).length > 0) {
      for (const subCode in newResults) {
        if (Object.prototype.hasOwnProperty.call(newResults, subCode)) {
          const newSub = newResults[subCode];
          const existingSub = existingResults[subCode];
          const existingSemSub = updatedSemesterSubjects[subCode];

          if (existingSub) {
            const existingInt = Number(existingSub.intMarks) || 0;
            const existingExt = Number(existingSub.extMarks) || 0;
            const newInt = Number(newSub.intMarks) || existingInt;
            const newExt = Number(newSub.extMarks) || existingExt;
            const marksAreDifferent = existingInt !== newInt || existingExt !== newExt;

            const isRevaluation = studentData.resultType?.toLowerCase().includes('rvresults');
            const isSupply = studentData.resultType?.toLowerCase().includes('supplyresults');

            const subjectData = subjectMaxMarks[normalizeSubjectCode(subCode)];
            const maxMarks = subjectData?.maxMarks || 100;
            const credits = subjectData?.credits || 0;

            if (isRevaluation) {
              if (newExt > existingExt) {
                const computed = computeResultFromMarks(existingInt, newExt, maxMarks);
                updatedResults[subCode] = {
                  ...existingSub,
                  subjectName: newSub.subjectName || existingSub.subjectName || '',
                  attempts: existingSub.attempts || 1,
                  credits,
                  ...computed,
                };
                updatedSemesterSubjects[subCode] = { ...(existingSemSub || updatedResults[subCode]), ...computed, attempts: updatedResults[subCode].attempts };
              }
            } else if (isSupply) {
              const computed = computeResultFromMarks(newInt, newExt, maxMarks);
              updatedResults[subCode] = {
                ...existingSub,
                subjectName: newSub.subjectName || existingSub.subjectName || '',
                attempts: (existingSub.attempts || 1) + 1,
                credits,
                ...computed,
              };
              updatedSemesterSubjects[subCode] = { ...(existingSemSub || updatedResults[subCode]), ...computed, attempts: updatedResults[subCode].attempts };
            } else if (marksAreDifferent) {
              const computed = computeResultFromMarks(newInt, newExt, maxMarks);
              updatedResults[subCode] = {
                ...existingSub,
                subjectName: newSub.subjectName || existingSub.subjectName || '',
                attempts: (existingSub.attempts || 1) + 1,
                credits,
                ...computed,
              };
              updatedSemesterSubjects[subCode] = { ...(existingSemSub || updatedResults[subCode]), ...computed, attempts: updatedResults[subCode].attempts };
            }
          } else {
            const subjectData = subjectMaxMarks[normalizeSubjectCode(subCode)];
            const maxMarks = subjectData?.maxMarks || 100;
            const credits = subjectData?.credits || 0;
            const computed = computeResultFromMarks(newSub.intMarks, newSub.extMarks, maxMarks);

            updatedResults[subCode] = {
              ...newSub,
              subjectName: newSub.subjectName || '',
              attempts: 1,
              credits,
              ...computed,
            };
            updatedSemesterSubjects[subCode] = updatedResults[subCode];
          }
        }
      }
    }

    console.log("Saving result for:", studentData.roll);

    let semTotalMarks = 0;
    let semTotalMaxMarks = 0;
    let totalCredits = 0;
    let weightedGradePoints = 0;

    for (const subCode in updatedSemesterSubjects) {
      if (Object.prototype.hasOwnProperty.call(updatedSemesterSubjects, subCode)) {
        const sub = updatedSemesterSubjects[subCode];
        semTotalMarks += sub.total || 0;
        
        const credits = sub.credits || subjectMaxMarks[normalizeSubjectCode(subCode)]?.credits || 0;
        totalCredits += credits;
        const gradePoints = parseFloat(sub.grade) || 0;
        weightedGradePoints += credits * gradePoints;
        
        semTotalMaxMarks += sub.maxMarks || subjectMaxMarks[normalizeSubjectCode(subCode)]?.maxMarks || 100;
      }
    }
    
    const SGPA = totalCredits > 0 ? weightedGradePoints / totalCredits : 0;

    const newSemesterResult = {
      ...existingSemesterData, // KEEP previous properties just in case
      semester: meta?.semester || existingSemesterData.semester || '',
      scrapeType: meta?.scrapeType || existingSemesterData.scrapeType || '',
      marks: semTotalMarks,
      maxMarks: semTotalMaxMarks,
      SGPA: Number(SGPA.toFixed(2)),
      subjects: updatedSemesterSubjects,
      uploadDate: new Date().toISOString()
    };

    await studentRef.update({
      name: studentData.name,
      branch: studentData.branch,
      college: studentData.college,
      number: studentData.number,
      batch: studentData.batch,
      subjectResults: updatedResults,
      [`semesterResults.${semKey}`]: newSemesterResult,
      resultType: studentData.resultType,
      courseType: meta?.courseType || 'BTech',
      lastUpdated: new Date().toISOString()
    });

  } else {
    // Document doesn't exist, create it.
    console.warn("Student not found. Creating new document for:", studentData.roll);
    
    const semKey = `sem${meta?.semester || '1'}`;
    let semTotalMarks = 0;
    let semTotalMaxMarks = 0;
    let totalCredits = 0;
    let weightedGradePoints = 0;
    
    for (const subCode in studentData.subjectResults) {
      if (Object.prototype.hasOwnProperty.call(studentData.subjectResults, subCode)) {
        const sub = studentData.subjectResults[subCode];
        semTotalMarks += sub.total || 0;
        
        const credits = sub.credits || subjectMaxMarks[normalizeSubjectCode(subCode)]?.credits || 0;
        totalCredits += credits;
        const gradePoints = parseFloat(sub.grade) || 0;
        weightedGradePoints += credits * gradePoints;
        
        semTotalMaxMarks += sub.maxMarks || subjectMaxMarks[normalizeSubjectCode(subCode)]?.maxMarks || 100;
      }
    }
    
    const SGPA = totalCredits > 0 ? weightedGradePoints / totalCredits : 0;
    
    const newSemesterResult = {
      semester: meta?.semester || '',
      scrapeType: meta?.scrapeType || '',
      marks: semTotalMarks,
      maxMarks: semTotalMaxMarks,
      SGPA: Number(SGPA.toFixed(2)),
      subjects: studentData.subjectResults,
      uploadDate: new Date().toISOString()
    };

    await studentRef.set({
      ...studentData,
      semesterResults: {
        [semKey]: newSemesterResult
      },
      resultType: studentData.resultType,
      lastUpdated: new Date().toISOString()
    });
  }

  // Invalidate precomputed CGPA
  try {
    await adminDb.collection('cgpa').doc(studentData.roll).delete();
  } catch {
    // ignore
  }
}