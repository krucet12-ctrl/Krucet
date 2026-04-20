'use client';
import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, onAuthStateChanged, setPersistence, browserSessionPersistence } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { handleFirebaseError } from '../../lib/utils';

const AdminLogin: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // Check if user is already logged in
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) router.push('/admin-dashboard');
    });
    return () => unsubscribe();
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await setPersistence(auth, browserSessionPersistence);
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/admin-dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(handleFirebaseError(message));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 w-full min-h-screen items-center bg-slate-50 relative overflow-hidden p-4">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-100/40 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-100/40 rounded-full blur-3xl pointer-events-none translate-y-1/3 -translate-x-1/3"></div>

      <div className="col-span-1 md:col-span-4 md:col-start-5 w-full space-y-6 mx-auto max-w-md relative z-10">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-white rounded-2xl shadow-sm border border-indigo-100 flex items-center justify-center mb-4 transition-transform hover:scale-105">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-xl flex items-center justify-center text-white font-extrabold text-lg shadow-md">
              KU
            </div>
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Admin Login</h2>
          <p className="mt-2 text-sm text-slate-500 font-medium">
            Access the administrative portal for Krishna University
          </p>
        </div>

        {/* Login Form */}
        <div className="premium-card p-6 sm:p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <ErrorMessage
                message={error}
                onRetry={() => setError('')}
              />
            )}

            <div className="space-y-2">
              <label htmlFor="email" className="label-premium">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="off"
                placeholder="admin@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                className="input-premium"
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="label-premium">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="input-premium"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-2.5 flex justify-center items-center mt-6 shadow-sm hover:shadow"
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Signing in...</span>
                </div>
              ) : (
                'Sign in to Dashboard'
              )}
            </button>
          </form>
        </div>

        {/* Back to Home */}
        <div className="text-center pt-2">
          <Link
            href="/"
            className="text-indigo-600 hover:text-indigo-700 font-bold text-sm inline-flex items-center transition-colors group"
          >
            <svg className="w-4 h-4 mr-1.5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Home
          </Link>
        </div>

        {/* Admin Portal Info */}
        <div className="bg-white/60 backdrop-blur-sm rounded-xl p-5 border border-slate-200/60 shadow-sm mt-4">
          <h3 className="text-xs font-bold text-slate-800 mb-2.5 uppercase tracking-wider flex items-center">
            <svg className="w-4 h-4 mr-1.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Admin Portal Features
          </h3>
          <ul className="text-xs text-slate-600 font-medium space-y-2 pl-1">
            <li className="flex items-start"><span className="text-indigo-400 mr-2">•</span> Manage student records and results</li>
            <li className="flex items-start"><span className="text-indigo-400 mr-2">•</span> Update department information</li>
            <li className="flex items-start"><span className="text-indigo-400 mr-2">•</span> Generate academic reports</li>
            <li className="flex items-start"><span className="text-indigo-400 mr-2">•</span> System configuration and maintenance</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin; 