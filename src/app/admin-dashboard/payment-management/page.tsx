'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface Payment {
    id: string;
    studentName: string;
    rollNumber: string;
    duNumber: string;
    uploadedAt: string;
    status: 'pending' | 'verified' | 'rejected';
    category: string;
    collection: 'tuitionFeePayments' | 'examFees';
    paymentProofURL: string;
    // Tuition specific
    yearOfFee?: number;
    // Exam specific
    semester?: number;
    feeType?: string;
    fileName?: string;
    // Rejection specific
    rejectionReason?: string;
    rejectionComment?: string;
}

export default function PaymentManagement() {
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        search: '',
        type: 'all',
        status: 'all',
        semester: '',
        year: ''
    });
    const [stats, setStats] = useState({ total: 0, pending: 0, verified: 0, rejected: 0 });

    // Modal State
    const [selectedProof, setSelectedProof] = useState<string | null>(null);
    const [proofType, setProofType] = useState<'image' | 'pdf' | null>(null);

    // Rejection State
    const [rejectModalOpen, setRejectModalOpen] = useState(false);
    const [rejectingPayment, setRejectingPayment] = useState<{ id: string, collection: string } | null>(null);
    const [rejectionReason, setRejectionReason] = useState<string>('');
    const [rejectionComment, setRejectionComment] = useState<string>('');

    // Toast State
    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const fetchPayments = async () => {
        setLoading(true);
        try {
            const queryParams = new URLSearchParams();
            if (filters.search) queryParams.append('search', filters.search);
            if (filters.type !== 'all') queryParams.append('type', filters.type);
            if (filters.status !== 'all') queryParams.append('status', filters.status);
            if (filters.semester) queryParams.append('semester', filters.semester);
            if (filters.year) queryParams.append('year', filters.year);

            const response = await fetch(`/api/admin/payments?${queryParams.toString()}`);
            const result = await response.json();

            if (result.success) {
                setPayments(result.data);
                setStats(result.stats);
            }
        } catch (error) {
            console.error('Failed to fetch payments:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Debounce search
        const timer = setTimeout(() => {
            fetchPayments();
        }, 500);
        return () => clearTimeout(timer);
    }, [filters]);

    const updateStatus = async (id: string, collectionName: string, newStatus: string, extraData?: any) => {
        try {
            const bodyData = { id, collection: collectionName, status: newStatus, ...extraData };
            const response = await fetch('/api/admin/payments/update-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData)
            });

            if (response.ok) {
                // Optimistic update
                setPayments(prev => prev.map(p =>
                    p.id === id ? { ...p, status: newStatus as any, ...extraData } : p
                ));
                showToast(`Payment ${newStatus} successfully`, 'success');
            } else {
                showToast(`Failed to update status to ${newStatus}`, 'error');
            }
        } catch (error) {
            console.error('Failed to update status:', error);
            showToast('An error occurred during status update', 'error');
        }
    };

    const handleConfirmReject = async () => {
        if (!rejectingPayment || !rejectionReason) return;
        
        await updateStatus(
            rejectingPayment.id, 
            rejectingPayment.collection, 
            'rejected', 
            { 
                rejectionReason, 
                rejectionComment 
            }
        );
        
        setRejectModalOpen(false);
        setRejectingPayment(null);
        setRejectionReason('');
        setRejectionComment('');
    };

    const handleViewProof = (url: string, fileName: string) => {
        const isPdf = fileName?.toLowerCase().endsWith('.pdf') || url.includes('.pdf');
        setProofType(isPdf ? 'pdf' : 'image');
        setSelectedProof(url);
    };

    return (
    <div className="min-h-screen bg-slate-50 relative pointer-events-auto pb-12">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-100/30 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
      <div className="absolute top-40 left-0 w-[500px] h-[500px] bg-blue-100/30 rounded-full blur-3xl pointer-events-none -translate-x-1/3"></div>

      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md shadow-sm border-b border-indigo-100/60 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between py-4 w-full gap-4">
            <div className="flex items-center gap-4">
              <Link href="/admin-dashboard" className="text-sm font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-2 transition-colors group">
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                <span>Back to Dashboard</span>
              </Link>
              <div className="h-5 w-px bg-slate-200 hidden sm:block"></div>
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-800 tracking-tight">Payment Management</h1>
            </div>
            
            <div className="flex gap-3">
              <div className="bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Total: {stats.total}</span>
              </div>
              <div className="bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Pending: {stats.pending}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 relative z-10">

                {/* Filters */}
                <div className="premium-card p-5 sm:p-6 mb-8 border-indigo-100 bg-white">
                  <div className="flex items-center space-x-3 mb-5">
                    <div className="bg-indigo-50 p-2 rounded-lg">
                      <span className="text-lg">🔍</span>
                    </div>
                    <h2 className="text-base font-extrabold text-slate-800 tracking-tight">Filter Payments</h2>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {/* Search */}
                    <div className="sm:col-span-2 lg:col-span-2">
                        <label className="label-premium">Search</label>
                        <input
                            type="text"
                            placeholder="Roll No, DU Number, Name..."
                            className="input-premium focus:ring-2 uppercase"
                            value={filters.search}
                            onChange={(e) => setFilters({ ...filters, search: e.target.value.toUpperCase() })}
                        />
                    </div>

                    {/* Payment Type */}
                    <div>
                        <label className="label-premium">Payment Type</label>
                        <select
                            className="input-premium py-2 cursor-pointer"
                            value={filters.type}
                            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                        >
                            <option value="all">All Payments</option>
                            <option value="tuition">Tuition Fee</option>
                            <option value="exam">Exam Fee (All)</option>
                            <option value="exam-regular">Exam - Regular</option>
                            <option value="exam-supply">Exam - Supply</option>
                            <option value="exam-revaluation">Exam - Revaluation</option>
                            <option value="exam-special">Exam - Special</option>
                        </select>
                    </div>

                    {/* Status */}
                    <div>
                        <label className="label-premium">Status</label>
                        <select
                            className="input-premium py-2 cursor-pointer"
                            value={filters.status}
                            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                        >
                            <option value="all">All Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="verified">Verified</option>
                            <option value="rejected">Rejected</option>
                        </select>
                    </div>

                    {/* Additional Filters based on type */}
                    {filters.type === 'tuition' && (
                        <div>
                            <label className="label-premium">Year</label>
                            <select
                                className="input-premium py-2 cursor-pointer"
                                value={filters.year}
                                onChange={(e) => setFilters({ ...filters, year: e.target.value })}
                            >
                                <option value="">All Years</option>
                                <option value="1">1st Year</option>
                                <option value="2">2nd Year</option>
                                <option value="3">3rd Year</option>
                                <option value="4">4th Year</option>
                            </select>
                        </div>
                    )}

                    {filters.type.startsWith('exam') && (
                        <div>
                            <label className="label-premium">Semester</label>
                            <select
                                className="input-premium py-2 cursor-pointer"
                                value={filters.semester}
                                onChange={(e) => setFilters({ ...filters, semester: e.target.value })}
                            >
                                <option value="">All Semesters</option>
                                {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    )}
                  </div>
                </div>

                {/* Table */}
                <div className="premium-card p-0 overflow-hidden border-slate-200">
                    {loading ? (
                        <div className="p-12 text-center">
                            <svg className="animate-spin h-8 w-8 text-indigo-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <p className="text-slate-500 font-bold text-sm tracking-wide">Loading payments...</p>
                        </div>
                    ) : payments.length === 0 ? (
                        <div className="p-16 text-center">
                            <div className="text-5xl mb-4">📭</div>
                            <p className="text-slate-500 font-bold text-sm tracking-wide">No payments found matching your filters.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-100">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-5 py-4 text-left font-extrabold text-slate-500 text-[10px] uppercase tracking-widest">Date</th>
                                        <th className="px-5 py-4 text-left font-extrabold text-slate-500 text-[10px] uppercase tracking-widest">Student</th>
                                        <th className="px-5 py-4 text-left font-extrabold text-slate-500 text-[10px] uppercase tracking-widest">Category</th>
                                        <th className="px-5 py-4 text-left font-extrabold text-slate-500 text-[10px] uppercase tracking-widest">Details</th>
                                        <th className="px-5 py-4 text-left font-extrabold text-slate-500 text-[10px] uppercase tracking-widest">Status</th>
                                        <th className="px-5 py-4 text-left font-extrabold text-slate-500 text-[10px] uppercase tracking-widest">Proof</th>
                                        <th className="px-5 py-4 text-right font-extrabold text-slate-500 text-[10px] uppercase tracking-widest">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-slate-50">
                                    {payments.map((payment) => (
                                        <tr key={payment.id} className="hover:bg-slate-50/70 transition-colors group">
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                <div className="text-xs font-bold text-slate-700">{new Date(payment.uploadedAt).toLocaleDateString()}</div>
                                                <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">{new Date(payment.uploadedAt).toLocaleTimeString()}</div>
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                <div className="text-sm font-bold text-slate-800">{payment.studentName}</div>
                                                <div className="text-xs font-mono font-bold text-indigo-500">{payment.rollNumber}</div>
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                <span className={`px-2.5 py-1 inline-flex text-[10px] font-extrabold uppercase tracking-widest rounded-lg border ${payment.category.includes('Tuition') ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200'
                                                    }`}>
                                                    {payment.category}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                <div className="flex flex-col space-y-1">
                                                    <span className="text-xs text-slate-600 font-medium">
                                                        <span className="font-bold text-slate-400 uppercase tracking-widest text-[9px] mr-1">DU</span>{payment.duNumber}
                                                    </span>
                                                    {payment.yearOfFee && (
                                                        <span className="text-xs text-slate-600 font-medium">
                                                            <span className="font-bold text-slate-400 uppercase tracking-widest text-[9px] mr-1">Year</span>{payment.yearOfFee}
                                                        </span>
                                                    )}
                                                    {payment.semester && (
                                                        <span className="text-xs text-slate-600 font-medium">
                                                            <span className="font-bold text-slate-400 uppercase tracking-widest text-[9px] mr-1">Sem</span>{payment.semester}
                                                        </span>
                                                    )}
                                                    {payment.status === 'rejected' && payment.rejectionReason && (
                                                        <div className="mt-2 bg-red-50 border border-red-100 rounded p-2 max-w-[200px] whitespace-normal">
                                                            <span className="block text-[10px] font-bold text-red-800 uppercase tracking-wider mb-0.5">Rejection Reason</span>
                                                            <span className="block text-xs font-medium text-red-600 leading-tight">{payment.rejectionReason}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                <span className={`px-2.5 py-1 inline-flex items-center text-[10px] font-extrabold uppercase tracking-widest rounded-lg border ${
                                                    payment.status === 'verified' ? 'bg-green-50 text-green-700 border-green-200' :
                                                    payment.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                                                    'bg-amber-50 text-amber-700 border-amber-200'
                                                    }`}>
                                                    {payment.status === 'verified' && <span className="mr-1">✓</span>}
                                                    {payment.status === 'rejected' && <span className="mr-1">✗</span>}
                                                    {payment.status === 'pending' && <span className="mr-1">⏳</span>}
                                                    {payment.status}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                <div className="flex space-x-2">
                                                    <a
                                                        href={payment.paymentProofURL}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-indigo-600 bg-indigo-50 hover:bg-indigo-100 hover:text-indigo-800 border border-indigo-100 transition-colors flex items-center px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm"
                                                    >
                                                        <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                        </svg>
                                                        Open Link
                                                    </a>
                                                    {payment.fileName && (
                                                        <button
                                                            onClick={() => handleViewProof(payment.paymentProofURL, payment.fileName || '')}
                                                            className="text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors flex items-center px-2 py-1.5 rounded-lg text-xs font-bold shadow-sm hidden sm:flex"
                                                            title="Preview Legacy File"
                                                        >
                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                            </svg>
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-right">
                                                <div className="flex justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {payment.status !== 'verified' && (
                                                        <button
                                                            onClick={() => updateStatus(payment.id, payment.collection, 'verified')}
                                                            className="text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 font-bold transition-colors rounded-lg px-3 py-1.5 text-xs shadow-sm"
                                                        >
                                                            Verify
                                                        </button>
                                                    )}
                                                    {payment.status !== 'rejected' && (
                                                        <button
                                                            onClick={() => {
                                                                setRejectingPayment({ id: payment.id, collection: payment.collection });
                                                                setRejectionReason('');
                                                                setRejectionComment('');
                                                                setRejectModalOpen(true);
                                                            }}
                                                            className="text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 font-bold transition-colors rounded-lg px-3 py-1.5 text-xs shadow-sm"
                                                        >
                                                            Reject
                                                        </button>
                                                    )}
                                                    {payment.status !== 'pending' && (
                                                        <button
                                                            onClick={() => updateStatus(payment.id, payment.collection, 'pending')}
                                                            className="text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 font-bold transition-colors rounded-lg px-3 py-1.5 text-xs shadow-sm"
                                                        >
                                                            Reset
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Proof Modal */}
            {selectedProof && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedProof(null)}></div>
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up border border-slate-200">
                        <div className="flex justify-between items-center p-4 bg-slate-50 border-b border-slate-200">
                            <h3 className="text-lg font-extrabold text-slate-800 tracking-tight flex items-center">
                                <span className="mr-2">📄</span> Payment Proof Document
                            </h3>
                            <button onClick={() => setSelectedProof(null)} className="text-slate-400 hover:text-slate-700 bg-white hover:bg-slate-100 p-1.5 rounded-lg transition-colors shadow-sm border border-slate-200">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto bg-slate-100 p-6 flex items-center justify-center relative">
                            {proofType === 'pdf' ? (
                                <iframe src={selectedProof} className="w-full h-full min-h-[60vh] rounded-xl shadow-sm border border-slate-200 bg-white" title="PDF Preview"></iframe>
                            ) : (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img src={selectedProof} alt="Payment Proof" className="max-w-full max-h-[70vh] rounded-xl object-contain shadow-md border border-slate-200 bg-white" />
                            )}
                        </div>
                        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
                            <a
                                href={selectedProof}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-primary flex items-center text-sm px-6 py-2"
                            >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                Open Original Value
                            </a>
                        </div>
                    </div>
                </div>
            )}

            {/* Rejection Modal */}
            {rejectModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setRejectModalOpen(false)}></div>
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-fade-in-up border border-slate-200 p-6">
                        <h3 className="text-xl font-extrabold text-slate-800 tracking-tight flex items-center mb-6">
                            <span className="mr-2 text-2xl">⚠️</span> Reject Payment
                        </h3>
                        
                        <div className="space-y-5">
                            <div>
                                <label className="label-premium block">Select Rejection Reason *</label>
                                <div className="space-y-3 mt-2">
                                    <label className="flex items-start space-x-3 cursor-pointer p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                                        <input 
                                            type="radio" 
                                            name="rejectReason" 
                                            value="The file is not visible / not public"
                                            checked={rejectionReason === "The file is not visible / not public"}
                                            onChange={(e) => setRejectionReason(e.target.value)}
                                            className="mt-1 flex-shrink-0 text-red-600 focus:ring-red-500 border-slate-300"
                                        />
                                        <span className="text-sm font-bold text-slate-700">The file is not visible / not public</span>
                                    </label>
                                    <label className="flex items-start space-x-3 cursor-pointer p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                                        <input 
                                            type="radio" 
                                            name="rejectReason" 
                                            value="DU Number does not match with the file"
                                            checked={rejectionReason === "DU Number does not match with the file"}
                                            onChange={(e) => setRejectionReason(e.target.value)}
                                            className="mt-1 flex-shrink-0 text-red-600 focus:ring-red-500 border-slate-300"
                                        />
                                        <span className="text-sm font-bold text-slate-700">DU Number does not match with the file</span>
                                    </label>
                                </div>
                            </div>
                            
                            <div>
                                <label className="label-premium block">Additional Comments (optional)</label>
                                <textarea 
                                    className="input-premium py-2 mt-1 resize-none" 
                                    rows={3}
                                    placeholder="Enter any extra details explaining the rejection..."
                                    value={rejectionComment}
                                    onChange={(e) => setRejectionComment(e.target.value)}
                                ></textarea>
                            </div>
                        </div>

                        <div className="flex gap-3 justify-end mt-8 border-t border-slate-100 pt-5">
                            <button 
                                onClick={() => setRejectModalOpen(false)} 
                                className="px-5 py-2.5 rounded-xl text-slate-600 font-bold hover:bg-slate-100 transition-colors text-sm"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleConfirmReject} 
                                disabled={!rejectionReason}
                                className="px-5 py-2.5 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-all shadow-sm text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Confirm Reject
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Global Toasts */}
            {toast && (
                <div className="fixed bottom-6 right-6 z-[100] animate-fade-in-up">
                    <div className={`px-6 py-3.5 rounded-xl shadow-lg font-bold text-sm tracking-wide flex items-center gap-3 ${
                        toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
                    }`}>
                        <span className="text-lg">{toast.type === 'success' ? '✓' : '✗'}</span>
                        {toast.message}
                    </div>
                </div>
            )}
        </div>
    );
}
