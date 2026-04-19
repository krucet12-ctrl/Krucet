import React from 'react';

interface BadgeProps {
    type: 'verified' | 'pending' | 'rejected' | 'default';
    children: React.ReactNode;
}

export function Badge({ type, children }: BadgeProps) {
    const styles = {
        verified: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        pending: 'bg-amber-50 text-amber-700 border-amber-200',
        rejected: 'bg-red-50 text-red-700 border-red-200',
        default: 'bg-slate-50 text-slate-700 border-slate-200'
    };
    
    return (
        <span className={`inline-flex items-center px-2.5 py-1 text-[10px] sm:text-xs font-extrabold uppercase tracking-widest rounded-lg border ${styles[type]}`}>
            {children}
        </span>
    );
}
