'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

const INACTIVITY_LIMIT_MS = 10 * 60 * 1000; // 10 minutes

export function useAutoLogout() {
  const router = useRouter();

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    const logout = () => {
      signOut(auth).then(() => router.replace('/admin-login'));
    };

    const resetTimer = () => {
      clearTimeout(timeout);
      timeout = setTimeout(logout, INACTIVITY_LIMIT_MS);
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'] as const;
    events.forEach((e) => window.addEventListener(e, resetTimer));
    resetTimer(); // Start timer immediately

    return () => {
      clearTimeout(timeout);
      events.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, [router]);
}
