import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

export function Input({ label, error, className = '', ...props }: InputProps) {
    return (
        <div className="space-y-2 w-full">
            {label && <label className="block text-sm font-semibold text-slate-600 uppercase tracking-wider">{label}</label>}
            <input 
                autoComplete="off"
                className={`w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all outline-none font-medium text-slate-800 ${className}`}
                {...props}
            />
            {error && <p className="text-red-500 text-xs font-medium">{error}</p>}
        </div>
    );
}
