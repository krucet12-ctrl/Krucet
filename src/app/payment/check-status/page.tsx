'use client';

import { useState } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, Timestamp, getDoc } from 'firebase/firestore';
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
    amount?: number;
    // Tuition fee fields
    yearOfFee?: number | string;
    // Exam fee fields
    semester?: string | number;
    feeType?: string;
    // Legacy / shared
    academicYear?: string;
    paymentType?: string;
    status: 'pending' | 'verified' | 'rejected';
    paymentProofURL?: string;
    paymentProofLink?: string;
    rejectionReason?: string;
    rejectionComment?: string;
    collection: string;
    uploadedAt: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createdAt?: any;
}

/** Returns a human-readable ordinal suffix (1st, 2nd, 3rd, 4th). */
function ordinal(n: number): string {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** Builds a meaningful payment label from a record's fields. */
function getPaymentLabel(rec: PaymentRecord): string {
    if (rec.collection === 'tuitionFeePayments') {
        const year = rec.yearOfFee ? Number(rec.yearOfFee) : null;
        return year ? `Tuition Fee – ${ordinal(year)} Year` : 'Tuition Fee';
    }
    if (rec.collection === 'examFees') {
        const parts: string[] = ['Exam Fee'];
        if (rec.semester) parts.push(`Sem ${rec.semester}`);
        if (rec.feeType) parts.push(`(${rec.feeType})`);
        return parts.join(' – ');
    }
    return rec.paymentType || 'Payment';
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

/** Calculate paid amount for a student's tuition fee in a specific year */
async function calculateTuitionPaidAmount(rollNumber: string, yearOfFee: number | string): Promise<number> {
    try {
        const q = query(
            collection(db, 'tuitionFeePayments'),
            where('rollNumber', '==', rollNumber.toUpperCase()),
            where('yearOfFee', '==', parseInt(String(yearOfFee))),
            where('status', '==', 'verified')
        );
        const querySnapshot = await getDocs(q);
        let totalPaid = 0;
        querySnapshot.forEach(doc => {
            const data = doc.data();
            if (data.amount) {
                totalPaid += data.amount;
            }
        });
        return totalPaid;
    } catch (error) {
        console.error('Error calculating paid amount:', error);
        return 0;
    }
}

export default function CheckPaymentStatus() {
    const [rollNumber, setRollNumber] = useState('');
    const [category, setCategory] = useState('tuition');
    const [searchLoading, setSearchLoading] = useState(false);
    const [records, setRecords] = useState<PaymentRecord[]>([]);
    const [searched, setSearched] = useState(false);
    const [tuitionPaidAmounts, setTuitionPaidAmounts] = useState<{ [key: string]: number }>({});
    const [tuitionTotalFees, setTuitionTotalFees] = useState<{ [key: string]: number }>({});

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
        setTuitionPaidAmounts({});

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

                // Calculate paid amounts for tuition fees
                if (category === 'tuition') {
                    const paidAmounts: { [key: string]: number } = {};
                    const totalFeesAmounts: { [key: string]: number } = {};
                    for (const record of docsData) {
                        if (record.yearOfFee) {
                            const key = `${record.rollNumber}_${record.yearOfFee}`;
                            const paid = await calculateTuitionPaidAmount(record.rollNumber, record.yearOfFee);
                            paidAmounts[key] = paid;

                            const match = record.rollNumber.match(/^([YL]\d{2})([A-Z]{2,6})(\d+)$/i);
                            if (match) {
                                const batch = match[1].toUpperCase();
                                const rollUpper = record.rollNumber.toUpperCase();
                                let courseType = 'BTech';
                                if (rollUpper.includes('MTH')) {
                                    courseType = 'MTech';
                                } else if (rollUpper.includes('CSE') || rollUpper.includes('ECE') || rollUpper.includes('AIML')) {
                                    courseType = 'BTech';
                                }

                                const classDoc = await getDoc(doc(db, `classes/${courseType}/batches/${batch}`));
                                if (classDoc.exists()) {
                                    const tuitionData = classDoc.data()?.tuitionFees || {};
                                    totalFeesAmounts[key] = tuitionData[`year${record.yearOfFee}`] || 40500;
                                } else {
                                    totalFeesAmounts[key] = 40500;
                                }
                            }
                        }
                    }
                    setTuitionPaidAmounts(paidAmounts);
                    setTuitionTotalFees(totalFeesAmounts);
                }
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
                            <h3 className="text-lg font-extrabold text-slate-800 mb-5">
                                Payment Records
                                <span className="ml-2 text-sm font-semibold text-slate-400">({records.length})</span>
                            </h3>

                            {/* ── 2-Column Grid ── */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {records.map((rec) => (
                                    <div
                                        key={rec.id}
                                        className={`bg-white rounded-2xl shadow-sm border flex flex-col justify-between overflow-hidden
                                            ${rec.status === 'verified' ? 'border-t-4 border-t-emerald-500 border-slate-200' :
                                              rec.status === 'rejected' ? 'border-t-4 border-t-red-500 border-slate-200' :
                                              'border-t-4 border-t-amber-400 border-slate-200'}`}
                                    >
                                        <div className="p-5 flex flex-col gap-4 flex-1">

                                            {/* Top: Student Info + DU Number */}
                                            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                                                <div>
                                                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block mb-1">Student Info</span>
                                                    <span className="font-bold text-slate-800 leading-tight block">{rec.studentName}</span>
                                                    <span className="text-xs text-slate-500 font-mono mt-0.5 block">{rec.rollNumber}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block mb-1">DU Number</span>
                                                    <span className="font-mono font-bold text-indigo-600">{(rec.duNumber || 'N/A').toUpperCase()}</span>
                                                </div>
                                            </div>

                                            <div className="border-t border-slate-100" />

                                            {/* Middle: Payment Info + Uploaded Date */}
                                            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                                                <div>
                                                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block mb-1">Payment Info</span>
                                                    <span className="font-bold text-slate-800">{getPaymentLabel(rec)}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block mb-1">Uploaded Date</span>
                                                    <span className="font-bold text-slate-800 text-xs leading-snug">{formatDate(rec.createdAt || rec.uploadedAt)}</span>
                                                </div>
                                            </div>

                                            <div className="border-t border-slate-100" />

                                            {/* Amount Paid */}
                                            {rec.amount && (
                                                <div>
                                                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block mb-1">Amount Paid</span>
                                                    <span className="font-bold text-indigo-600 text-sm">₹ {rec.amount.toLocaleString('en-IN')}</span>
                                                </div>
                                            )}

                                            <div className="border-t border-slate-100" />

                                            {/* Tuition Fee Summary */}
                                            {rec.collection === 'tuitionFeePayments' && rec.yearOfFee && (
                                                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                                                    <p className="text-xs font-extrabold text-indigo-900 uppercase tracking-wider mb-2">Tuition Fee Summary</p>
                                                    <div className="space-y-2">
                                                        <div className="flex justify-between items-center text-xs">
                                                            <span className="text-indigo-700 font-semibold">Total Fee:</span>
                                                            <span className="font-bold text-indigo-900">₹ {(tuitionTotalFees[`${rec.rollNumber}_${rec.yearOfFee}`] || 40500).toLocaleString('en-IN')}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center text-xs">
                                                            <span className="text-indigo-700 font-semibold">Paid Amount:</span>
                                                            <span className="font-bold text-indigo-900">₹ {(tuitionPaidAmounts[`${rec.rollNumber}_${rec.yearOfFee}`] || 0).toLocaleString('en-IN')}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center text-xs">
                                                            <span className="text-indigo-700 font-semibold">Due Amount:</span>
                                                            <span className="font-bold text-indigo-900">₹ {Math.max(0, (tuitionTotalFees[`${rec.rollNumber}_${rec.yearOfFee}`] || 40500) - (tuitionPaidAmounts[`${rec.rollNumber}_${rec.yearOfFee}`] || 0)).toLocaleString('en-IN')}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {rec.collection === 'tuitionFeePayments' && rec.yearOfFee && (
                                                <div className="border-t border-slate-100" />
                                            )}

                                            {/* Bottom: Status */}
                                            <div>
                                                <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block mb-1.5">Current Status</span>
                                                {rec.status === 'verified' && <Badge type="verified"><span className="mr-1.5">✓</span>Verified</Badge>}
                                                {rec.status === 'pending'  && <Badge type="pending"><span className="mr-1.5 animate-pulse">⏳</span>Pending</Badge>}
                                                {rec.status === 'rejected' && <Badge type="rejected"><span className="mr-1.5">❌</span>Rejected</Badge>}
                                            </div>

                                            {/* Rejection reason */}
                                            {rec.status === 'rejected' && (
                                                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                                                    <p className="text-xs font-extrabold text-red-700 flex items-center gap-1.5 mb-1">
                                                        <span>⚠️</span> Payment Rejected
                                                    </p>
                                                    <p className="text-xs text-red-700 font-semibold">
                                                        Reason: {rec.rejectionReason || '—'}
                                                    </p>
                                                    {rec.rejectionComment && (
                                                        <p className="text-xs text-red-600 mt-1 opacity-80">"{rec.rejectionComment}"</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Reupload button — only for rejected */}
                                        {rec.status === 'rejected' && (
                                            <div className="px-5 pb-5">
                                                {activeReuploadId === rec.id ? (
                                                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                                                        <div className="flex items-center justify-between">
                                                            <h4 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                                                                <span>🔁</span> Reupload Payment
                                                            </h4>
                                                            <button
                                                                onClick={() => setActiveReuploadId(null)}
                                                                className="text-xs font-bold text-slate-500 hover:text-slate-700 transition"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                        <form onSubmit={(e) => handleReupload(e, rec)} className="space-y-4">
                                                            <Input
                                                                label="Correct DU Number *"
                                                                className="font-mono"
                                                                value={newDUNumber}
                                                                onChange={(e) => setNewDUNumber(e.target.value)}
                                                                required
                                                            />
                                                            <div>
                                                                <Input
                                                                    label="New Payment Proof Link *"
                                                                    placeholder="Paste your Drive/Cloud link..."
                                                                    value={newProofLink}
                                                                    onChange={(e) => setNewProofLink(e.target.value)}
                                                                    required
                                                                />
                                                                <p className="text-xs text-amber-600 font-bold flex items-center gap-1 mt-1.5">
                                                                    <span>⚠️</span> Ensure access is set to "Anyone with the link".
                                                                </p>
                                                            </div>
                                                            <Button
                                                                type="submit"
                                                                isLoading={isReuploading}
                                                                loadingText="Uploading..."
                                                                className="w-full py-3 shadow-md"
                                                            >
                                                                Confirm Reupload
                                                            </Button>
                                                        </form>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => {
                                                            setActiveReuploadId(rec.id);
                                                            setNewDUNumber(rec.duNumber || '');
                                                            setNewProofLink('');
                                                        }}
                                                        className="w-full mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold py-2.5 rounded-xl hover:shadow-md hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center justify-center gap-2 text-sm"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                                        </svg>
                                                        Reupload Receipt
                                                    </button>
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


