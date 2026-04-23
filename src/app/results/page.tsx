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
      ? `<th class="left" style="width:18%">Sub Code</th>
         <th style="width:10%">Max</th>
         <th style="width:10%">Internal</th>
         <th style="width:10%">External</th>
         <th style="width:10%">Total</th>
         <th style="width:8%">Grade</th>
         <th style="width:8%">Credits</th>
         <th style="width:8%">Status</th>`
      : `<th class="left" style="width:22%">Sub Code</th>
         <th style="width:12%">Max</th>
         <th style="width:14%">Total Marks</th>
         <th style="width:12%">Grade</th>
         <th style="width:12%">Credits</th>
         <th style="width:10%">Status</th>`;

    const tableRows = results.map(res => {
      const statusCell = `<td class="center" style="color:${res.pass ? '#166534' : '#991b1b'};font-weight:700">${res.pass ? 'P' : 'F'}</td>`;
      const max = (res.maxMarks ?? 100);
      if (hasIntExt) {
        return `<tr>
          <td class="mono">${res.code}</td>
          <td class="center bold">${max}</td>
          <td class="center">${res.intMarks ?? '-'}</td>
          <td class="center">${res.extMarks ?? '-'}</td>
          <td class="center bold">${res.total}</td>
          <td class="center bold" style="${!res.pass ? 'color:#991b1b' : ''}">${res.grade}</td>
          <td class="center">${res.credits}</td>
          ${statusCell}
        </tr>`;
      } else {
        return `<tr>
          <td class="mono">${res.code}</td>
          <td class="center bold">${max}</td>
          <td class="center bold">${res.total}</td>
          <td class="center bold" style="${!res.pass ? 'color:#991b1b' : ''}">${res.grade}</td>
          <td class="center">${res.credits}</td>
          ${statusCell}
        </tr>`;
      }
    }).join('');

    const examMonthYear = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

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

        /* Student detail grid — 6 fields */
        .stu-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 24px; border: 1px solid #000; padding: 8px 12px; margin-bottom: 10px; }
        .field { display: flex; align-items: baseline; margin-bottom: 5px; }
        .lbl { font-weight: 700; font-size: 10px; text-transform: uppercase; width: 150px; flex-shrink: 0; color: #333; }
        .val { font-weight: 600; font-size: 11px; border-bottom: 1px dotted #999; flex: 1; padding-left: 6px; min-height: 15px; }

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

        /* Summary bar */
        .summary-bar { display: flex; border: 1px solid #000; margin-bottom: 12px; }
        .sum-cell { flex: 1; padding: 7px 8px; text-align: center; border-right: 1px solid #000; }
        .sum-cell:last-child { border-right: none; }
        .sum-val { font-family: 'EB Garamond', serif; font-size: 22px; font-weight: 800; display: block; line-height: 1; }
        .sum-lbl { font-size: 9px; font-weight: 700; text-transform: uppercase; color: #555; letter-spacing: 0.05em; display: block; margin-top: 2px; }

        /* Footer */
        .footer { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; border-top: 1px solid #000; padding-top: 8px; }
        .footer-date { font-size: 10px; font-weight: 600; }
        .footer-stamp { text-align: center; }
        .stamp-text { font-family: 'EB Garamond', serif; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; border: 1.5px solid #000; padding: 4px 18px; display: inline-block; }

        @media print {
          .cmm-wrap { border: 2.5px solid #000 !important; }
          .cmm-inner { border: 1px solid #000 !important; }
          table { page-break-inside: avoid; }
        }
      </style>
      <div class="cmm-wrap">
        <div class="cmm-inner">

          <!-- Header -->
          <div class="hdr">
            <img src="${logoUrl}" alt="Logo" class="hdr-logo" />
            <div class="hdr-univ">KRISHNA UNIVERSITY</div>
            <div class="hdr-addr">Machilipatnam – 521004, ANDHRA PRADESH, INDIA</div>
            <div class="hdr-title">Consolidated Marks Memo / Credit Sheet</div>
          </div>

          <!-- Student Details (6 fields only) -->
          <div class="stu-grid">
            <div class="field"><span class="lbl">Student Name</span><span class="val">${studentInfo.name}</span></div>
            <div class="field"><span class="lbl">Hall Ticket No</span><span class="val">${rollNo}</span></div>
            <div class="field"><span class="lbl">College Name</span><span class="val">${COLLEGE_NAME}</span></div>
            <div class="field"><span class="lbl">Month &amp; Year of Exam</span><span class="val">${examMonthYear}</span></div>
            <div class="field"><span class="lbl">Year of Admission</span><span class="val">20${rollNo.substring(1, 3) || '__'}</span></div>
            <div class="field"><span class="lbl">Class Awarded</span><span class="val">${classAwarded}</span></div>
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
              <tr style="background:#f0f0f0">
                <td class="bold" colspan="2">Total</td>
                ${hasIntExt ? `<td class="center bold">—</td><td class="center bold">—</td>` : ''}
                <td class="center bold">${totalMarks} / ${maxMarks}</td>
                <td class="center bold">—</td>
                <td class="center bold">${totalCreditsReg}</td>
                <td class="center bold" style="color:${overallResult === 'PASS' ? '#166534' : '#991b1b'}">${overallResult}</td>
              </tr>
            </tbody>
          </table>

          <!-- Summary Bar -->
          <div class="summary-bar">
            <div class="sum-cell">
              <span class="sum-val">${totalCreditsReg}</span>
              <span class="sum-lbl">Credits Registered</span>
            </div>
            <div class="sum-cell">
              <span class="sum-val">${totalCreditsEarned}</span>
              <span class="sum-lbl">Credits Earned</span>
            </div>
            <div class="sum-cell">
              <span class="sum-val">${totalMarks}</span>
              <span class="sum-lbl">Aggregate Marks</span>
            </div>
            <div class="sum-cell">
              <span class="sum-val">${gpa || 'NA'}</span>
              <span class="sum-lbl">SGPA</span>
            </div>
          </div>

          <!-- Footer -->
          <div class="footer">
            <div class="footer-date">Date of Issue: ${currentDate}</div>
            <div class="footer-stamp">
              <div class="stamp-text">TEMPORARY CMM</div>
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

              <div ref={tableRef} className="rounded-3xl border border-slate-200 overflow-hidden bg-white shadow-sm ring-1 ring-slate-200/50">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50/80 backdrop-blur-sm border-b border-slate-200">
                        <th className="px-6 py-5 text-left font-black text-slate-600 text-[11px] uppercase tracking-widest">Sub Code</th>
                        <th className="px-6 py-5 text-center font-black text-slate-600 text-[11px] uppercase tracking-widest">Max Marks</th>
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
                          <td className="px-6 py-5 text-center text-slate-900 font-black">{res.maxMarks ?? 100}</td>
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