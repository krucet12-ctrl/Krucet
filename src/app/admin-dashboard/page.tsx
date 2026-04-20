'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { signOut, User, onAuthStateChanged } from 'firebase/auth';

const INACTIVITY_LIMIT_MS = 15 * 60 * 1000; // 15 minutes

interface SubjectMarks {
  subCode: string;
  extMarks: string;
  intMarks: string;
  status: string;
}

export interface StudentData {
  roll: string;
  name: string;
  branch: string;
  college: string;
  lastUpdated: string;
  subjectResults: {
    [semester: string]: {
      [subjectCode: string]: SubjectMarks;
    }
  };
}

export default function AdminPage() {
  // Only keep authentication, loading, and logout logic
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const router = useRouter();
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLogout = useCallback(async () => {
    setLogoutLoading(true);
    try {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      await signOut(auth);
      router.push('/admin-login');
    } catch {
      // handle error silently
    } finally {
      setLogoutLoading(false);
    }
  }, [router]);

  // ── Auth state listener ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!auth) {
      router.replace('/admin-login');
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
      if (user) {
        setAuthenticated(true);
        setUser(user);
      } else {
        setAuthenticated(false);
        setUser(null);
        router.replace('/admin-login');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  // ── Inactivity auto-logout ───────────────────────────────────────────────────
  useEffect(() => {
    if (!authenticated) return;

    const resetTimer = () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      inactivityTimer.current = setTimeout(() => {
        signOut(auth).then(() => router.replace('/admin-login'));
      }, INACTIVITY_LIMIT_MS);
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'] as const;
    events.forEach((e) => window.addEventListener(e, resetTimer));
    resetTimer(); // Start the timer immediately

    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimer));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [authenticated, router]);

  // ── Sign out on tab / browser close ─────────────────────────────────────────
  useEffect(() => {
    if (!authenticated) return;

    const handleBeforeUnload = () => {
      signOut(auth);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [authenticated]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <svg className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!authenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <svg className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 relative">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-100/30 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-100/30 rounded-full blur-3xl pointer-events-none translate-y-1/3 -translate-x-1/3"></div>

      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md shadow-sm border-b border-indigo-100/60 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 space-y-3 sm:space-y-0 w-full">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-xl flex items-center justify-center text-white font-extrabold text-sm shadow-md mr-3">
                KU
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">Admin Dashboard</h1>
                <p className="text-xs text-indigo-500 font-bold uppercase tracking-wider hidden sm:block">Control Panel</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-5 w-full sm:w-auto bg-slate-50/50 sm:bg-transparent p-3 sm:p-0 rounded-lg sm:rounded-none">
              <div className="text-sm text-slate-600 w-full sm:w-auto flex items-center">
                <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                <span className="font-semibold text-slate-900 break-all">{user.email}</span>
              </div>
              <button
                onClick={handleLogout}
                disabled={logoutLoading}
                className="w-full sm:w-auto btn-secondary text-xs font-bold px-4 py-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
              >
                {logoutLoading ? 'Signing out...' : 'Sign Out'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 relative z-10 w-full">
        <div className="mb-10 text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-3 tracking-tight">Welcome Back</h2>
          <p className="text-slate-600 text-sm sm:text-base font-medium max-w-2xl mx-auto">Manage student data, results, curriculum, and university portal content</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          <button
            className="premium-card p-6 flex flex-col items-center hover:scale-[1.02] transition-all duration-300 focus:outline-none group bg-white border-indigo-100/60"
            onClick={() => router.push('/admin-dashboard/add-results')}
          >
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-blue-600 transition-colors">
              <span className="text-3xl group-hover:scale-110 transition-transform duration-200 drop-shadow-sm">📥</span>
            </div>
            <span className="text-base font-extrabold mb-2 text-center text-slate-800 tracking-tight">Results Management</span>
            <span className="text-slate-500 text-xs font-medium text-center leading-relaxed">Scrape results and view stored data by batch & semester</span>
          </button>

          <button
            className="premium-card p-6 flex flex-col items-center hover:scale-[1.02] transition-all duration-300 focus:outline-none group bg-white border-indigo-100/60"
            onClick={() => router.push('/admin-dashboard/add-class')}
          >
            <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-green-600 transition-colors">
              <span className="text-3xl group-hover:scale-110 transition-transform duration-200 drop-shadow-sm">🏫</span>
            </div>
            <span className="text-base font-extrabold mb-2 text-center text-slate-800 tracking-tight">Class Management</span>
            <span className="text-slate-500 text-xs font-medium text-center leading-relaxed">Create class batches and manage regulation mappings</span>
          </button>

          <button
            className="premium-card p-6 flex flex-col items-center hover:scale-[1.02] transition-all duration-300 focus:outline-none group bg-white border-indigo-100/60"
            onClick={() => router.push('/admin-dashboard/get-student-details')}
          >
            <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-amber-500 transition-colors">
              <span className="text-3xl group-hover:scale-110 transition-transform duration-200 drop-shadow-sm">👤</span>
            </div>
            <span className="text-base font-extrabold mb-2 text-center text-slate-800 tracking-tight">Student Details</span>
            <span className="text-slate-500 text-xs font-medium text-center leading-relaxed">View student info, results, and academic profiles</span>
          </button>

          <button
            className="premium-card p-6 flex flex-col items-center hover:scale-[1.02] transition-all duration-300 focus:outline-none group bg-white border-indigo-100/60"
            onClick={() => router.push('/admin-dashboard/manage-curriculum')}
          >
            <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-purple-600 transition-colors">
              <span className="text-3xl group-hover:scale-110 transition-transform duration-200 drop-shadow-sm">📚</span>
            </div>
            <span className="text-base font-extrabold mb-2 text-center text-slate-800 tracking-tight">Manage Curriculum</span>
            <span className="text-slate-500 text-xs font-medium text-center leading-relaxed">Manage regulations, branches, and subject codes</span>
          </button>

          <button
            className="premium-card p-6 flex flex-col items-center hover:scale-[1.02] transition-all duration-300 focus:outline-none group bg-white border-indigo-100/60"
            onClick={() => router.push('/admin-dashboard/payment-management')}
          >
            <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-rose-600 transition-colors">
              <span className="text-3xl group-hover:scale-110 transition-transform duration-200 drop-shadow-sm">💰</span>
            </div>
            <span className="text-base font-extrabold mb-2 text-center text-slate-800 tracking-tight">Payment Management</span>
            <span className="text-slate-500 text-xs font-medium text-center leading-relaxed">Cross-verify fee payments, receipts, and proofs</span>
          </button>

          <button
            className="premium-card p-6 flex flex-col items-center hover:scale-[1.02] transition-all duration-300 focus:outline-none group bg-white border-indigo-100/60"
            onClick={() => router.push('/admin-dashboard/university-content')}
          >
            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-indigo-600 transition-colors">
              <span className="text-3xl group-hover:scale-110 transition-transform duration-200 drop-shadow-sm">🏛️</span>
            </div>
            <span className="text-base font-extrabold mb-2 text-center text-slate-800 tracking-tight">University Content</span>
            <span className="text-slate-500 text-xs font-medium text-center leading-relaxed">Manage site details, officials, and faculty data</span>
          </button>
        </div>
      </div>
    </div>
  );
}
