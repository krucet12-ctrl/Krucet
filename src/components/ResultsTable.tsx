import React from 'react';

interface ResultData {
  code: string;
  name?: string;
  maxMarks?: number;
  total: number;
  credits: number;
  grade: string;
  pass: boolean;
  intMarks?: number;
  extMarks?: number;
}

interface ResultsTableProps {
  results: ResultData[];
  variant?: 'screen' | 'print';
  showInternalExternal?: boolean;
}

export const ResultsTable: React.FC<ResultsTableProps> = ({
  results,
  variant = 'screen',
  showInternalExternal = false,
}) => {
  const isPrint = variant === 'print';

  const getStatus = (passed: boolean): string => {
    return passed ? 'Pass' : 'Fail';
  };

  if (isPrint) {
    // Print variant - returns HTML string compatible with getDocumentHTML
    const headers = showInternalExternal
      ? `<th style="width:15%">Sub Code</th>
         <th style="width:20%">Subject Name</th>
         <th style="width:8%">Max</th>
         <th style="width:8%">Internal</th>
         <th style="width:8%">External</th>
         <th style="width:8%">Total</th>
         <th style="width:8%">Grade</th>
         <th style="width:8%">Credits</th>
         <th style="width:9%">Status</th>`
      : `<th style="width:15%">Sub Code</th>
         <th style="width:25%">Subject Name</th>
         <th style="width:10%">Max Marks</th>
         <th style="width:12%">Obtained</th>
         <th style="width:10%">Credits</th>
         <th style="width:8%">Grade</th>
         <th style="width:10%">Status</th>`;

    const rows = results.map((res) => {
      const statusColor = res.pass ? '#166534' : '#991b1b';
      const maxMarks = res.maxMarks ?? 100;
      
      if (showInternalExternal) {
        return `<tr>
          <td class="mono" style="font-weight:600">${res.code}</td>
          <td style="text-align:left;font-size:10px">${res.name || '—'}</td>
          <td class="center bold">${maxMarks}</td>
          <td class="center">${res.intMarks ?? '—'}</td>
          <td class="center">${res.extMarks ?? '—'}</td>
          <td class="center bold">${res.total}</td>
          <td class="center bold" style="color:${!res.pass ? statusColor : ''}">${res.grade}</td>
          <td class="center">${res.credits}</td>
          <td class="center" style="color:${statusColor};font-weight:700">${getStatus(res.pass)}</td>
        </tr>`;
      } else {
        return `<tr>
          <td class="mono" style="font-weight:600">${res.code}</td>
          <td style="text-align:left;font-size:10px">${res.name || '—'}</td>
          <td class="center bold">${maxMarks}</td>
          <td class="center bold">${res.total}</td>
          <td class="center">${res.credits}</td>
          <td class="center bold" style="color:${!res.pass ? statusColor : ''}">${res.grade}</td>
          <td class="center" style="color:${statusColor};font-weight:700">${getStatus(res.pass)}</td>
        </tr>`;
      }
    }).join('');

    return `<thead><tr>${headers}</tr></thead><tbody>${rows}</tbody>`;
  }

  // Screen variant - React component
  return (
    <div className="rounded-3xl border border-slate-200 overflow-hidden bg-white shadow-sm ring-1 ring-slate-200/50">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50/80 backdrop-blur-sm border-b border-slate-200">
              <th className="px-6 py-5 text-left font-black text-slate-600 text-[11px] uppercase tracking-widest min-w-[120px]">
                Sub Code
              </th>
              <th className="px-6 py-5 text-left font-black text-slate-600 text-[11px] uppercase tracking-widest min-w-[200px]">
                Subject Name
              </th>
              <th className="px-6 py-5 text-center font-black text-slate-600 text-[11px] uppercase tracking-widest min-w-[100px]">
                Max Marks
              </th>
              <th className="px-6 py-5 text-center font-black text-slate-600 text-[11px] uppercase tracking-widest min-w-[120px]">
                Obtained
              </th>
              <th className="px-6 py-5 text-center font-black text-slate-600 text-[11px] uppercase tracking-widest min-w-[90px]">
                Credits
              </th>
              <th className="px-6 py-5 text-center font-black text-slate-600 text-[11px] uppercase tracking-widest min-w-[80px]">
                Grade
              </th>
              <th className="px-6 py-5 text-center font-black text-slate-600 text-[11px] uppercase tracking-widest min-w-[100px]">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {results.map((res, idx) => (
              <tr
                key={idx}
                className={`hover:bg-indigo-50/20 transition-all group ${
                  idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                }`}
              >
                <td className="px-6 py-5 font-mono text-slate-500 font-bold group-hover:text-indigo-600 transition-colors">
                  {res.code}
                </td>
                <td className="px-6 py-5 text-slate-700 text-sm">
                  {res.name || '—'}
                </td>
                <td className="px-6 py-5 text-center text-slate-900 font-black">
                  {res.maxMarks ?? 100}
                </td>
                <td className="px-6 py-5 text-center text-slate-900 font-black text-base">
                  {res.total}
                </td>
                <td className="px-6 py-5 text-center text-slate-900 font-black">
                  {res.credits}
                </td>
                <td className="px-6 py-5 text-center">
                  <span
                    className={`text-base font-black transition-transform inline-block group-hover:scale-110 ${
                      res.pass ? 'text-slate-800' : 'text-red-600'
                    }`}
                  >
                    {res.grade}
                  </span>
                </td>
                <td className="px-6 py-5 text-center">
                  <div
                    className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider inline-block ${
                      res.pass
                        ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                    }`}
                  >
                    {res.pass ? '✓ Pass' : '✗ Fail'}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ResultsTable;
