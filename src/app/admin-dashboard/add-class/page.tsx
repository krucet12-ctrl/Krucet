'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Edit3, Save, Search, RefreshCw, ShieldCheck } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { sanitizeDatesInObject } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────
interface DetectedRange {
    id: string;
    batch: string;
    branch: string;
    type: 'Regular' | 'Lateral';
    startRoll: string;
    endRoll: string;
}

interface ClassDocData {
    regulation?: string;
    department?: string;
    exists?: boolean;
    updatedAt?: any;
    [key: string]: any;
}

const COURSE_TYPES = ['BTech', 'MTech'];

// ─── SUB-COMPONENT: Add Class Tab ────────────────────────────────────────────
function AddClassTab() {
    const [step, setStep] = useState<1 | 2>(1);

    const [courseType, setCourseType] = useState('BTech');
    const [regulationNumber, setRegulationNumber] = useState('');
    const [file, setFile] = useState<File | null>(null);

    // Derived value - always has R prefix
    const regulation = regulationNumber ? `R${regulationNumber}` : '';

    const [status, setStatus] = useState<'idle' | 'parsing' | 'uploading' | 'completed' | 'error'>('idle');
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [errorMsg, setErrorMsg] = useState('');
    const [successStats, setSuccessStats] = useState({ total: 0, batches: [] as string[] });

    const [detectedRanges, setDetectedRanges] = useState<DetectedRange[]>([]);
    const [parsedDataMap, setParsedDataMap] = useState<Record<string, any>>({});
    const fileInputRef = useRef<HTMLInputElement>(null);
    const workerRef = useRef<Worker | null>(null);
    const [parseProgress, setParseProgress] = useState<{ stage: string; current: number; total: number }>({ stage: '', current: 0, total: 0 });

    useEffect(() => {
        return () => {
            workerRef.current?.terminate();
            workerRef.current = null;
        };
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
            setStatus('idle');
            setErrorMsg('');
            setSuccessStats({ total: 0, batches: [] });
            setParsedDataMap({});
            setStep(1);
        }
    };

    const parseExcel = async () => {
        if (!file) { setErrorMsg('Please upload an Excel file.'); return; }
        if (!regulationNumber.trim()) { setErrorMsg('Please enter a regulation (e.g., 20).'); return; }
        setStatus('parsing'); setErrorMsg('');
        setParseProgress({ stage: 'starting', current: 0, total: 0 });
        try {
            workerRef.current?.terminate();
            workerRef.current = null;

            const worker = new Worker(new URL('../../../workers/excelWorker.ts', import.meta.url), { type: 'module' });
            workerRef.current = worker;

            worker.onmessage = (ev: MessageEvent<any>) => {
                const msg = ev.data;
                if (!msg || typeof msg !== 'object') return;
                if (msg.type === 'progress') {
                    setParseProgress({ stage: msg.stage || '', current: msg.current || 0, total: msg.total || 0 });
                    return;
                }
                if (msg.type === 'result') {
                    setDetectedRanges(msg.detectedRanges || []);
                    setParsedDataMap(msg.parsedDataMap || {});
                    setStatus('idle');
                    setStep(2);
                    return;
                }
                if (msg.type === 'error') {
                    setStatus('error');
                    setErrorMsg(msg.message || 'An error occurred during parsing.');
                    return;
                }
            };

            worker.onerror = (err) => {
                setStatus('error');
                setErrorMsg(err.message || 'An error occurred during parsing.');
            };

            worker.postMessage({ type: 'parse', file });
        } catch (err: any) {
            setStatus('error');
            setErrorMsg(err.message || 'An error occurred during parsing.');
        }
    };

    const handleRangeChange = (id: string, field: 'startRoll' | 'endRoll', val: string) => {
        setDetectedRanges(prev => prev.map(r => r.id === id ? { ...r, [field]: val.toUpperCase() } : r));
    };

    const confirmAndUpload = async () => {
        setStatus('uploading'); setErrorMsg('');
        try {
            const finalStudents: Array<{ rollNo: string; batch: string; branch: string }> = [];
            const uniqueRolls = new Set<string>();

            let generated = 0;
            const yieldToUI = () =>
                new Promise<void>((resolve) => {
                    if (typeof (window as any).requestIdleCallback === 'function') {
                        (window as any).requestIdleCallback(() => resolve(), { timeout: 50 });
                    } else {
                        setTimeout(() => resolve(), 0);
                    }
                });

            for (const range of detectedRanges) {
                const startMatch = range.startRoll.match(/^([A-Z0-9]+?)(\d+)$/i);
                const endMatch = range.endRoll.match(/^([A-Z0-9]+?)(\d+)$/i);
                if (startMatch && endMatch && startMatch[1] === endMatch[1]) {
                    const prefix = startMatch[1];
                    const startNum = parseInt(startMatch[2], 10);
                    const endNum = parseInt(endMatch[2], 10);
                    const padding = startMatch[2].length;
                    if (endNum >= startNum) {
                        for (let i = startNum; i <= endNum; i++) {
                            const rollNo = (prefix + i.toString().padStart(padding, '0')).toUpperCase();
                            if (!uniqueRolls.has(rollNo)) {
                                uniqueRolls.add(rollNo);
                                let sBatch = range.batch, sBranch = range.branch;
                                const p = rollNo.match(/^([YL]\d{2})([A-Z]{2,6})(\d+)$/i);
                                if (p) { sBatch = p[1].toUpperCase(); sBranch = p[2].toUpperCase(); if (sBranch === 'AIM') sBranch = 'AIML'; }
                                const rawRow = parsedDataMap[rollNo] || {};
                                finalStudents.push({ ...sanitizeDatesInObject(rawRow), rollNo, batch: sBatch, branch: sBranch });
                                generated++;
                                if (generated % 100 === 0) await yieldToUI();
                            }
                        }
                    } else {
                        throw new Error(`Start roll ${range.startRoll} cannot be numerically higher than end roll ${range.endRoll}.`);
                    }
                } else {
                    for (const roll of [range.startRoll, range.endRoll]) {
                        if (!uniqueRolls.has(roll)) {
                            uniqueRolls.add(roll);
                            let sBatch = range.batch, sBranch = range.branch;
                            const p = roll.match(/^([YL]\d{2})([A-Z]{2,6})(\d+)$/i);
                            if (p) { sBatch = p[1].toUpperCase(); sBranch = p[2].toUpperCase(); if (sBranch === 'AIM') sBranch = 'AIML'; }
                            const rawRow2 = parsedDataMap[roll] || {};
                            finalStudents.push({ ...sanitizeDatesInObject(rawRow2), rollNo: roll, batch: sBatch, branch: sBranch });
                            generated++;
                            if (generated % 100 === 0) await yieldToUI();
                        }
                    }
                }
            }

            if (finalStudents.length === 0) throw new Error('No students generated from ranges.');
            setProgress({ current: 0, total: finalStudents.length });

            const CHUNK_SIZE = 100;
            const uniqueBatches = new Set<string>();
            for (let i = 0; i < finalStudents.length; i += CHUNK_SIZE) {
                const chunk = finalStudents.slice(i, i + CHUNK_SIZE);
                chunk.forEach(s => uniqueBatches.add(s.batch));
                const req = await fetch('/api/admin/add-class', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ courseType, regulation: regulation, students: chunk })
                });
                let res;
                try { res = await req.json(); } catch { throw new Error('Server returned an invalid response.'); }
                if (!req.ok || !res.success) throw new Error(res.error || `Upload failed at chunk ${Math.floor(i / CHUNK_SIZE) + 1}`);
                setProgress(p => ({ ...p, current: Math.min(p.current + CHUNK_SIZE, p.total) }));
                await yieldToUI();
            }

            setStatus('completed');
            setSuccessStats({ total: finalStudents.length, batches: Array.from(uniqueBatches) });
            setStep(1); setFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        } catch (err: any) {
            setStatus('error');
            setErrorMsg(err.message || 'An error occurred during upload.');
            setStep(1);
        }
    };

    return (
        <div className="w-full max-w-3xl mx-auto">
            <div className="premium-card p-6 sm:p-8 space-y-8 bg-white border border-indigo-100/60 shadow-lg">
                <div className="flex items-center space-x-3 mb-2">
                    <div className="bg-indigo-50 p-2 rounded-lg"><span className="text-xl">🏫</span></div>
                    <h2 className="text-lg font-extrabold text-slate-800 tracking-tight">Upload Students Data</h2>
                </div>

                {/* STEP 1 */}
                {step === 1 && (
                    <div className="space-y-8 animate-fade-in-up">
                        <div className="bg-slate-50/70 rounded-2xl border border-slate-200/60 p-5 space-y-5">
                            <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                <span className="w-5 h-5 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-[10px] font-black">1</span>
                                Course & Regulation
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <label className="label-premium">Course Type</label>
                                    <div className="flex rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                                        {(['BTech', 'MTech']).map((ct) => (
                                            <button key={ct} onClick={() => setCourseType(ct)}
                                                className={`flex-1 py-2.5 text-sm font-extrabold transition-all ${courseType === ct ? 'bg-indigo-600 text-white shadow-inner' : 'bg-white text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'}`}>
                                                {ct === 'BTech' ? 'B.Tech' : 'M.Tech'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="label-premium">Regulation</label>
                                    <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                        <span className="bg-slate-100 px-4 py-2.5 font-bold text-slate-600 text-sm">R</span>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            placeholder="20,23,26...etc"
                                            className="input-prefix-inner uppercase"
                                            value={regulationNumber}
                                            onChange={(e) => setRegulationNumber(e.target.value.replace(/[^0-9]/g, ''))}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-50/70 rounded-2xl border border-slate-200/60 p-5 space-y-5">
                            <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                <span className="w-5 h-5 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-[10px] font-black">2</span>
                                File Upload
                            </h3>
                            <div className="space-y-2">
                                <label className="label-premium">Select Excel File (.xlsx / .xls)</label>
                                <div className="relative border-2 border-dashed border-indigo-200 rounded-xl bg-white focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all hover:bg-indigo-50">
                                    <input type="file" accept=".xlsx, .xls" onChange={handleFileChange} ref={fileInputRef}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                    <div className="py-8 flex flex-col items-center justify-center text-center px-4">
                                        <FileSpreadsheet className={`w-10 h-10 mb-3 ${file ? 'text-indigo-600' : 'text-slate-400'}`} />
                                        <p className="text-sm font-bold text-slate-700 mb-1">{file ? file.name : 'Click or drag file to this area'}</p>
                                        <p className="text-xs text-slate-500 font-medium">{file ? `${(file.size / 1024).toFixed(1)} KB` : 'Supports any format — auto detects batch & branch'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button onClick={parseExcel} disabled={status === 'parsing' || status === 'uploading' || !file || !regulationNumber.trim()}
                            className="w-full btn-primary py-3 flex items-center justify-center font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all">
                            {status === 'parsing' ? (
                                <div className="flex items-center space-x-2"><Loader2 className="w-5 h-5 animate-spin text-white" /><span>Parsing Excel... Please wait</span></div>
                            ) : (
                                <div className="flex items-center space-x-2"><Search className="w-5 h-5 text-white" /><span>Parse Excel & View Ranges</span></div>
                            )}
                        </button>

                        {status === 'parsing' && (
                            <div className="bg-indigo-50 border border-indigo-200 text-indigo-700 p-5 rounded-xl shadow-sm transition-all duration-300 animate-fade-in-up">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs font-bold text-indigo-600 mb-1">
                                        <span>Parsing Excel... Please wait</span>
                                        <span>
                                            {parseProgress.total > 0 ? `${parseProgress.current} / ${parseProgress.total}` : '...'}
                                        </span>
                                    </div>
                                    <div className="w-full bg-indigo-100 rounded-full h-2.5 overflow-hidden">
                                        <div
                                            className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300 ease-out"
                                            style={{ width: `${parseProgress.total > 0 ? (parseProgress.current / parseProgress.total) * 100 : 8}%` }}
                                        />
                                    </div>
                                    {parseProgress.stage && (
                                        <div className="text-[11px] font-bold text-indigo-700/80 uppercase tracking-widest">
                                            {parseProgress.stage}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* STEP 2 */}
                {step === 2 && (
                    <div className="space-y-8 animate-fade-in-up">
                        <div className="bg-slate-50/70 rounded-2xl border border-slate-200/60 p-5 space-y-5">
                            <div className="flex justify-between items-center mb-2 border-b border-indigo-100/60 pb-3">
                                <h3 className="text-[11px] font-extrabold text-slate-600 uppercase tracking-widest flex items-center gap-2">
                                    <span className="w-5 h-5 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-[10px] font-black">3</span>
                                    Review & Edit Detected Ranges
                                </h3>
                                <button onClick={() => setStep(1)} className="text-[11px] uppercase tracking-widest font-extrabold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors">
                                    <Edit3 className="w-3.5 h-3.5" /> Re-upload File
                                </button>
                            </div>
                            <div className="text-sm font-semibold text-slate-500 mb-2">
                                We auto-detected <span className="font-bold text-indigo-600">{detectedRanges.length}</span> unique ranges from your file. Verify and modify the generated ranges below.
                            </div>
                            <div className="space-y-4 max-h-[45vh] overflow-y-auto pr-2 custom-scrollbar">
                                {detectedRanges.map(range => (
                                    <div key={range.id} className="bg-white border border-indigo-100/80 rounded-xl p-4 shadow-sm hover:border-indigo-300 transition-colors">
                                        <div className="flex flex-wrap items-center justify-between mb-4 gap-2 border-b border-slate-100 pb-3">
                                            <div className="flex gap-2 items-center">
                                                <span className="px-2.5 py-1 text-[10px] uppercase font-extrabold tracking-widest bg-slate-100 text-slate-500 rounded-md">{range.batch}</span>
                                                <span className="px-2.5 py-1 text-[10px] uppercase font-extrabold tracking-widest bg-blue-50 text-blue-600 border border-blue-100 rounded-md">{range.branch}</span>
                                                <span className={`px-2.5 py-1 text-[10px] uppercase font-extrabold tracking-widest rounded-md ${range.type === 'Lateral' ? 'bg-purple-50 text-purple-600 border border-purple-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>{range.type}</span>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">Start Roll No</label>
                                                <input type="text" className="input-premium font-mono text-sm py-2 font-bold focus:bg-indigo-50/50"
                                                    value={range.startRoll} onChange={(e) => handleRangeChange(range.id, 'startRoll', e.target.value)} />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">End Roll No</label>
                                                <input type="text" className="input-premium font-mono text-sm py-2 font-bold focus:bg-indigo-50/50"
                                                    value={range.endRoll} onChange={(e) => handleRangeChange(range.id, 'endRoll', e.target.value)} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <button onClick={confirmAndUpload} disabled={status === 'uploading'}
                            className="w-full btn-primary py-3 flex items-center justify-center font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all">
                            {status === 'uploading' ? (
                                <div className="flex items-center space-x-2"><Loader2 className="w-5 h-5 animate-spin text-white" /><span>Uploading Students into Database...</span></div>
                            ) : (
                                <div className="flex items-center space-x-2"><Save className="w-5 h-5 text-white" /><span>Confirm & Save All Students</span></div>
                            )}
                        </button>
                    </div>
                )}

                {status === 'error' && (
                    <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-start text-sm mt-4 animate-fade-in-up">
                        <AlertCircle className="w-5 h-5 shrink-0 mr-3 text-red-500" />
                        <div><p className="font-extrabold tracking-tight mb-0.5">Operation Error</p><p>{errorMsg}</p></div>
                    </div>
                )}

                {status === 'completed' && (
                    <div className="bg-green-50 border border-green-200 text-green-700 p-5 rounded-xl flex items-start text-sm shadow-sm transition-all mt-4 animate-fade-in-up">
                        <CheckCircle2 className="w-6 h-6 shrink-0 mr-3 text-green-500" />
                        <div>
                            <p className="font-extrabold tracking-tight text-base mb-1">Students Stored/Merged Successfully!</p>
                            <ul className="text-sm font-semibold text-green-800 space-y-1">
                                <li>• Processed <span className="font-bold bg-green-200/50 px-1 rounded">{successStats.total}</span> valid roll numbers.</li>
                                <li>• Processed Batches: <span className="font-bold">{successStats.batches.join(', ')}</span>.</li>
                                <li className="italic text-xs mt-2 opacity-80">* Existing students were protected. Only new entries were added or arrays synced.</li>
                            </ul>
                        </div>
                    </div>
                )}

                {status === 'uploading' && (
                    <div className="bg-indigo-50 border border-indigo-200 text-indigo-700 p-5 rounded-xl shadow-sm transition-all duration-300 animate-fade-in-up">
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs font-bold text-indigo-600 mb-1">
                                <span>Saving data to Firestore safely...</span>
                                <span>{progress.current} / {progress.total}</span>
                            </div>
                            <div className="w-full bg-indigo-100 rounded-full h-2.5 overflow-hidden">
                                <div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500 ease-out"
                                    style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }} />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Helper: Get lateral batch prefix ─────────────────────────────────────────
const getLateralBatch = (batch: string) => {
    const match = batch.match(/^[YLyl](\d+)$/);
    if (!match) return '';
    return `L${parseInt(match[1]) + 1}`;
};

// ─── SUB-COMPONENT: Check Class Tab ──────────────────────────────────────────
function CheckClassTab() {
    const [courseType, setCourseType] = useState('BTech');
    const [batchNumber, setBatchNumber] = useState('');
    const [department, setDepartment] = useState('');

    // Derived value - always has Y prefix
    const batch = batchNumber ? `Y${batchNumber}` : '';
    const lateralBatch = getLateralBatch(batch);

    const [fetchStatus, setFetchStatus] = useState<'idle' | 'loading' | 'success' | 'notfound' | 'error'>('idle');
    const [classData, setClassData] = useState<ClassDocData | null>(null);
    const [fetchedPath, setFetchedPath] = useState('');
    const [lateralExists, setLateralExists] = useState(false);

    const [selectedRegulationNumber, setSelectedRegulationNumber] = useState('');
    const selectedRegulation = selectedRegulationNumber ? `R${selectedRegulationNumber}` : '';
    const [updateStatus, setUpdateStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [updateMsg, setUpdateMsg] = useState('');
    const [currentRegulation, setCurrentRegulation] = useState('');

    const hasChanged = fetchStatus === 'success' && selectedRegulation !== currentRegulation && selectedRegulation !== '';

    const fetchClass = async () => {
        if (!batch.trim()) return;
        setFetchStatus('loading');
        setClassData(null);
        setCurrentRegulation('');
        setSelectedRegulationNumber('');
        setUpdateStatus('idle');
        setUpdateMsg('');
        setLateralExists(false);

        try {
            const batchKey = batch.trim().toUpperCase();
            const latBatchKey = lateralBatch ? lateralBatch.toUpperCase() : '';

            // 1. Check that the regular batch document exists
            const batchPath = `classes/${courseType}/batches/${batchKey}`;
            const batchSnap = await getDoc(doc(db, batchPath));
            if (!batchSnap.exists()) {
                setFetchStatus('notfound');
                return;
            }

            // 2. Check if lateral batch exists
            let latExists = false;
            if (latBatchKey) {
                const latSnap = await getDoc(doc(db, `classes/${courseType}/batches/${latBatchKey}`));
                latExists = latSnap.exists();
                setLateralExists(latExists);
            }

            // 3. Read regulations from yearToRegulation/map
            const mapSnap = await getDoc(doc(db, 'yearToRegulation', 'map'));
            const mapData = mapSnap.exists() ? mapSnap.data() : {};
            const regulation = mapData[batchKey] || '';
            
            setClassData(batchSnap.data() as ClassDocData);
            setCurrentRegulation(regulation);
            // Strip the leading 'R' so the input shows just the digits
            setSelectedRegulationNumber(regulation.replace(/^R/i, ''));
            setFetchedPath(batchPath);
            setFetchStatus('success');
        } catch (err) {
            console.error(err);
            setFetchStatus('error');
        }
    };

    const [showConfirm, setShowConfirm] = useState(false);

    const handleUpdateRegulation = async () => {
        if (!hasChanged) return;
        setShowConfirm(false);
        setUpdateStatus('loading');
        setUpdateMsg('');
        try {
            const batchKey = batch.trim().toUpperCase();
            const latBatchKey = lateralBatch ? lateralBatch.toUpperCase() : '';
            
            const updates: Record<string, string> = {
                [batchKey]: selectedRegulation
            };
            if (latBatchKey && lateralExists) {
                updates[latBatchKey] = selectedRegulation;
            }
            
            await updateDoc(doc(db, 'yearToRegulation', 'map'), updates);
            setCurrentRegulation(selectedRegulation);
            setUpdateStatus('success');
            setUpdateMsg('Regulation updated successfully');
            setTimeout(() => setUpdateStatus('idle'), 3500);
        } catch (err) {
            console.error(err);
            setUpdateStatus('error');
            setUpdateMsg('Failed to update regulation. Please try again.');
            setTimeout(() => setUpdateStatus('idle'), 3500);
        }
    };

    return (
        <div className="w-full max-w-3xl mx-auto space-y-6">
            {/* Filter Card */}
            <div className="premium-card p-6 sm:p-8 bg-white border border-indigo-100/60 shadow-lg">
                <div className="flex items-center space-x-3 mb-6">
                    <div className="bg-violet-50 p-2 rounded-lg"><span className="text-xl">🔍</span></div>
                    <div>
                        <h2 className="text-lg font-extrabold text-slate-800 tracking-tight">Check Class</h2>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">Fetch and manage regulation mapping for an existing class</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    {/* Course Type */}
                    <div className="space-y-2">
                        <label className="label-premium">Class (Course Type)</label>
                        <div className="flex rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                            {COURSE_TYPES.map((ct) => (
                                <button key={ct} onClick={() => { setCourseType(ct); setFetchStatus('idle'); setClassData(null); }}
                                    className={`flex-1 py-2.5 text-sm font-extrabold transition-all ${courseType === ct ? 'bg-indigo-600 text-white shadow-inner' : 'bg-white text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'}`}>
                                    {ct === 'BTech' ? 'B.Tech' : 'M.Tech'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Batch */}
                    <div className="space-y-2">
                        <label className="label-premium">Batch</label>
                        <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                            <span className="bg-slate-100 px-4 py-2.5 font-bold text-slate-600 text-sm">Y</span>
                            <input
                                type="text"
                                inputMode="numeric"
                                placeholder="22,23,24...etc"
                                className="input-prefix-inner uppercase"
                                value={batchNumber}
                                onChange={(e) => { setBatchNumber(e.target.value.replace(/[^0-9]/g, '')); setFetchStatus('idle'); setClassData(null); }}
                                maxLength={2}
                            />
                        </div>
                    </div>
                </div>

                <button
                    onClick={fetchClass}
                    disabled={!batch.trim() || fetchStatus === 'loading'}
                    className="w-full btn-primary py-3 flex items-center justify-center font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all"
                >
                    {fetchStatus === 'loading' ? (
                        <div className="flex items-center space-x-2"><Loader2 className="w-5 h-5 animate-spin text-white" /><span>Fetching from Firestore...</span></div>
                    ) : (
                        <div className="flex items-center space-x-2"><Search className="w-5 h-5 text-white" /><span>Fetch Class Data</span></div>
                    )}
                </button>

                {/* Not Found */}
                {fetchStatus === 'notfound' && (
                    <div className="mt-4 bg-amber-50 border border-amber-200 text-amber-700 p-4 rounded-xl flex items-start text-sm animate-fade-in-up">
                        <AlertCircle className="w-5 h-5 shrink-0 mr-3 text-amber-500" />
                        <div><p className="font-extrabold tracking-tight mb-0.5">Not Found</p><p>No class document found at the specified path. Please verify the course type, batch, and department.</p></div>
                    </div>
                )}

                {fetchStatus === 'error' && (
                    <div className="mt-4 bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-start text-sm animate-fade-in-up">
                        <AlertCircle className="w-5 h-5 shrink-0 mr-3 text-red-500" />
                        <div><p className="font-extrabold tracking-tight mb-0.5">Error</p><p>Failed to fetch class data. Please try again.</p></div>
                    </div>
                )}
            </div>

            {/* Result Card */}
            {fetchStatus === 'success' && classData && (
                <div className="premium-card p-6 sm:p-8 bg-white border border-violet-100 shadow-lg animate-fade-in-up">
                    <div className="flex items-center space-x-3 mb-6 border-b border-slate-100 pb-5">
                        <div className="bg-violet-50 p-2 rounded-lg"><ShieldCheck className="w-5 h-5 text-violet-600" /></div>
                        <div>
                            <h3 className="text-base font-extrabold text-slate-800 tracking-tight">Class Information</h3>
                            <p className="text-xs text-slate-400 font-mono mt-0.5">{fetchedPath}</p>
                        </div>
                    </div>

                    {/* Info Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
                        <InfoTile label="Class" value={courseType} color="indigo" />
                        <InfoTile 
                            label="Batch" 
                            value={lateralExists ? `${batch.toUpperCase()} (+${lateralBatch})` : batch.toUpperCase()} 
                            color="blue" 
                            badge={lateralExists ? `Includes ${lateralBatch} laterals` : undefined}
                        />
                        <InfoTile
                            label="Regulation"
                            value={currentRegulation || 'Not Set'}
                            color={currentRegulation ? 'emerald' : 'amber'}
                        />
                    </div>

                    {/* Regulation Update */}
                    <div className="bg-slate-50/70 rounded-2xl border border-slate-200/60 p-5 space-y-4">
                        <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <RefreshCw className="w-3.5 h-3.5" /> Update Regulation
                        </h4>

                        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
                            <div className="flex-1 space-y-2">
                                <label className="label-premium">Regulation for {batch.toUpperCase()} {lateralExists && `& ${lateralBatch}`}</label>
                                <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                    <span className="bg-slate-100 px-4 py-2.5 font-bold text-slate-600 text-sm">R</span>
                                    <input
                                        id="regulation-input"
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={2}
                                        placeholder="20, 23, 26...etc"
                                        className="input-prefix-inner"
                                        value={selectedRegulationNumber}
                                        onChange={(e) => setSelectedRegulationNumber(e.target.value.replace(/[^0-9]/g, ''))}
                                    />
                                </div>
                            </div>

                            <button
                                id="update-regulation-btn"
                                onClick={() => setShowConfirm(true)}
                                disabled={!hasChanged || updateStatus === 'loading'}
                                className="w-full sm:w-auto btn-primary px-6 py-2.5 flex items-center justify-center gap-2 font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            >
                                {updateStatus === 'loading' ? (
                                    <><Loader2 className="w-4 h-4 animate-spin text-white" /><span>Updating...</span></>
                                ) : (
                                    <><Save className="w-4 h-4 text-white" /><span>Update Regulation</span></>
                                )}
                            </button>
                        </div>

                        {(!hasChanged && selectedRegulation) && (
                            <p className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 bg-slate-300 rounded-full inline-block"></span>
                                Select a different regulation to enable the update button.
                            </p>
                        )}
                    </div>

                    {/* Update Feedback */}
                    {updateStatus === 'success' && (
                        <div className="mt-4 bg-green-50 border border-green-200 text-green-700 p-4 rounded-xl flex items-center gap-3 text-sm font-medium animate-fade-in-up">
                            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                            <span className="font-bold">{updateMsg}</span>
                        </div>
                    )}
                    {updateStatus === 'error' && (
                        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center gap-3 text-sm font-medium animate-fade-in-up">
                            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                            <span className="font-bold">{updateMsg}</span>
                        </div>
                    )}
                </div>
            )}

            {/* Confirm Modal */}
            {showConfirm && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm border border-slate-100">
                        <div className="mb-6">
                            <h3 className="text-lg font-extrabold text-slate-800 mb-2">Confirm Regulation Update</h3>
                            <p className="text-sm text-slate-500 leading-relaxed">
                                Are you sure you want to change the regulation from{' '}
                                <span className="font-bold text-slate-700">{currentRegulation || 'Not Set'}</span> to{' '}
                                <span className="font-bold text-indigo-600">{selectedRegulation}</span>?
                            </p>
                        </div>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowConfirm(false)}
                                className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-bold text-sm transition-colors">
                                Cancel
                            </button>
                            <button
                                id="confirm-update-btn"
                                onClick={handleUpdateRegulation}
                                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition-colors shadow-sm flex items-center gap-2">
                                <Save className="w-4 h-4" /> Confirm Update
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Helper: Info Tile ────────────────────────────────────────────────────────
const colorMap: Record<string, string> = {
    indigo: 'bg-indigo-50 border-indigo-100 text-indigo-700',
    blue: 'bg-blue-50 border-blue-100 text-blue-700',
    purple: 'bg-purple-50 border-purple-100 text-purple-700',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-700',
    amber: 'bg-amber-50 border-amber-100 text-amber-700',
};

function InfoTile({ label, value, color, badge }: { label: string; value: string; color: string; badge?: string }) {
    return (
        <div className={`rounded-xl border p-3.5 flex flex-col gap-1 ${colorMap[color] || colorMap.indigo}`}>
            <span className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">{label}</span>
            <div className="flex items-center gap-2">
                <span className="text-sm font-extrabold tracking-tight">{value}</span>
                {badge && (
                    <span className="text-[10px] font-bold text-purple-600 bg-purple-50 border border-purple-100 px-2 py-0.5 rounded-full">
                        {badge}
                    </span>
                )}
            </div>
        </div>
    );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
type TabId = 'class' | 'check-class';

const TABS: { id: TabId; label: string; icon: string }[] = [
    { id: 'class', label: 'Class', icon: '🏫' },
    { id: 'check-class', label: 'Check Class', icon: '🔍' },
];

export default function ClassPage() {
    const [activeTab, setActiveTab] = useState<TabId>('class');

    return (
        <div className="min-h-screen bg-slate-50 relative pointer-events-auto pb-12">
            {/* Background Decorative Elements */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-100/30 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/3" />
            <div className="absolute top-40 left-0 w-[500px] h-[500px] bg-blue-100/30 rounded-full blur-3xl pointer-events-none -translate-x-1/3" />

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
                            <h1 className="text-lg sm:text-xl font-extrabold text-slate-800 tracking-tight">Class Management</h1>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 relative z-10 flex flex-col items-center gap-6">
                {/* Tab Bar */}
                <div className="flex gap-2 p-1.5 bg-white/60 backdrop-blur-md rounded-xl shadow-sm border border-slate-200/60 w-full max-w-3xl">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            id={`tab-${tab.id}`}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-all duration-200 ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm'}`}
                        >
                            <span>{tab.icon}</span>
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                {activeTab === 'class' && <AddClassTab />}
                {activeTab === 'check-class' && <CheckClassTab />}
            </div>
        </div>
    );
}
