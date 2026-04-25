'use client';

import { useState } from 'react';
import Link from 'next/link';
import { safeTrim } from '@/lib/utils';
import { Toast } from '@/components/ui/Toast';

export default function ExamFeePage() {
    const [studentName, setStudentName] = useState('');
    const [rollNumber, setRollNumber] = useState('');
    const [semester, setSemester] = useState('');
    const [feeType, setFeeType] = useState('');
    const [amount, setAmount] = useState('');
    const [duNumber, setDuNumber] = useState('');
    const [paymentProofLink, setPaymentProofLink] = useState('');
    const [errors, setErrors] = useState<{ [key: string]: string }>({});
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const validateInputs = () => {
        const newErrors: { [key: string]: string } = {};

        if (!safeTrim(studentName)) {
            newErrors.name = 'Student name is required';
        }

        if (!safeTrim(rollNumber)) {
            newErrors.rollNo = 'Roll number is required';
        } else if (!/^[YL]\d{2}[A-Z]{2,6}\d+$/i.test(safeTrim(rollNumber))) {
            newErrors.rollNo = 'Invalid roll number format (e.g., Y22CSE279063 or L21ECE180045)';
        }

        if (!semester) {
            newErrors.semester = 'Semester is required';
        }

        if (!feeType) {
            newErrors.feeType = 'Type of Fee is required';
        }

        if (!amount) {
            newErrors.amount = 'Payment amount is required';
        } else if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
            newErrors.amount = 'Please enter a valid amount greater than 0';
        }

        if (!safeTrim(duNumber)) {
            newErrors.duNumber = 'DU Number is required';
        }

        if (!safeTrim(paymentProofLink)) {
            newErrors.link = 'Payment proof link is required';
        } else {
            try {
                new URL(paymentProofLink);
            } catch {
                newErrors.link = 'Please enter a valid URL';
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validateInputs()) {
            return;
        }

        setUploading(true);
        setMessage(null);

        try {
            const payload = {
                studentName,
                rollNumber: rollNumber.toUpperCase(),
                semester,
                feeType,
                amount: parseFloat(amount),
                duNumber,
                paymentProofLink
            };

            const response = await fetch('/api/payment/exam-fee', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (data.success) {
                setMessage({ type: 'success', text: 'Exam fee payment proof submitted successfully!' });
                setStudentName('');
                setRollNumber('');
                setSemester('');
                setFeeType('');
                setAmount('');
                setDuNumber('');
                setPaymentProofLink('');
            } else {
                setMessage({ type: 'error', text: data.error || 'Failed to submit payment proof' });
            }
        } catch (error) {
            console.error('Submit error:', error);
            setMessage({ type: 'error', text: 'An error occurred while submitting' });
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-6 sm:py-8 animate-fade-in relative">
                {/* Back Button */}
                <Link
                    href="/payment"
                    className="inline-flex items-center text-sm font-semibold text-gray-600 hover:text-indigo-600 mb-6 sm:mb-8 transition-colors"
                >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Back to Payment Portal
                </Link>

                {/* Header */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 mb-6 sm:mb-8">
                    <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
                        <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center shadow-sm shrink-0">
                            <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">Exam Fee Payment</h1>
                            <p className="text-sm text-gray-600 font-medium">Submit your exam fee details and proof</p>
                        </div>
                    </div>
                </div>

                {/* Payment Action Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 sm:mb-8">
                    {/* Where to Pay Button */}
                    <a
                        href="https://onlinesbi.sbi/sbicollect/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center px-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition-all group font-bold"
                    >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span>Where to Pay</span>
                        <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                    </a>

                    {/* How to Pay Button */}
                    <button
                        onClick={() => window.open('https://drive.google.com/file/d/1YJ2n1jr3aHQ_6KfnvqhXCYPC4KB2E9Xq/view?usp=sharing', '_blank')}
                        className="flex items-center justify-center px-6 py-4 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-indigo-600 rounded-xl shadow-sm transition-all group font-bold"
                    >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>How to Pay</span>
                        <svg className="w-4 h-4 ml-2 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>

                {/* Form */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
                    <h2 className="text-lg font-bold text-gray-900 mb-6 pb-3 border-b border-gray-100">Payment Details</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Student Name */}
                        <div>
                            <label htmlFor="studentName" className="label-premium">
                                Student Name *
                            </label>
                            <input
                                type="text"
                                id="studentName"
                                autoComplete="off"
                                value={studentName}
                                onChange={(e) => {
                                    setStudentName(e.target.value.toUpperCase());
                                    if (errors.name) setErrors({ ...errors, name: '' });
                                }}
                                placeholder="Enter Your Full Name"
                                className={`input-premium uppercase focus:!ring-indigo-500 focus:!border-indigo-500 ${errors.name ? '!border-red-300 !bg-red-50' : ''
                                    }`}
                            />
                            {errors.name && (
                                <p className="mt-1 text-xs text-red-600 flex items-center">
                                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    {errors.name}
                                </p>
                            )}
                        </div>

                        {/* Roll Number */}
                        <div>
                            <label htmlFor="rollNumber" className="label-premium">
                                Roll Number *
                            </label>
                            <input
                                type="text"
                                id="rollNumber"
                                autoComplete="off"
                                value={rollNumber}
                                onChange={(e) => {
                                    setRollNumber(e.target.value.toUpperCase());
                                    if (errors.rollNo) setErrors({ ...errors, rollNo: '' });
                                }}
                                placeholder="Enter Your Roll Number"
                                className={`input-premium uppercase focus:!ring-indigo-500 focus:!border-indigo-500 ${errors.rollNo ? '!border-red-300 !bg-red-50' : ''
                                    }`}
                            />
                            {errors.rollNo && (
                                <p className="mt-1 text-xs text-red-600 flex items-center">
                                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    {errors.rollNo}
                                </p>
                            )}
                        </div>

                        {/* Semester */}
                        <div>
                            <label htmlFor="semester" className="label-premium">
                                Semester *
                            </label>
                            <select
                                id="semester"
                                value={semester}
                                onChange={(e) => {
                                    setSemester(e.target.value);
                                    if (errors.semester) setErrors({ ...errors, semester: '' });
                                }}
                                className={`input-premium focus:!ring-indigo-500 focus:!border-indigo-500 ${errors.semester ? '!border-red-300 !bg-red-50' : ''
                                    }`}
                            >
                                <option value="">-- Select Semester --</option>
                                {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                                    <option key={sem} value={sem}>{sem} Semester</option>
                                ))}
                            </select>
                            {errors.semester && (
                                <p className="mt-1 text-xs text-red-600 flex items-center">
                                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    {errors.semester}
                                </p>
                            )}
                        </div>

                        {/* Type of Fee */}
                        <div>
                            <label htmlFor="feeType" className="label-premium">
                                Type of Fee *
                            </label>
                            <select
                                id="feeType"
                                value={feeType}
                                onChange={(e) => {
                                    setFeeType(e.target.value);
                                    if (errors.feeType) setErrors({ ...errors, feeType: '' });
                                }}
                                className={`input-premium focus:!ring-indigo-500 focus:!border-indigo-500 ${errors.feeType ? '!border-red-300 !bg-red-50' : ''
                                    }`}
                            >
                                <option value="">-- Select Fee Type --</option>
                                <option value="Regular Fee">Regular Fee</option>
                                <option value="Supply Fee">Supply Fee</option>
                                <option value="Revaluation Fee">Revaluation Fee</option>
                            </select>
                            {errors.feeType && (
                                <p className="mt-1 text-xs text-red-600 flex items-center">
                                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    {errors.feeType}
                                </p>
                            )}
                        </div>

                        {/* Payment Amount */}
                        <div>
                            <label htmlFor="amount" className="label-premium">
                                Payment Amount *
                            </label>
                            <input
                                type="text"
                                id="amount"
                                autoComplete="off"
                                value={amount}
                                onChange={(e) => {
                                    setAmount(e.target.value.replace(/[^0-9]/g, ''));
                                    if (errors.amount) setErrors({ ...errors, amount: '' });
                                }}
                                placeholder="Enter payment amount"
                                className={`input-premium focus:!ring-indigo-500 focus:!border-indigo-500 ${errors.amount ? '!border-red-300 !bg-red-50' : ''
                                    }`}
                            />
                            {errors.amount && (
                                <p className="mt-1 text-xs text-red-600 flex items-center">
                                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    {errors.amount}
                                </p>
                            )}
                        </div>

                        {/* DU Number */}
                        <div>
                            <label htmlFor="duNumber" className="label-premium">
                                DU Number *
                            </label>
                            <input
                                type="text"
                                id="duNumber"
                                autoComplete="off"
                                value={duNumber}
                                onChange={(e) => {
                                    setDuNumber(e.target.value.toUpperCase());
                                    if (errors.duNumber) setErrors({ ...errors, duNumber: '' });
                                }}
                                placeholder="Enter DU Number"
                                className={`input-premium uppercase focus:!ring-indigo-500 focus:!border-indigo-500 ${errors.duNumber ? '!border-red-300 !bg-red-50' : ''
                                    }`}
                            />
                            {errors.duNumber && (
                                <p className="mt-1 text-xs text-red-600 flex items-center">
                                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    {errors.duNumber}
                                </p>
                            )}
                        </div>

                        {/* Payment Proof Link */}
                        <div className="col-span-1 md:col-span-2 lg:col-span-3">
                            <label htmlFor="paymentProofLink" className="label-premium flex items-baseline">
                                Enter Payment Proof Link (Google Drive / Cloud Link) *
                            </label>
                            <input
                                type="text"
                                id="paymentProofLink"
                                autoComplete="off"
                                value={paymentProofLink}
                                onChange={(e) => {
                                    setPaymentProofLink(e.target.value);
                                    if (errors.link) setErrors({ ...errors, link: '' });
                                }}
                                placeholder='Paste your payment proof link (Drive/Cloud). Make sure access is set to "Anyone with the link".'
                                className={`input-premium ${errors.link ? '!border-red-300 !bg-red-50' : ''}`}
                            />
                            {errors.link && (
                                <p className="mt-1 text-xs text-red-600 flex items-center">
                                    <svg className="w-4 h-4 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    {errors.link}
                                </p>
                            )}
                            <p className="mt-2 text-xs text-gray-600">
                                ⚠️ Please ensure your file access is set to "Anyone with the link", otherwise your payment will not be verified.
                            </p>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-8 flex gap-3 justify-end pt-6 border-t border-gray-100">
                        <Link
                            href="/payment"
                            className="inline-flex items-center justify-center font-medium py-2.5 px-6 rounded-xl shadow-md transition-all duration-300 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-indigo-600"
                        >
                            Cancel
                        </Link>
                        <button
                            onClick={handleSubmit}
                            disabled={uploading}
                            className="inline-flex items-center justify-center font-medium py-2.5 px-6 rounded-xl shadow-md transition-all duration-300 bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {uploading ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                        <circle cx="12" cy="12" r="10" strokeWidth="4" className="opacity-25" />
                                        <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75" fill="currentColor" />
                                    </svg>
                                    Saving...
                                </span>
                            ) : 'Save Payment Proof'}
                        </button>
                    </div>
                </div>

                {/* Warning Box */}
                <div className="mt-6 sm:mt-8 max-w-7xl mx-auto w-full">
                    <div className="bg-red-50 border border-red-200 rounded-xl p-5 shadow-sm">
                        <div className="flex items-start space-x-3">
                            <svg className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <div className="text-sm text-yellow-800">
                                <p className="font-semibold mb-1">Important Instructions</p>
                                <ul className="space-y-1 text-yellow-700">
                                    <li>• Click "Where to Pay" to access the official payment portal</li>
                                    <li>• Click "How to Pay" for step-by-step payment instructions</li>
                                    <li>• Complete payment first, then upload the receipt to Google Drive (or similar)</li>
                                    <li>• <strong>Ensure the link is set to "Anyone with the link"</strong></li>
                                    <li>• Paste the link here to complete submission</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Toasts */}
                {message && <Toast message={message.text} type={message.type} onClose={() => setMessage(null)} />}
            </div>
        </div>
    );
}
