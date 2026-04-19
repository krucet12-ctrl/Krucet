import React from 'react';

interface ToastProps {
    message: string;
    type?: 'success' | 'error' | 'info';
    onClose?: () => void;
}

export function Toast({ message, type = 'info', onClose }: ToastProps) {
    const bgColors = {
        success: 'bg-emerald-600',
        error: 'bg-red-600',
        info: 'bg-blue-600'
    };
    const icon = {
        success: '✓',
        error: '✗',
        info: 'ℹ'
    };

    return (
        <div className="fixed top-6 right-6 z-[100] animate-fade-in-up">
            <div className={`px-6 py-3.5 rounded-xl shadow-xl font-bold text-sm tracking-wide flex items-center gap-3 text-white ${bgColors[type]}`}>
                <span className="text-lg">{icon[type]}</span>
                {message}
                {onClose && (
                    <button onClick={onClose} className="ml-4 opacity-70 hover:opacity-100">
                        ✕
                    </button>
                )}
            </div>
        </div>
    );
}
