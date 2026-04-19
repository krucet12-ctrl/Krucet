'use client';

import { useState } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Toast } from '@/components/ui/Toast';

interface PaymentRecord {
    id: string;
    rollNumber: string;
    studentName: string;
    duNumber: string;
    semester?: string;
    academicYear?: string;
    paymentType?: string;
    status: 'pending' | 'verified' | 'rejected';
    paymentProofURL?: string;
    paymentProofLink?: string; // from new system
    rejectionReason?: string;
    rejectionComment?: string;
    collection: string;
    uploadedAt: string;
    // Firestore Timestamp or ISO string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createdAt?: any;
}

/** Safely formats a Firestore Timestamp, seconds object, or ISO string. */
function formatDate(value: unknown): string {
    if (!value) return 'N/A';
    if (value instanceof Timestamp) return value.toDate().toLocaleString();
    if (typeof value === 'object' && (value as { seconds?: number }).seconds) {
        return new Date((value as { seconds: number }).seconds * 1000).toLocaleString();
    }
    if (typeof value === 'string') {
        const d = new Date(value);
        return isNaN(d.getTime()) ? 'N/A' : d.toLocaleString();
    }
    return 'N/A';
}

export default function CheckPaymentStatus() {
    const [rollNumber, setRollNumber] = useState('');
    const [category, setCategory] = useState('tuition');
    const [searchLoading, setSearchLoading] = useState(false);
    const [records, setRecords] = useState<PaymentRecord[]>([]);
    const [searched, setSearched] = useState(false);

    // Reupload State
    const [activeReuploadId, setActiveReuploadId] = useState<string | null>(null);
    const [newProofLink, setNewProofLink] = useState('');
    const [newDUNumber, setNewDUNumber] = useState('');
    const [isReuploading, setIsReuploading] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleCheckStatus = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!rollNumber.trim()) {
            showToast('Please enter your Roll Number', 'error');
            return;
        }

        setSearchLoading(true);
        setSearched(true);
        setRecords([]);
        setActiveReuploadId(null);

        try {
            const collectionName = category === 'tuition' ? 'tuitionFeePayments' : 'examFees';
            const q = query(
                collection(db, collectionName),
                where('rollNumber', '==', rollNumber.trim().toUpperCase())
            );

            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const docsData = querySnapshot.docs.map(d => ({
                    id: d.id,
                    ...d.data(),
                    collection: collectionName
                })) as PaymentRecord[];

                // Sort by uploadedAt descending
                docsData.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
                setRecords(docsData);
            }
        } catch (error) {
            console.error('Error fetching payment:', error);
            showToast('Failed to fetch payment details.', 'error');
        } finally {
            setSearchLoading(false);
        }
    };

    const handleReupload = async (e: React.FormEvent, targetRecord: PaymentRecord) => {
        e.preventDefault();
        
        if (!newProofLink.trim() || !newDUNumber.trim()) {
            showToast('Please fill in both fields', 'error');
            return;
        }

        // Basic URL validation
        try {
            new URL(newProofLink);
        } catch {
            showToast("Please enter a valid URL (e.g., https://drive.google.com/...)", "error");
            return;
        }

        setIsReuploading(true);

        try {
            const docRef = doc(db, targetRecord.collection, targetRecord.id);
            await updateDoc(docRef, {
                duNumber: newDUNumber.trim().toUpperCase(),
                paymentProofURL: newProofLink, // keeping legacy field mapped if needed, or both
                paymentProofLink: newProofLink,
                status: 'pending', // Revert to pending for re-verification
                rejectionReason: '',
                rejectionComment: '',
                updatedAt: new Date().toISOString()
            });

            setRecords(prev => prev.map(rec => rec.id === targetRecord.id ? {
                ...rec,
                status: 'pending',
                duNumber: newDUNumber.trim().toUpperCase(),
                paymentProofURL: newProofLink,
                paymentProofLink: newProofLink,
                rejectionReason: '',
                rejectionComment: ''
            } : rec));

            setNewProofLink('');
            setActiveReuploadId(null);
            showToast('Payment reuploaded successfully', 'success');

        } catch (error) {
            console.error('Failed to reupload:', error);
            showToast('Failed to reupload payment', 'error');
        } finally {
            setIsReuploading(false);
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
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">Check Payment Status</h1>
                            <p className="text-sm text-gray-600 font-medium">Verify your payment or reupload rejected receipts</p>
                        </div>
                    </div>
                </div>

                <Card>
                    <form onSubmit={handleCheckStatus} className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end mb-8">
                        <Input
                            label="Roll Number *"
                            className="uppercase tracking-wider w-full"
                            placeholder="Enter Your roll Number"
                            value={rollNumber}
                            onChange={(e) => setRollNumber(e.target.value)}
                            required
                        />
                        <Select
                            label="Payment Category *"
                            className="w-full"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            options={[
                                { label: 'Tuition Fee', value: 'tuition' },
                                { label: 'Exam Fee', value: 'exam' }
                            ]}
                        />
                        <div className="w-full md:w-auto h-[46px] pb-[1px] flex gap-3">
                            <Button
                                type="submit"
                                isLoading={searchLoading}
                                loadingText="Checking..."
                                className="w-full md:w-auto h-[46px]"
                            >
                                Check Status
                            </Button>
                        </div>
                    </form>

                    {searched && !searchLoading && records.length === 0 && (
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center animate-fade-in-up">
                            <div className="text-4xl mb-3">📭</div>
                            <h3 className="text-lg font-bold text-slate-700">No payment records found</h3>
                            <p className="text-slate-500 text-sm mt-1">We couldn&apos;t find any {category === 'tuition' ? 'Tuition' : 'Exam'} Fee payments for roll number <span className="font-bold text-indigo-500">{rollNumber.toUpperCase()}</span>.</p>
                            <div className="mt-6 flex justify-center gap-4">
                                <Link href="/payment/tuition-fee" className="text-indigo-600 hover:text-indigo-800 text-sm font-bold underline transition-colors">
                                    Pay Tuition Fee
                                </Link>
                                <span className="text-slate-300">|</span>
                                <Link href="/payment/exam-fee" className="text-indigo-600 hover:text-indigo-800 text-sm font-bold underline transition-colors">
                                    Pay Exam Fee
                                </Link>
                            </div>
                        </div>
                    )}

                    {records.length > 0 && (
                        <div className="animate-fade-in-up border-t border-slate-100 pt-8">
                            <h3 className="text-lg font-extrabold text-slate-800 mb-5">Payment Records</h3>

                            <div className="space-y-4">
                                {records.map((rec) => (
                                    <div key={rec.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                                                <div>
                                                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 block mb-0.5">Student Info</span>
                                                    <span className="font-bold text-slate-800">{rec.studentName} ({rec.rollNumber})</span>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 block mb-0.5">DU Number</span>
                                                    <span className="font-mono font-bold text-indigo-600">{(rec.duNumber || 'N/A').toUpperCase()}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 block mb-0.5">Semester</span>
                                                    <span className="font-bold text-slate-800">{rec.semester || 'N/A'}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 block mb-0.5">Academic Year</span>
                                                    <span className="font-bold text-slate-800">{rec.academicYear || 'N/A'}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 block mb-0.5">Payment Type</span>
                                                    <span className="font-bold text-slate-800">{rec.paymentType || 'N/A'}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 block mb-0.5">Uploaded Date</span>
                                                    <span className="font-bold text-slate-800">{formatDate(rec.createdAt || rec.uploadedAt)}</span>
                                                </div>
                                                <div className="col-span-2 md:col-span-4 flex justify-start mt-2">
                                                    <div>
                                                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 block mb-2">Current Status</span>
                                                        {rec.status === 'verified' && <Badge type="verified"><span className="mr-2">✓</span>Verified</Badge>}
                                                        {rec.status === 'pending' && <Badge type="pending"><span className="mr-2 animate-pulse">⏳</span>Pending</Badge>}
                                                        {rec.status === 'rejected' && <Badge type="rejected"><span className="mr-2">❌</span>Rejected</Badge>}
                                                    </div>
                                                </div>
                                            </div>

                                        {/* Rejection Handling & Reupload Section */}
                                        {rec.status === 'rejected' && (
                                            <div className="mt-6 border-t border-slate-100 pt-6">
                                                <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6 shadow-sm">
                                                    <h4 className="text-red-800 font-extrabold flex items-center mb-3">
                                                        <span className="mr-2 text-lg">⚠️</span> Payment Rejected
                                                    </h4>
                                                    <div className="bg-white/60 p-4 rounded-lg border border-red-100">
                                                        <p className="text-sm text-red-800 font-bold mb-1">Reason: <span className="font-semibold">{rec.rejectionReason}</span></p>
                                                        {rec.rejectionComment && (
                                                            <p className="text-sm text-red-800 font-medium opacity-90 mt-2">"{rec.rejectionComment}"</p>
                                                        )}
                                                    </div>
                                                </div>

                                                {activeReuploadId === rec.id ? (
                                                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
                                                        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                                                            <h4 className="text-lg font-extrabold text-slate-800 tracking-tight flex items-center">
                                                                <span className="mr-2">🔁</span> Reupload Payment
                                                            </h4>
                                                            <button 
                                                                onClick={() => setActiveReuploadId(null)}
                                                                className="text-sm font-bold text-slate-500 hover:text-slate-700 transition"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>

                                                        <form onSubmit={(e) => handleReupload(e, rec)} className="space-y-6">
                                                            <Input
                                                                label="Correct DU Number *"
                                                                className="font-mono"
                                                                value={newDUNumber}
                                                                onChange={(e) => setNewDUNumber(e.target.value)}
                                                                required
                                                            />

                                                            <div className="space-y-2">
                                                                <Input
                                                                    label="New Payment Proof Link (Drive/Cloud) *"
                                                                    placeholder="Paste your active link here..."
                                                                    value={newProofLink}
                                                                    onChange={(e) => setNewProofLink(e.target.value)}
                                                                    required
                                                                />
                                                                <p className="text-xs text-amber-600 font-bold flex items-center gap-1 mt-2">
                                                                    <span>⚠️</span> Please ensure access is set to "Anyone with the link".
                                                                </p>
                                                            </div>

                                                            <Button
                                                                type="submit"
                                                                isLoading={isReuploading}
                                                                loadingText="Processing Upload..."
                                                                className="w-full text-base py-3.5 shadow-lg"
                                                            >
                                                                Reupload New Payment
                                                            </Button>
                                                        </form>
                                                    </div>
                                                ) : (
                                                    <Button 
                                                        onClick={() => {
                                                            setActiveReuploadId(rec.id);
                                                            setNewDUNumber(rec.duNumber || '');
                                                            setNewProofLink('');
                                                        }}
                                                        variant="secondary"
                                                        className="w-full text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border-none"
                                                    >
                                                        Tap to Reupload Error Receipt
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </Card>
            </div>

            {/* Toasts */}
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
}
