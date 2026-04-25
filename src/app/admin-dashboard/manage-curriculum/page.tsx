'use client';

import { useState } from 'react';
import { db } from '../../../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { safeTrim } from '@/lib/utils';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface SubjectEntry {
  code: string;
  credit: number;
  maxMarks: number;
}

const MAX_MARKS_OPTIONS = [50,100,200] as const;

const DEPT_OPTIONS = {
  BTech: ["CSE", "ECE", "AIML"],
  MTech: ["CSE"],
};

const SEM_OPTIONS = {
  BTech: [1, 2, 3, 4, 5, 6, 7, 8],
  MTech: [1, 2, 3, 4],
};

export default function ManageCurriculumPage() {
  const [courseType, setCourseType] = useState<"BTech" | "MTech">("BTech");
  const [regulationNumber, setRegulationNumber] = useState("");
  // Derived — always has 'R' prefix (matches Firestore key format)
  const regulation = regulationNumber ? `R${regulationNumber}` : '';
  const [branch, setBranch] = useState("");
  const [semester, setSemester] = useState("SEM1");
  const [subjects, setSubjects] = useState<SubjectEntry[]>([]);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [isLoaded, setIsLoaded] = useState(false);

  const handleLoad = async () => {
    if (!safeTrim(regulation) || !safeTrim(branch)) {
      setMessage({ text: 'Please enter Regulation and Branch.', type: 'error' });
      return;
    }

    setLoading(true);
    setMessage({ text: '', type: '' });

    try {
      const docRef = doc(db, "curriculum", `${courseType}_${regulation.toUpperCase()}`, branch.toUpperCase(), semester);
      const snap = await getDoc(docRef);

      if (snap.exists()) {
        const data = snap.data();
        const fetchedSubjects = (data.Subjects || []).map((s: any) => ({
          code: s.code || '',
          credit: s.credit || s.Credit || s.credits || 0,
          maxMarks: s.maxMarks || 100 // Default old ones to 100
        }));
        setSubjects(fetchedSubjects);
        setMessage({ text: 'Curriculum loaded successfully.', type: 'success' });
      } else {
        setSubjects([]);
        setMessage({ text: 'No curriculum found. You can create a new one.', type: 'info' });
      }
      setIsLoaded(true);
    } catch (error: any) {
      setMessage({ text: 'Error loading curriculum: ' + error.message, type: 'error' });
      setIsLoaded(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!safeTrim(regulation) || !safeTrim(branch)) {
      setMessage({ text: 'Regulation and Branch are required.', type: 'error' });
      return;
    }

    // Validate duplicates
    const codes = subjects.map(s => safeTrim(s.code).toUpperCase());
    const hasDuplicates = new Set(codes).size !== codes.length;
    if (hasDuplicates) {
      setMessage({ text: 'Duplicate subject codes are not allowed in the same semester.', type: 'error' });
      return;
    }

    // Validate values
    const hasInvalidMarks = subjects.some(s => !MAX_MARKS_OPTIONS.includes(s.maxMarks as any));
    if (hasInvalidMarks) {
      setMessage({ text: 'Max Marks must be one of: 50, 75, 100, 150, 200.', type: 'error' });
      return;
    }

    setLoading(true);
    setMessage({ text: '', type: '' });

    try {
      const docRef = doc(db, "curriculum", `${courseType}_${regulation.toUpperCase()}`, branch.toUpperCase(), semester);
      await setDoc(docRef, {
        Subjects: subjects.map(s => ({
          code: safeTrim(s.code).toUpperCase(),
          credit: Number(s.credit),
          maxMarks: Number(s.maxMarks)
        }))
      });

      setMessage({ text: 'Curriculum saved successfully.', type: 'success' });
    } catch (error: any) {
      setMessage({ text: 'Error saving curriculum: ' + error.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddSubject = () => {
    setSubjects([...subjects, { code: '', credit: 3, maxMarks: 100 }]);
  };

  const handleRemoveSubject = (index: number) => {
    setSubjects(subjects.filter((_, i) => i !== index));
  };

  const handleSubjectChange = (index: number, field: keyof SubjectEntry, value: string | number) => {
    const newSubjects = [...subjects];
    if (field === 'credit') {
      const num = typeof value === 'string' ? parseFloat(value) : value;
      newSubjects[index] = { ...newSubjects[index], credit: isNaN(num) ? 0 : num };
    } else {
      newSubjects[index] = { ...newSubjects[index], [field]: value };
    }
    setSubjects(newSubjects);
  };

  return (
    <div className="min-h-screen bg-slate-50 relative pointer-events-auto pb-12">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-100/30 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
      <div className="absolute top-40 left-0 w-[500px] h-[500px] bg-blue-100/30 rounded-full blur-3xl pointer-events-none -translate-x-1/3"></div>

      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md shadow-sm border-b border-indigo-100/60 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center py-4 w-full gap-4">
            <Link href="/admin-dashboard" className="text-sm font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-2 transition-colors group">
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span>Back to Dashboard</span>
            </Link>
            <div className="h-5 w-px bg-slate-200 hidden sm:block"></div>
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-800 tracking-tight">Curriculum Management</h1>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 relative z-10">
        <div className="w-full max-w-5xl mx-auto">
          <div className="premium-card p-6 sm:p-8 bg-white border-indigo-100 mb-8">
            <div className="flex items-center space-x-3 mb-6">
              <div className="bg-indigo-50 p-2 rounded-lg">
                <span className="text-xl">📚</span>
              </div>
              <h2 className="text-lg font-extrabold text-slate-800 tracking-tight">Load Curriculum</h2>
            </div>

            <div className="space-y-6 mb-6">
              {/* Course Type Toggle */}
              <div className="space-y-2">
                <label className="label-premium">Course Type</label>
                <div className="flex rounded-xl overflow-hidden border border-slate-200 shadow-sm max-w-xs">
                  {(["BTech", "MTech"] as const).map((ct) => (
                    <button
                      key={ct}
                      type="button"
                      onClick={() => {
                        setCourseType(ct);
                        setBranch("");
                        setSemester("SEM1");
                        setIsLoaded(false);
                      }}
                      className={`flex-1 py-2.5 text-sm font-extrabold transition-all ${courseType === ct
                          ? "bg-indigo-600 text-white shadow-inner"
                          : "bg-white text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"
                        }`}
                    >
                      {ct === "BTech" ? "B.Tech" : "M.Tech"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="label-premium">Regulation</label>
                  <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <span className="bg-slate-100 px-4 py-2.5 font-bold text-slate-600 text-sm">R</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={2}
                      placeholder="20, 23, 26...etc"
                      className="flex-1 px-4 py-2.5 outline-none text-sm font-bold"
                      value={regulationNumber}
                      onChange={(e) => setRegulationNumber(e.target.value.replace(/[^0-9]/g, ''))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="label-premium">Department</label>
                  <select
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="input-premium font-bold bg-white"
                  >
                    <option value="" disabled>Select Department</option>
                    {DEPT_OPTIONS[courseType].map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="label-premium">Semester</label>
                  <select
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                    className="input-premium py-2 cursor-pointer bg-white"
                  >
                    {SEM_OPTIONS[courseType].map((num) => (
                      <option key={num} value={`SEM${num}`}>
                        Semester {num}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="pt-2">
              <button
                onClick={handleLoad}
                disabled={loading}
                className="btn-primary w-full px-8 py-3 flex justify-center items-center font-bold"
              >
                {loading ? (
                  <div className="flex items-center space-x-2">
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Loading...</span>
                  </div>
                ) : 'Load Curriculum'}
              </button>
            </div>
          </div>

          {message.text && (
            <div className={`p-4 rounded-md mb-6 ${message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
              message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
                'bg-blue-50 text-blue-700 border border-blue-200'}`}>
              {message.text}
            </div>
          )}

          {isLoaded && (
            <div className="premium-card p-6 sm:p-8 bg-white border-indigo-100">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 border-b border-slate-200/60 pb-6">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Subjects Editor</h2>
                  <p className="text-xs text-indigo-500 font-bold uppercase tracking-wider mt-1">{courseType} • {regulation || "Reg"} • {branch || "Dept"} • {semester}</p>
                </div>
                <button
                  onClick={handleAddSubject}
                  className="w-full sm:w-auto bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-all duration-200 flex items-center justify-center space-x-2 group"
                >
                  <span className="text-lg leading-none">+</span>
                  <span>Add Subject</span>
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-8">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-4 text-left font-extrabold text-slate-500 text-[10px] uppercase tracking-widest w-1/4">Code</th>
                      <th className="px-5 py-4 text-left font-extrabold text-slate-500 text-[10px] uppercase tracking-widest w-24">Credits</th>
                      <th className="px-5 py-4 text-left font-extrabold text-slate-500 text-[10px] uppercase tracking-widest w-32">Max Marks</th>
                      <th className="px-5 py-4 text-center font-extrabold text-slate-500 text-[10px] uppercase tracking-widest w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {subjects.map((sub, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70 transition-colors group/row">
                        <td className="px-5 py-3">
                          <input
                            type="text"
                            value={sub.code}
                            onChange={e => handleSubjectChange(idx, 'code', e.target.value.toUpperCase())}
                            className="input-premium py-1.5 px-3 font-mono text-xs uppercase cursor-text bg-white group-hover/row:bg-slate-50"
                            placeholder="CODE"
                          />
                        </td>
                        <td className="px-5 py-3">
                          <input
                            type="number"
                            value={sub.credit}
                            min={0}
                            step={0.5}
                            onChange={e => handleSubjectChange(idx, 'credit', e.target.value)}
                            onWheel={e => e.currentTarget.blur()}
                            className="input-premium py-1.5 px-3 text-sm text-center cursor-text bg-white group-hover/row:bg-slate-50"
                          />
                        </td>
                        <td className="px-5 py-3">
                          <select
                            value={sub.maxMarks}
                            onChange={e => handleSubjectChange(idx, 'maxMarks', parseInt(e.target.value))}
                            className="input-premium py-1.5 px-3 text-sm cursor-pointer bg-white group-hover/row:bg-slate-50"
                          >
                            {MAX_MARKS_OPTIONS.map((m) => (
                              <option key={m} value={m}>{m} Marks</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-5 py-3 text-center">
                          <button
                            onClick={() => handleRemoveSubject(idx)}
                            className="p-2 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-all opacity-100 sm:opacity-0 sm:group-hover/row:opacity-100"
                            title="Delete Subject"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                    {subjects.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center">
                          <span className="text-4xl block mb-3">📋</span>
                          <span className="text-slate-500 font-bold text-sm tracking-wide">No subjects found for this semester. Click &quot;Add Subject&quot; to begin.</span>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-end">
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="btn-primary w-full sm:w-auto px-10 py-3 flex justify-center items-center font-bold"
                >
                  {loading ? (
                    <div className="flex items-center space-x-2">
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Saving...</span>
                    </div>
                  ) : 'Save Curriculum Changes'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
