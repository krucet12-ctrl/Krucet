import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

export interface CurriculumEntry {
  code: string;
  credits: number;
  maxMarks: number;
  subjectName?: string;
  order?: number;
  semKey: string;
}

// ── Module-level cache (survives across requests in the same server process) ──
const curriculumCache: Record<string, { data: any[], timestamp: number }> = {};
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * Fetch all semester curriculum docs for a given regulation/department in parallel,
 * then build a flat map: normalizedSubjectCode → CurriculumEntry.
 * Results are cached at module level to avoid redundant fetches across requests.
 */
export async function buildCurriculumMap(
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
        
        try {
          const snap = await getDoc(curRef);
          let subjectInfo: any[] = [];
          
          if (snap.exists()) {
            const data = snap.data();
            if (data.Subjects && Array.isArray(data.Subjects)) {
              subjectInfo = data.Subjects;
            } else if (data.subjects && Array.isArray(data.subjects)) {
              subjectInfo = data.subjects;
            } else {
              // Document might be a map of: subjectCode -> { credits, maxMarks, ... }
              for (const [key, val] of Object.entries(data)) {
                if (val && typeof val === 'object') {
                  subjectInfo.push({
                    ...(val as any),
                    code: (val as any).code || (val as any).subjectCode || key
                  });
                }
              }
            }
          }
          
          curriculumCache[cacheKey] = {
            data: subjectInfo,
            timestamp: Date.now(),
          };
        } catch (error) {
          // If a document doesn't exist or errors, cache an empty array to avoid retries
          curriculumCache[cacheKey] = {
            data: [],
            timestamp: Date.now(),
          };
        }
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
          credits: Number(s.credit || s.Credit || s.credits || 0),
          maxMarks: maxMarks ?? 100,
          subjectName: s.subjectName || s.name || s.description || '',
          order: Number.isNaN(orderValue) ? idx + 1 : orderValue,
          semKey: semKey.trim().toUpperCase(),
        });
      });
    })
  );

  return map;
}
