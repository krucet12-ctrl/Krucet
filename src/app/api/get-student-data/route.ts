import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getRegulationForRollNumber, parseRollNumber } from '../../../lib/firebaseService';
import { getGradePoint, getGrade, isSubjectPassed } from '../../../lib/gradingUtils';
import { safeTrim } from '@/lib/utils';

export const dynamic = 'force-dynamic';

// ── Module-level cache (survives across requests in the same server process) ──
const curriculumCache: Record<string, { data: CurriculumEntry[], timestamp: number }> = {};
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

interface CurriculumEntry {
  /** Normalized (UPPER) subject code */
  code: string;
  credits: number;
  maxMarks: number;
  subjectName: string;
  order: number;
  semKey: string;
}

/**
 * Fetch all semester curriculum docs for a given regulation/department in parallel,
 * then build a flat map: normalizedSubjectCode → CurriculumEntry.
 * Results are cached at module level to avoid redundant fetches across requests.
 */
async function buildCurriculumMap(
  courseType: string,
  regulation: string,
  department: string
): Promise<Map<string, CurriculumEntry>> {
  const map = new Map<string, CurriculumEntry>();
  if (!regulation || !department) return map;

  const regKey = `${courseType}_${regulation.toUpperCase()}`;
  const deptKey = department.toUpperCase();

  // Fetch semesters in parallel (BTech: 8, MTech: 4)
  const numSems = courseType === 'MTech' ? 4 : 8;
  const semKeys = Array.from({ length: numSems }, (_, i) => `SEM${i + 1}`);

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
      subjects.forEach((s: any, idx: number) => {
        const rawCode = (s.code || s.subjectCode || s.subject_code || '').toString().trim().toUpperCase();
        if (!rawCode) return;

        const rawMax = s.maxMarks ?? s.max_marks ?? s.MaxMarks ?? null;
        const maxMarks = rawMax !== null && Number(rawMax) > 0 ? Number(rawMax) : null;
        const orderValue = Number(s.order ?? s.Order ?? (idx + 1));

        map.set(rawCode, {
          code: rawCode,
          credits: Number(s.Credit || s.credits || 0),
          maxMarks: maxMarks ?? 100,
          subjectName: s.subjectName || s.name || s.description || '',
          order: Number.isNaN(orderValue) ? idx + 1 : orderValue,
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

    // 2. Fetch student document
    const studentRef = doc(db, 'students', rollNo);
    const studentSnap = await getDoc(studentRef);

    if (!studentSnap.exists()) {
      return NextResponse.json({ error: 'No results found for this roll number.' }, { status: 404 });
    }

    const studentData = studentSnap.data();
    const subjectResults = studentData.subjectResults || {};

    // 3. Resolve regulation & department
    const { batch, branch: department } = parseRollNumber(rollNo);
    const regulation = await getRegulationForRollNumber(rollNo);
    const courseType: string = studentData.courseType || 'BTech';

    const curriculumMap = await buildCurriculumMap(courseType, regulation || '', department);

    // 5. Map subject results → semester buckets
    const resultsData: Record<string, any> = {};

    for (const [subCode, subInfo] of Object.entries(subjectResults) as any[]) {
      const normalizedCode = subCode.trim().toUpperCase();
      const cur = curriculumMap.get(normalizedCode);

      if (!cur) {
        // Subject not in curriculum — use defaults
      }

      const semKey  = cur?.semKey      ?? 'Unknown';
      const credits = cur?.credits     ?? 0;
      const maxMarks = cur?.maxMarks   ?? 100;
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
