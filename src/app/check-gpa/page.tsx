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

    const getCourse = (rollNo: string) => {
      if (!rollNo) return 'B.Tech';
      return 'B.Tech';
    };

    const getRegulation = (rollNo: string) => {
      const match = rollNo.match(/^([YL]\d{2})/i);
      if (!match) return 'R20';
      const batch = match[1].toUpperCase();
      if (['Y20', 'Y21'].includes(batch)) return 'R18';
      return 'R20';
    };

    const course = getCourse(studentRoll);
    const regulation = getRegulation(studentRoll);

    const semesterRows = semestersWithResults
      .map((sem) => {
        const semDetail = semesterDetails[sem] || { credits: null, gpa: null };
        const totalCredits = semDetail.credits ?? 0;
        const earnedCredits = semDetail.gpa ? totalCredits : 0;
        const sgpa = semDetail.gpa !== null && semDetail.gpa !== undefined ? semDetail.gpa.toFixed(2) : '-';

        return `
          <tr>
            <td>${sem.replace('SEM', 'Semester ')}</td>
            <td class="center">${totalCredits}</td>
            <td class="center">${earnedCredits}</td>
            <td class="center">${sgpa}</td>
          </tr>
        `;
      })
      .join('');

    const finalCGPA = cgpa ? Number(cgpa) : null;
    const classAwarded = finalCGPA !== null
      ? finalCGPA >= 8.0 ? 'First Class with Distinction'
        : finalCGPA >= 7.0 ? 'First Class'
        : finalCGPA >= 6.0 ? 'Second Class'
        : finalCGPA >= 5.0 ? 'Pass Class'
        : 'Fail'
      : 'N/A';

    const currentDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    const printWindow = window.open('', '', 'height=900,width=680');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Student Information Certificate - ${studentRoll}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600;700;800&family=Inter:wght@400;500;600;700&display=swap');
            @page { size: A4 portrait; margin: 10mm; }
            * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            html, body { margin: 0; padding: 0; width: 210mm; min-height: 297mm; background: #fff; color: #111827; font-family: 'Inter', sans-serif; }

            .memo-outer { border: 1px solid #333; padding: 1mm; width: 210mm; margin: 0 auto; background: #fff; }
            .memo-inner { border: 2px solid #333; padding: 14px 20px; }

            .header { display: flex; align-items: center; justify-content: center; margin-bottom: 12px; border-bottom: 1px solid #000; padding-bottom: 8px; gap: 12px; flex-wrap: wrap; }
            .logo { width: 70px; height: 70px; object-fit: contain; flex-shrink: 0; }
            .text-container { flex: 1; min-width: 0; text-align: center; }
            .university-name { font-family: 'Crimson Pro', serif; font-size: 22px; font-weight: 800; margin: 0; text-transform: uppercase; color: #000; white-space: normal; word-break: break-word; overflow-wrap: anywhere; }
            .header h2 { font-size: 13px; font-weight: 700; margin: 4px 0 0; color: #333; }
            .header p { font-size: 10px; margin: 2px 0; color: #555; font-weight: 500; }
            .memo-title { margin-top: 10px; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }

            @media screen and (max-width: 768px) {
              .header { flex-direction: column; align-items: flex-start; }
              .text-container { text-align: left; }
              .university-name { font-size: 16px; line-height: 1.3; }
            }

            .section { margin-bottom: 10px; }
            .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; border-bottom: 1px solid #333; padding-bottom: 4px; margin-bottom: 8px; }
            .details-grid { display: grid; grid-template-columns: 130px 1fr; gap: 6px 14px; }
            .field { display: flex; }
            .label { font-weight: 700; width: 130px; text-transform: uppercase; font-size: 10px; color: #444; }
            .value { font-weight: 600; color: #111827; border-bottom: 1px dotted #ccc; padding-left: 4px; }

            .table { width: 100%; border-collapse: collapse; margin-top: 8px; page-break-inside: avoid; }
            .table th, .table td { border: 1px solid #000; padding: 6px; font-size: 11px; }
            .table th { background: #f2f2f2; font-weight: 700; text-transform: uppercase; }
            .center { text-align: center; }

            .footer { display: flex; justify-content: space-between; margin-top: 18px; align-items: flex-start; font-size: 10px; }
            .date-sec { font-weight: 600; }
            .sign-block { width: 48%; text-align: right; }
            .sign-line { margin-top: 25px; width: 180px; border-bottom: 1px solid #334155; }

            @media print {
              @page { size: A4 portrait; margin: 10mm; }
              body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .print-hidden, button, input, .hidden-print, .navbar, nav, .btn-primary, .btn-secondary, .input-premium { display: none !important; }
              .memo-outer { border: none; margin: 0; width: 100%; padding: 0; }
              .memo-inner { border: none; padding: 0; }
              .section, .details-grid, .table { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="memo-outer">
            <div class="memo-inner">
              <div class="header">
                <img src="${logoUrl}" alt="University Logo" class="logo" />
                <div class="text-container">
                  <h1 class="university-name">${UNIVERSITY_NAME}</h1>
                  <h2>${COLLEGE_NAME}</h2>
                  <p>${COLLEGE_ADDRESS}</p>
                  <div class="memo-title">Student Information Certificate</div>
                </div>
              </div>

              <div class="section">
                <div class="section-title">Basic Identification</div>
                <div class="details-grid">
                  <div class="field"><span class="label">Name:</span><span class="value">${studentName || '-'}</span></div>
                  <div class="field"><span class="label">Roll Number:</span><span class="value">${studentRoll || '-'}</span></div>
                  <div class="field"><span class="label">Course:</span><span class="value">${course}</span></div>
                  <div class="field"><span class="label">Branch:</span><span class="value">${studentBranch || '-'}</span></div>
                  <div class="field"><span class="label">Regulation:</span><span class="value">${regulation || '-'}</span></div>
                  <div class="field"><span class="label">Date of Issue:</span><span class="value">${currentDate}</span></div>
                </div>
              </div>

              <div class="section">
                <div class="section-title">Academic Details</div>
                <div class="details-grid">
                  <div class="field"><span class="label">CGPA:</span><span class="value">${finalCGPA !== null ? finalCGPA.toFixed(2) : 'NA'}</span></div>
                  <div class="field"><span class="label">Percentage:</span><span class="value">${percentage ? percentage + '%' : 'NA'}</span></div>
                  <div class="field"><span class="label">Class Awarded:</span><span class="value">${classAwarded}</span></div>
                </div>
                <table class="table">
                  <thead>
                    <tr>
                      <th>Semester</th>
                      <th>Total Credits</th>
                      <th>Credits Earned</th>
                      <th>SGPA</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${semesterRows || '<tr><td colspan="4" class="center">No semester data available</td></tr>'}
                  </tbody>
                </table>
              </div>

              <div class="section">
                <div class="section-title">Other Details</div>
                <div class="details-grid">
                  ${Object.entries(studentInfo || {}).filter(([key]) => !['name','roll','branch'].includes(key)).map(([key, value]) => `\
                    <div class="field"><span class="label">${key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}:</span><span class="value">${value || '-'}</span></div>\
                  `).join('') || '<div class="field"><span class="label">Note:</span><span class="value">No additional fields</span></div>'}
                </div>
              </div>

              <div class="footer">
                <div class="date-sec">Date of Issue: ${currentDate}</div>
                <div class="sign-block">
                  <div>Authorized Signature</div>
                  <div class="sign-line"></div>
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
      // fallback if onload doesn't fire on mobile
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
                📄 Print Report
              </button>
              <button
                className="btn-secondary download-btn text-sm px-5 py-2.5 ml-3"
                onClick={() => alert('PDF download is available on desktop only')}
                disabled={isMobile}
              >
                📥 Download PDF
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