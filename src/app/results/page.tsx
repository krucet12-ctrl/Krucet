"use client";
import { useState, useRef, useEffect } from "react";
import { safeTrim } from "@/lib/utils";
import ResultsTable from "@/components/ResultsTable";

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
  maxMarks?: number;
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
    const currentDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    const rollNo = studentInfo.roll;

    const getRegulation = (rn: string) => {
      const match = rn.match(/^([YL]\d{2})/i);
      if (!match) return 'R20';
      const batch = match[1].toUpperCase();
      if (['Y20', 'Y21'].includes(batch)) return 'R18';
      return 'R20';
    };
    const regulation = getRegulation(rollNo);

    // Derive year/sem label from SEM number
    const semNum = parseInt(semester.replace('SEM', '')) || 0;
    const yearLabel = semNum <= 2 ? 'I YEAR' : semNum <= 4 ? 'II YEAR' : semNum <= 6 ? 'III YEAR' : 'IV YEAR';
    const semInYear = semNum % 2 === 1 ? 'I Semester' : 'II Semester';

    const totalCreditsEarned = results.reduce((acc, curr) => acc + (curr.pass ? curr.credits : 0), 0);
    const totalCreditsReg = results.reduce((acc, curr) => acc + curr.credits, 0);
    const totalMarks = results.reduce((acc, curr) => acc + curr.total, 0);
    const maxMarks = results.length * 100;
    const overallResult = results.every(r => r.pass) ? 'PASS' : 'FAIL';

    const hasIntExt = results.some(r => r.intMarks !== undefined || r.extMarks !== undefined);

    const tableHeaders = hasIntExt
      ? `<th style="width:12%">Sub Code</th>
         <th style="width:22%">Subject Name</th>
         <th style="width:8%">Max</th>
         <th style="width:8%">Internal</th>
         <th style="width:8%">External</th>
         <th style="width:8%">Total</th>
         <th style="width:8%">Grade</th>
         <th style="width:8%">Credits</th>
         <th style="width:10%">Status</th>`
      : `<th style="width:13%">Sub Code</th>
         <th style="width:25%">Subject Name</th>
         <th style="width:10%">Max Marks</th>
         <th style="width:12%">Obtained</th>
         <th style="width:10%">Credits</th>
         <th style="width:8%">Grade</th>
         <th style="width:12%">Status</th>`;

    const tableRows = results.map(res => {
      const statusColor = res.pass ? '#166534' : '#991b1b';
      const max = (res.maxMarks ?? 100);
      if (hasIntExt) {
        return `<tr>
          <td class="mono" style="font-weight:600">${res.code}</td>
          <td style="text-align:left;font-size:10px">${res.name || '—'}</td>
          <td class="center bold">${max}</td>
          <td class="center">${res.intMarks ?? '—'}</td>
          <td class="center">${res.extMarks ?? '—'}</td>
          <td class="center bold">${res.total}</td>
          <td class="center bold" style="color:${!res.pass ? statusColor : ''}">${res.grade}</td>
          <td class="center">${res.credits}</td>
          <td class="center" style="color:${statusColor};font-weight:700">${res.pass ? 'Pass' : 'Fail'}</td>
        </tr>`;
      } else {
        return `<tr>
          <td class="mono" style="font-weight:600">${res.code}</td>
          <td style="text-align:left;font-size:10px">${res.name || '—'}</td>
          <td class="center bold">${max}</td>
          <td class="center bold">${res.total}</td>
          <td class="center">${res.credits}</td>
          <td class="center bold" style="color:${!res.pass ? statusColor : ''}">${res.grade}</td>
          <td class="center" style="color:${statusColor};font-weight:700">${res.pass ? 'Pass' : 'Fail'}</td>
        </tr>`;
      }
    }).join('');

    // examMonthYear removed per user request

    const classAwarded = (() => {
      if (!gpa || gpa === 'NA') return 'N/A';
      const g = Number(gpa);
      if (g >= 8.0) return 'First Class with Distinction';
      if (g >= 7.0) return 'First Class';
      if (g >= 6.0) return 'Second Class';
      if (g >= 5.0) return 'Pass Class';
      return 'Fail';
    })();

    return `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;500;600;700;800&family=Source+Sans+3:wght@400;600;700&display=swap');
        @page { size: A4 portrait; margin: 10mm 12mm; }
        *, *::before, *::after { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        html, body { margin: 0; padding: 0; background: #fff; color: #000; font-family: 'Source Sans 3', sans-serif; font-size: 11px; }

        .cmm-wrap { border: 2.5px solid #000; padding: 3px; width: 100%; }
        .cmm-inner { border: 1px solid #000; padding: 16px 20px 14px; }

        /* Header — centered, no flex row */
        .hdr { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 10px; }
        .hdr-logo { width: 64px; height: 64px; object-fit: contain; display: block; margin: 0 auto 6px; }
        .hdr-univ { font-family: 'EB Garamond', serif; font-size: 20px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; line-height: 1.2; margin: 0; }
        .hdr-addr { font-size: 11px; color: #222; margin: 3px 0 0; font-weight: 500; }
        .hdr-title { display: inline-block; margin-top: 9px; border: 1px solid #000; padding: 3px 22px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; }

        /* Student detail grid */
        .stu-grid { display: grid; grid-template-columns: 56% 44%; gap: 12px 16px; border: 1px solid #000; padding: 12px 16px; margin-bottom: 16px; }
        .field { display: flex; align-items: flex-start; }
        .lbl { font-weight: 700; font-size: 10px; text-transform: uppercase; width: 140px; flex-shrink: 0; color: #333; padding-top: 1px; }
        .val-wrap { flex: 1; text-align: left; }
        .val { font-weight: 700; font-size: 11px; border-bottom: 1px solid #555; padding-bottom: 1px; display: inline; color: #111; line-height: 1.4; }
        .val.nowrap { white-space: nowrap; }
        .val.small-nowrap { white-space: nowrap; font-size: 10px; }

        /* Year/Sem banner */
        .sem-banner { text-align: center; font-family: 'EB Garamond', serif; font-size: 13px; font-weight: 700; border: 1px solid #000; padding: 4px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; }

        /* Table */
        table { width: 100%; border-collapse: collapse; margin-bottom: 10px; page-break-inside: avoid; font-size: 10.5px; }
        th { border: 1px solid #000; padding: 5px 6px; background: #f0f0f0; font-weight: 700; text-transform: uppercase; font-size: 9.5px; text-align: center; }
        th.left { text-align: left; }
        td { border: 1px solid #000; padding: 5px 6px; }
        td.center { text-align: center; }
        td.bold { font-weight: 700; }
        td.mono { font-family: monospace; font-size: 10px; }

        /* SGPA Summary Box */
        .sgpa-box { border: 1px solid #000; padding: 16px 12px; margin-bottom: 10px; text-align: center; width: 100%; }
        .sgpa-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #333; letter-spacing: 0.05em; margin-bottom: 6px; }
        .sgpa-value { font-family: 'EB Garamond', serif; font-size: 28px; font-weight: 800; color: #000; line-height: 1; }

        /* Footer */
        .footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 12px; border-top: 1px solid #000; padding-top: 10px; }
        .footer-left { display: flex; flex-direction: column; gap: 4px; }
        .footer-date { font-size: 11px; font-weight: 700; }
        .footer-right { max-width: 60%; }
        .highlight-note {
          background-color: #fef2f2;
          border: 1px solid #fca5a5;
          padding: 8px 12px;
          font-size: 9px;
          color: #991b1b;
          text-align: left;
          line-height: 1.4;
          border-radius: 4px;
        }
        .highlight-note strong { font-weight: 800; font-size: 10px; }

        @media print {
          .cmm-wrap { border: 2.5px solid #000 !important; }
          .cmm-inner { border: 1px solid #000 !important; }
          table { page-break-inside: avoid; }
          .sgpa-box { page-break-inside: avoid; }
          .highlight-note { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      </style>
      <div class="cmm-wrap">
        <div class="cmm-inner">

          <!-- Header -->
          <div class="hdr">
            <img src="${logoUrl}" alt="Logo" class="hdr-logo" />
            <div class="hdr-univ">KRISHNA UNIVERSITY</div>
            <div class="hdr-addr">Machilipatnam – 521004, ANDHRA PRADESH, INDIA</div>
            <div class="hdr-title">MARKS MEMO / CREDIT SHEET</div>
          </div>

          <!-- Student Details -->
          <div class="stu-grid">
            <div class="field"><span class="lbl">Student Name</span><div class="val-wrap"><span class="val">${studentInfo.name}</span></div></div>
            <div class="field"><span class="lbl">Hall Ticket No</span><div class="val-wrap"><span class="val nowrap">${rollNo}</span></div></div>
            <div class="field"><span class="lbl">College Name</span><div class="val-wrap"><span class="val small-nowrap">${COLLEGE_NAME}</span></div></div>
            <div class="field"><span class="lbl">Class Awarded</span><div class="val-wrap"><span class="val">${classAwarded}</span></div></div>
            <div class="field"><span class="lbl">Year of Admission</span><div class="val-wrap"><span class="val">20${rollNo.substring(1, 3) || '__'}</span></div></div>
            <div></div> <!-- Spacer for exact 2-column layout -->
          </div>

          <!-- Year/Sem banner -->
          <div class="sem-banner">${yearLabel} &nbsp;|&nbsp; ${semInYear} End Examination Results</div>

          <!-- Marks Table -->
          <table>
            <thead>
              <tr>
                ${tableHeaders}
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>

          <!-- SGPA Summary -->
          <div class="sgpa-box">
            <div class="sgpa-label">Semester GPA (SGPA)</div>
            <div class="sgpa-value">${gpa || 'NA'}</div>
          </div>

          <!-- Footer -->
          <div class="footer">
            <div class="footer-left">
              <div class="footer-date">Date of Issue: ${currentDate}</div>
            </div>
            <div class="footer-right">
              <div class="highlight-note">
                <strong>Note:</strong><br/>
                This document is electronically generated and does not require a signature.<br/>
                It is intended for reference purposes only and is not valid for official use.
              </div>
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
    printWindow.document.write(`<html><head><title>Statement of Marks - ${studentInfo?.roll}</title></head><body style="margin:0">${htmlContent}</body></html>`);
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
              autoComplete="off"
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
                  <p className="text-xs text-slate-500 font-medium pl-6">Verified as per {UNIVERSITY_NAME} standards</p>
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

              <div ref={tableRef}>
                <ResultsTable results={results} variant="screen" />
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