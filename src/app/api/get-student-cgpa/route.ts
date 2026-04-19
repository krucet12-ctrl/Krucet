import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getRegulationForRollNumber, parseRollNumber } from '../../../lib/firebaseService';
import { StudentData } from '../../../lib/types';
import { getGradePoint, isSubjectPassed } from '../../../lib/gradingUtils';
import { safeTrim } from '@/lib/utils';

// ── Module-level cache (survives across requests in the same server process) ──
const curriculumCache: Record<string, { data: any[], timestamp: number }> = {};
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

interface CurriculumEntry {
  code: string;
  credits: number;
  maxMarks: number;
  semKey: string;
}

/**
 * Fetch all semester curriculum docs in parallel and return a flat map
 * keyed by normalized (UPPER) subject code.
 */
async function buildCurriculumMap(
  courseType: string,
  regulation: string,
  department: string
): Promise<Map<string, CurriculumEntry>> {
  const map = new Map<string, CurriculumEntry>();
  if (!regulation || !department) return map;

  const regKey  = `${courseType}_${regulation.toUpperCase()}`;
  const deptKey = department.toUpperCase();
  const semKeys = Array.from({ length: 8 }, (_, i) => `SEM${i + 1}`);

  await Promise.all(
    semKeys.map(async (semKey) => {
      const cacheKey = `${regKey}-${deptKey}-${semKey}`;

      if (!curriculumCache[cacheKey] || Date.now() - curriculumCache[cacheKey].timestamp > CACHE_TTL) {
        const curRef = doc(db, 'curriculum', regKey, deptKey, semKey);
        const snap = await getDoc(curRef);
        curriculumCache[cacheKey] = {
          data: snap.exists() ? (snap.data()?.Subjects || []) : [],
          timestamp: Date.now(),
        };
      }

      const subjects: any[] = curriculumCache[cacheKey].data;
      subjects.forEach((s: any) => {
        const rawCode = (s.code || s.subjectCode || s.subject_code || '').toString().trim().toUpperCase();
        if (!rawCode) return;

        // Resolve maxMarks — support all common field name variants
        const rawMax = s.maxMarks ?? s.max_marks ?? s.MaxMarks ?? null;
        const maxMarks = rawMax !== null && Number(rawMax) > 0 ? Number(rawMax) : null;

        if (maxMarks === null) {
          console.warn(`⚠️  maxMarks missing for "${rawCode}" in ${regKey}/${deptKey}/${semKey}. Defaulting to 100.`);
        }

        map.set(rawCode, {
          code:     rawCode,
          credits:  Number(s.Credit || s.credits || 0),
          maxMarks: maxMarks ?? 100,
          semKey,
        });
      });
    })
  );

  return map;
}

export async function POST(req: NextRequest) {
  try {
    const { rollNo: rawRoll } = await req.json();
    if (!rawRoll) return NextResponse.json({ error: 'Missing rollNo' }, { status: 400 });

    const rollNo = safeTrim(rawRoll).toUpperCase();

    console.log('🔍 FETCHING CGPA (Flat Architecture)');
    console.log('Roll Number:', rollNo);

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
    const { batch, branch: department } = parseRollNumber(rollNo);
    const regulation  = await getRegulationForRollNumber(rollNo);
    const courseType  = (student as any).courseType || 'BTech';

    console.log(`📍 CGPA: Roll=${rollNo}, Batch=${batch}, Dept=${department}, Reg=${regulation}, Course=${courseType}`);

    // 3. Build curriculum map ONCE — O(1) lookups for every subject
    const curriculumMap = await buildCurriculumMap(courseType, regulation || '', department);

    if (curriculumMap.size === 0) {
      console.warn(`⚠️  Curriculum map empty for ${courseType}_${regulation}/${department}. maxMarks will default to 100.`);
    }

    // 4. Map subject results → semester buckets
    const resultsData: Record<string, any> = {};

    for (const [subCode, subInfo] of Object.entries(subjectResults) as any[]) {
      const normalizedCode = subCode.trim().toUpperCase();
      const cur = curriculumMap.get(normalizedCode);

      if (!cur) {
        console.warn(`⚠️  Subject "${normalizedCode}" not found in curriculum map.`);
      }

      const semKey   = cur?.semKey   ?? 'Unknown';
      const credits  = cur?.credits  ?? 0;
      const maxMarks = cur?.maxMarks ?? 100;

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