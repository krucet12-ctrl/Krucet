"use client";
import { useState, useEffect, useCallback } from "react";
import { collection, getDocs, query, orderBy, Timestamp, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import { ArrowLeft, Search, ChevronDown, ChevronRight, Loader2, Database } from "lucide-react";
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
  if (!batch || !semester) return "";
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

function CheckStoredResultsTab() {
  const [courseType, setCourseType] = useState<CourseType>("BTech");
  const [fetchStatus, setFetchStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [results, setResults] = useState<Record<string, BatchResult>>({});
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());
  const [batchFilterNumber, setBatchFilterNumber] = useState("");

  // Derived value - always has Y prefix
  const batchFilter = batchFilterNumber ? `Y${batchFilterNumber}` : '';

  const semCount = courseType === "BTech" ? 8 : 4;

  const toggleBatch = (batch: string) => {
    setExpandedBatches(prev => {
      const next = new Set(prev);
      next.has(batch) ? next.delete(batch) : next.add(batch);
      return next;
    });
  };

  const fetchResults = async () => {
    setFetchStatus("loading");
    setResults({});
    setExpandedBatches(new Set());

    try {
      // 1. Fetch from "results" collection with filter
      const resultsSnap = await getDocs(query(collection(db, "results"), where("courseType", "==", courseType)));
      const resultsData = resultsSnap.docs.map(d => d.data() as {
        courseType: string;
        batch: string;
        semester: string;
        resultType: string;
        createdAt: Timestamp | string;
      });

      // Data is already filtered by courseType in the query
      const filteredResults = resultsData;

      // Group by batch
      const grouped: Record<string, BatchResult> = {};

      for (const r of filteredResults) {
        const batch = r.batch;
        if (!batch || batch.startsWith("L")) continue;

        const lateralBatch = getLateralPrefix(batch);
        const semKey = r.semester;
        const resultTypeValue = r.resultType;

        if (!grouped[batch]) {
          grouped[batch] = {
            batchLabel: batch,
            lateralBatch: lateralBatch || undefined,
            semesters: {}
          };
        }

        if (!grouped[batch].semesters[semKey]) {
          grouped[batch].semesters[semKey] = {
            regular: false,
            revaluation: false,
            supply: false,
            regularCount: 0,
            revaluationCount: 0,
            supplyCount: 0,
            regularUploadedAt: null,
            revaluationUploadedAt: null,
            supplyUploadedAt: null,
          };
        }

        // Set result type and date
        const ts = r.createdAt;
        const date = ts instanceof Timestamp ? ts.toDate() : ts ? new Date(ts as string) : null;

        if (resultTypeValue === 'regular') {
          grouped[batch].semesters[semKey].regular = true;
          grouped[batch].semesters[semKey].regularUploadedAt = date;
          grouped[batch].semesters[semKey].regularCount = 1;
        } else if (resultTypeValue === 'revaluation') {
          grouped[batch].semesters[semKey].revaluation = true;
          grouped[batch].semesters[semKey].revaluationUploadedAt = date;
          grouped[batch].semesters[semKey].revaluationCount = 1;
        } else if (resultTypeValue === 'supply') {
          grouped[batch].semesters[semKey].supply = true;
          grouped[batch].semesters[semKey].supplyUploadedAt = date;
          grouped[batch].semesters[semKey].supplyCount = 1;
        }
      }

      setResults(grouped);
      setFetchStatus("success");
      setExpandedBatches(new Set(Object.keys(grouped)));
    } catch (err) {
      console.error(err);
      setFetchStatus("error");
    }
  };

  const sortedBatches = Object.keys(results)
    .filter(r => batchFilter ? r === batchFilter : true)
    .sort();

  return (
    <div className="space-y-6">
      {/* Fetch Card */}
      <div className="premium-card p-6 sm:p-8 bg-white border border-indigo-100/60 shadow-lg">
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-violet-50 p-2 rounded-lg"><Database className="w-5 h-5 text-violet-600" /></div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-800 tracking-tight">Check Stored Results</h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">View all result collections grouped by batch and semester</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="space-y-2 w-full sm:w-auto">
            <label className="label-premium">Course Type</label>
            <div className="flex rounded-xl overflow-hidden border border-slate-200 shadow-sm">
              {(["BTech", "MTech"] as CourseType[]).map((ct) => (
                <button
                  key={ct}
                  onClick={() => { setCourseType(ct); setFetchStatus("idle"); setResults({}); }}
                  className={`flex-1 py-2.5 px-5 text-sm font-extrabold transition-all ${courseType === ct ? "bg-indigo-600 text-white shadow-inner" : "bg-white text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"}`}
                >
                  {ct === "BTech" ? "B.Tech" : "M.Tech"}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 w-full sm:w-auto">
            <label className="label-premium">Filter by Batch</label>
            <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <span className="bg-slate-100 px-4 py-2.5 font-bold text-slate-600 text-sm">Y</span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="22..etc"
                className="flex-1 px-4 py-2.5 outline-none text-sm font-bold uppercase w-20"
                value={batchFilterNumber}
                onChange={(e) => setBatchFilterNumber(e.target.value.replace(/[^0-9]/g, ''))}
                maxLength={2}
              />
            </div>
          </div>

          <button
            onClick={fetchResults}
            disabled={fetchStatus === "loading"}
            className="btn-primary py-2.5 px-6 flex items-center gap-2 font-bold disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto justify-center"
          >
            {fetchStatus === "loading" ? (
              <><Loader2 className="w-4 h-4 animate-spin" /><span>Fetching...</span></>
            ) : (
              <><Search className="w-4 h-4" /><span>Fetch Stored Results</span></>
            )}
          </button>
        </div>

        {fetchStatus === "error" && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm font-medium">
            Failed to fetch results. Please check your connection and try again.
          </div>
        )}

        {fetchStatus === "success" && sortedBatches.length === 0 && (
          <div className="mt-6 text-center py-10 bg-slate-50/70 rounded-2xl border border-dashed border-slate-200">
            <span className="text-4xl block mb-3">🗂️</span>
            <p className="text-slate-500 font-bold text-sm">No stored results found for {courseType}.</p>
            <p className="text-slate-400 text-xs mt-1">Run bulk scraping first to populate results.</p>
          </div>
        )}
      </div>

      {/* Batch Cards Grid */}
      {fetchStatus === "success" && sortedBatches.length > 0 && (
        <div className="space-y-5">
          {sortedBatches.map((batch) => {
            const batchData = results[batch];
            const isExpanded = expandedBatches.has(batch);

            // Sort semesters numerically, keep only those with data
            const semKeys = Object.keys(batchData.semesters).sort((a, b) => {
              return parseInt(a.replace("Sem", "")) - parseInt(b.replace("Sem", ""));
            });

            const totalTypes = semKeys.reduce((acc, k) => {
              const s = batchData.semesters[k];
              return acc + (s.regular ? 1 : 0) + (s.revaluation ? 1 : 0) + (s.supply ? 1 : 0);
            }, 0);

            return (
              <div key={batch} className="premium-card bg-white border border-indigo-100/60 shadow-lg overflow-hidden">

                {/* ── Batch Header ── */}
                <button
                  onClick={() => toggleBatch(batch)}
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-indigo-50/30 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-md shrink-0">
                      <span className="text-white font-extrabold text-sm tracking-wide">{batch}</span>
                    </div>
                    <div className="text-left">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-extrabold text-slate-800 text-base group-hover:text-indigo-700 transition-colors">
                          {batch} Batch
                        </h3>
                        {batchData.lateralBatch && (
                          <span className="text-[11px] font-bold text-purple-600 bg-purple-50 border border-purple-100 px-2.5 py-0.5 rounded-full">
                            Includes {batchData.lateralBatch} Laterals
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 font-medium mt-0.5">
                        {semKeys.length} semester{semKeys.length !== 1 ? "s" : ""} · {totalTypes} result collection{totalTypes !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all shrink-0 ${isExpanded ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500"}`}>
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </div>
                </button>

                {/* ── Semester Grid ── */}
                {isExpanded && (
                  <div className="border-t border-slate-100 px-6 py-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {semKeys.map((semKey) => {
                        const semData = batchData.semesters[semKey];
                        const semNum = semKey.replace("Sem", "");
                        const totalCount = semData.regularCount + semData.revaluationCount + semData.supplyCount;
                        return (
                          <div
                            key={semKey}
                            className="bg-white rounded-xl border border-slate-200 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all p-4 text-center"
                          >
                            {/* Sem number badge */}
                            <div className="flex justify-center mb-2">
                              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
                                <span className="text-white font-extrabold text-sm">S{semNum}</span>
                              </div>
                            </div>

                            {/* Sem label */}
                            <p className="font-extrabold text-slate-800 text-sm mb-0.5">Sem {semNum}</p>

                            {/* Total count */}
                            <p className="text-[11px] text-slate-400 font-semibold mb-3">
                              {totalCount > 0 ? `${totalCount} records` : "All uploaded results"}
                            </p>

                            {/* Divider + Types + Dates */}
                            <div className="border-t border-slate-100 pt-3 space-y-2">
                              {[
                                { type: "regular" as const, exists: semData.regular, count: semData.regularCount, date: semData.regularUploadedAt },
                                { type: "revaluation" as const, exists: semData.revaluation, count: semData.revaluationCount, date: semData.revaluationUploadedAt },
                                { type: "supply" as const, exists: semData.supply, count: semData.supplyCount, date: semData.supplyUploadedAt },
                              ].filter(t => t.exists).map(({ type, count, date }) => (
                                <div key={type} className="flex flex-col items-center gap-0.5">
                                  <TypeBadge type={type} exists count={count} />
                                  <span className="text-[10px] text-slate-400 font-medium">
                                    {date
                                      ? date.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
                                      : "No upload date"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Bulk Scraping Tab ────────────────────────────────────────────────────────

function BulkScrapingTab() {
  const [courseType, setCourseType] = useState<CourseType>("BTech");
  const [batchNumber, setBatchNumber] = useState("");
  const [selectedSemester, setSelectedSemester] = useState("4");
  const [selectedType, setSelectedType] = useState("regular");
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
        const res = await fetch("/api/bulk-scrape", { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) { setBulkError(data.error || "Failed to start bulk scraping."); allSuccess = false; break; }
      }
      if (allSuccess) setShowSuccess(true);
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
                className="flex-1 px-4 py-2.5 outline-none text-sm font-bold uppercase"
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
              {semesterOptions.map((s) => <option key={s} value={String(s)}>Sem {s}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Scrape Type</label>
            <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className="input-premium py-2 cursor-pointer">
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