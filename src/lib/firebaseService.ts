import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  orderBy,
  updateDoc,
  addDoc,
  serverTimestamp,
  writeBatch,
  enableNetwork,
  disableNetwork,
  deleteDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  StudentData,
  SubjectResult,
  SemesterSubjects,
  ParsedResult,
  YearToRegulationMap,
  CurriculumSubject
} from './types';
import { getGrade, isSubjectPassed } from './gradingUtils';

// Retry mechanism for Firestore operations
const retryOperation = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 2,
  delay: number = 500
): Promise<T> => {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries) {
        // Check if it's a connection issue
        if (error instanceof Error && (
          error.message.includes('INTERNAL ASSERTION') ||
          error.message.includes('network') ||
          error.message.includes('CANCELLED')
        )) {
          try {
            await disableNetwork(db);
            await new Promise(resolve => setTimeout(resolve, delay));
            await enableNetwork(db);
          } catch (reconnectError) {
            console.error('Failed to reconnect:', reconnectError);
          }
        }

        // Wait before retrying (shorter delay)
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
};

// Check Firestore connection
export const checkFirestoreConnection = async (): Promise<boolean> => {
  try {
    // Try to enable network connection
    await enableNetwork(db);

    // Test connection with a simple operation
    const testRef = doc(db, '_test_connection', 'test');
    await setDoc(testRef, { timestamp: new Date().toISOString() }, { merge: true });
    await getDoc(testRef);

    return true;
  } catch (error) {
    console.error('Firestore connection error:', error);

    // Provide more specific error information
    if (error instanceof Error) {
      if (error.message.includes('permission')) {
        console.error('Firestore permission denied - check security rules');
      } else if (error.message.includes('network')) {
        console.error('Firestore network error - check internet connection');
      } else if (error.message.includes('project')) {
        console.error('Firestore project not found - check project ID');
      } else if (error.message.includes('INTERNAL ASSERTION')) {
        console.error('Firestore internal assertion - attempting to reconnect');
        // Try to reconnect
        try {
          await disableNetwork(db);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
          await enableNetwork(db);
          return true;
        } catch (reconnectError) {
          console.error('Failed to reconnect to Firestore:', reconnectError);
          return false;
        }
      } else {
        console.error('Unknown Firestore error:', error.message);
      }
    }

    return false;
  }
};

export const normalizeSubjectCode = (code: string): string => {
  return (code || '').toString().trim().toUpperCase();
};

export const computeResultFromMarks = (intMarksRaw: any, extMarksRaw: any, maxMarks: number) => {
  const intMarks = Number(intMarksRaw) || 0;
  const extMarks = Number(extMarksRaw) || 0;
  const total = intMarks + extMarks;
  const passed = isSubjectPassed(intMarks, extMarks, total, maxMarks);
  const grade = getGrade(total, passed, maxMarks);
  const status: 'PASS' | 'FAIL' = passed ? 'PASS' : 'FAIL';

  return {
    intMarks,
    extMarks,
    total,
    maxMarks,
    pass: passed,
    grade,
    status
  };
};

export const getCurriculumMaxMarks = async (
  courseType: string,
  regulation: string,
  department: string,
  semester: string
): Promise<Record<string, { maxMarks: number, credits: number }>> => {
  const result: Record<string, { maxMarks: number, credits: number }> = {};
  try {
    if (!courseType || !regulation || !department || !semester) {
      return result;
    }

    const docName = `${courseType}_${regulation.toUpperCase()}`;
    const branchName = department.toUpperCase();
    const semName = semester.toUpperCase();
    const builtPath = `curriculum/${docName}/${branchName}/${semName}`;
    
    const curDoc = doc(db, 'curriculum', docName, branchName, semName);
    const curSnap = await getDoc(curDoc);

    if (curSnap.exists()) {
      let subjects = curSnap.data().Subjects || curSnap.data().subjects || [];
      if (!Array.isArray(subjects)) {
        subjects = Object.values(curSnap.data() || {});
      }
      
      for (const subject of subjects) {
        if (!subject) continue;
        const code = normalizeSubjectCode(subject.code || subject.subjectCode || subject.subject_code);
        if (!code) continue;
        
        // Exact matching logic as requested by user
        const matchedSubject = subjects.find((s: any) => 
          normalizeSubjectCode(s.code || s.subjectCode || s.subject_code) === code
        );

        const targetData = matchedSubject || subject;
        const maxMarks = Number(targetData.maxMarks || targetData.max_marks || targetData.maxmarks || 100);
        const credits = Number(targetData.credit || targetData.credits || 0);
        result[code] = {
          maxMarks: Number.isNaN(maxMarks) ? 100 : maxMarks,
          credits: Number.isNaN(credits) ? 0 : credits
        };
      }
      // No curriculum document found
    }
  } catch (error) {
    console.error('Error getting curriculum max marks:', error);
  }

  return result;
};

// Student Operations

export const saveStudentResult = async (
  studentData: StudentData,
  subjectMaxMarks: Record<string, { maxMarks: number, credits: number }> = {},
  meta?: { courseType: string; batch: string; semester: string; scrapeType: string }
): Promise<void> => {
  return retryOperation(async () => {
    const studentRef = doc(db, 'students', studentData.roll);
    const studentSnap = await getDoc(studentRef);

    if (studentSnap.exists()) {
      const existingData = studentSnap.data() as StudentData;
      const semesterKey = `semesterResults.sem${meta?.semester}`;
      const semesterData = existingData.semesterResults?.[semesterKey] || { subjects: {} };

      const updatedSubjects = { ...semesterData.subjects };
      const newResults = studentData.subjectResults;

      for (const subCode in newResults) {
        if (Object.prototype.hasOwnProperty.call(newResults, subCode)) {
          const newSub = newResults[subCode];
          const existingSub = updatedSubjects[subCode];

          const subjectData = subjectMaxMarks[normalizeSubjectCode(subCode)] || { maxMarks: 100, credits: 0 };
          const maxMarks = subjectData.maxMarks;

          const computed = computeResultFromMarks(newSub.intMarks, newSub.extMarks, maxMarks);

          if (existingSub) {
            updatedSubjects[subCode] = {
              ...existingSub,
              ...computed,
              subjectName: newSub.subjectName || existingSub.subjectName,
              attempts: (existingSub.attempts || 1) + 1,
            };
          } else {
            updatedSubjects[subCode] = {
              ...newSub,
              ...computed,
              attempts: 1,
            };
          }
        }
      }

      // Recalculate SGPA
      let totalCredits = 0;
      let weightedGradePoints = 0;
      for (const subCode in updatedSubjects) {
        const subject = updatedSubjects[subCode];
        const credits = subjectMaxMarks[normalizeSubjectCode(subCode)]?.credits || 0;
        totalCredits += credits;
        const gradePoints = parseFloat(subject.grade) || 0; // Ensure grade is a number
        weightedGradePoints += credits * gradePoints;
      }
      const SGPA = totalCredits > 0 ? weightedGradePoints / totalCredits : 0;

      // Update Firestore
      await updateDoc(studentRef, {
        [`semesterResults.sem${meta?.semester}`]: {
          ...semesterData,
          subjects: updatedSubjects,
          SGPA,
          lastUpdated: new Date().toISOString(),
        },
      });
    } else {
      // Document doesn't exist, create it.
      
      let totalMarks = 0;
      let totalMaxMarks = 0;
      for (const subCode in studentData.subjectResults) {
        if (Object.prototype.hasOwnProperty.call(studentData.subjectResults, subCode)) {
          const sub = studentData.subjectResults[subCode];
          totalMarks += sub.total || 0;
          totalMaxMarks += sub.maxMarks || subjectMaxMarks[normalizeSubjectCode(subCode)]?.maxMarks || 100;
        }
      }
      
      const resultKey = studentData.resultType || 'Unknown_Result';
      const newSemesterResult = {
        semester: meta?.semester || '',
        scrapeType: meta?.scrapeType || '',
        marks: totalMarks,
        maxMarks: totalMaxMarks,
        SGPA: 0,
        subjects: studentData.subjectResults,
        uploadDate: new Date().toISOString()
      };

      await setDoc(studentRef, {
        ...studentData,
        semesterResults: {
          [resultKey]: newSemesterResult
        },
        resultType: studentData.resultType,
        lastUpdated: new Date().toISOString()
      });
    }

    // Invalidate precomputed CGPA document to force precise recalculation on next read
    try {
      await deleteDoc(doc(db, 'cgpa', studentData.roll));
    } catch (e) {
      // ignore
    }

  });
};

export const getStudentResult = async (rollNo: string): Promise<StudentData | null> => {
  try {
    const isConnected = await checkFirestoreConnection();
    if (!isConnected) {
      throw new Error('Firestore connection failed');
    }

    const studentRef = doc(db, 'students', rollNo);
    const studentSnap = await getDoc(studentRef);

    if (studentSnap.exists()) {
      return studentSnap.data() as StudentData;
    }
    return null;
  } catch (error) {
    console.error('Error getting student result:', error);
    throw error;
  }
};

export const getStudentsByBatch = async (batch: string): Promise<StudentData[]> => {
  try {
    const isConnected = await checkFirestoreConnection();
    if (!isConnected) {
      throw new Error('Firestore connection failed');
    }

    const studentsRef = collection(db, 'students');
    const q = query(studentsRef, where('batch', '==', batch));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(doc => doc.data() as StudentData);
  } catch (error) {
    console.error('Error getting students by batch:', error);
    throw error;
  }
};

// Subject Operations
export const saveSemesterSubjects = async (
  batch: string,
  branch: string,
  sem: number,
  subjects: SemesterSubjects
): Promise<void> => {
  try {
    const isConnected = await checkFirestoreConnection();
    if (!isConnected) {
      throw new Error('Firestore connection failed');
    }

    const subjectsRef = doc(db, 'subjects', batch, branch, sem.toString());
    await setDoc(subjectsRef, subjects);
  } catch (error) {
    console.error('Error saving semester subjects:', error);
    throw error;
  }
};

export const getSemesterSubjects = async (
  batch: string,
  branch: string,
  sem: number
): Promise<SemesterSubjects | null> => {
  try {
    const isConnected = await checkFirestoreConnection();
    if (!isConnected) {
      throw new Error('Firestore connection failed');
    }

    const subjectsRef = doc(db, 'subjects', batch, branch, sem.toString());
    const subjectsSnap = await getDoc(subjectsRef);

    if (subjectsSnap.exists()) {
      return subjectsSnap.data() as SemesterSubjects;
    }
    return null;
  } catch (error) {
    console.error('Error getting semester subjects:', error);
    throw error;
  }
};


// Utility Functions
export const parseRollNumber = (rollNo: string): { batch: string; branch: string; college: string; number: string; courseType: string } => {
  // Example: Y22CSE279063 -> batch: Y22, branch: CSE, college: 279, number: 063
  // Updated to handle variable-length numeric portion
  const match = rollNo.match(/^([YL]\d{2})([A-Z]{2,6})(\d+)$/i);
  if (!match) {
    throw new Error(`Invalid roll number format: ${rollNo}`);
  }

  const numericPart = match[3];
  // If numeric part is 6 digits or more, split into college (first 3) and number (rest)
  // Otherwise, treat entire numeric part as the number
  const college = numericPart.length >= 6 ? numericPart.substring(0, 3) : '';
  const number = numericPart.length >= 6 ? numericPart.substring(3) : numericPart;

  const batch = match[1].toUpperCase();
  const branch = match[2].toUpperCase();
  const rollUpper = rollNo.toUpperCase();

  let courseType = 'BTech';
  if (rollUpper.includes('MTH')) {
    courseType = 'MTech';
  } else if (rollUpper.includes('CSE') || rollUpper.includes('ECE') || rollUpper.includes('AIML')) {
    courseType = 'BTech';
  }

  return {
    batch,
    branch,
    college,
    number,
    courseType
  };
};

// Deleted deprecated static calculateGrade functions

export const convertParsedResultToStudentData = (
  parsedResult: ParsedResult,
  resultType?: string,
  subjectMaxMarks: Record<string, { maxMarks: number, credits: number }> = {}
): Omit<StudentData, 'subjectResults'> & { subjectResults: Record<string, SubjectResult> } => {
  const { batch, branch, college, number } = parseRollNumber(parsedResult.studentInfo.rollNo);

  const subjectResults: Record<string, SubjectResult> = {};

    parsedResult.subjects.forEach(subject => {
      const code = normalizeSubjectCode(subject.subCode);
      if (!code) return;

      const subjectData = subjectMaxMarks[normalizeSubjectCode(code)] || { maxMarks: 100, credits: 0 };
      const maxMarks = subjectData.maxMarks;
      const credits = subjectData.credits;

      const computed = computeResultFromMarks(subject.intMarks, subject.extMarks, maxMarks);

      subjectResults[code] = {
        subjectName: subject.subjectName || '',
        ...computed,
        attempts: 1, // Initialize attempts to 1 for a new scrape
        credits
      };
    });

  const studentData = {
    roll: parsedResult.studentInfo.rollNo,
    name: parsedResult.studentInfo.name,
    batch,
    branch,
    college,
    number,
    subjectResults,
    resultType, // Include the resultType
    lastUpdated: new Date().toISOString()
  };

  return studentData;
};

// Curriculum insertion and query utilities
export async function getSubjectInfoFromCurriculum(regulation: string, branch: string, subjectCode: string): Promise<{ semester: string, credit: number, code: string } | null> {
  const curriculumDocRef = doc(db, 'curriculum', regulation, branch);
  const semestersCollectionRef = collection(curriculumDocRef, 'semesters');

  const querySnapshot = await getDocs(semestersCollectionRef);

  for (const semesterDoc of querySnapshot.docs) {
    const semesterData = semesterDoc.data();
    if (semesterData.subjects && semesterData.subjects[subjectCode]) {
      return {
        semester: semesterDoc.id,
        credit: semesterData.subjects[subjectCode].Credit,
        code: subjectCode
      };
    }
  }
  return null;
}

// Year-to-Regulation Mapping Utilities

// Get the year-to-regulation mapping document
export async function getYearToRegulationMap(courseType: string = 'BTech'): Promise<YearToRegulationMap | null> {
  const docRef = doc(db, 'yearToRegulation', courseType);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data() as YearToRegulationMap;
  }
  return null;
}

// Get regulation for a roll number using year-to-regulation mapping
export async function getRegulationForRollNumber(rollNo: string, courseType: string = 'BTech'): Promise<string | null> {
  const { batch } = parseRollNumber(rollNo);
  const yearToRegMap = await getYearToRegulationMap(courseType);

  if (yearToRegMap && yearToRegMap[batch]) {
    return yearToRegMap[batch];
  }

  return null;
}

// Result URL Storage
export const saveResultUrl = async (
  resultType: string,
  rsurl: string,
  metadata: {
    rollNumber: string;
    studentName: string;
    timestamp: string;
    resultType: string;
  }
): Promise<void> => {
  return retryOperation(async () => {
    const isConnected = await checkFirestoreConnection();
    if (!isConnected) {
      throw new Error('Firestore connection failed');
    }

    // Create a unique document ID by combining resultType and rsurl
    const documentId = `${resultType}_${rsurl.replace(/[\/\\]/g, '_').replace(/[^a-zA-Z0-9_-]/g, '_')}`;

    // Store in format: resultUrls/{documentId}
    const resultUrlRef = doc(db, 'resultUrls', documentId);
    await setDoc(resultUrlRef, {
      ...metadata,
      resultType,
      rsurl,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true }); // Use merge to handle duplicates gracefully
  });
};

// Simple version without retry for bulk operations
export const saveResultUrlSimple = async (
  resultType: string,
  rsurl: string,
  metadata: {
    rollNumber: string;
    studentName: string;
    timestamp: string;
    resultType: string;
  }
): Promise<void> => {
  // Create a unique document ID by combining resultType and rsurl
  const documentId = `${resultType}_${rsurl.replace(/[\/\\]/g, '_').replace(/[^a-zA-Z0-9_-]/g, '_')}`;

  // Store in format: resultUrls/{documentId}
  const resultUrlRef = doc(db, 'resultUrls', documentId);
  await setDoc(resultUrlRef, {
    ...metadata,
    resultType,
    rsurl,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true }); // Use merge to handle duplicates gracefully
};

// Get result URLs by result type
export const getResultUrlsByType = async (resultType: string): Promise<unknown[]> => {
  try {
    const isConnected = await checkFirestoreConnection();
    if (!isConnected) {
      throw new Error('Firestore connection failed');
    }

    const resultUrlsRef = collection(db, 'resultUrls');
    const q = query(resultUrlsRef, where('resultType', '==', resultType));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting result URLs by type:', error);
    throw error;
  }
};

// Check if a result URL already exists
export const checkResultUrlExists = async (resultType: string, rsurl: string): Promise<boolean> => {
  try {
    const isConnected = await checkFirestoreConnection();
    if (!isConnected) {
      throw new Error('Firestore connection failed');
    }

    const documentId = `${resultType}_${rsurl.replace(/[\/\\]/g, '_').replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const resultUrlRef = doc(db, 'resultUrls', documentId);
    const docSnap = await getDoc(resultUrlRef);

    return docSnap.exists();
  } catch (error) {
    console.error('Error checking if result URL exists:', error);
    throw error;
  }
};

// Connection health check - call this periodically to maintain connection
export const performConnectionHealthCheck = async (): Promise<boolean> => {
  try {
    // Simple connection test without writing data
    const testRef = doc(db, '_health_check', 'status');
    await getDoc(testRef);

    return true;
  } catch (error) {
    console.error('Firestore connection health check failed:', error);

    // Try to reconnect only if it's a connection issue
    if (error instanceof Error && (
      error.message.includes('INTERNAL ASSERTION') ||
      error.message.includes('network') ||
      error.message.includes('CANCELLED')
    )) {
      try {
        await disableNetwork(db);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Reduced wait time
        await enableNetwork(db);
        return true;
      } catch (reconnectError) {
        console.error('Failed to reconnect to Firestore:', reconnectError);
        return false;
      }
    }

    return false;
  }
};

export const addOrUpdateCurriculum = async (
  regulation: string,
  branch: string,
  semester: string,
  subjects: CurriculumSubject[]
): Promise<void> => {
  // Use explicit 5-segment pattern requested by user
  const curriculumRef = doc(db, 'curriculum', regulation, branch, semester, semester);
  const docSnap = await getDoc(curriculumRef);
  let existingSubjects: CurriculumSubject[] = [];

  if (docSnap.exists()) {
    existingSubjects = docSnap.data().Subjects || [];
  }

  const updatedSubjects = [...existingSubjects];
  const existingSubjectCodes = new Set(existingSubjects.map((s: CurriculumSubject) => s.subject_code));

  subjects.forEach((newSubject: CurriculumSubject) => {
    if (!existingSubjectCodes.has(newSubject.subject_code)) {
      updatedSubjects.push(newSubject);
      existingSubjectCodes.add(newSubject.subject_code);
    }
  });

  const curriculumData = { Subjects: updatedSubjects };
  await setDoc(curriculumRef, curriculumData, { merge: true });

  // Update branch metadata for easy querying
  const metadataRef = doc(db, 'curriculum', regulation, '_metadata', 'branches');
  const metadataSnap = await getDoc(metadataRef);

  let branchesList: string[] = [];
  if (metadataSnap.exists()) {
    branchesList = metadataSnap.data().list || [];
  }

  if (!branchesList.includes(branch)) {
    branchesList.push(branch);
    await setDoc(metadataRef, { list: branchesList }, { merge: true });
  }
};

// Fetch all classes and organize by courseType → batch → branch
// Supports new path: classes/{courseType}/{batch}/{branch}
// Also falls back to legacy path: classes/{batch}/{branch}
export const getAllClassBatchBranchInfo = async () => {
  const result: Record<string, Record<string, Record<string, { regularRollNos: string[]; lateralRollNos: string[] }>>> = {};

  // ── New structure: classes/{courseType}/batches/{batch}/departments/{branch} ──
  const courseTypes = ["BTech", "MTech"];
  for (const ct of courseTypes) {
    const batchesCollRef = collection(db, "classes", ct, "batches");
    const batchSnap = await getDocs(batchesCollRef);

    if (!batchSnap.empty) {
      if (!result[ct]) result[ct] = {};

      for (const batchDoc of batchSnap.docs) {
        const batchId = batchDoc.id;
        if (!result[ct][batchId]) result[ct][batchId] = {};

        const departmentsCollRef = collection(db, "classes", ct, "batches", batchId, "departments");
        const branchSnap = await getDocs(departmentsCollRef);

        for (const branchDoc of branchSnap.docs) {
          const branchId = branchDoc.id;
          if (branchId.startsWith("_")) continue;

          // Note: In the new structure, roll numbers are stored in a 'students' sub-collection.
          // For now, we attempt to get summary arrays if they exist on the department doc.
          const data = branchDoc.data() as { regularRollNos?: string[]; lateralRollNos?: string[] };
          
          // If the arrays are empty, we might need to fetch from the 'students' sub-collection.
          let regulars = data.regularRollNos || [];
          let laterals = data.lateralRollNos || [];

          if (regulars.length === 0 && laterals.length === 0) {
            const studentsSnap = await getDocs(collection(db, "classes", ct, "batches", batchId, "departments", branchId, "students"));
            const allRolls = studentsSnap.docs.map(d => d.id).sort();
            
            // Basic detection for regular/lateral
            const lateralPrefix = `L${(parseInt(batchId.slice(1)) + 1)}`;
            regulars = allRolls.filter(r => r.startsWith(batchId.toUpperCase()));
            laterals = allRolls.filter(r => r.startsWith(lateralPrefix));
          }

          result[ct][batchId][branchId] = {
            regularRollNos: regulars,
            lateralRollNos: laterals,
          };
        }
      }
    }
  }

  // Note: Legacy fallback removed or redirected as it was causing segment errors
  // If needed, implement a query on the root 'classes' collection with filters.

  return result;
};