"use client";
import { useState, useRef, useEffect } from "react";
import { safeTrim } from "@/lib/utils";

// Define a type for the student's basic information
interface StudentInfo {
  name: string;
  roll: string;
  branch: string;
}

interface ResultType {
  code: string;
  name?: string;
  credits: number;
  extMarks?: number;
  intMarks?: number;
  total: number;
  grade: string;
  pass: boolean;
}

const UNIVERSITY_NAME = "KRISHNA UNIVERSITY";
const COLLEGE_NAME = "College of Engineering & Technology";
const COLLEGE_ADDRESS = "Rudravaram, Machilipatnam-521004, Andhra Pradesh, India";
const UNIVERSITY_LOGO = "/krishna-university-logo.png";
const WEBSITE_LINK = "https://your-website-link.com";


export default function ResultsPage() {
  const [roll, setRoll] = useState("");
  const [semester, setSemester] = useState("");
  const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null);
  const [availableSemesters, setAvailableSemesters] = useState<string[]>([]);
  const [allData, setAllData] = useState<any>(null);
  const [results, setResults] = useState<ResultType[]>([]);
  const [gpa, setGpa] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Client-side roll number format validation
  const validateRollNumberFormat = (rollNo: string): boolean => {
    if (!rollNo || typeof rollNo !== 'string' || safeTrim(rollNo) === '') return false;
    const format = /^[A-Z]\d{2}[A-Z]+\d{3}\d{3}$/;
    return format.test(safeTrim(rollNo));
  };

  const handleRollNumberChange = (value: string) => {
    setRoll(value.toUpperCase());
  };

  const fetchAvailableSemesters = async () => {
    const cleanRollNo = roll ? safeTrim(roll) : '';

    if (!cleanRollNo) {
      setError("Please enter a valid Roll Number.");
      return;
    }

    if (!validateRollNumberFormat(cleanRollNo)) {
      setError("Invalid roll number format. Expected format: Y22CSE279001 (e.g., Y(batch) + Branch + College + Number)");
      return;
    }

    setError("");
    setLoading(true);
    
    try {
      const response = await fetch('/api/get-student-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rollNo: cleanRollNo.toUpperCase() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "An error occurred.");
      }

      setStudentInfo(data.student);
      setAllData(data);

      const sems = Object.keys(data.results).filter(key => key.startsWith('SEM')).sort((a, b) => {
        const aNum = parseInt(a.replace('SEM', ''));
        const bNum = parseInt(b.replace('SEM', ''));
        return aNum - bNum;
      });

      setAvailableSemesters(sems);
      
      if (sems.length > 0) {
        const latest = sems[sems.length - 1];
        setSemester(latest);
        const semData = data.results[latest];
        setResults([...semData.subjects]);
        setGpa(semData.sgpa);
      } else {
        setError("No results found for this student record.");
        setStudentInfo(null);
      }

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error fetching student data.");
      setStudentInfo(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSemesterChange = (selectedSemester: string) => {
    setSemester(selectedSemester);
    if (allData && allData.results && allData.results[selectedSemester]) {
      const semData = allData.results[selectedSemester];
      setResults([...semData.subjects]);
      setGpa(semData.sgpa);
    } else {
      setResults([]);
      setGpa(null);
    }
  };

  const getDocumentHTML = () => {
    if (!tableRef.current || !studentInfo) return "";
    
    const logoUrl = window.location.origin + UNIVERSITY_LOGO;
    const semesterLabel = semester ? semester.replace('SEM', 'Semester ') : "";
    const currentDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    
    // Extract batch/dept for display
    const rollNo = studentInfo.roll;
    const batch = rollNo.substring(0, 3);
    const regulation = gpa ? "As per Regulation" : "R20"; // Fallback or dynamic
    
    // Generate the table rows manually for perfect control in marks memo
    const tableRows = results.map(res => `
      <tr>
        <td class="center font-mono">${res.code}</td>
        <td>${res.name || (res.code.includes('LAB') ? 'PRACTICAL' : 'THEORY')}</td>
        <td class="center">${res.total}</td>
        <td class="center bold">${res.grade}</td>
        <td class="center">${res.credits}</td>
      </tr>
    `).join('');

    const totalCredits = results.reduce((acc, curr) => acc + (curr.pass ? curr.credits : 0), 0);

    return `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600;700;800&family=Inter:wght@400;500;600;700&display=swap');
        
        * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body { margin: 0; padding: 0; font-family: 'Inter', sans-serif; background: white; color: #111; }
        
        .memo-outer { border: 1px solid #333; padding: 1mm; margin: 0 auto; max-width: 210mm; background: #fff; position: relative; }
        .memo-inner { border: 2px solid #333; padding: 15px 30px; position: relative; }
        
        .header { display: flex; align-items: center; justify-content: center; margin-bottom: 20px; border-bottom: 1.5px solid #000; padding-bottom: 15px; gap: 12px; flex-wrap: wrap; }
        .logo { width: 75px; height: 75px; object-fit: contain; flex-shrink: 0; }
        .text-container { flex: 1; min-width: 0; text-align: center; }
        .university-name { font-family: 'Crimson Pro', serif; font-size: 24px; font-weight: 800; margin: 0; text-transform: uppercase; color: #000; white-space: normal; word-break: break-word; overflow-wrap: anywhere; }
        .header h2 { font-size: 14px; font-weight: 700; margin: 5px 0; color: #333; }
        .header p { font-size: 10px; margin: 2px 0; color: #555; font-weight: 500; }
        .memo-title { display: inline-block; margin-top: 10px; padding: 3px 15px; border: 1px solid #000; font-weight: 800; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; }

        @media screen and (max-width: 768px) {
          .header { flex-direction: column; align-items: flex-start; }
          .text-container { text-align: left; }
          .university-name { font-size: 16px; line-height: 1.3; }
        }

        .student-sec { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; padding: 10px 0; border-bottom: 1px dashed #999; }
        .field { display: flex; margin-bottom: 5px; font-size: 11px; }
        .label { font-weight: 700; width: 110px; text-transform: uppercase; font-size: 10px; color: #444; }
        .value { border-bottom: 1px dotted #ccc; flex: 1; font-weight: 600; padding-left: 5px; }

        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; page-break-inside: avoid; }
        th { border: 1px solid #000; padding: 6px; background: #f2f2f2; font-size: 10px; font-weight: 800; text-transform: uppercase; }
        td { border: 1px solid #000; padding: 6px; font-size: 11px; }
        .center { text-align: center; }
        .bold { font-weight: 700; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }

        .summary-sec { display: flex; justify-content: space-around; align-items: flex-start; margin-bottom: 20px; page-break-inside: avoid; }
        .summary-item { display: flex; flex-direction: column; align-items: center; }
        .sum-val { font-size: 20px; font-weight: 800; color: #000; }
        .sum-lab { font-size: 9px; font-weight: 700; text-transform: uppercase; color: #666; }
        .sgpa-highlight { border: 2px solid #000; padding: 6px 20px; border-radius: 4px; background: #f9f9f9; }

        .footer { display: flex; justify-content: center; align-items: center; margin-top: 10px; page-break-inside: avoid; }
        .date-sec { font-size: 10px; font-weight: 600; text-align: center; }

        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .memo-outer { border: none; margin: 0; width: 100%; padding: 0; page-break-inside: avoid; }
          .memo-inner { page-break-inside: avoid; }
        }
      </style>
      <div class="memo-outer">
        <div class="memo-inner">
          <div class="header">
            <img src="${logoUrl}" alt="University Logo" class="logo" />
            <div class="text-container">
              <h1 class="university-name">${UNIVERSITY_NAME}</h1>
              <h2>${COLLEGE_NAME}</h2>
              <p>${COLLEGE_ADDRESS}</p>
              <div class="memo-title">Statement of Marks</div>
            </div>
          </div>
          
          <div class="student-sec">
            <div class="field"><span class="label">Name:</span><span class="value">${studentInfo.name}</span></div>
            <div class="field"><span class="label">Roll Number:</span><span class="value">${studentInfo.roll}</span></div>
            <div class="field"><span class="label">Branch:</span><span class="value">${studentInfo.branch}</span></div>
            <div class="field"><span class="label">Examination:</span><span class="value">${semesterLabel} - End Exams</span></div>
          </div>

          <table>
            <thead>
              <tr>
                <th width="15%">Sub Code</th>
                <th>Subject Description</th>
                <th width="12%">Marks</th>
                <th width="12%">Grade</th>
                <th width="12%">Credits</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>

          <div class="summary-sec">
            <div class="summary-item">
              <span class="sum-val">${totalCredits}</span>
              <span class="sum-lab">Earned Credits</span>
            </div>
            <div class="summary-item sgpa-highlight">
              <span class="sum-val">${gpa || 'NA'}</span>
              <span class="sum-lab">Semester GPA (SGPA)</span>
            </div>
            <div class="summary-item">
              <span class="sum-val">${results.every(r => r.pass) ? 'PASS' : 'FAIL'}</span>
              <span class="sum-lab">Result Status</span>
            </div>
          </div>

          <div class="footer">
            <div class="date-sec">
              Date of Issue: ${currentDate}<br>
              Generated Online
            </div>
          </div>
        </div>
      </div>
    `;
  };

  const handlePrintTable = () => {
    if (window.innerWidth < 768) {
      alert("Print is only available on desktop.");
      return;
    }
    const htmlContent = getDocumentHTML();
    if (!htmlContent) return;
    const printWindow = window.open('', '', 'height=850,width=1100');
    if (!printWindow) return;
    printWindow.document.write(`<html><head><title>Marks Memo - ${studentInfo?.roll}</title></head><body style="margin:0">${htmlContent}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      setTimeout(() => printWindow.close(), 500);
    }, 400);
  };

  return (
    <div className="w-full space-y-8 animate-fade-in relative pb-12">
      <div className="absolute top-0 right-0 w-80 h-80 bg-blue-100/20 rounded-full blur-3xl pointer-events-none -z-10"></div>
      
      {/* Header Section */}
      <div className="text-center relative">
        <h1 className="heading-premium inline-block relative">
          Academic Results
          <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-16 h-1 bg-indigo-600 rounded-full"></div>
        </h1>
        <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto mt-6 font-medium">
          Access your official examination marks and verify your semester-wise academic standing.
        </p>
      </div>

      {/* Input Area */}
      <div className="premium-card max-w-3xl mx-auto">
        <h2 className="text-xl font-extrabold text-slate-800 mb-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          Verify Credentials
        </h2>
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <input
              type="text"
              className="input-premium flex-1 uppercase"
              placeholder="Enter Roll Number"
              value={roll}
              onChange={e => handleRollNumberChange(e.target.value)}
              disabled={loading}
              onKeyPress={e => e.key === 'Enter' && fetchAvailableSemesters()}
            />
            <button
              onClick={fetchAvailableSemesters}
              className="btn-primary sm:w-auto min-w-[140px]"
              disabled={loading || !roll}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  <span>Searching...</span>
                </div>
              ) : 'Fetch Records'}
            </button>
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-center text-sm font-medium">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Results Display Area */}
      {studentInfo && (
        <div className="animate-fade-in space-y-8 max-w-5xl mx-auto mt-8">
          <div className="premium-card border-indigo-100/50 bg-gradient-to-br from-white to-indigo-50/10">
            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 border-b border-slate-100 pb-6 gap-6 sm:gap-0">
              <div className="flex items-center sm:items-center gap-3 sm:gap-5 w-full sm:w-auto">
                <img src={UNIVERSITY_LOGO} alt="University Logo" className="w-12 h-12 sm:w-14 sm:h-14 object-contain shadow-sm rounded-full bg-white p-1 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-extrabold text-slate-800 text-[16px] sm:text-xl leading-[1.3] sm:leading-tight tracking-tight uppercase whitespace-normal break-words" style={{ overflowWrap: "anywhere" }}>{UNIVERSITY_NAME}</h3>
                  <p className="text-[10px] sm:text-xs text-indigo-600 font-bold uppercase tracking-widest mt-1 opacity-80 whitespace-normal break-words">{COLLEGE_NAME}</p>
                </div>
              </div>
              {!isMobile ? (
                <button 
                  onClick={handlePrintTable}
                  className="btn-primary print-btn text-sm px-6 py-3 flex items-center gap-2.5 shadow-indigo-200/50 shadow-lg hover:shadow-indigo-300 transition-all hover:-translate-y-0.5"
                >
                  <span className="text-lg">🎓</span>
                  Download Official Memo
                </button>
              ) : (
                <div className="text-xs text-amber-600 font-semibold bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                  Printing is available only on desktop for better formatting.
                </div>
              )}
            </div>

            {/* Information Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 border border-slate-100 rounded-3xl overflow-hidden mb-10 shadow-sm bg-white">
              <div className="p-8 flex flex-col items-center sm:items-start group hover:bg-slate-50 transition-colors">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 border-b-2 border-slate-200 w-full pb-1">Full Name</h3>
                <p className="text-xl text-slate-800 font-extrabold truncate w-full">{studentInfo.name}</p>
              </div>
              <div className="p-8 flex flex-col items-center border-y sm:border-y-0 sm:border-x border-slate-100 bg-indigo-50/20 group hover:bg-indigo-50/40 transition-colors">
                <h3 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2 border-b-2 border-indigo-200 w-full pb-1 text-center font-mono">Roll Number</h3>
                <p className="text-2xl text-indigo-700 font-black font-mono tracking-tighter">{studentInfo.roll}</p>
              </div>
              <div className="p-8 flex flex-col items-center sm:items-start group hover:bg-slate-50 transition-colors">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 border-b-2 border-slate-200 w-full pb-1">Branch</h3>
                <p className="text-xl text-slate-800 font-extrabold truncate w-full">{studentInfo.branch}</p>
              </div>
            </div>

            {/* Results Section */}
            <div className="space-y-8">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-6 px-2">
                <div className="space-y-1">
                  <h4 className="font-extrabold text-slate-800 text-lg flex items-center gap-3">
                    <span className="w-3 h-3 bg-indigo-600 rounded-full shadow-md"></span>
                    Examination Results
                  </h4>
                  <p className="text-xs text-slate-500 font-medium pl-6">Verified as per ${UNIVERSITY_NAME} standards</p>
                </div>
                <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                  <select
                    value={semester}
                    onChange={(e) => handleSemesterChange(e.target.value)}
                    className="input-premium font-bold bg-white text-slate-700 min-w-[180px]"
                  >
                    {!semester && <option value="" disabled>Select Semester</option>}
                    {availableSemesters.map((sem) => (
                      <option key={sem} value={sem}>
                        {sem.replace('SEM', 'Semester ')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div ref={tableRef} className="rounded-3xl border border-slate-200 overflow-hidden bg-white shadow-sm ring-1 ring-slate-200/50">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50/80 backdrop-blur-sm border-b border-slate-200">
                        <th className="px-6 py-5 text-left font-black text-slate-600 text-[11px] uppercase tracking-widest">Sub Code</th>
                        <th className="px-6 py-5 text-left font-black text-slate-600 text-[11px] uppercase tracking-widest">Subject Name</th>
                        <th className="px-6 py-5 text-center font-black text-slate-600 text-[11px] uppercase tracking-widest">Credits</th>
                        <th className="px-6 py-5 text-center font-black text-slate-600 text-[11px] uppercase tracking-widest">Marks</th>
                        <th className="px-6 py-5 text-center font-black text-slate-600 text-[11px] uppercase tracking-widest">Grade</th>
                        <th className="px-6 py-5 text-center font-black text-slate-600 text-[11px] uppercase tracking-widest">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {results.map((res, idx) => (
                        <tr key={idx} className="hover:bg-indigo-50/20 transition-all group">
                          <td className="px-6 py-5 font-mono text-slate-500 font-bold group-hover:text-indigo-600 transition-colors">{res.code}</td>
                          <td className="px-6 py-5 text-slate-700 font-bold">{res.name || '-'}</td>
                          <td className="px-6 py-5 text-center text-slate-900 font-black">{res.credits}</td>
                          <td className="px-6 py-5 text-center text-slate-900 font-black text-base">{res.total}</td>
                          <td className="px-6 py-5 text-center">
                            <span className={`text-base font-black transition-transform inline-block group-hover:scale-110 ${
                              res.pass ? 'text-slate-800' : 'text-red-600'
                            }`}>
                              {res.grade}
                            </span>
                          </td>
                          <td className="px-6 py-5 text-center">
                            <div className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider inline-block ${
                              res.pass ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                            }`}>
                              {res.pass ? '✓ PASS' : '✗ FAIL'}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* GPA Visualization Section */}
            {gpa && gpa !== 'NA' && (
              <div className="mt-12 flex justify-center">
                <div className="bg-white p-2 rounded-[3rem] border border-slate-200 shadow-xl max-w-sm w-full relative group hover:scale-105 transition-all duration-500">
                  <div className="bg-slate-900 rounded-[2.5rem] p-10 text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl transform translate-x-10 -translate-y-10"></div>
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-sky-500/20 rounded-full blur-2xl transform -translate-x-10 translate-y-10"></div>
                    <div className="relative z-10">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4">Academic Merit Index</p>
                      <div className="text-7xl font-black text-white tracking-tighter mb-2 drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">{gpa}</div>
                      <div className="h-1.5 w-16 bg-gradient-to-r from-indigo-500 to-sky-400 mx-auto rounded-full mb-4"></div>
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Semester GPA (SGPA)</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}