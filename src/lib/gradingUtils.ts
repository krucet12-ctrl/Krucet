// Standalone utility — no external imports to avoid HMR chain invalidation
const safeTrim = (value: unknown): string => (value || '').toString().trim();
// Dynamic grading criteria based on maxMarks

/**
 * Validates the format of a roll number.
 * Expected format: Y22CSE279001 (e.g., Y(batch) + Branch + College + Number)
 * 
 * @param rollNo The roll number to validate
 * @returns Object containing isValid boolean and optional error message
 */
export const validateRollNumberFormat = (rollNo: string): { isValid: boolean; error?: string } => {
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

/**
 * Returns the percentage for a subject.
 * percentage = (obtainedMarks / maxMarks) * 100
 *
 * @param obtainedMarks Marks obtained by the student
 * @param maxMarks Maximum marks for the subject (defaults to 100)
 * @returns Percentage (0–100)
 */
export const getSubjectPercentage = (obtainedMarks: number, maxMarks: number = 100): number => {
  if (!maxMarks || maxMarks <= 0) return 0;
  return (obtainedMarks / maxMarks) * 100;
};

/**
 * Calculates grade points based on percentage (obtainedMarks / maxMarks * 100).
 * Works correctly for any maxMarks value (50, 75, 100, 200, …).
 *
 * @param totalMarks The total marks obtained
 * @param maxMarks The maximum marks (defaults to 100)
 * @returns The calculated grade point (0–10)
 */
export const getGradePoint = (totalMarks: number, maxMarks: number = 100): number => {
  const pct = getSubjectPercentage(totalMarks, maxMarks);
  if (pct >= 90) return 10;
  if (pct >= 80) return 9;
  if (pct >= 70) return 8;
  if (pct >= 60) return 7;
  if (pct >= 50) return 6;
  if (pct >= 40) return 5;
  return 0; // Fail
};

/**
 * Determines the letter grade based on percentage (obtainedMarks / maxMarks * 100).
 * Works correctly for any maxMarks value (50, 75, 100, 200, …).
 *
 * Grade scale (percentage-based):
 *   ≥ 90% → S
 *   ≥ 80% → A
 *   ≥ 70% → B
 *   ≥ 60% → C
 *   ≥ 50% → D
 *   ≥ 40% → E
 *    < 40% → F (Fail)
 *
 * @param totalMarks The total marks obtained
 * @param passed Whether the student passed the subject
 * @param maxMarks Maximum marks (defaults to 100)
 * @returns The letter grade (S, A, B, C, D, E, F)
 */
export const getGrade = (totalMarks: number, passed: boolean, maxMarks: number = 100): string => {
  if (!passed) return 'F';
  const pct = getSubjectPercentage(totalMarks, maxMarks);
  if (pct >= 90) return 'S';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B';
  if (pct >= 60) return 'C';
  if (pct >= 50) return 'D';
  return 'E';
};

/**
 * Determines if a subject is passed based on marks and maxMarks.
 * Pass threshold: 40% of maxMarks (total).
 * For 100-mark subjects, also enforces the external mark component rule.
 *
 * @param intMarks Internal marks
 * @param extMarks External marks
 * @param totalMarks Total marks (int + ext)
 * @param maxMarks Maximum marks (defaults to 100)
 * @returns True if passed, false otherwise
 */
export const isSubjectPassed = (intMarks: number, extMarks: number, totalMarks: number, maxMarks: number = 100): boolean => {
  const passThreshold = maxMarks * 0.4; // 40% of maxMarks

  // For 100-mark subjects: enforce int+ext component rule
  // Internal is scored out of 30, external out of 70; pass requires total >= 40
  // with the constraint that ext >= (40 - int) when int <= 15.
  if (maxMarks === 100) {
    if (intMarks >= 0 && intMarks <= 15) {
      const requiredExt = 40 - intMarks;
      return extMarks >= requiredExt;
    }
    return totalMarks >= passThreshold;
  }

  // For all other maxMarks values: simple 40% threshold
  return totalMarks >= passThreshold;
};
