import React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    options: { label: string; value: string }[];
}

export function Select({ label, options, className = '', ...props }: SelectProps) {
    return (
        <div className="space-y-2 w-full">
            {label && <label className="block text-sm font-semibold text-slate-600 uppercase tracking-wider">{label}</label>}
            <select 
                className={`w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all outline-none font-medium text-slate-800 cursor-pointer ${className}`}
                {...props}
            >
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>
        </div>
    );
}
