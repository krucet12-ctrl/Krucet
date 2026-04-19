import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger';
    isLoading?: boolean;
    loadingText?: string;
    children: React.ReactNode;
}

export function Button({ variant = 'primary', isLoading, loadingText = 'Processing...', children, className = '', disabled, ...props }: ButtonProps) {
    const baseStyle = "inline-flex items-center justify-center font-medium py-2.5 px-6 rounded-xl shadow-md transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed";
    const variants = {
        primary: "bg-indigo-600 hover:bg-indigo-700 text-white",
        secondary: "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-indigo-600",
        danger: "bg-red-600 hover:bg-red-700 text-white"
    };

    return (
        <button 
            className={`${baseStyle} ${variants[variant]} ${className}`} 
            disabled={disabled || isLoading} 
            {...props}
        >
            {isLoading ? (
                <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {loadingText}
                </>
            ) : children}
        </button>
    );
}
