"use client";
import { useState, useRef, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import Image from "next/image";
import dynamic from "next/dynamic";
import { safeTrim } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";

const UNIVERSITY_NAME = "Krishna University";
const COLLEGE_NAME = "College of Engineering and Technology";
const COLLEGE_ADDRESS = "Rudravaram, Machilipatnam-521004, Andhra Pradesh, India";
const UNIVERSITY_LOGO = "/krishna-university-logo.png";
const WEBSITE_LINK = "https://your-website-link.com";

// Helper to get lateral batch prefix
const getLateralPrefix = (batch: string) => {
  const match = batch.match(/^[YLyl](\d+)$/);
  if (!match) return "";
  return `L${parseInt(match[1]) + 1}`;
};

const DEPT_OPTIONS = {
  BTech: ["CSE", "ECE", "AIM"],
  MTech: ["CSE"],
};

// Print styles as a constant
const PRINT_STYLES = `
  @media print {
    @page {
      size: A4 portrait;
      margin: 15mm;
    }
    body {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .no-print {
      display: none !important;
    }
    .print-only {
      display: block !important;
    }
    .print-container {
      width: 100% !important;
      max-width: none !important;
      padding: 0 !important;
      margin: 0 !important;
      box-shadow: none !important;
      border: none !important;
      background: white !important;
    }
    .marksheet {
      font-family: 'Times New Roman', Times, serif !important;
      font-size: 11pt !important;
      line-height: 1.4 !important;
    }
    .marksheet-header {
      text-align: center !important;
      border-bottom: 2px solid #000 !important;
      padding-bottom: 10px !important;
      margin-bottom: 15px !important;
    }
    .marksheet-title {
      font-size: 16pt !important;
      font-weight: bold !important;
      text-transform: uppercase !important;
      margin: 5px 0 !important;
    }
    .student-details {
      display: grid !important;
      grid-template-columns: 120px 1fr 120px 1fr !important;
      gap: 8px !important;
      margin-bottom: 15px !important;
      font-size: 10pt !important;
    }
    .detail-label {
      font-weight: bold !important;
    }
    .subjects-table {
      width: 100% !important;
      border-collapse: collapse !important;
      margin: 15px 0 !important;
      font-size: 10pt !important;
    }
    .subjects-table th,
    .subjects-table td {
      border: 1px solid #000 !important;
      padding: 6px !important;
      text-align: center !important;
    }
    .subjects-table th {
      background: #f0f0f0 !important;
      font-weight: bold !important;
    }
    .subjects-table td:first-child,
    .subjects-table td:nth-child(2) {
      text-align: left !important;
    }
    .summary-section {
      margin-top: 15px !important;
      padding-top: 10px !important;
      border-top: 1px solid #000 !important;
      display: flex !important;
      justify-content: space-between !important;
    }
    .summary-item {
      font-size: 10pt !important;
    }
    .summary-item span {
      font-weight: bold !important;
    }
    .print-footer {
      margin-top: 20px !important;
      padding-top: 10px !important;
      border-top: 1px solid #000 !important;
      display: flex !important;
      justify-content: space-between !important;
      font-size: 9pt !important;
    }
  }
`;

const formatKey = (key: string) => {
  if (!key) return "";
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2') // CamelCase to space
    .replace(/[_-]/g, ' ') // Underscores and dashes to space
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .trim()
    .replace(/\s+/g, ' ');
};

const GROUPS = [
  {
    title: "1. Basic Identification",
    fields: ["s.no", "admissions no", "reg.no", "rollno", "roll", "hall ticket no", "s s c reg.no"]
  },
  {
    title: "2. Student Personal Details",
    fields: ["name of the student", "name", "d.o.b", "gender"]
  },
  {
    title: "3. Family Details",
    fields: ["father name", "mother name", "parent no", "father aadhar no", "mother aadhar no"]
  },
  {
    title: "4. Contact Information",
    fields: ["student no", "phone", "e-mail id", "email"]
  },
  {
    title: "5. Identity Details",
    fields: ["student aadhar no", "aadhar"]
  },
  {
    title: "6. Academic Details",
    fields: ["date of joining", "year", "m o pass", "batch", "department", "branch", "coursetype", "regulation"]
  },
  {
    title: "7. Address Details",
    fields: ["district", "mandalam", "village", "pin no"]
  },
  {
    title: "8. Residential Info",
    fields: ["day schollar/hostel", "residential"]
  },
  {
    title: "9. Category & Social Info",
    fields: ["caste", "sub-caste", "alloted category", "category"]
  },
  {
    title: "10. Scholarship & Admission Process",
    fields: ["schollarship status", "phase"]
  }
];

const getPriorityScore = (key: string) => {
  const k = key.toLowerCase();
  if (k.includes('name') && !k.includes('father') && !k.includes('mother') && !k.includes('parent')) return 1;
  if (k === 'reg.no' || k.includes('roll') || k.startsWith('reg no') || k.startsWith('regno') || k === 'id') return 2;
  if (k === 'branch' || k === 'department' || k === 'course') return 3;
  return 4;
};

const getGroupedFields = (studentObj: Record<string, unknown>) => {
  if (!studentObj) return [];

  const highlightKeys = ["name of the student", "name", "roll no", "reg.no", "rollno", "roll", "department", "branch"];

  const allFields = Object.entries(studentObj)
    .filter(([key, value]) => {
      const lowerKey = key.toLowerCase();
      if (lowerKey === 'updatedat' || lowerKey === 'createdat' || lowerKey.includes('timestamp')) return false;
      if (value === null || value === undefined || value === "") return false;
      if (typeof value === 'object') return false; // skip objects like subjectResults
      return true;
    })
    .map(([key, value]) => {
      const label = formatKey(key);
      return {
        key,
        label,
        value: String(value),
        highlight: highlightKeys.includes(key.toLowerCase()) || highlightKeys.includes(label.toLowerCase())
      };
    });

  const grouped: { title: string, fields: typeof allFields }[] = [];
  const usedKeys = new Set<string>();

  GROUPS.forEach(group => {
    const matchedFields: typeof allFields = [];
    
    // We try to match each predefined field against the student's actual fields
    group.fields.forEach(targetLower => {
      const matchIndex = allFields.findIndex(f => 
        !usedKeys.has(f.key) && 
        (f.key.toLowerCase().trim() === targetLower || f.label.toLowerCase().trim() === targetLower)
      );
      
      if (matchIndex !== -1) {
        matchedFields.push(allFields[matchIndex]);
        usedKeys.add(allFields[matchIndex].key);
      }
    });

    if (matchedFields.length > 0) {
      grouped.push({
        title: group.title,
        fields: matchedFields
      });
    }
  });

  const remainingFields = allFields.filter(f => !usedKeys.has(f.key));
  if (remainingFields.length > 0) {
    remainingFields.sort((a, b) => getPriorityScore(a.key) - getPriorityScore(b.key));
    grouped.push({
      title: "11. Other Details",
      fields: remainingFields
    });
  }

  return grouped;
};

export default function GetStudentDetailsPage() {
  const [courseType, setCourseType] = useState<"BTech" | "MTech">("BTech");
  const [batchNumber, setBatchNumber] = useState("");
  const [branch, setBranch] = useState("");
  const [rollNo, setRollNo] = useState("");
  const batch = batchNumber ? `Y${batchNumber}` : "";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [student, setStudent] = useState<Record<string, unknown> | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const detailsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const handleFetch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setStudent(null);
    setLoading(true);
    try {
      const batchUp = safeTrim(batch).toUpperCase();
      const branchUp = safeTrim(branch).toUpperCase();
      const rollUp = safeTrim(rollNo).toUpperCase();
      const lateralBatch = getLateralPrefix(batchUp);

      // Try new path first: classes/{courseType}/batches/{batch}/departments/{branch}/students/{roll}
      let docSnap = await getDoc(doc(db, "classes", courseType, "batches", batchUp, "departments", branchUp, "students", rollUp));

      // If not found in regular batch, try lateral batch
      if (!docSnap.exists() && lateralBatch) {
        docSnap = await getDoc(doc(db, "classes", courseType, "batches", lateralBatch, "departments", branchUp, "students", rollUp));
      }

      if (!docSnap.exists()) {
        // Fallback: legacy path classes/{batch}/{branch}/{roll}
        let legacySnap = await getDoc(doc(db, `classes/${batchUp}/${branchUp}`, rollUp));
        if (!legacySnap.exists() && lateralBatch) {
          legacySnap = await getDoc(doc(db, `classes/${lateralBatch}/${branchUp}`, rollUp));
        }
        if (!legacySnap.exists()) {
          setError("Student not found. Verify course type, batch, branch and roll number.");
        } else {
          setStudent(legacySnap.data());
        }
      } else {
        setStudent(docSnap.data());
      }
    } catch {
      setError("Error fetching student details.");
    } finally {
      setLoading(false);
    }
  };

  const getDocumentHTML = () => {
    if (!detailsRef.current || !student) return "";
    const logoUrl = window.location.origin + UNIVERSITY_LOGO;
    const studentRoll = String(student["Reg.No"] || student["roll"] || rollNo);
    const studentName = String(student["Name of the Student"] || student["name"] || student["Name"] || "N/A");
    const studentBranch = String(student["Branch"] || student["Department"] || student["branch"] || branch || "N/A");
    const regulation = String(student["Regulation"] || student["regulation"] || "N/A");
    const currentDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    // Extract key student details for the grid format
    const keyFields = [
      { label: "Roll Number", value: studentRoll },
      { label: "Name", value: studentName },
      { label: "Branch", value: studentBranch },
      { label: "Regulation", value: regulation },
      { label: "Batch", value: batch.toUpperCase() },
      { label: "Course", value: courseType === "BTech" ? "B.Tech" : "M.Tech" },
    ];

    // Get all other fields not in the key fields
    const groupedFields = getGroupedFields(student);
    let additionalDetailsHtml = '';
    
    groupedFields.forEach(group => {
      const relevantFields = group.fields.filter(f => 
        !["name of the student", "name", "roll no", "reg.no", "rollno", "roll", "branch", "department", "regulation", "batch", "coursetype"].includes(f.key.toLowerCase())
      );
      if (relevantFields.length > 0) {
        additionalDetailsHtml += `<div class="section-title">${group.title}</div>`;
        additionalDetailsHtml += `<div class="details-grid">`;
        relevantFields.forEach(({ label, value }) => {
          additionalDetailsHtml += `
            <div class="detail-item">
              <div class="detail-label">${label}</div>
              <div class="detail-value">${value}</div>
            </div>
          `;
        });
        additionalDetailsHtml += `</div>`;
      }
    });

    return `
      <style>
        .print-container { max-width: 800px; margin: 0 auto; font-family: 'Times New Roman', Times, serif; color: #1f2937; background: white; padding: 20px; box-sizing: border-box; }
        .print-header { display: flex; align-items: center; justify-content: center; gap: 15px; margin-bottom: 25px; border-bottom: 2px solid #000; padding-bottom: 15px; }
        .print-header img { width: 80px; height: 80px; object-fit: contain; flex-shrink: 0; }
        .print-header .text-container { text-align: center; }
        .print-header h1 { font-size: 1.5rem; font-weight: bold; margin: 0 0 5px 0; color: #000; text-transform: uppercase; letter-spacing: 1px; }
        .print-header h2 { font-size: 1.1rem; font-weight: 600; margin: 0 0 5px 0; color: #333; }
        .print-header p { font-size: 0.85rem; margin: 0; color: #555; }
        
        .document-title { text-align: center; font-size: 1.2rem; margin-bottom: 20px; color: #000; text-transform: uppercase; letter-spacing: 2px; font-weight: bold; border-bottom: 1px solid #ccc; padding-bottom: 10px; }
        
        .student-info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; padding: 15px; background: #f9f9f9; border: 1px solid #ddd; }
        .info-item { display: flex; flex-direction: column; }
        .info-label { font-size: 0.75rem; text-transform: uppercase; font-weight: bold; color: #666; margin-bottom: 3px; }
        .info-value { font-size: 1rem; font-weight: 600; color: #000; }
        
        .section-title { font-size: 0.9rem; font-weight: bold; color: #000; border-bottom: 1px solid #ccc; margin-top: 20px; margin-bottom: 10px; padding-bottom: 5px; text-transform: uppercase; page-break-after: avoid; }
        
        .details-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 15px; }
        .detail-item { background: #fff; border: 1px solid #ddd; padding: 8px 12px; box-sizing: border-box; page-break-inside: avoid; }
        .detail-label { font-size: 0.7rem; text-transform: uppercase; font-weight: bold; color: #666; margin-bottom: 2px; }
        .detail-value { font-size: 0.9rem; font-weight: 500; color: #000; }
        
        .print-footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #000; display: flex; justify-content: space-between; font-size: 0.8rem; color: #333; }
        .footer-left { text-align: left; }
        .footer-right { text-align: right; }
        .signature-line { margin-top: 30px; border-top: 1px solid #000; width: 200px; padding-top: 5px; text-align: center; font-size: 0.75rem; }
        
        @media print {
          @page { size: A4 portrait; margin: 15mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print-container { max-width: 100%; padding: 0; box-shadow: none; border: none; }
          .student-info-grid { background: #f5f5f5 !important; }
        }
      </style>
      <div class="print-container">
        <div class="print-header">
           <img src="${logoUrl}" alt="University Logo" onerror="this.style.display='none'" />
           <div class="text-container">
             <h1>${UNIVERSITY_NAME}</h1>
             <h2>${COLLEGE_NAME}</h2>
             <p>${COLLEGE_ADDRESS}</p>
           </div>
        </div>
        
        <div class="document-title">Student Information Record</div>
        
        <div class="student-info-grid">
          ${keyFields.map(field => `
            <div class="info-item">
              <div class="info-label">${field.label}</div>
              <div class="info-value">${field.value}</div>
            </div>
          `).join('')}
        </div>
        
        ${additionalDetailsHtml}
        
        <div class="print-footer">
          <div class="footer-left">
            <div>Date of Issue: <strong>${currentDate}</strong></div>
          </div>
          <div class="footer-right">
            <div class="signature-line">Controller of Examinations</div>
          </div>
        </div>
      </div>
    `;
  };

  const handlePrint = () => {
    if (window.innerWidth < 768) {
      alert("Print is only available on desktop.");
      return;
    }
    const htmlContent = getDocumentHTML();
    if (!htmlContent) return;

    const printWindow = window.open('', '', 'height=600,width=900');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Student Details</title>
          <style>@page { size: A4 portrait; margin: 15mm; } body { margin: 0; padding: 0; background: white; }</style>
        </head>
        <body>${htmlContent}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      setTimeout(() => printWindow.close(), 500);
    }, 250);
  };


  return (
    <div className="min-h-screen bg-slate-50 relative pointer-events-auto">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-100/30 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
      <div className="absolute top-40 left-0 w-[500px] h-[500px] bg-blue-100/30 rounded-full blur-3xl pointer-events-none -translate-x-1/3"></div>

      <div className="bg-white/80 backdrop-blur-md shadow-sm border-b border-indigo-100/60 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center py-4 w-full gap-4">
            <Link href="/admin-dashboard" className="text-sm font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-2 transition-colors group">
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span>Back to Dashboard</span>
            </Link>
            <div className="h-5 w-px bg-slate-200 hidden sm:block"></div>
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-800 tracking-tight">Student Details</h1>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 relative z-10">
        <div className="w-full max-w-4xl max-w-4xl mx-auto">
          <div className="premium-card p-6 sm:p-8 bg-white border-indigo-100">
            <div className="flex items-center space-x-3 mb-6">
              <div className="bg-indigo-50 p-2 rounded-lg">
                <span className="text-xl">👤</span>
              </div>
              <h2 className="text-lg font-extrabold text-slate-800 tracking-tight">Search Student </h2>
            </div>

            <form onSubmit={handleFetch} className="space-y-6">
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
                        setBranch(""); // Reset branch on course type change
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
                  <label className="label-premium">Batch</label>
                  <div className="flex items-center border rounded-xl overflow-hidden">
                    <span className="bg-slate-100 px-4 py-2 font-bold text-slate-600">Y</span>
                    <input
                      type="text"
                      placeholder="22, 23, 24..."
                      value={batchNumber}
                      onChange={e => setBatchNumber(e.target.value.replace(/[^0-9]/g, ""))}
                      className="flex-1 px-4 py-2 outline-none uppercase font-mono"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="label-premium">Department</label>
                  <select
                    value={branch}
                    onChange={e => setBranch(e.target.value)}
                    className="input-premium font-bold bg-white"
                    required
                  >
                    <option value="" disabled>Select Department</option>
                    {DEPT_OPTIONS[courseType].map((dept: string) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="label-premium">Roll Number</label>
                  <input
                    type="text"
                    placeholder="Y22CSE279001"
                    value={rollNo}
                    onChange={e => setRollNo(e.target.value.toUpperCase())}
                    className="input-premium uppercase font-mono"
                    required
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading || !safeTrim(rollNo) || !safeTrim(batch) || !safeTrim(branch)}
                  className="btn-primary w-full px-8 py-3 flex justify-center items-center font-bold"
                >
                  {loading ? (
                    <div className="flex items-center space-x-2">
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Fetching Data...</span>
                    </div>
                  ) : "Retrieve Details"}
                </button>
              </div>
            </form>

            {error && (
              <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm font-bold flex items-center">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

            {student && (
              <div className="mt-8 pt-8 border-t border-slate-200/60">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Student Information</h2>
                    <p className="text-xs text-indigo-500 font-bold uppercase tracking-wider mt-1">{safeTrim(batch).toUpperCase()} • {safeTrim(branch).toUpperCase()}</p>
                  </div>
                  {!isMobile ? (
                    <button
                      onClick={handlePrint}
                      className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-md transition-all duration-200 flex items-center justify-center space-x-2 print:hidden group print-btn"
                    >
                      <svg className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                      <span>Print Report</span>
                    </button>
                  ) : (
                    <div className="text-xs text-amber-600 font-semibold bg-amber-50 px-3 py-2 rounded-lg border border-amber-200 mt-4 sm:mt-0">
                      Printing is available only on desktop for better formatting.
                    </div>
                  )}
                </div>

                <div ref={detailsRef} className="space-y-8">
                  {student && getGroupedFields(student).map((group, gIdx) => (
                    <div key={gIdx} className="bg-slate-50/50 rounded-2xl border border-slate-200 shadow-inner p-6">
                      <div className="flex items-center space-x-3 mb-5 border-b border-slate-200/60 pb-3">
                        <h3 className="text-sm font-extrabold text-indigo-900 tracking-wide uppercase">{group.title}</h3>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {group.fields.map(({ key, label, value, highlight }) => (
                          <div key={key} className={`p-4 rounded-xl shadow-sm border transition-colors ${highlight ? 'bg-indigo-50/70 border-indigo-200 group hover:border-indigo-400' : 'bg-white border-slate-200/60 group hover:border-slate-300'}`}>
                            <div className={`text-[10px] sm:text-xs font-extrabold uppercase tracking-widest mb-1.5 ${highlight ? 'text-indigo-600' : 'text-slate-500'}`}>{label}</div>
                            <div className="text-sm font-bold text-slate-800 break-words">{value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
