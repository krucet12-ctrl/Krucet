'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getDepartments, DepartmentDetails } from '@/lib/cmsService';

export default function Departments() {
  const [selectedProgram, setSelectedProgram] = useState<'UG' | 'PG'>('UG');
  const [departments, setDepartments] = useState<DepartmentDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const depts = await getDepartments();
      setDepartments(depts);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
          <div className="text-indigo-800 font-semibold animate-pulse tracking-wide">Loading Programs & Departments...</div>
        </div>
      </div>
    );
  }

  const dynamicUG = departments.filter(d => d.programType === 'UG');
  const dynamicPG = departments.filter(d => d.programType === 'PG');

  const programs: Record<'UG' | 'PG', DepartmentDetails[]> = {
    UG: dynamicUG,
    PG: dynamicPG
  };

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'cpu':
        // Heroicons: cpu-chip
        return (
          <svg className="w-8 h-8 sm:w-10 sm:h-10" fill="none" stroke="white" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3v2.25m4.5-2.25V5.25m-7.5 7.5H3m2.25 4.5H5.25m13.5-4.5h2.25m-2.25 4.5h2.25M7.5 21v-2.25m9 2.25V18.75M7.5 7.5h9v9h-9v-9z" />
          </svg>
        );
      case 'brain':
        // Tabler Icons: brain
        return (
          <svg className="w-8 h-8 sm:w-10 sm:h-10" fill="none" stroke="white" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 4a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3m-6 0a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3m0 0V3m6 1V3m-6 18v-1m6 1v-1" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 8a3 3 0 0 1 6 0v8a3 3 0 0 1-6 0V8z" />
          </svg>
        );
      case 'zap':
        // Heroicons: bolt
        return (
          <svg className="w-8 h-8 sm:w-10 sm:h-10" fill="none" stroke="white" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        );
      case 'graduation-cap':
        // Heroicons: academic-cap
        return (
          <svg className="w-8 h-8 sm:w-10 sm:h-10" fill="none" stroke="white" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
          </svg>
        );
      case 'building':
        // Heroicons: building-office
        return (
          <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="orange" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 21V7a2 2 0 012-2h2a2 2 0 012 2v14m0-14h6a2 2 0 012 2v14m0-14h2a2 2 0 012 2v14M9 21v-4a2 2 0 012-2h2a2 2 0 012 2v4" />
          </svg>
        );
      case 'book-open':
        // Heroicons: book-open
        return (
          <svg className="w-8 h-8 sm:w-10 sm:h-10" fill="none" stroke="white" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        );
      default:
        return <span className="text-white text-lg font-bold">{iconName}</span>;
    }
  };

  return (
    <div className="w-full space-y-10 animate-fade-in relative">
      {/* subtle decorative background */}
      <div className="absolute top-20 right-0 w-72 h-72 bg-indigo-200/20 rounded-full blur-3xl pointer-events-none -z-10"></div>
      
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-center space-y-3 sm:space-y-0 sm:space-x-5">
          <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center shadow-inner transform -rotate-3 hover:rotate-0 transition-transform duration-300">
            <svg className="w-7 h-7 sm:w-8 sm:h-8 text-indigo-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 21V7a2 2 0 012-2h2a2 2 0 012 2v14m0-14h6a2 2 0 012 2v14m0-14h2a2 2 0 012 2v14M9 21v-4a2 2 0 012-2h2a2 2 0 012 2v4" />
            </svg>
          </div>
          <div>
            <h1 className="heading-premium !mb-1">Academic Programs</h1>
            <p className="text-base text-gray-600">Krishna University - College of Engineering and Technology</p>
          </div>
        </div>
      </div>

      {/* Program Type Selector */}
      <div className="flex justify-center">
        <div className="bg-white/80 backdrop-blur rounded-xl p-1.5 shadow-sm border border-slate-200/60 inline-flex">
          <div className="flex space-x-1">
            <button
              onClick={() => setSelectedProgram('UG')}
              className={`px-8 py-3 rounded-lg font-bold text-sm sm:text-base transition-all duration-300 ${selectedProgram === 'UG'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
            >
              Undergraduate (UG)
            </button>
            <button
              onClick={() => setSelectedProgram('PG')}
              className={`px-8 py-3 rounded-lg font-bold text-sm sm:text-base transition-all duration-300 ${selectedProgram === 'PG'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
            >
              Postgraduate (PG)
            </button>
          </div>
        </div>
      </div>

      {/* Programs Grid */}
      {programs[selectedProgram].length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {programs[selectedProgram].map((program) => (
            <div key={program.id} className="premium-card !p-0 group flex flex-col">
              {/* Header */}
              <div className={`bg-gradient-to-r ${program.color || 'from-indigo-600 to-blue-500'} p-6 text-white relative overflow-hidden`}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl transform translate-x-10 -translate-y-10 group-hover:bg-white/20 transition-all duration-500"></div>
                <div className="flex items-center space-x-3 relative z-10">
                  <div>
                    <h3 className="text-2xl font-extrabold tracking-tight mb-1">{program.shortName}</h3>
                    <p className="text-sm font-medium opacity-90">{program.name}</p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 md:p-8 space-y-8 flex-grow flex flex-col bg-white">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 group-hover:border-indigo-100 group-hover:bg-indigo-50/30 transition-colors duration-300">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Duration</p>
                    <p className="text-indigo-700 font-extrabold text-lg">{program.duration}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 group-hover:border-indigo-100 group-hover:bg-indigo-50/30 transition-colors duration-300">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Intake</p>
                    <p className="text-blue-700 font-extrabold text-lg">{program.intake}</p>
                  </div>
                </div>

                <div className="mt-auto pt-2">
                  <Link
                    href={`/departments/${program.id}`}
                    className="btn-primary w-full"
                  >
                    View Department
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="premium-card flex items-center justify-center text-center p-16 border-dashed bg-slate-50/50">
          <p className="text-slate-500 text-lg font-semibold border border-slate-200 bg-white px-6 py-3 rounded-full shadow-sm">Content not available</p>
        </div>
      )}

      {/* CTA */}
      <section className="bg-gradient-to-br from-indigo-700 via-blue-800 to-indigo-900 rounded-3xl p-10 sm:p-14 text-white shadow-2xl text-center relative overflow-hidden mt-12">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('/grid.svg')] opacity-10 pointer-events-none"></div>
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500 rounded-full blur-3xl opacity-30"></div>
        <div className="relative z-10 max-w-3xl mx-auto space-y-6">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight drop-shadow-sm">Ready to Begin Your Engineering Journey?</h2>
          <p className="text-indigo-100 text-lg sm:text-xl font-medium drop-shadow-sm">Join KRUCET and become part of our legacy of engineering excellence</p>
          <div className="pt-4">
            <a
              href="https://kru.ac.in"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center bg-white text-indigo-700 font-extrabold py-3.5 px-10 rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 hover:bg-slate-50 transition-all duration-300 text-base"
            >
              Visit Official Website
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}