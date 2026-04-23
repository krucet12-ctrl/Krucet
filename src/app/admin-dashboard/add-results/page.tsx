"use client";
import { useState, useEffect, useCallback } from "react";
import { collection, getDocs, query, Timestamp, addDoc, serverTimestamp, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import { ArrowLeft, Loader2, Database } from "lucide-react";
import { safeTrim } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RollRange {
  branch: string;
  type: "regular" | "lateral";
  start: string;
  end: string;
}

type CourseType = "BTech" | "MTech";

interface SemesterData {
  regular: boolean;
  revaluation: boolean;
  supply: boolean;
  regularCount: number;
  revaluationCount: number;
  supplyCount: number;
  regularUploadedAt?: Date | null;
  revaluationUploadedAt?: Date | null;
  supplyUploadedAt?: Date | null;
}

interface BatchResult {
  batchLabel: string;
  lateralBatch?: string;
  semesters: Record<string, SemesterData>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getLateralPrefix = (batch: string) => {
  const match = batch.match(/^[YLyl](\d+)$/);
  if (!match) return "";
  return `L${parseInt(match[1]) + 1}`;
};

const buildResultType = (
  courseType: CourseType,
  batch: string,
  semester: string,
  scrapeType: string
): string => {
  if (!batch || !semester || !scrapeType) return "";
  const base = `${courseType}-${batch}-Sem${semester}`;
  if (scrapeType === "regular") return base;
  const suffix = scrapeType === "revaluation" ? "RVresults" : "SupplyResults";
  return `${base}-${suffix}`;
};

// ─── Badge component ──────────────────────────────────────────────────────────

function TypeBadge({ type, exists, count }: { type: "regular" | "revaluation" | "supply"; exists: boolean; count?: number }) {
  if (!exists) return null;
  const styles: Record<string, string> = {
    regular: "bg-emerald-50 text-emerald-700 border-emerald-200",
    revaluation: "bg-blue-50 text-blue-700 border-blue-200",
    supply: "bg-orange-50 text-orange-700 border-orange-200",
  };
  const labels: Record<string, string> = {
    regular: "Regular",
    revaluation: "Revaluation",
    supply: "Supply",
  };
  const icons: Record<string, string> = {
    regular: "✔",
    revaluation: "✔",
    supply: "✔",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-extrabold uppercase tracking-widest ${styles[type]}`}>
      <span>{icons[type]}</span>
      <span>{labels[type]}</span>
      {count !== undefined && count > 0 && (
        <span className="ml-1 opacity-60 font-bold normal-case tracking-normal">({count})</span>
      )}
    </span>
  );
}

// ─── Check Stored Results Tab ─────────────────────────────────────────────────

interface StoredResult {
  id: string;
  courseType: string;
  batch: string;
  semester: string;
  scrapeType: string;
  resultType: string;
  rsurl: string;
  createdAt: Timestamp | null;
}

const RESULT_TYPE_STYLES: Record<string, { bg: string; text: string; border: string; label: string; dot: string }> = {
  regular:     { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", label: "Regular", dot: "bg-emerald-500" },
  revaluation: { bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-200",    label: "Revaluation", dot: "bg-blue-500" },
  supply:      { bg: "bg-orange-50",  text: "text-orange-700",  border: "border-orange-200",  label: "Supply", dot: "bg-orange-500" },
};

function ResultCard({ item }: { item: StoredResult }) {
  const typeKey = (item.resultType || item.scrapeType || "").toString().trim().toLowerCase();
  const style =
    RESULT_TYPE_STYLES[typeKey] ??
    { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200", label: item.resultType || item.scrapeType || typeKey, dot: "bg-slate-400" };
  const uploadDate = item.createdAt instanceof Timestamp
    ? item.createdAt.toDate().toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
    : '—';
  const semLabel = item.semester || "—";

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col">
      {/* Top accent bar */}
      <div className={`h-1.5 w-full ${style.dot}`} />

      <div className="p-5 flex flex-col gap-4 flex-1">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-sm shrink-0">
              <span className="text-white font-extrabold text-xs tracking-wide leading-tight text-center">{item.batch}</span>
            </div>
            <div>
              <p className="font-extrabold text-slate-800 text-base leading-tight">{item.batch} Batch</p>
              <p className="text-xs text-slate-400 font-semibold mt-0.5">{item.courseType || "—"}</p>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-extrabold uppercase tracking-widest shrink-0 ${style.bg} ${style.text} ${style.border}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
            {style.label}
          </span>
        </div>

        {/* Divider */}
        <div className="h-px bg-slate-100" />

        {/* Fields */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-0.5">
            <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">Semester</p>
            <p className="text-sm font-extrabold text-slate-800">{semLabel}</p>
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">Upload Date</p>
            <p className="text-xs font-bold text-slate-700 leading-snug">{uploadDate}</p>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5">
          <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Scrape Type / Result Type</p>
          <p className="text-xs font-extrabold text-slate-800">
            {item.scrapeType || "—"} / {item.resultType || "—"}
          </p>
        </div>

        {/* RSURL */}
        <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5">
          <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">RSURL</p>
          <p className="text-[11px] font-mono font-bold text-indigo-700 break-all leading-snug">
            {item.rsurl || <span className="text-slate-400 italic font-normal">Not recorded</span>}
          </p>
        </div>
      </div>
    </div>
  );
}

function CheckStoredResultsTab() {
  const [fetchStatus, setFetchStatus] = useState<"loading" | "success" | "error">("loading");
  const [allResults, setAllResults] = useState<StoredResult[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

  // Filters
  const [batchFilter, setBatchFilter] = useState("");
  const [semFilter, setSemFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  useEffect(() => {
    setFetchStatus("loading");
    setErrorMsg("");
    const q = query(collection(db, "results"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: StoredResult[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<StoredResult, "id">),
        }));
        setAllResults(rows);
        setFetchStatus("success");
      },
      (err) => {
        console.error(err);
        setErrorMsg(err?.message || String(err));
        setFetchStatus("error");
      }
    );
    return () => unsub();
  }, []);

  // Derive filter options from fetched data
  const batchOptions = Array.from(new Set(allResults.map(r => r.batch))).sort();
  const semOptions   = Array.from(new Set(allResults.map(r => r.semester))).sort((a, b) => {
    const aNum = parseInt(a.replace(/Sem\s*/i, ""));
    const bNum = parseInt(b.replace(/Sem\s*/i, ""));
    return aNum - bNum;
  });
  const typeOptions  = Array.from(new Set(allResults.map(r => r.resultType)));

  const filtered = allResults.filter(r =>
    (!batchFilter || r.batch === batchFilter) &&
    (!semFilter   || r.semester === semFilter) &&
    (!typeFilter  || r.resultType === typeFilter)
  );

  return (
    <div className="space-y-6">
      {/* Control Card */}
      <div className="premium-card p-6 sm:p-8 bg-white border border-indigo-100/60 shadow-lg">
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-violet-50 p-2 rounded-lg"><Database className="w-5 h-5 text-violet-600" /></div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-800 tracking-tight">Check Stored Results</h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">View all uploaded result metadata with full details</p>
          </div>
        </div>

        {fetchStatus === "loading" && (
          <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading stored results...</span>
          </div>
        )}

        {/* Filters — only show after fetch */}
        {fetchStatus === "success" && allResults.length > 0 && (
          <div className="mt-6 pt-5 border-t border-slate-100 flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block">Batch</label>
              <select
                value={batchFilter}
                onChange={e => setBatchFilter(e.target.value)}
                className="input-premium py-2 text-sm min-w-[110px]"
              >
                <option value="">All Batches</option>
                {batchOptions.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block">Semester</label>
              <select
                value={semFilter}
                onChange={e => setSemFilter(e.target.value)}
                className="input-premium py-2 text-sm min-w-[110px]"
              >
                <option value="">All Semesters</option>
                {semOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block">Result Type</label>
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                className="input-premium py-2 text-sm min-w-[130px]"
              >
                <option value="">All Types</option>
                {typeOptions.map((t) => {
                  const key = t.toString().trim().toLowerCase();
                  return <option key={t} value={t}>{RESULT_TYPE_STYLES[key]?.label ?? t}</option>;
                })}
              </select>
            </div>
            {(batchFilter || semFilter || typeFilter) && (
              <button
                onClick={() => { setBatchFilter(""); setSemFilter(""); setTypeFilter(""); }}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline underline-offset-2 pb-1"
              >
                Clear filters
              </button>
            )}
            <span className="ml-auto text-xs font-bold text-slate-400 pb-1 self-end">
              Showing {filtered.length} of {allResults.length}
            </span>
          </div>
        )}

        {fetchStatus === "error" && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm">
            <p className="font-extrabold mb-1">
              {errorMsg.toLowerCase().includes('index')
                ? '⚠️ Firestore index error'
                : errorMsg.toLowerCase().includes('permission')
                ? '🔒 Permission denied'
                : '❌ Failed to fetch results'}
            </p>
            <p className="font-medium opacity-80">
              {errorMsg.toLowerCase().includes('index')
                ? 'A Firestore composite index is required. Please create it in the Firebase Console or contact the developer.'
                : errorMsg.toLowerCase().includes('permission')
                ? 'You do not have permission to read results. Check Firestore security rules.'
                : 'Please check your internet connection and try again.'}
            </p>
          </div>
        )}
      </div>

      {/* Results Grid */}
      {fetchStatus === "success" && (
        <>
          {filtered.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200 shadow-sm">
              <span className="text-5xl block mb-4">🗂️</span>
              <p className="text-slate-600 font-bold text-base">No stored results found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map(item => <ResultCard key={item.id} item={item} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}


// ─── Bulk Scraping Tab ────────────────────────────────────────────────────────

function BulkScrapingTab() {
  const [courseType, setCourseType] = useState<CourseType>("BTech");
  const [batchNumber, setBatchNumber] = useState("");
  const [selectedSemester, setSelectedSemester] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [rsurl, setRsurl] = useState("");

  // Derived value - always has Y prefix
  const selectedBatch = batchNumber ? `Y${batchNumber}` : '';

  const [availableBranches, setAvailableBranches] = useState<string[]>([]);
  const [rollRanges, setRollRanges] = useState<RollRange[]>([]);
  const [fetchingRanges, setFetchingRanges] = useState(false);
  const [fetchError, setFetchError] = useState("");

  const [resultType, setResultType] = useState("");
  const [bulkScraping, setBulkScraping] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  const semesterOptions = courseType === "BTech" ? [1, 2, 3, 4, 5, 6, 7, 8] : [1, 2, 3, 4];

  useEffect(() => {
    setResultType(buildResultType(courseType, selectedBatch, selectedSemester, selectedType));
  }, [courseType, selectedBatch, selectedSemester, selectedType]);

  const fetchRangesForBatch = useCallback(async (batch: string, ct: CourseType) => {
    if (!batch) { setAvailableBranches([]); setRollRanges([]); setFetchError(""); return; }
    setFetchingRanges(true); setFetchError("");
    try {
      const lateralPrefix = getLateralPrefix(batch);
      const regularBranchesRef = collection(db, "classes", ct, "batches", batch, "departments");
      const lateralBranchesRef = lateralPrefix ? collection(db, "classes", ct, "batches", lateralPrefix, "departments") : null;
      const [regularSnap, lateralBatchSnap] = await Promise.all([
        getDocs(regularBranchesRef),
        lateralBranchesRef ? getDocs(lateralBranchesRef) : Promise.resolve(null),
      ]);
      let branchSnap = regularSnap;
      if (branchSnap.empty) {
        branchSnap = await getDocs(collection(db, "classes", ct, batch));
      }
      if (branchSnap.empty) {
        setAvailableBranches([]); setRollRanges([]);
        setFetchError(`No branches found for batch "${batch}" under ${ct}. Ensure students are uploaded first.`);
        return;
      }
      const lateralByBranch = new Map<string, string[]>();
      if (lateralBatchSnap && 'empty' in lateralBatchSnap && !lateralBatchSnap.empty) {
        for (const ldoc of lateralBatchSnap.docs) {
          if (ldoc.id.startsWith("_")) continue;
          const ldata = ldoc.data() as { lateralRollNos?: string[] };
          lateralByBranch.set(ldoc.id, ldata.lateralRollNos || []);
        }
      }
      const newRanges: RollRange[] = [];
      const branches: string[] = [];
      for (const branchDoc of branchSnap.docs) {
        const branchId = branchDoc.id;
        if (branchId.startsWith("_")) continue;
        branches.push(branchId);
        const data = branchDoc.data() as { regularRollNos?: string[]; lateralRollNos?: string[] };
        let regulars = (data.regularRollNos || []).sort();
        const lateralsFromL23 = lateralByBranch.get(branchId) || [];
        const lateralsFromSameDoc = data.lateralRollNos || [];
        const lateralSet = new Set([...lateralsFromL23, ...lateralsFromSameDoc]);
        let laterals = Array.from(lateralSet).sort();
        if (regulars.length === 0 && laterals.length === 0) {
          try {
            const studentsSnap = await getDocs(collection(db, "classes", ct, "batches", batch, "departments", branchId, "students"));
            const allRolls = studentsSnap.docs.map((d) => d.id).sort();
            if (allRolls.length > 0) {
              regulars = allRolls.filter((r) => r.toUpperCase().startsWith(batch.toUpperCase())).sort();
              laterals = allRolls.filter((r) => lateralPrefix ? r.toUpperCase().startsWith(lateralPrefix.toUpperCase()) : false).sort();
            }
          } catch { /* non-fatal */ }
        }
        newRanges.push({ branch: branchId, type: "regular", start: regulars[0] || "", end: regulars[regulars.length - 1] || "" });
        newRanges.push({ branch: branchId, type: "lateral", start: laterals[0] || "", end: laterals[laterals.length - 1] || "" });
      }
      setAvailableBranches(branches.sort());
      setRollRanges(newRanges);
    } catch (err) {
      console.error(err);
      setFetchError("Failed to fetch branch data. Please check your connection and try again.");
      setAvailableBranches([]); setRollRanges([]);
    } finally {
      setFetchingRanges(false);
    }
  }, []);

  useEffect(() => {
    const trimmed = selectedBatch.trim().toUpperCase();
    if (trimmed.length >= 3) fetchRangesForBatch(trimmed, courseType);
    else { setAvailableBranches([]); setRollRanges([]); setFetchError(""); }
  }, [selectedBatch, courseType, fetchRangesForBatch]);

  useEffect(() => {
    if (courseType === "MTech" && parseInt(selectedSemester) > 4) setSelectedSemester("1");
  }, [courseType, selectedSemester]);

  const validRanges = rollRanges.filter((r) => r.start && r.end);
  const hasValidData = validRanges.length > 0 && !!rsurl && !!safeTrim(resultType);

  const handleBulkScrape = async () => {
    setBulkScraping(true); setBulkError(""); setShowSuccess(false);
    let allSuccess = true;
    try {
      for (const range of validRanges) {
        const formData = new FormData();
        formData.append("startRoll", range.start);
        formData.append("endRoll", range.end);
        formData.append("rsurl", rsurl);
        formData.append("resultType", resultType);
        formData.append("courseType", courseType);
        formData.append("batch", selectedBatch);
        formData.append("semester", selectedSemester);
        formData.append("scrapeType", selectedType);
        const res = await fetch("/api/bulk-scrape", { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) { setBulkError(data.error || "Failed to start bulk scraping."); allSuccess = false; break; }
      }

      if (allSuccess) {
        const courseTypeLabel = courseType === "BTech" ? "B.Tech" : "M.Tech";
        const semLabel = selectedSemester ? `Sem ${selectedSemester}` : "";
        const typeLabel =
          selectedType === "regular" ? "Regular" :
          selectedType === "supply" ? "Supply" :
          selectedType === "revaluation" ? "Revaluation" :
          selectedType;

        await addDoc(collection(db, "results"), {
          courseType: courseTypeLabel,
          batch: selectedBatch,
          semester: semLabel,
          scrapeType: typeLabel,
          rsurl,
          resultType: typeLabel,
          createdAt: serverTimestamp(),
        });
        setShowSuccess(true);
      }
    } catch (err) {
      setBulkError("Failed to start bulk scraping: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBulkScraping(false);
    }
  };

  return (
    <div className="premium-card p-6 sm:p-8 space-y-8">
      <div className="flex items-center space-x-3">
        <div className="bg-indigo-50 p-2 rounded-lg"><span className="text-xl">📥</span></div>
        <h2 className="text-lg font-extrabold text-slate-800 tracking-tight">Add Results</h2>
      </div>

      {/* Step 1 */}
      <div className="bg-slate-50/70 rounded-2xl border border-slate-200/60 p-5 space-y-5">
        <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <span className="w-5 h-5 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-[10px] font-black">1</span>
          Course & Batch Selection
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-2">
            <label className="label-premium">Course Type</label>
            <div className="flex rounded-xl overflow-hidden border border-slate-200 shadow-sm">
              {(["BTech", "MTech"] as CourseType[]).map((ct) => (
                <button key={ct} onClick={() => setCourseType(ct)}
                  className={`flex-1 py-2.5 text-sm font-extrabold transition-all ${courseType === ct ? "bg-indigo-600 text-white shadow-inner" : "bg-white text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"}`}>
                  {ct === "BTech" ? "B.Tech" : "M.Tech"}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="label-premium">Batch Code <span className="ml-1 text-slate-400 font-normal text-xs">(e.g. Y22)</span></label>
            <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <span className="bg-slate-100 px-4 py-2.5 font-bold text-slate-600 text-sm">Y</span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="22,23,24,25,26....etc"
                className="input-prefix-inner uppercase"
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value.replace(/[^0-9]/g, ''))}
                maxLength={2}
              />
              {fetchingRanges && (
                <div className="pr-3">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Branch discovery */}
      {selectedBatch.length >= 3 && (
        <div>
          {fetchError ? (
            <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm font-medium">
              <span>{fetchError}</span>
            </div>
          ) : fetchingRanges ? (
            <div className="text-center py-6 text-sm text-slate-500 font-medium animate-pulse">Fetching branches from database...</div>
          ) : availableBranches.length === 0 ? null : (
            <div className="bg-slate-50/70 rounded-2xl border border-slate-200/60 p-5 space-y-4">
              <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <span className="w-5 h-5 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-[10px] font-black">2</span>
                Roll Number Ranges
                <span className="ml-auto text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
                  {availableBranches.length} branch{availableBranches.length !== 1 ? "es" : ""} found
                </span>
              </h3>
              <div className="space-y-5">
                {availableBranches.map((branch) => {
                  const regularRange = rollRanges.find((r) => r.branch === branch && r.type === "regular");
                  const lateralRange = rollRanges.find((r) => r.branch === branch && r.type === "lateral");
                  return (
                    <div key={branch} className="rounded-xl border border-indigo-100 bg-white overflow-hidden shadow-sm">
                      <div className="bg-indigo-600 px-4 py-2 flex items-center justify-between">
                        <span className="text-white font-extrabold text-sm tracking-wide">{branch}</span>
                        <span className="text-indigo-200 text-[11px] font-bold">
                          {[regularRange, lateralRange].filter((r) => r?.start).length} active range{[regularRange, lateralRange].filter((r) => r?.start).length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[{ label: "Regular", range: regularRange, color: "blue" }, { label: "Lateral", range: lateralRange, color: "purple" }].map(({ label, range, color }) => (
                          <div key={label} className="space-y-2">
                            <div className="flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full bg-${color}-400 shrink-0`} />
                              <span className={`text-[10px] font-extrabold text-${color}-600 uppercase tracking-widest`}>{label}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {["Start", "End"].map((lbl) => (
                                <div key={lbl}>
                                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">{lbl}</p>
                                  <div className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold border ${range?.start ? "bg-white border-slate-200 text-slate-700" : "bg-slate-50 border-dashed border-slate-200 text-slate-400 italic"}`}>
                                    {lbl === "Start" ? range?.start || "—" : range?.end || "—"}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              {validRanges.length === 0 && (
                <div className="text-center py-3 text-sm text-slate-500 font-medium bg-white rounded-xl border border-dashed border-slate-200">
                  ⚠️ No roll number ranges found. Add students to the database first.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 3: URL & Type */}
      <div className="bg-slate-50/70 rounded-2xl border border-slate-200/60 p-5 space-y-4">
        <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <span className="w-5 h-5 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-[10px] font-black">3</span>
          Result URL & Type Configuration
        </h3>
        <div className="space-y-2">
          <label className="label-premium">Result URL Identifier (rsurl)</label>
          <input type="text" placeholder="e.g., BTechSem4NetResults-15032025" className="input-premium font-mono text-sm"
            value={rsurl} onChange={(e) => setRsurl(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Semester</label>
            <select value={selectedSemester} onChange={(e) => setSelectedSemester(e.target.value)} className="input-premium py-2 cursor-pointer">
              <option value="" disabled>Select semester</option>
              {semesterOptions.map((s) => <option key={s} value={String(s)}>Sem {s}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Scrape Type</label>
            <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className="input-premium py-2 cursor-pointer">
              <option value="" disabled>Select type</option>
              <option value="regular">Regular</option>
              <option value="supply">Supply</option>
              <option value="revaluation">Revaluation</option>
            </select>
          </div>
          <div className="space-y-1 sm:col-span-1 col-span-2">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Result Type Preview</label>
            <div className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-[10px] sm:text-[11px] font-mono font-bold text-indigo-600 flex items-center overflow-x-auto whitespace-nowrap shadow-sm h-[38px] sm:h-[42px]">
              {resultType || <span className="text-slate-400 italic font-normal">Fill batch & semester…</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Summary */}
      {availableBranches.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm">
          <p className="font-extrabold text-indigo-700 mb-2 text-xs uppercase tracking-wider">📋 Uploading Summary</p>
          <ul className="space-y-1 text-indigo-800 font-medium text-xs">
            <li><span className="font-bold">Course:</span> {courseType === "BTech" ? "B.Tech" : "M.Tech"}</li>
            <li><span className="font-bold">Batch:</span> {selectedBatch || "—"}</li>
            <li><span className="font-bold">Branches:</span> {availableBranches.join(", ") || "—"}</li>
            <li><span className="font-bold">Active ranges:</span> {validRanges.length} out of {rollRanges.length}</li>
            <li><span className="font-bold">Result Type:</span> {resultType || "—"}</li>
          </ul>
        </div>
      )}

      {/* Start Button */}
      <div>
        <button onClick={handleBulkScrape} disabled={bulkScraping || !hasValidData}
          className="btn-primary w-full sm:w-auto px-8 py-3 flex justify-center items-center font-bold disabled:opacity-50 disabled:cursor-not-allowed">
          {bulkScraping ? (
            <div className="flex items-center space-x-2">
              <Loader2 className="w-5 h-5 animate-spin text-white" />
              <span>Uploading the Results...</span>
            </div>
          ) : "Add Results"}
        </button>
        {!hasValidData && !bulkScraping && (
          <p className="mt-2 text-xs text-slate-400 font-medium">
            {!selectedBatch ? "Enter a batch code to begin" : validRanges.length === 0 ? "No roll number ranges available for this batch" : !rsurl ? "Enter a Result URL Identifier" : "Fill all required fields"}
          </p>
        )}
      </div>

      {showSuccess && !bulkError && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-bold">Results Uploaded successfully!</span>
          </div>
          <button onClick={() => setShowSuccess(false)} className="text-green-700 hover:text-green-900 font-bold text-lg leading-none">&times;</button>
        </div>
      )}
      {bulkError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="text-red-800 font-extrabold text-xs uppercase tracking-wide mb-1">Error</div>
          <div className="text-red-700 text-sm">{bulkError}</div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type TabId = "bulk" | "check";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "bulk", label: "Add Results", icon: "📥" },
  { id: "check", label: "Check Stored Results", icon: "🗂️" },
];

export default function ResultsManagementPage() {
  const [activeTab, setActiveTab] = useState<TabId>("bulk");

  return (
    <div className="min-h-screen bg-slate-50 relative pointer-events-auto pb-12">
      {/* Background Decorative */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-100/30 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/3" />
      <div className="absolute top-40 left-0 w-[500px] h-[500px] bg-blue-100/30 rounded-full blur-3xl pointer-events-none -translate-x-1/3" />

      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md shadow-sm border-b border-indigo-100/60 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center py-4 w-full gap-4">
            <Link href="/admin-dashboard" className="text-sm font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-2 transition-colors group">
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span>Back to Dashboard</span>
            </Link>
            <div className="h-5 w-px bg-slate-200 hidden sm:block" />
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-800 tracking-tight">Results Management</h1>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 relative z-10">
        {/* Tab Bar */}
        <div className="flex gap-2 p-1.5 bg-white/60 backdrop-blur-md rounded-xl shadow-sm border border-slate-200/60 mb-8 w-full max-w-4xl mx-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-all duration-200 ${activeTab === tab.id ? "bg-indigo-600 text-white shadow-md shadow-indigo-200" : "text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm"}`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="w-full max-w-4xl mx-auto">
          {activeTab === "bulk" && <BulkScrapingTab />}
          {activeTab === "check" && <CheckStoredResultsTab />}
        </div>
      </div>
    </div>
  );
}