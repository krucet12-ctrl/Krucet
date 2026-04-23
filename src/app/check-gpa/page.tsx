'use client';
import { useState, useRef, useEffect } from 'react';
import { safeTrim } from '@/lib/utils';

interface StudentInfo {
  name: string;
  roll: string;
  branch: string;
}

interface SemesterDetail {
  credits: number | null;
  gradePoints: number | null;
  gpa: number | null;
}

const UNIVERSITY_NAME = "Krishna University";
const COLLEGE_NAME = "College of Engineering and Technology";
const COLLEGE_ADDRESS = "Rudravaram, Machilipatnam-521004, Andhra Pradesh, India";
const UNIVERSITY_LOGO = "/krishna-university-logo.png";
const WEBSITE_LINK = "https://your-website-link.com";


const CheckGpaPage = () => {
  const [roll, setRoll] = useState('');
  const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null);
  const [cgpa, setCgpa] = useState<string | null>(null);
  const [percentage, setPercentage] = useState<string | null>(null);
  const [semestersWithResults, setSemestersWithResults] = useState<string[]>([]);
  const [semesterDetails, setSemesterDetails] = useState<{ [semester: string]: SemesterDetail }>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDesktop, setIsDesktop] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

  const validateRollNumberFormat = (rollNo: string): boolean => {
    if (!rollNo || typeof rollNo !== 'string' || safeTrim(rollNo) === '') return false;
    const format = /^[A-Z]\d{2}[A-Z]+\d{3}\d{3}$/;
    return format.test(safeTrim(rollNo));
  };

  const updateScreenType = () => {
    const width = window.innerWidth;
    setIsMobile(width < 768);
    setIsDesktop(width >= 1024);
  };

  useEffect(() => {
    updateScreenType();
    window.addEventListener('resize', updateScreenType);
    return () => window.removeEventListener('resize', updateScreenType);
  }, []);


  const handleRollNumberChange = (value: string) => {
    setRoll(value.toUpperCase());
  };

  const fetchCGPA = async () => {
    const cleanRollNo = roll ? safeTrim(roll) : '';
    if (!cleanRollNo) {
      setError('Please enter a valid roll number.');
      return;
    }
    if (!validateRollNumberFormat(cleanRollNo)) {
      setError('Invalid roll number format. Expected format: Y22CSE279001 (e.g., Y(batch) + Branch + College + Number)');
      return;
    }
    setError('');
    setCgpa(null);
    setPercentage(null);
    setStudentInfo(null);
    setSemestersWithResults([]);
    setSemesterDetails({});
    setLoading(true);
    try {
      const response = await fetch('/api/get-student-cgpa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rollNo: cleanRollNo.toUpperCase() }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'An error occurred.');
      }
      setStudentInfo(data.student);
      const cgpaVal = Number(data.cgpa);
      setCgpa(!Number.isNaN(cgpaVal) ? cgpaVal.toFixed(2) : null);
      setPercentage(!Number.isNaN(cgpaVal) ? (cgpaVal * 10).toFixed(2) : null);
      setSemestersWithResults(data.semestersWithResults || []);
      setSemesterDetails(data.semesterDetails || {});
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error fetching CGPA.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (window.innerWidth < 768) {
      window.alert('Printing is only available on desktop or laptop devices.');
      return;
    }

    const logoUrl = window.location.origin + UNIVERSITY_LOGO;
    const studentName = studentInfo?.name || '';
    const studentRoll = studentInfo?.roll || '';
    const studentBranch = studentInfo?.branch || '';

    const getRegulation = (rollNo: string) => {
      const match = rollNo.match(/^([YL]\d{2})/i);
      if (!match) return 'R20';
      const batch = match[1].toUpperCase();
      if (['Y20', 'Y21'].includes(batch)) return 'R18';
      return 'R20';
    };

    const regulation = getRegulation(studentRoll);
    const finalCGPA = cgpa ? Number(cgpa) : null;

    const classAwarded = finalCGPA !== null
      ? finalCGPA >= 8.0 ? 'First Class with Distinction'
        : finalCGPA >= 7.0 ? 'First Class'
        : finalCGPA >= 6.0 ? 'Second Class'
        : finalCGPA >= 5.0 ? 'Pass Class'
        : 'Fail'
      : 'N/A';

    const totalCreditsAll = semestersWithResults.reduce(
      (acc, sem) => acc + (semesterDetails[sem]?.credits ?? 0), 0
    );
    const totalGradePoints = semestersWithResults.reduce(
      (acc, sem) => acc + (semesterDetails[sem]?.gradePoints ?? 0), 0
    );

    const currentDate = new Date().toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric'
    });

    const semRows = semestersWithResults.map((sem) => {
      const d = semesterDetails[sem] || { credits: null, gpa: null, gradePoints: null };
      const semLabel = sem.replace('SEM', 'Semester ');
      const sgpa = d.gpa !== null && d.gpa !== undefined ? Number(d.gpa).toFixed(2) : '-';
      const credits = d.credits ?? '-';
      const gpoints = d.gradePoints ?? '-';
      return `
        <tr>
          <td>${semLabel}</td>
          <td class="center">${credits}</td>
          <td class="center">${gpoints}</td>
          <td class="center bold">${sgpa}</td>
        </tr>`;
    }).join('');

    // Month & Year of most recent semester exam
    const lastSem = semestersWithResults[semestersWithResults.length - 1] || '';
    const lastSemNum = parseInt(lastSem.replace('SEM', '')) || 0;
    const examMonthYear = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

    // Group semesters by year for display
    const yearGroups: { label: string; sems: string[] }[] = [
      { label: 'I YEAR', sems: semestersWithResults.filter(s => [1,2].includes(parseInt(s.replace('SEM','')))) },
      { label: 'II YEAR', sems: semestersWithResults.filter(s => [3,4].includes(parseInt(s.replace('SEM','')))) },
      { label: 'III YEAR', sems: semestersWithResults.filter(s => [5,6].includes(parseInt(s.replace('SEM','')))) },
      { label: 'IV YEAR', sems: semestersWithResults.filter(s => [7,8].includes(parseInt(s.replace('SEM','')))) },
    ].filter(g => g.sems.length > 0);

    const semTableRows = yearGroups.map(group => {
      const yearRow = `<tr style="background:#e8e8e8"><td colspan="5" style="font-weight:800;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;padding:4px 7px">${group.label}</td></tr>`;
      const semRows = group.sems.map(sem => {
        const d = semesterDetails[sem] || { credits: null, gpa: null, gradePoints: null };
        const semInYear = parseInt(sem.replace('SEM','')) % 2 === 1 ? 'I Semester' : 'II Semester';
        const sgpa = d.gpa !== null && d.gpa !== undefined ? Number(d.gpa).toFixed(2) : '-';
        return `<tr>
          <td style="padding-left:14px">${semInYear}</td>
          <td class="center">${d.credits ?? '-'}</td>
          <td class="center">${d.gradePoints ?? '-'}</td>
          <td class="center bold">${sgpa}</td>
        </tr>`;
      }).join('');
      return yearRow + semRows;
    }).join('');

    const printWindow = window.open('', '', 'height=900,width=730');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Temporary CMM - ${studentRoll}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;500;600;700;800&family=Source+Sans+3:wght@400;600;700&display=swap');
            @page { size: A4 portrait; margin: 10mm 12mm; }
            *, *::before, *::after { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            html, body { margin: 0; padding: 0; background: #fff; color: #000; font-family: 'Source Sans 3', sans-serif; font-size: 11px; }

            .cmm-wrap { border: 2.5px solid #000; padding: 3px; width: 100%; }
            .cmm-inner { border: 1px solid #000; padding: 16px 20px 14px; }

            /* Header */
            .hdr { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 10px; }
            .hdr-logo { width: 64px; height: 64px; object-fit: contain; display: block; margin: 0 auto 6px; }
            .hdr-univ { font-family: 'EB Garamond', serif; font-size: 20px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; line-height: 1.2; margin: 0; }
            .hdr-addr { font-size: 11px; color: #222; margin: 3px 0 0; font-weight: 500; }
            .hdr-title { display: inline-block; margin-top: 9px; border: 1px solid #000; padding: 3px 22px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; }

            /* Student Details */
            .stu-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 24px; border: 1px solid #000; padding: 8px 12px; margin-bottom: 10px; }
            .field { display: flex; align-items: baseline; margin-bottom: 5px; }
            .lbl { font-weight: 700; font-size: 10px; text-transform: uppercase; width: 150px; flex-shrink: 0; color: #333; }
            .val { font-weight: 600; font-size: 11px; border-bottom: 1px dotted #999; flex: 1; padding-left: 6px; min-height: 15px; }

            /* Table */
            table { width: 100%; border-collapse: collapse; margin-bottom: 10px; page-break-inside: avoid; font-size: 11px; }
            th { border: 1px solid #000; padding: 5px 7px; background: #f0f0f0; font-weight: 700; text-transform: uppercase; font-size: 10px; text-align: center; }
            th.left { text-align: left; }
            td { border: 1px solid #000; padding: 5px 7px; }
            td.center { text-align: center; }
            td.bold { font-weight: 700; }

            /* Summary */
            .summary-bar { display: flex; border: 1px solid #000; margin-bottom: 12px; }
            .sum-cell { flex: 1; padding: 7px 8px; text-align: center; border-right: 1px solid #000; }
            .sum-cell:last-child { border-right: none; }
            .sum-val { font-family: 'EB Garamond', serif; font-size: 20px; font-weight: 800; display: block; line-height: 1; }
            .sum-lbl { font-size: 9px; font-weight: 700; text-transform: uppercase; color: #555; letter-spacing: 0.05em; display: block; margin-top: 2px; }

            /* Footer */
            .footer { margin-top: 12px; border-top: 1px solid #000; padding-top: 8px; display: flex; justify-content: space-between; align-items: center; }
            .footer-date { font-size: 10px; font-weight: 600; }
            .footer-stamp { text-align: center; }
            .stamp-text { font-family: 'EB Garamond', serif; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; border: 1.5px solid #000; padding: 4px 18px; display: inline-block; }

            @media print {
              html, body { background: #fff; }
              .cmm-wrap { border: 2.5px solid #000 !important; }
              .cmm-inner { border: 1px solid #000 !important; }
              table { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="cmm-wrap">
            <div class="cmm-inner">

              <!-- Header -->
              <div class="hdr">
                <img src="${logoUrl}" alt="Logo" class="hdr-logo" />
                <div class="hdr-univ">KRISHNA UNIVERSITY</div>
                <div class="hdr-addr">Machilipatnam – 521004, ANDHRA PRADESH, INDIA</div>
                <div class="hdr-title">Consolidated Marks Memo / Credit Sheet</div>
              </div>

              <!-- Student Details -->
              <div class="stu-grid">
                <div class="field"><span class="lbl">Student Name</span><span class="val">${studentName || '-'}</span></div>
                <div class="field"><span class="lbl">Hall Ticket No</span><span class="val">${studentRoll || '-'}</span></div>
                <div class="field"><span class="lbl">College Name</span><span class="val">${COLLEGE_NAME}</span></div>
                <div class="field"><span class="lbl">Month &amp; Year of Exam</span><span class="val">${examMonthYear}</span></div>
                <div class="field"><span class="lbl">Year of Admission</span><span class="val">20${studentRoll.substring(1, 3) || '__'}</span></div>
                <div class="field"><span class="lbl">Class Awarded</span><span class="val">${classAwarded}</span></div>
              </div>

              <!-- Semester-wise Table -->
              <table>
                <thead>
                  <tr>
                    <th class="left" style="width:28%">Semester</th>
                    <th style="width:22%">Credits Registered</th>
                    <th style="width:22%">Grade Points Earned</th>
                    <th style="width:20%">SGPA</th>
                  </tr>
                </thead>
                <tbody>
                  ${semTableRows || '<tr><td colspan="4" class="center">No semester data available</td></tr>'}
                  <tr style="background:#f0f0f0">
                    <td class="bold">Total</td>
                    <td class="center bold">${totalCreditsAll}</td>
                    <td class="center bold">${totalGradePoints}</td>
                    <td class="center bold">—</td>
                  </tr>
                </tbody>
              </table>

              <!-- Summary Bar -->
              <div class="summary-bar">
                <div class="sum-cell">
                  <span class="sum-val">${totalCreditsAll}</span>
                  <span class="sum-lbl">Credits Registered</span>
                </div>
                <div class="sum-cell">
                  <span class="sum-val">${totalGradePoints}</span>
                  <span class="sum-lbl">Aggregate Marks / Points</span>
                </div>
                <div class="sum-cell">
                  <span class="sum-val">${finalCGPA !== null ? finalCGPA.toFixed(2) : 'N/A'}</span>
                  <span class="sum-lbl">CGPA</span>
                </div>
                <div class="sum-cell">
                  <span class="sum-val">${percentage ? percentage + '%' : 'N/A'}</span>
                  <span class="sum-lbl">Percentage</span>
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
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();

    const printAction = () => {
      setTimeout(() => {
        printWindow.print();
        setTimeout(() => {
          printWindow.close();
        }, 500);
      }, 500);
    };

    if ('onload' in printWindow) {
      printWindow.onload = printAction;
      setTimeout(printAction, 1200);
    } else {
      setTimeout(printAction, 1200);
    }
  };


  return (
    <div className="w-full space-y-8 animate-fade-in relative">
      <div className="absolute top-0 right-0 w-80 h-80 bg-blue-100/20 rounded-full blur-3xl pointer-events-none -z-10"></div>
      
      <div className="text-center relative">
        <h1 className="heading-premium inline-block relative">
          Check CGPA
          <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-16 h-1 bg-indigo-600 rounded-full"></div>
        </h1>
        <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto mt-6 font-medium">
          Enter your roll number to instantly check your Cumulative Grade Point Average (CGPA) and academic performance.
        </p>
      </div>

      <div className="premium-card max-w-3xl mx-auto">
        <h2 className="text-xl font-extrabold text-slate-800 mb-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          Enter Details
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
              onKeyPress={e => e.key === 'Enter' && fetchCGPA()}
            />
            <button
              onClick={fetchCGPA}
              className="btn-primary sm:w-auto min-w-[140px]"
              disabled={loading || !roll}
            >
              {loading ? 'Fetching...' : 'Get CGPA'}
            </button>
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-center text-sm font-medium">
              {error}
            </div>
          )}
        </div>
      </div>

      {cgpa && studentInfo && (
        <div ref={tableRef} className="premium-card mt-8 animate-fade-in border-indigo-100/50 bg-gradient-to-br from-white to-indigo-50/30">
          {!isMobile ? (
            <div className="flex justify-end mb-6 print-hidden">
              <button
                onClick={handlePrint}
                className="btn-secondary print-btn text-sm px-5 py-2.5"
                disabled={isMobile}
              >
                📄 Print CMM Report
              </button>
            </div>
          ) : (
            <div className="mb-6 px-3 py-2 bg-yellow-100 border border-yellow-200 text-yellow-800 rounded-lg text-sm">
              Printing is available only on desktop or laptop screens for better formatting.
            </div>
          )}
          <div className="text-center space-y-8">
            <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-100 print-hidden">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
                <div className="flex flex-col items-center">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Student Name</h3>
                  <p className="text-lg text-slate-800 font-extrabold">{studentInfo.name}</p>
                </div>
                <div className="flex flex-col items-center border-t sm:border-t-0 sm:border-x border-slate-100 pt-4 sm:pt-0">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Roll Number</h3>
                  <p className="text-lg text-indigo-700 font-extrabold font-mono tracking-wider">{studentInfo.roll}</p>
                </div>
                <div className="flex flex-col items-center border-t sm:border-t-0 border-slate-100 pt-4 sm:pt-0">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Branch</h3>
                  <p className="text-lg text-slate-800 font-extrabold">{studentInfo.branch}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-indigo-600 via-blue-700 to-indigo-800 rounded-3xl p-10 sm:p-12 text-white shadow-xl mx-auto max-w-3xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl transform translate-x-10 -translate-y-10 group-hover:bg-white/20 transition-all duration-700"></div>
              <div className="relative z-10">
                <h3 className="text-sm font-extrabold text-indigo-100 uppercase tracking-widest mb-8">Aggregate Performance</h3>
                <div className="flex flex-col sm:flex-row items-center justify-center space-y-8 sm:space-y-0 sm:space-x-16">
                  <div className="text-center">
                    <div className="text-6xl sm:text-7xl font-extrabold mb-2 tracking-tighter drop-shadow-md">{cgpa}</div>
                    <div className="text-sm text-indigo-100 font-bold uppercase tracking-widest">CGPA</div>
                  </div>
                  <div className="w-24 h-px sm:w-px sm:h-24 bg-white/20"></div>
                  <div className="text-center">
                    <div className="text-6xl sm:text-7xl font-extrabold mb-2 tracking-tighter drop-shadow-md">{percentage}%</div>
                    <div className="text-sm text-indigo-100 font-bold uppercase tracking-widest">Percentage</div>
                  </div>
                </div>
              </div>
            </div>
            {semestersWithResults.length > 0 && semesterDetails && (
              <div className="bg-white rounded-2xl p-0 shadow-sm mt-6 overflow-hidden border border-slate-200/60 max-w-4xl mx-auto">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 cursor-default">
                  <h4 className="font-extrabold text-slate-700 text-sm text-left flex items-center gap-2">
                    <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Semester-wise Performance
                  </h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="bg-white border-b border-slate-100">
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">Semester</th>
                        <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">GPA</th>
                        <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">Credits</th>
                        <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">Points</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {semestersWithResults
                        .filter(sem => semesterDetails && semesterDetails[sem])
                        .map(sem => (
                          <tr key={sem} className="hover:bg-indigo-50/40 transition-colors">
                            <td className="px-6 py-3 font-semibold text-sm text-slate-800 text-left">{sem.replace('SEM', 'Sem ')}</td>
                            <td className="px-6 py-3 text-center text-sm text-indigo-700 font-extrabold">
                              {semesterDetails[sem]?.gpa !== null && semesterDetails[sem]?.gpa !== undefined
                                ? semesterDetails[sem]?.gpa?.toFixed(2)
                                : '-'}
                            </td>
                            <td className="px-6 py-3 text-center text-sm text-slate-600 font-medium">
                              {semesterDetails[sem]?.credits !== null && semesterDetails[sem]?.credits !== undefined
                                ? semesterDetails[sem]?.credits
                                : '-'}
                            </td>
                            <td className="px-6 py-3 text-center text-sm text-slate-600 font-medium">
                              {semesterDetails[sem]?.gradePoints !== null && semesterDetails[sem]?.gradePoints !== undefined
                                ? semesterDetails[sem]?.gradePoints
                                : '-'}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckGpaPage;