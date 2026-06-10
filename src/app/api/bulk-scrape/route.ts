import { NextRequest, NextResponse } from 'next/server';
import { 
  convertParsedResultToStudentData, 
  saveResultUrl,
  parseRollNumber,
  getRegulationForRollNumber,
  getCurriculumMaxMarks,
  computeResultFromMarks,
  normalizeSubjectCode,
  addOrUpdateCurriculum
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

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, data: any) => {
          try {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          } catch (e) {
            console.error("Stream enqueue error:", e);
          }
        };

        try {
          parseRollNumber(startRoll);
          parseRollNumber(endRoll);
        } catch {
          sendEvent('error', { message: 'Invalid roll number format. Expected format: Y22CSE279001' });
          controller.close();
          return;
        }

        try {
          const summary = await performBulkScrape("", startRoll, endRoll, rsurl, resultType, {
            courseType: ctField || '',
            batch: batchField || '',
            semester: semField || '',
            scrapeType: scrapeTypeField || '',
          }, sendEvent);

          sendEvent('complete', summary);
        } catch (error: any) {
          sendEvent('error', { message: error.message || 'Unknown error occurred' });
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: unknown) {
    console.error('Bulk scrape API error:', error);
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
  meta?: { courseType: string; batch: string; semester: string; scrapeType: string },
  sendEvent?: (event: string, data: any) => void
) {
  const rollStatus: Record<string, 'pending' | 'success' | 'error'> = {};

  let { branch: department, courseType: parsedCourseType } = parseRollNumber(startRoll);
  
  // Determine curriculum context once
  const courseType = parsedCourseType || meta?.courseType || 'BTech';
  const semMatch = (resultType || '').match(/-Sem(\d+)/i);
  const semesterKey = meta?.semester ? `SEM${meta.semester}` : (semMatch ? `SEM${semMatch[1]}` : 'SEM1');


  const regulation = await getRegulationForRollNumber(startRoll, courseType);
  const curriculumKey = regulation ? `${courseType}_${regulation}` : '';
  const subjectMaxMarks = regulation ? await getCurriculumMaxMarks(courseType, regulation, department, semesterKey) : {};

  try {
    // Generate roll numbers
    const rollNumbers = generateRollNumbers(startRoll, endRoll);
    rollNumbers.forEach(rollNo => { rollStatus[rollNo] = 'pending'; });

    // Process roll numbers in smaller parallel chunks to speed up while avoiding blocks
    const CHUNK_SIZE = 5; 
    let currentBatch = adminDb.batch();
    let operationsInBatch = 0;
    let successfullyUploaded = 0;
    let skipped = 0;
    let failed = 0;

    const reportProgress = (currentRoll: string) => {
      if (sendEvent) {
        sendEvent('progress', {
          total: rollNumbers.length,
          currentRoll,
          uploaded: successfullyUploaded,
          failed,
          skipped
        });
      }
    };

    // Ensure every parsed student row is processed one by one safely
    for (const rollNo of rollNumbers) {
      reportProgress(rollNo);
      let attempt = 0;
      let success = false;
      const MAX_ATTEMPTS = 2; // 1 initial + 1 retry

      while (attempt < MAX_ATTEMPTS && !success) {
        attempt++;
        try {
          const url = process.env.RESULTS_URL || 'https://upiqpbank.com/kvrrms/home/getresults';
          const payload = new URLSearchParams({ hno: rollNo, rsurl });
          const response = await fetch(url, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' }, 
            body: payload.toString() 
          });
          
          if (!response.ok) {
            throw new Error(`HTTP Error ${response.status}`);
          }

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

            const missingSubjects: any[] = [];
            for (const subCode in studentData.subjectResults) {
              const normalizedCode = normalizeSubjectCode(subCode);
              if (!subjectMaxMarks[normalizedCode]) {
                const subjectInfo = studentData.subjectResults[subCode];
                missingSubjects.push({
                  subject_code: normalizedCode,
                  credits: subjectInfo.credits || 0,
                  max_marks: subjectInfo.maxMarks || 100,
                });
              }
            }

            if (missingSubjects.length > 0 && curriculumKey && semesterKey) {
              await addOrUpdateCurriculum(curriculumKey, department, semesterKey, missingSubjects);
              missingSubjects.forEach((subject) => {
                subjectMaxMarks[subject.subject_code] = {
                  maxMarks: subject.max_marks,
                  credits: subject.credits,
                };
              });
            }

            await saveStudentResultAdmin(studentData, subjectMaxMarks, { ...meta, courseType: rollCourseType } as any, currentBatch);
            
            rollStatus[rollNo] = 'success';
            operationsInBatch += 2; 
            successfullyUploaded++;
            success = true;
          } else {
            // Skip only completely empty rows safely, do not retry
            rollStatus[rollNo] = 'error';
            skipped++;
            success = true;
          }
        } catch (err) {
          if (attempt >= MAX_ATTEMPTS) {
            rollStatus[rollNo] = 'error';
            failed++;
            console.error(`Failed permanently for student ${rollNo}:`, err);
          } else {
            await new Promise(resolve => setTimeout(resolve, 1000)); // small delay before retry
          }
        }
      }

      // Sequential batch commits: Wait for each batch to complete before starting the next
      if (operationsInBatch >= 400) {
        try {
          await currentBatch.commit();
          console.log(`[Bulk Scrape] Committed sequential batch of ${operationsInBatch} operations.`);
        } catch (batchErr) {
          console.error(`[Bulk Scrape] Batch commit failed:`, batchErr);
        }
        currentBatch = adminDb.batch();
        operationsInBatch = 0;
      }
    }

    // Commit any remaining operations in the final batch
    if (operationsInBatch > 0) {
      try {
        await currentBatch.commit();
        console.log(`[Bulk Scrape] Committed final batch of ${operationsInBatch} operations.`);
      } catch (batchErr) {
        console.error(`[Bulk Scrape] Final batch commit failed:`, batchErr);
      }
    }

    console.log(`\n=== Upload Summary ===`);
    console.log(`Total Parsed: ${rollNumbers.length}`);
    console.log(`Uploaded Successfully: ${successfullyUploaded}`);
    console.log(`Failed: ${failed}`);
    console.log(`Skipped Empty Rows: ${skipped}`);
    console.log(`======================\n`);

    if (sendEvent) {
      sendEvent('progress', {
        total: rollNumbers.length,
        currentRoll: 'Done',
        uploaded: successfullyUploaded,
        failed,
        skipped
      });
    }

    return {
      totalParsed: rollNumbers.length,
      uploadedSuccessfully: successfullyUploaded,
      failed,
      skippedEmptyRows: skipped
    };

  } catch (error: unknown) {
    console.error('Bulk scrape error:', error);
    throw error;
  }
}

async function saveStudentResultAdmin(
  studentData: StudentData, 
  subjectMaxMarks: Record<string, { maxMarks: number, credits: number }> = {},
  meta?: { courseType: string; batch: string; semester: string; scrapeType: string },
  batch?: FirebaseFirestore.WriteBatch
): Promise<void> {
  if (!adminDb) {
    throw new Error('Admin DB not initialized');
  }
  
  const normalizedRoll = (studentData.roll || '').trim().toUpperCase();
  studentData.roll = normalizedRoll;


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



    let semTotalMarks = 0;
    let semTotalMaxMarks = 0;
    let totalCredits = 0;
    let weightedGradePoints = 0;

    for (const subCode in updatedSemesterSubjects) {
      if (Object.prototype.hasOwnProperty.call(updatedSemesterSubjects, subCode)) {
        if (updatedResults[subCode]) {
          updatedResults[subCode].semester = semKey;
        }
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
      subjectCodes: Object.keys(updatedSemesterSubjects),
      uploadDate: new Date().toISOString()
    };
    // Cleanup old subjects map if present to free space
    if ('subjects' in newSemesterResult) {
      delete newSemesterResult.subjects;
    }

    const updatePayload = {
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
    };

    if (batch) {
      batch.update(studentRef, updatePayload);
    } else {
      await studentRef.update(updatePayload);
    }

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
      subjectCodes: Object.keys(studentData.subjectResults),
      uploadDate: new Date().toISOString()
    };

    // Add semester tag to all subjects
    for (const subCode in studentData.subjectResults) {
      studentData.subjectResults[subCode].semester = semKey;
    }

    const setPayload = {
      ...studentData,
      semesterResults: {
        [semKey]: newSemesterResult
      },
      resultType: studentData.resultType,
      lastUpdated: new Date().toISOString()
    };

    if (batch) {
      batch.set(studentRef, setPayload);
    } else {
      await studentRef.set(setPayload);
    }
  }

  // Invalidate precomputed CGPA
  try {
    const cgpaRef = adminDb.collection('cgpa').doc(studentData.roll);
    if (batch) {
      batch.delete(cgpaRef);
    } else {
      await cgpaRef.delete();
    }
  } catch {
    // ignore
  }
}