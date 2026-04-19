'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';

import { getDepartmentById, getFacultyMembers, DepartmentDetails, FacultyMember } from '@/lib/cmsService';
import { useState, useEffect } from 'react';

export default function DepartmentDetail() {
  const params = useParams();
  const departmentId = params.id as string;

  const [department, setDepartment] = useState<DepartmentDetails | null>(null);
  const [faculty, setFaculty] = useState<FacultyMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [deptDetails, facDetails] = await Promise.all([
        getDepartmentById(departmentId),
        getFacultyMembers(departmentId)
      ]);

      if (deptDetails) {
        setDepartment(deptDetails);
        setFaculty(facDetails);
      }
      setLoading(false);
    }
    load();
  }, [departmentId]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
          <div className="text-indigo-800 font-semibold animate-pulse tracking-wide">Loading Department Details...</div>
        </div>
      </div>
    );
  }

  if (!department) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Department Not Found</h1>
          <Link href="/departments" className="text-blue-600 hover:underline">
            Back to Departments
          </Link>
        </div>
      </div>
    );
  }

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'cpu':
        return (
          <svg className="w-8 h-8 sm:w-10 sm:h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
          </svg>
        );
      case 'brain':
        return (
          <svg className="w-8 h-8 sm:w-10 sm:h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        );
      case 'zap':
        return (
          <svg className="w-8 h-8 sm:w-10 sm:h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        );
      case 'graduation-cap':
        return (
          <svg className="w-8 h-8 sm:w-10 sm:h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
          </svg>
        );
      case 'users':
        return (
          <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
          </svg>
        );
      case 'book-open':
        return (
          <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full animate-fade-in space-y-8 relative">
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-100/30 rounded-full blur-3xl pointer-events-none -z-10"></div>
      
      <div className="w-full">
        {/* Breadcrumb Navigation */}
        <nav className="mb-6">
          <Link
            href="/departments"
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 transition-colors font-semibold group bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-100 w-max"
          >
            <svg className="w-4 h-4 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Programs
          </Link>
        </nav>

        {/* Header Card */}
        <div className={`premium-card !p-0 overflow-hidden mb-8`}>
          <div className={`bg-gradient-to-r ${department.color || 'from-indigo-600 to-blue-500'} p-8 text-white relative`}>
            <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-2xl transform translate-x-10 -translate-y-10"></div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 relative z-10">
              <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg border border-white/20 transform rotate-3">
                {getIcon(department.icon)}
              </div>
              <div className="flex-1">
                <h1 className="text-3xl sm:text-4xl font-display font-extrabold mb-2 tracking-tight drop-shadow-sm">{department.name}</h1>
                <p className="text-indigo-50 text-base font-semibold tracking-wide drop-shadow-sm">Department of {department.shortName}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-8">
          {/* About Section - Takes 2 columns on large screens */}
          <div className="xl:col-span-2 premium-card">
            <h2 className="heading-premium text-2xl flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              About the Department
            </h2>
            <p className="text-base text-slate-700 leading-relaxed p-2">{department.about}</p>
          </div>

          {/* Vision & Mission - Stacked in sidebar on large screens */}
          <div className="space-y-6">
            <div className="premium-card bg-gradient-to-br from-indigo-50/50 to-blue-50/50 border-indigo-100">
              <h3 className="text-lg font-display font-extrabold text-indigo-900 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Vision
              </h3>
              <p className="text-sm text-indigo-900/80 leading-relaxed font-medium">{department.vision}</p>
            </div>

            <div className="premium-card bg-gradient-to-br from-blue-50/50 to-indigo-50/50 border-blue-100">
              <h3 className="text-lg font-display font-extrabold text-blue-900 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Mission
              </h3>
              <p className="text-sm text-blue-900/80 leading-relaxed font-medium">{department.mission}</p>
            </div>
          </div>
        </div>

        {/* Faculty Section */}
        <div className="premium-card border-slate-200/60 mt-8 mb-8">
          <div className="flex items-center justify-between mb-8 border-b border-slate-100 pb-6">
            <h2 className="heading-premium text-2xl !mb-0 flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              Faculty Members
            </h2>
            <div className="text-sm font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-lg">
              {faculty.length} Members
            </div>
          </div>
          
          {faculty.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {faculty.map((member, idx) => (
                <div
                  key={idx}
                  className="group bg-slate-50 border border-slate-200 rounded-xl p-4 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-indigo-300 hover:bg-white relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-indigo-100/50 to-transparent rounded-bl-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="flex items-start gap-4 relative z-10">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center flex-shrink-0 shadow-sm border border-slate-100 group-hover:border-indigo-200 transition-colors">
                      <svg className="w-6 h-6 text-slate-400 group-hover:text-indigo-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <h4 className="font-extrabold text-slate-800 text-base leading-tight truncate group-hover:text-indigo-700 transition-colors">{member.name}</h4>
                      <p className="text-xs font-semibold text-slate-500 mt-1 uppercase tracking-wider truncate">{member.designation}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center p-8 bg-slate-50 rounded-xl border border-dashed border-slate-300">
              <p className="text-base font-semibold text-slate-500">No faculty members found for this department.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 