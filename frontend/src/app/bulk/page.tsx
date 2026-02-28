"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Navbar from "@/components/Navbar";
import {
  Layers, Search, Loader2, Upload, AlertTriangle, CheckCircle,
  ShieldAlert, ChevronDown, Download, Trash2, Plus, FileText,
  BarChart3, Ban, Copy, Check, ExternalLink,
} from "lucide-react";

// ── Types ───────────────────────────────────────────────────────────────────

type Chain = { id: number; name: string; short: string; explorer: string; native: string };

type WalletResult = {
  address: string;
  ens_name?: string | null;
  risk_score: number | null;
  risk_label?: string;
  ml_raw_score?: number;
  heuristic_score?: number;
  flags?: string[];
  tx_count?: number;
  is_sanctioned?: boolean;
  error?: string;
};

type BatchSummary = {
  total_addresses: number;
  successfully_analyzed: number;
  errors: number;
  avg_risk_score: number;
  high_risk_count: number;
  medium_risk_count: number;
  low_risk_count: number;
  sanctioned_count: number;
};

type BatchResult = {
  results: WalletResult[];
  summary: BatchSummary;
  error?: string;
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function getRiskColor(score: number | null) {
  if (score === null) return "text-zinc-400";
  if (score < 40) return "text-green-400";
  if (score < 75) return "text-yellow-400";
  return "text-red-400";
}

function getRiskBg(score: number | null) {
  if (score === null) return "bg-white/5 border-white/10";
  if (score < 40) return "bg-green-400/10 border-green-400/20";
  if (score < 75) return "bg-yellow-400/10 border-yellow-400/20";
  return "bg-red-400/10 border-red-400/20";
}

function getRiskBarColor(score: number) {
  if (score < 40) return "bg-green-400";
  if (score < 75) return "bg-yellow-400";
  return "bg-red-400";
}

function getRiskLabel(score: number | null) {
  if (score === null) return "Error";
  if (score < 40) return "Low Risk";
  if (score < 75) return "Medium Risk";
  return "High Risk";
}

const LOADING_MESSAGES = [
  "Resolving addresses...",
  "Fetching transactions...",
  "Running ML scoring...",
  "Checking sanctions lists...",
  "Compiling results...",
];

const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

// ── Component ───────────────────────────────────────────────────────────────

export default function BulkScreening() {
  // Input state
  const [inputMode, setInputMode] = useState<"manual" | "csv">("manual");
  const [addressInput, setAddressInput] = useState("");
  const [csvContent, setCsvContent] = useState("");
  const [csvFileName, setCsvFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Chain state
  const [chains, setChains] = useState<Chain[]>([]);
  const [selectedChain, setSelectedChain] = useState(1);
  const [chainDropdownOpen, setChainDropdownOpen] = useState(false);

  // Analysis state
  const [quickMode, setQuickMode] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [result, setResult] = useState<BatchResult | null>(null);
  const [error, setError] = useState("");

  // UI state
  const [sortBy, setSortBy] = useState<"risk" | "alpha">("risk");
  const [filterRisk, setFilterRisk] = useState<"all" | "high" | "medium" | "low">("all");
  const [copied, setCopied] = useState<string | null>(null);

  // Fetch chains
  useEffect(() => {
    fetch(`${API}/chains`)
      .then((r) => r.json())
      .then((data) => {
        setChains(data.chains || []);
        setSelectedChain(data.default || 1);
      })
      .catch(() => { });
  }, []);

  // Loading animation
  useEffect(() => {
    if (!loading) return;
    const iv = setInterval(() => setLoadingStep((s) => (s + 1) % LOADING_MESSAGES.length), 2500);
    return () => clearInterval(iv);
  }, [loading]);

  // Parse addresses from manual input
  const getManualAddresses = useCallback((): string[] => {
    return addressInput
      .split(/[\n,]+/)
      .map((a) => a.trim())
      .filter((a) => a.startsWith("0x") || a.endsWith(".eth"));
  }, [addressInput]);

  // CSV upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvContent(text);
    };
    reader.readAsText(file);
  };

  // Copy helper
  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  // Run analysis
  const runAnalysis = async () => {
    setError("");
    setResult(null);
    setLoadingStep(0);

    if (inputMode === "manual") {
      const addrs = getManualAddresses();
      if (addrs.length === 0) {
        setError("Enter at least one valid address (0x... or .eth)");
        return;
      }
      if (addrs.length > 50) {
        setError("Maximum 50 addresses per batch");
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(`${API}/batch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            addresses: addrs,
            chain_id: selectedChain,
            quick: quickMode,
          }),
        });
        const data = await res.json();
        if (data.error) {
          setError(data.error);
        } else {
          setResult(data);
        }
      } catch {
        setError("Failed to connect to backend");
      } finally {
        setLoading(false);
      }
    } else {
      if (!csvContent.trim()) {
        setError("Upload a CSV file first");
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(`${API}/batch/csv`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            csv_content: csvContent,
            chain_id: selectedChain,
            quick: quickMode,
          }),
        });
        const data = await res.json();
        if (data.error) {
          setError(data.error);
        } else {
          setResult(data);
        }
      } catch {
        setError("Failed to connect to backend");
      } finally {
        setLoading(false);
      }
    }
  };

  // Export results as CSV
  const exportCsv = () => {
    if (!result) return;
    const headers = ["Address", "ENS", "Risk Score", "Risk Label", "Flags", "TX Count", "Sanctioned", "Error"];
    const rows = result.results.map((r) => [
      r.address,
      r.ens_name || "",
      r.risk_score !== null ? r.risk_score : "N/A",
      r.risk_label || getRiskLabel(r.risk_score),
      (r.flags || []).join("; "),
      r.tx_count || 0,
      r.is_sanctioned ? "YES" : "NO",
      r.error || "",
    ]);
    const csv = [headers, ...rows].map((row) => row.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kryptos-bulk-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filtered + sorted results
  const filteredResults = result?.results
    ? result.results
      .filter((r) => {
        if (filterRisk === "all") return true;
        if (r.risk_score === null) return false;
        if (filterRisk === "high") return r.risk_score >= 75;
        if (filterRisk === "medium") return r.risk_score >= 40 && r.risk_score < 75;
        return r.risk_score < 40;
      })
      .sort((a, b) => {
        if (sortBy === "risk") return (b.risk_score ?? -1) - (a.risk_score ?? -1);
        return a.address.localeCompare(b.address);
      })
    : [];

  const addressCount = inputMode === "manual" ? getManualAddresses().length : 0;
  const selectedChainData = chains.find((c) => c.id === selectedChain);

  return (
    <main className="min-h-screen text-white overflow-hidden relative font-[family-name:var(--font-nuqun)]">
      <Navbar />

      <section className="min-h-screen px-8 md:px-24 pt-32 pb-20">
        <div className="max-w-6xl mx-auto w-full">

          {/* ── Header ──────────────────────────────────────────────── */}
          <div className="mb-12">
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-[#4ADE80]/10 p-3 rounded-2xl">
                <Layers className="w-8 h-8 text-[#4ADE80]" />
              </div>
              <h1 className="text-5xl md:text-7xl font-medium tracking-wider">
                Bulk Screening
              </h1>
            </div>
            <p className="text-xl text-zinc-400 font-[family-name:var(--font-spacemono)] max-w-2xl mt-4">
              Analyze up to 50 wallets at once. Paste addresses or upload a CSV to batch-screen for risk.
            </p>
          </div>

          {/* ── Input Section ────────────────────────────────────────── */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8">

            {/* Mode Tabs + Chain Selector */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
              <div className="flex bg-white/5 rounded-xl p-1">
                <button
                  onClick={() => setInputMode("manual")}
                  className={`px-4 py-2 rounded-lg text-sm font-bold font-[family-name:var(--font-spacemono)] transition-all ${inputMode === "manual" ? "bg-[#4ADE80] text-black" : "text-zinc-400 hover:text-white"}`}
                >
                  <FileText size={14} className="inline mr-1.5 -mt-0.5" />Paste Addresses
                </button>
                <button
                  onClick={() => setInputMode("csv")}
                  className={`px-4 py-2 rounded-lg text-sm font-bold font-[family-name:var(--font-spacemono)] transition-all ${inputMode === "csv" ? "bg-[#4ADE80] text-black" : "text-zinc-400 hover:text-white"}`}
                >
                  <Upload size={14} className="inline mr-1.5 -mt-0.5" />Upload CSV
                </button>
              </div>

              <div className="flex items-center gap-3">
                {/* Quick Mode Toggle */}
                <button
                  onClick={() => setQuickMode(!quickMode)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold font-[family-name:var(--font-spacemono)] transition-all ${quickMode ? "bg-[#4ADE80]/10 border-[#4ADE80]/20 text-[#4ADE80]" : "bg-white/5 border-white/10 text-zinc-400 hover:text-white"}`}
                >
                  <BarChart3 size={12} />
                  {quickMode ? "Quick Mode" : "Deep Scan"}
                </button>

                {/* Chain Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setChainDropdownOpen(!chainDropdownOpen)}
                    className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 flex items-center gap-2 hover:bg-white/10 transition font-[family-name:var(--font-spacemono)] text-sm"
                  >
                    {selectedChainData?.short || "ETH"}
                    <ChevronDown size={14} className={`transition-transform ${chainDropdownOpen ? "rotate-180" : ""}`} />
                  </button>
                  {chainDropdownOpen && (
                    <div className="absolute right-0 mt-2 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto w-48">
                      {chains.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => { setSelectedChain(c.id); setChainDropdownOpen(false); }}
                          className={`w-full text-left px-4 py-2 text-sm hover:bg-white/5 transition font-[family-name:var(--font-spacemono)] ${c.id === selectedChain ? "text-[#4ADE80]" : "text-zinc-300"}`}
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Manual Input */}
            {inputMode === "manual" && (
              <div>
                <textarea
                  value={addressInput}
                  onChange={(e) => setAddressInput(e.target.value)}
                  placeholder={"One address per line, or comma-separated..."}
                  rows={6}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-[family-name:var(--font-spacemono)] text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#4ADE80] transition-colors resize-none"
                />
                <div className="flex items-center justify-between mt-3">
                  <p className="text-xs text-zinc-500 font-[family-name:var(--font-spacemono)]">
                    {addressCount > 0 ? `${addressCount} address${addressCount !== 1 ? "es" : ""} detected` : "Paste wallet addresses above"}
                    {addressCount > 50 && <span className="text-red-400 ml-2">Max 50</span>}
                  </p>
                  {addressInput && (
                    <button onClick={() => setAddressInput("")} className="text-xs text-zinc-500 hover:text-red-400 transition flex items-center gap-1">
                      <Trash2 size={10} />Clear
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* CSV Upload */}
            {inputMode === "csv" && (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-white/10 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-[#4ADE80]/30 hover:bg-white/[0.02] transition-all group"
                >
                  {csvFileName ? (
                    <>
                      <FileText size={32} className="text-[#4ADE80] mb-3" />
                      <p className="text-sm font-[family-name:var(--font-spacemono)] text-white">{csvFileName}</p>
                      <p className="text-xs text-zinc-500 font-[family-name:var(--font-spacemono)] mt-1">Click to replace</p>
                    </>
                  ) : (
                    <>
                      <Upload size={32} className="text-zinc-500 group-hover:text-[#4ADE80] transition mb-3" />
                      <p className="text-sm text-zinc-400 font-[family-name:var(--font-spacemono)]">Click to upload CSV</p>
                      <p className="text-xs text-zinc-600 font-[family-name:var(--font-spacemono)] mt-1">Single column or column named &quot;address&quot;</p>
                    </>
                  )}
                </div>
                {csvContent && (
                  <div className="flex items-center justify-between mt-3">
                    <p className="text-xs text-zinc-500 font-[family-name:var(--font-spacemono)]">
                      {csvContent.split("\n").filter((l) => l.trim()).length} lines loaded
                    </p>
                    <button
                      onClick={() => { setCsvContent(""); setCsvFileName(""); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                      className="text-xs text-zinc-500 hover:text-red-400 transition flex items-center gap-1"
                    >
                      <Trash2 size={10} />Remove
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mt-4 p-3 bg-red-400/10 border border-red-400/20 rounded-xl flex items-center gap-2">
                <AlertTriangle size={14} className="text-red-400 shrink-0" />
                <p className="text-red-400 font-[family-name:var(--font-spacemono)] text-sm">{error}</p>
              </div>
            )}

            {/* Analyze Button */}
            <button
              onClick={runAnalysis}
              disabled={loading}
              className="mt-6 w-full bg-white text-black font-bold px-8 py-4 rounded-xl hover:bg-[#4ADE80] transition-colors flex items-center justify-center gap-2 font-[family-name:var(--font-spacemono)] disabled:opacity-50"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
              {loading ? "Analyzing..." : `Screen ${inputMode === "manual" && addressCount > 0 ? `${addressCount} ` : ""}Wallets`}
            </button>
          </div>

          {/* ── Loading State ────────────────────────────────────────── */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-2 border-white/10 border-t-[#4ADE80] animate-spin" />
                <Layers size={20} className="text-[#4ADE80] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <div className="mt-6 space-y-2">
                {LOADING_MESSAGES.map((msg, i) => (
                  <div
                    key={msg}
                    className={`flex items-center gap-3 text-sm font-[family-name:var(--font-spacemono)] transition-all duration-300 ${i <= loadingStep ? "text-[#4ADE80]" : "text-zinc-600"}`}
                  >
                    {i < loadingStep ? <CheckCircle size={14} /> : i === loadingStep ? <Loader2 size={14} className="animate-spin" /> : <div className="w-3.5 h-3.5 rounded-full border border-zinc-700" />}
                    {msg}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Results ──────────────────────────────────────────────── */}
          {result && !loading && (
            <div>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[
                  { label: "Total Analyzed", value: result.summary.successfully_analyzed, sub: `of ${result.summary.total_addresses}` },
                  { label: "Avg Risk Score", value: result.summary.avg_risk_score, color: getRiskColor(result.summary.avg_risk_score) },
                  { label: "High Risk", value: result.summary.high_risk_count, color: "text-red-400" },
                  { label: "Sanctioned", value: result.summary.sanctioned_count, color: result.summary.sanctioned_count > 0 ? "text-red-400" : "text-green-400" },
                ].map((card, i) => (
                  <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-5">
                    <p className="text-xs text-zinc-400 font-[family-name:var(--font-spacemono)]">{card.label}</p>
                    <p className={`text-3xl font-bold mt-1 font-[family-name:var(--font-spacemono)] ${card.color || "text-white"}`}>
                      {card.value}
                    </p>
                    {card.sub && <p className="text-xs text-zinc-500 font-[family-name:var(--font-spacemono)] mt-1">{card.sub}</p>}
                  </div>
                ))}
              </div>

              {/* Risk Distribution Bar */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-8">
                <p className="text-xs text-zinc-400 font-[family-name:var(--font-spacemono)] uppercase tracking-wider mb-3">Risk Distribution</p>
                <div className="flex rounded-full overflow-hidden h-3">
                  {result.summary.high_risk_count > 0 && (
                    <div className="bg-red-400 transition-all" style={{ width: `${(result.summary.high_risk_count / result.summary.successfully_analyzed) * 100}%` }} />
                  )}
                  {result.summary.medium_risk_count > 0 && (
                    <div className="bg-yellow-400 transition-all" style={{ width: `${(result.summary.medium_risk_count / result.summary.successfully_analyzed) * 100}%` }} />
                  )}
                  {result.summary.low_risk_count > 0 && (
                    <div className="bg-green-400 transition-all" style={{ width: `${(result.summary.low_risk_count / result.summary.successfully_analyzed) * 100}%` }} />
                  )}
                  {result.summary.errors > 0 && (
                    <div className="bg-zinc-600 transition-all" style={{ width: `${(result.summary.errors / result.summary.total_addresses) * 100}%` }} />
                  )}
                </div>
                <div className="flex gap-6 mt-3 text-xs font-[family-name:var(--font-spacemono)]">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400" /><span className="text-zinc-400">High ({result.summary.high_risk_count})</span></span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-400" /><span className="text-zinc-400">Medium ({result.summary.medium_risk_count})</span></span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-400" /><span className="text-zinc-400">Low ({result.summary.low_risk_count})</span></span>
                  {result.summary.errors > 0 && (
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-zinc-600" /><span className="text-zinc-400">Errors ({result.summary.errors})</span></span>
                  )}
                </div>
              </div>

              {/* Controls */}
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-2">
                  {/* Filter */}
                  {(["all", "high", "medium", "low"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilterRisk(f)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold font-[family-name:var(--font-spacemono)] transition-all ${filterRisk === f ? "bg-[#4ADE80] text-black" : "bg-white/5 border border-white/10 text-zinc-400 hover:text-white"}`}
                    >
                      {f === "all" ? "All" : f === "high" ? "High Risk" : f === "medium" ? "Medium" : "Low Risk"}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  {/* Sort */}
                  <button
                    onClick={() => setSortBy(sortBy === "risk" ? "alpha" : "risk")}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-[family-name:var(--font-spacemono)] text-zinc-400 hover:text-white transition"
                  >
                    <BarChart3 size={12} />
                    Sort: {sortBy === "risk" ? "Risk Score" : "Address"}
                  </button>
                  {/* Export */}
                  <button
                    onClick={exportCsv}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-[family-name:var(--font-spacemono)] text-zinc-400 hover:text-white transition"
                  >
                    <Download size={12} />Export CSV
                  </button>
                </div>
              </div>

              {/* Results Table */}
              <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        {["Address", "Score", "Label", "Flags", "TXs", "Status"].map((h) => (
                          <th key={h} className={`${h === "Address" || h === "Flags" ? "text-left" : "text-center"} px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider font-[family-name:var(--font-spacemono)]`}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredResults.map((r, i) => (
                        <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition">
                          {/* Address */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button onClick={() => copyText(r.address, r.address)} className="text-zinc-500 hover:text-white transition" title="Copy">
                                {copied === r.address ? <Check size={12} className="text-[#4ADE80]" /> : <Copy size={12} />}
                              </button>
                              <a href={`/analyze?address=${r.address}`} className="font-[family-name:var(--font-spacemono)] text-xs hover:text-[#4ADE80] transition">
                                {r.address.slice(0, 10)}...{r.address.slice(-6)}
                              </a>
                              {r.ens_name && <span className="text-[10px] px-1.5 py-0.5 bg-purple-400/10 text-purple-400 border border-purple-400/20 rounded font-[family-name:var(--font-spacemono)]">{r.ens_name}</span>}
                              {r.is_sanctioned && <span title="OFAC Sanctioned"><Ban size={12} className="text-red-400" /></span>}
                            </div>
                          </td>

                          {/* Score */}
                          <td className="px-4 py-3 text-center">
                            {r.risk_score !== null ? (
                              <div className="flex flex-col items-center gap-1">
                                <span className={`text-lg font-bold font-[family-name:var(--font-spacemono)] ${getRiskColor(r.risk_score)}`}>
                                  {r.risk_score}
                                </span>
                                <div className="w-12 h-1 bg-white/10 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${getRiskBarColor(r.risk_score)}`} style={{ width: `${r.risk_score}%` }} />
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-zinc-500 font-[family-name:var(--font-spacemono)]">—</span>
                            )}
                          </td>

                          {/* Label */}
                          <td className="px-4 py-3 text-center">
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-bold font-[family-name:var(--font-spacemono)] ${getRiskBg(r.risk_score)} ${getRiskColor(r.risk_score)}`}>
                              {r.risk_label || getRiskLabel(r.risk_score)}
                            </span>
                          </td>

                          {/* Flags */}
                          <td className="px-4 py-3">
                            {r.flags && r.flags.length > 0 ? (
                              <div className="flex flex-wrap gap-1 max-w-xs">
                                {r.flags.slice(0, 2).map((f, fi) => (
                                  <span key={fi} className="text-[10px] px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-zinc-400 font-[family-name:var(--font-spacemono)] truncate max-w-[120px]">
                                    {f}
                                  </span>
                                ))}
                                {r.flags.length > 2 && (
                                  <span className="text-[10px] text-zinc-500 font-[family-name:var(--font-spacemono)]">+{r.flags.length - 2}</span>
                                )}
                              </div>
                            ) : r.error ? (
                              <span className="text-[10px] text-red-400 font-[family-name:var(--font-spacemono)]">{r.error}</span>
                            ) : (
                              <span className="text-[10px] text-zinc-600 font-[family-name:var(--font-spacemono)]">—</span>
                            )}
                          </td>

                          {/* TX Count */}
                          <td className="px-4 py-3 text-center font-[family-name:var(--font-spacemono)] text-xs text-zinc-400">
                            {r.tx_count ?? "—"}
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3 text-center">
                            {r.error ? (
                              <span title={r.error}><AlertTriangle size={14} className="text-red-400 mx-auto" /></span>
                            ) : (
                              <CheckCircle size={14} className="text-green-400 mx-auto" />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {filteredResults.length === 0 && (
                  <div className="p-8 text-center text-zinc-500 text-sm font-[family-name:var(--font-spacemono)]">
                    No results match the current filter
                  </div>
                )}
              </div>

              {/* Run Again */}
              <div className="mt-8 text-center">
                <button
                  onClick={() => { setResult(null); setError(""); }}
                  className="px-6 py-3 bg-white/5 border border-white/10 rounded-xl text-sm font-[family-name:var(--font-spacemono)] text-zinc-400 hover:text-white hover:bg-white/10 transition flex items-center gap-2 mx-auto"
                >
                  <Plus size={14} />New Batch
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}