import { NextRequest, NextResponse } from 'next/server';
import { 
  convertParsedResultToStudentData, 
  saveStudentResult,
  saveResultUrl,
  parseRollNumber,
  getRegulationForRollNumber,
  getCurriculumMaxMarks
} from '../../../lib/firebaseService';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, serverTimestamp, query, where } from 'firebase/firestore';
import { parseResultHTML } from '../../../lib/utils';

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
      };
    }

    const { startRoll, endRoll, rsurl, resultType } = body;
    
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
        await performBulkScrape("", startRoll, endRoll, rsurl, resultType);
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
  resultType: string
) {
  const rollStatus: Record<string, 'pending' | 'success' | 'error'> = {};

  // Determine curriculum context once
  const courseType = (resultType || '').split('-')[0] || 'BTech';
  const semMatch = (resultType || '').match(/-Sem(\d+)/i);
  const semesterKey = semMatch ? `SEM${semMatch[1]}` : 'SEM1';

  const { branch: department } = parseRollNumber(startRoll);

  const regulation = await getRegulationForRollNumber(startRoll);
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
            const studentData = convertParsedResultToStudentData(parsedResult, resultType, subjectMaxMarks);
            await saveStudentResult(studentData, subjectMaxMarks);
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

    // Save result metadata to "results" collection once after all processing
    try {
      const parts = resultType.split('-');
      const batch = parts[1] || '';
      const semMatch = resultType.match(/Sem(\d+)/i);
      const semester = semMatch ? `Sem${semMatch[1]}` : 'Sem1';
      
      let resultTypeValue = 'regular';
      if (resultType.toLowerCase().includes('rvresults')) {
        resultTypeValue = 'revaluation';
      } else if (resultType.toLowerCase().includes('supplyresults')) {
        resultTypeValue = 'supply';
      }

      const existingQuery = query(
        collection(db, 'results'),
        where('batch', '==', batch),
        where('semester', '==', semester),
        where('resultType', '==', resultTypeValue)
      );
      const existingSnap = await getDocs(existingQuery);
      
      if (existingSnap.empty) {
        await addDoc(collection(db, 'results'), {
          courseType,
          batch,
          semester,
          resultType: resultTypeValue,
          rsurl: `${courseType}${semester}${resultTypeValue}-${batch}`,
          createdAt: serverTimestamp()
        });
      }
    } catch (err) {
      console.warn('Failed to save result metadata:', err);
    }

  } catch (error: unknown) {
    console.error('Bulk scrape error:', error);
    throw error;
  }
}