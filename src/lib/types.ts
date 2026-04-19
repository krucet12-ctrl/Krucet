// Student Result Types
export interface SubjectResult {
  subjectName?: string;
  intMarks: number;
  extMarks: number;
  total: number;
  maxMarks?: number;
  pass: boolean;
  grade: string;
  status?: 'PASS' | 'FAIL';
  attempts: number;
}

export interface StudentData {
  roll: string;
  batch: string;
  branch: string;
  college: string;
  number: string;
  subjectResults: Record<string, SubjectResult>;
  lastUpdated: string;
  name?: string;
  semesters?: Record<string, { subjects: Record<string, unknown> }>;
  resultType?: string;
}

// Subject Metadata Types
export interface SubjectMetadata {
  credits: number;
}

export interface SemesterSubjects {
  [subjectCode: string]: SubjectMetadata;
}

export interface CurriculumSubject {
  subject_code: string;
  credits: number;
  max_marks: number;
}

// Parsed Result Types (from HTML)
export interface ParsedStudentInfo {
  rollNo: string;
  name: string;
  course: string;
  college: string;
}

export interface ParsedSubjectMarks {
  subCode: string;
  subjectName?: string;
  extMarks: string;
  intMarks: string;
  status: string;
}

export interface ParsedResult {
  studentInfo: ParsedStudentInfo;
  subjects: ParsedSubjectMarks[];
}

// Year to Regulation Mapping Type
export interface YearToRegulationMap {
  [year: string]: string;
} 