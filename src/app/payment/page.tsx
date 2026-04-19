'use client';

import Link from 'next/link';

export default function PaymentPage() {
    return (
        <div className="min-h-screen bg-slate-50 relative pointer-events-auto pb-12 w-full flex flex-col items-center overflow-hidden z-0">
            {/* Ambient Backgrounds */}
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none -z-10 translate-x-1/3 -translate-y-1/4 animate-pulse-slow"></div>
            <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none -z-10 -translate-x-1/3 translate-y-1/4 overflow-hidden"></div>

            <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
                <div className="text-center w-full space-y-4 mb-16 animate-fade-in-up">
                    <h1 className="text-5xl sm:text-6xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900 pb-2">
                        Payment Portal
                    </h1>
                    <p className="text-lg sm:text-xl text-slate-500 font-medium max-w-xl mx-auto leading-relaxed">
                        Select a module to seamlessly process your university transactions or track existing unverified payments.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                    {/* Tuition Fee Card */}
                    <Link href="/payment/tuition-fee" className="block w-full">
                        <div className="relative h-full bg-white rounded-2xl p-6 sm:p-8 shadow-sm hover:shadow-[0_20px_40px_rgb(79,70,229,0.1)] border border-slate-200 hover:border-indigo-200 hover:-translate-y-2 transition-all duration-300 group overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-bl-full transition-transform duration-500 group-hover:scale-110"></div>
                            <div className="relative z-10 flex flex-col h-full">
                                <div className="w-16 h-16 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0 mb-6 shadow-sm group-hover:rotate-6 transition-transform duration-300">
                                    <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                    </svg>
                                </div>
                                <h2 className="text-2xl font-extrabold text-slate-800 mb-2 group-hover:text-indigo-600 transition-colors">
                                    Tuition Fee
                                </h2>
                                <p className="text-sm text-slate-500 mb-8 font-medium leading-relaxed flex-1">
                                    Process ongoing semester tuition fees effortlessly with instant digital receipt generation.
                                </p>
                                <div className="flex items-center text-sm font-bold text-indigo-600 group-hover:text-indigo-800 transition-colors">
                                    Pay Now
                                    <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </Link>

                    {/* Exam Fee Card */}
                    <Link href="/payment/exam-fee" className="block w-full">
                        <div className="relative h-full bg-white rounded-2xl p-6 sm:p-8 shadow-sm hover:shadow-[0_20px_40px_rgb(79,70,229,0.1)] border border-slate-200 hover:border-indigo-200 hover:-translate-y-2 transition-all duration-300 group overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-bl-full transition-transform duration-500 group-hover:scale-110"></div>
                            <div className="relative z-10 flex flex-col h-full">
                                <div className="w-16 h-16 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0 mb-6 shadow-sm group-hover:rotate-6 transition-transform duration-300">
                                    <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                                <h2 className="text-2xl font-extrabold text-slate-800 mb-2 group-hover:text-cyan-600 transition-colors">
                                    Exam Fee
                                </h2>
                                <p className="text-sm text-slate-500 mb-8 font-medium leading-relaxed flex-1">
                                    Pay for semester exams, supply, or revaluation. Automates hall ticket eligibility.
                                </p>
                                <div className="flex items-center text-sm font-bold text-indigo-600 group-hover:text-indigo-800 transition-colors">
                                    Pay Now
                                    <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </Link>

                    {/* Check Status Card */}
                    <Link href="/payment/check-status" className="block w-full">
                        <div className="relative h-full bg-white rounded-2xl p-6 sm:p-8 shadow-sm hover:shadow-[0_20px_40px_rgb(79,70,229,0.1)] border border-slate-200 hover:border-indigo-200 hover:-translate-y-2 transition-all duration-300 group overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-bl-full transition-transform duration-500 group-hover:scale-110"></div>
                            <div className="relative z-10 flex flex-col h-full">
                                <div className="w-16 h-16 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0 mb-6 shadow-sm group-hover:rotate-6 transition-transform duration-300">
                                    <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <h2 className="text-2xl font-extrabold text-slate-800 mb-2 group-hover:text-emerald-600 transition-colors">
                                    Check Status
                                </h2>
                                <p className="text-sm text-slate-500 mb-8 font-medium leading-relaxed flex-1">
                                    Track live verification states. If a payment was rejected, quickly reupload your receipt here.
                                </p>
                                <div className="flex items-center text-sm font-bold text-indigo-600 group-hover:text-indigo-800 transition-colors">
                                    Track Payment
                                    <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </Link>

                </div>
            </div>
        </div>
    );
}
