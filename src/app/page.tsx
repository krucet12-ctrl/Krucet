'use client';
import React, { useEffect, useState } from 'react';
import { Users, BookOpen, Trophy, Target } from 'lucide-react';
import Image from 'next/image';
import { getUniversityInfo, getOfficials, UniversityInfo, Official } from '@/lib/cmsService';
import { safeTrim } from '@/lib/utils';

const Index = () => {
  const defaultStats = {
    students: "700+",
    departments: "2",
    years: "7+",
    placement: "100%"
  };

  const [univInfo, setUnivInfo] = useState<UniversityInfo | null>(null);
  const [officials, setOfficials] = useState<Official[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [info, off] = await Promise.all([
        getUniversityInfo(),
        getOfficials()
      ]);

      if (info) setUnivInfo(info);
      setOfficials(off);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
          <div className="text-indigo-800 font-semibold animate-pulse tracking-wide">Loading University Information...</div>
        </div>
      </div>
    );
  }

  // Use dynamic content or fallback to static if not yet loaded
  const description = univInfo?.description || "The Krishna University College of Engineering and Technology was established during the academic year 2016-17.";
  const univName = univInfo?.universityName || "Krishna University";
  const colName = univInfo?.collegeName || "College of Engineering and Technology";
  const address = univInfo?.address || "Andhra Pradesh";

  const displayOfficials = officials;

  // Resolve active stats
  const activeStats = univInfo || defaultStats;

  const statsList = [
    { icon: Users, label: 'Engineering Students', value: activeStats.students },
    { icon: BookOpen, label: 'Engineering Departments', value: activeStats.departments },
    { icon: Trophy, label: 'Years of Excellence', value: activeStats.years },
    { icon: Target, label: 'Placement Rate', value: activeStats.placement }
  ];

  return (
    <div className="w-full space-y-8 animate-fade-in">
      {/* Hero Section */}
      <section className="w-full relative rounded-3xl overflow-hidden shadow-2xl">
        <div className="bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-8 md:p-14 text-white text-center relative overflow-hidden group">
          <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 bg-indigo-500 opacity-20 rounded-full blur-3xl group-hover:bg-indigo-400 transition-colors duration-700"></div>
          <div className="absolute bottom-0 left-0 -mb-16 -ml-16 w-64 h-64 bg-blue-500 opacity-20 rounded-full blur-3xl group-hover:bg-blue-400 transition-colors duration-700"></div>
          <div className="relative z-10 flex flex-col items-center justify-center mb-8 gap-6">
            <div className="w-24 h-24 sm:w-28 sm:h-28 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-2xl p-4 border border-white/20 transform group-hover:-translate-y-2 transition-transform duration-500">
              <Image
                src="/krishna-university-logo.png"
                alt="Krishna University Logo"
                width={80}
                height={80}
                className="w-full h-full object-contain filter drop-shadow-lg"
              />
            </div>
            <div className="text-center space-y-2">
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold font-display tracking-tight text-white drop-shadow-xl bg-clip-text text-transparent bg-gradient-to-r from-white to-indigo-200">
                {univName}
              </h1>
              <h2 className="text-xl sm:text-2xl font-bold text-indigo-200 drop-shadow-md">
                {colName}
              </h2>
              <p className="text-indigo-300 font-medium">{address}</p>
            </div>
          </div>
          <p className="text-lg md:text-xl text-indigo-100/90 max-w-4xl mx-auto font-medium leading-relaxed z-10 relative drop-shadow mt-4">
            {description}
          </p>
        </div>
      </section>

      {/* University Officials Section */}
      <section className="pt-6">
        <div className="text-center mb-10">
          <h2 className="heading-premium inline-block relative">
            University Leadership
            <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-16 h-1 bg-indigo-600 rounded-full"></div>
          </h2>
        </div>
        {displayOfficials.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {displayOfficials.map((official, index) => {              
              return (
                <div key={index} className="premium-card flex flex-col items-center text-center group hover:border-indigo-200">
                  <div className="w-28 h-28 mb-6 relative rounded-full p-1 bg-gradient-to-tr from-indigo-500 to-blue-600 group-hover:scale-110 group-hover:shadow-lg transition-all duration-500">
                    <img
                      src={official.photo}
                      alt={official.name}
                      className="w-full h-full rounded-full object-cover border-4 border-white"
                      onError={(e) => {
                        e.currentTarget.src = "/default-user.png";
                      }}
                    />
                  </div>
                <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-2 bg-indigo-50 px-3 py-1 rounded-full">{official.title}</h3>
                <p className="text-xl font-extrabold text-slate-800 leading-tight">{official.name}</p>
              </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center font-semibold text-slate-500 bg-white p-8 rounded-2xl border border-dashed border-gray-300">Content not available</div>
        )}
      </section>

      {/* University Statistics */}
      <section className="premium-card border border-indigo-100/50 bg-gradient-to-br from-white to-indigo-50/30">
        <div className="text-center mb-10">
          <h2 className="heading-premium inline-block relative">
            Institution Statistics
            <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-16 h-1 bg-blue-600 rounded-full"></div>
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
          {statsList.map((stat, index) => {
            const IconComponent = stat.icon;
            return (
              <div key={index} className="flex flex-col items-center justify-center p-6 sm:p-8 bg-white rounded-2xl shadow-sm border border-slate-100 hover:shadow-xl hover:-translate-y-2 transition-all duration-500 group relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-600 transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>
                <div className="w-16 h-16 bg-indigo-50/80 rounded-2xl flex items-center justify-center mb-5 group-hover:bg-indigo-600 group-hover:rotate-6 transition-all duration-500 shadow-inner">
                  <IconComponent className="w-8 h-8 text-indigo-600 group-hover:text-white transition-colors duration-500" />
                </div>
                <div className="text-3xl sm:text-4xl font-extrabold text-slate-800 mb-2 tracking-tight group-hover:text-indigo-700 transition-colors duration-300">
                  {stat.value}
                </div>
                <div className="text-xs sm:text-sm font-bold text-slate-500 uppercase tracking-widest text-center px-2">{stat.label}</div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default Index;
