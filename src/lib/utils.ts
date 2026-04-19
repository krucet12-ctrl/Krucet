// Utility functions for the Krishna University academic portal

export const safeTrim = (value: any): string => {
  return (value || "").toString().trim();
};



// GPA Calculation Utilities
export const calculateGPA = (results: Array<{ gradePoint: number; credits: number }>): number => {
  if (!results || results.length === 0) return 0;

  const totalGradePoints = results.reduce((sum, result) => sum + (result.gradePoint * result.credits), 0);
  const totalCredits = results.reduce((sum, result) => sum + result.credits, 0);

  return totalCredits > 0 ? Math.round((totalGradePoints / totalCredits) * 100) / 100 : 0;
};

// Grade Conversion Utilities
export const gpaToPercentage = (gpa: number): number => {
  // Standard conversion: GPA * 10 = Percentage
  return Math.round(gpa * 10);
};

// Validation Utilities
export const validateRollNumber = (rollNumber: string): boolean => {
  const rollNumberPattern = /^[A-Z]\d{2}[A-Z]{3,}\d{3}\d{3}$/;
  return rollNumberPattern.test(rollNumber.toUpperCase());
};

export const validateGPA = (gpa: number): boolean => {
  return gpa >= 0 && gpa <= 10;
};

export const formatRollNumber = (rollNumber: string): string => {
  return safeTrim(rollNumber).toUpperCase();
};

export const formatStudentName = (name: string): string => {
  return safeTrim(name).replace(/\s+/g, ' ');
};

export const formatPercentage = (percentage: number): string => {
  return `${percentage.toFixed(2)}%`;
};

// Error Handling Utilities
export const handleFirebaseError = (error: unknown): string => {
  if (error instanceof Error && error.message === 'Firebase not configured') {
    return 'Firebase is not properly configured. Please check your setup.';
  }

  switch (error) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'Invalid email or password';
    case 'auth/invalid-email':
      return 'Invalid email format';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please try again later.';
    case 'auth/invalid-api-key':
      return 'Firebase configuration error. Please check your API keys.';
    default:
      return 'An error occurred. Please try again.';
  }
};

// Date and Time Utilities
export const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

export const getCurrentAcademicYear = (): string => {
  const currentYear = new Date().getFullYear();
  const nextYear = currentYear + 1;
  return `${currentYear}-${nextYear}`;
};

// Parses Krishna University result HTML into ParsedResult
export const parseResultHTML = (html: string): import("../lib/types").ParsedResult | null => {
  try {
    const rollNoMatch = html.match(/<th>Roll No<\/th><td>([^<]+)<\/td>/);
    const nameMatch = html.match(/<th>Student Name<\/th><td>([^<]+)<\/td>/);
    const courseMatch = html.match(/<th>Course<\/th><td>([^<]+)<\/td>/);
    const collegeMatch = html.match(/<th>College<\/th><td>([^<]+)<\/td>/);

    if (!rollNoMatch) return null; // Not a valid result page

    const studentInfo = {
      rollNo: safeTrim(rollNoMatch[1]),
      name: nameMatch ? safeTrim(nameMatch[1]) : 'N/A',
      course: courseMatch ? safeTrim(courseMatch[1]) : 'N/A',
      college: collegeMatch ? safeTrim(collegeMatch[1]) : 'N/A',
    };

    const subjects = [];
    let match;

    // Parser 1: Try the 7-column structure for REGULAR results first.
    const regularRegex = /<tr>\s*<td>([^<]+)<\/td>\s*<td>([^<]+)<\/td>\s*<td>\s*(\d+)\s*<\/td>\s*<td>[^<]*<\/td>\s*<td>\s*(\d+)\s*<\/td>\s*<td>[^<]*<\/td>\s*<td>([^<]+)<\/td>\s*<\/tr>/g;
    while ((match = regularRegex.exec(html)) !== null) {
      subjects.push({
        subCode: safeTrim(match[1]),
        subjectName: safeTrim(match[2]),
        extMarks: safeTrim(match[3]),
        intMarks: safeTrim(match[4]),
        status: safeTrim(match[5]),
      });
    }

    // Parser 2: If no subjects found, fall back to the 5-column REVALUATION structure.
    if (subjects.length === 0) {
      const revalRegex = /<tr>\s*<td>([^<]+)<\/td>\s*<td>([^<]+)<\/td>\s*<td>\s*(\d+).*?<\/td>\s*<td>\s*(\d+)\s*<\/td>\s*<td>([^<]+)<\/td>\s*<\/tr>/g;
      while ((match = revalRegex.exec(html)) !== null) {
        subjects.push({
          subCode: safeTrim(match[1]),
          subjectName: safeTrim(match[2]),
          extMarks: safeTrim(match[3]),
          intMarks: safeTrim(match[4]),
          status: safeTrim(match[5]),
        });
      }
    }

    return { studentInfo, subjects };
  } catch (error) {
    console.error('Error parsing HTML:', error);
    return null;
  }
};