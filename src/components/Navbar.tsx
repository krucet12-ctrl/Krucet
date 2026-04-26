'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

const navigationItems = [
    { path: '/', label: 'Home', icon: '🏠' },
    { path: '/departments', label: 'Courses', icon: '📚' },
    { path: '/results', label: 'Results', icon: '📄' },
    { path: '/check-gpa', label: 'Check CGPA', icon: '🧮' },
    { path: '/payment', label: 'Payment', icon: '💳' },
];

export default function Navbar() {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <header className="sticky top-0 z-50 bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 shadow-lg border-b border-indigo-500/30 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16 sm:h-20">
                    {/* Logo and University Name */}
                    <Link href="/" className="flex items-center space-x-3 group">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl flex items-center justify-center shadow-lg p-2 shrink-0 group-hover:scale-105 group-hover:bg-white/20 transition-all duration-300">
                            <Image
                                src="/krishna-university-logo.png"
                                alt="Krishna University Logo"
                                width={48}
                                height={48}
                                className="w-full h-full object-contain filter drop-shadow-md"
                                priority
                            />
                        </div>
                        <div className="flex flex-col justify-center text-white">
                            <h1 className="font-extrabold text-lg md:text-xl leading-tight text-blue-200 drop-shadow-sm">
                                Student Assist Portal
                            </h1>
                            <p className="text-xs text-indigo-100 opacity-90 mt-0.5">
                                Krishna University College of Engineering & Technology
                            </p>
                        </div>
                    </Link>

                    {/* Desktop Navigation */}
                    <nav className="hidden lg:flex items-center space-x-2">
                        {navigationItems.map((item) => (
                            <Link
                                key={item.path}
                                href={item.path}
                                className="px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-300 flex items-center space-x-2 text-indigo-100 hover:text-white hover:bg-white/10 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)] active:scale-95"
                            >
                                <span className="text-base opacity-80">{item.icon}</span>
                                {item.label && <span>{item.label}</span>}
                            </Link>
                        ))}
                    </nav>

                    {/* Mobile Menu Button */}
                    <div className="lg:hidden flex items-center">
                        <button
                            onClick={() => setIsOpen(!isOpen)}
                            className="p-2.5 rounded-xl text-indigo-100 bg-white/5 border border-white/10 hover:text-white hover:bg-white/20 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            aria-label="Toggle menu"
                        >
                            {isOpen ? (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            ) : (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                            )}
                        </button>
                    </div>
                </div>

                {/* Mobile Navigation Dropdown */}
                {isOpen && (
                    <div className="lg:hidden py-3 border-t border-indigo-500/30 bg-slate-900/95 backdrop-blur-md absolute left-0 right-0 px-4 shadow-xl animate-in slide-in-from-top-2 fade-in duration-200">
                        <div className="flex flex-col space-y-1.5">
                            {navigationItems.map((item) => (
                                <Link
                                    key={item.path}
                                    href={item.path}
                                    onClick={() => setIsOpen(false)}
                                    className="px-4 py-3 rounded-xl text-base font-semibold transition-all duration-200 flex items-center space-x-3 text-indigo-100 hover:bg-indigo-600/30 hover:text-white active:bg-indigo-600/50"
                                >
                                    <span className="text-xl">{item.icon}</span>
                                    <span>{item.label || 'Admin Login'}</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </header>
    );
}
