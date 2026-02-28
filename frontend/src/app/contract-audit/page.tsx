"use client";

import { useState, useEffect, useRef } from "react";
import Navbar from "@/components/Navbar";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Search, Loader2, Copy, Check, AlertTriangle, CheckCircle,
  ShieldAlert, ChevronDown, Code, ExternalLink, ChevronRight, Braces,
  Bug, Lock, Unlock, Zap, Eye, AlertCircle, Info, FileText, User,
  Layers, Hash, Cpu,
} from "lucide-react";

// ── Types ───────────────────────────────────────────────────────────────────

type Chain = { id: number; name: string; short: string; explorer: string; native: string };

type Finding = {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  line: number | null;
  description: string;
  snippet: string | null;
};

type AuditFunction = {
  name: string;
  inputs: number;
  outputs: number;
  mutability: string;
  risk_tags: string[];
};

type SeverityCounts = {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
};

type AuditResult = {
  contract_address: string;
  chain: { id: number; name: string; short: string; explorer: string };
  is_verified: boolean;
  contract_name: string | null;
  compiler_version: string | null;
  security_score: {
    score: number;
    label: string;
    grade: string;
    total_deduction: number;
    bonus: number;
    severity_counts: SeverityCounts;
  };
  findings: Finding[];
  functions: AuditFunction[];
  metadata: {
    optimization_used: boolean;
    optimization_runs: number;
    evm_version: string | null;
    license: string | null;
    is_proxy: boolean;
    implementation: string | null;
    source_lines: number;
    source_files_count: number;
  };
  creator: {
    address: string | null;
    creation_tx: string | null;
    balance: number | null;
    tx_count: number;
    contracts_deployed: number;
    label: string | null;
  };
  source_code: string | null;
  abi: any[] | null;
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function getScoreColor(score: number) {
  if (score >= 85) return "text-green-400";
  if (score >= 70) return "text-emerald-400";
  if (score >= 50) return "text-yellow-400";
  if (score >= 30) return "text-orange-400";
  return "text-red-400";
}

function getScoreRingColor(score: number) {
  if (score >= 85) return "#4ade80";
  if (score >= 70) return "#34d399";
  if (score >= 50) return "#facc15";
  if (score >= 30) return "#fb923c";
  return "#f87171";
}

function getScoreGlow(score: number) {
  if (score >= 85) return "shadow-[0_0_60px_rgba(74,222,128,0.15)]";
  if (score >= 70) return "shadow-[0_0_60px_rgba(52,211,153,0.15)]";
  if (score >= 50) return "shadow-[0_0_60px_rgba(250,204,21,0.15)]";
  if (score >= 30) return "shadow-[0_0_60px_rgba(251,146,60,0.15)]";
  return "shadow-[0_0_60px_rgba(248,113,113,0.15)]";
}

function getScoreBg(score: number) {
  if (score >= 85) return "bg-green-400/5 border-green-400/20";
  if (score >= 70) return "bg-emerald-400/5 border-emerald-400/20";
  if (score >= 50) return "bg-yellow-400/5 border-yellow-400/20";
  if (score >= 30) return "bg-orange-400/5 border-orange-400/20";
  return "bg-red-400/5 border-red-400/20";
}

function getGradeColor(grade: string) {
  if (grade === "A") return "text-green-400 bg-green-400/10 border-green-400/30";
  if (grade === "B") return "text-emerald-400 bg-emerald-400/10 border-emerald-400/30";
  if (grade === "C") return "text-yellow-400 bg-yellow-400/10 border-yellow-400/30";
  if (grade === "D") return "text-orange-400 bg-orange-400/10 border-orange-400/30";
  return "text-red-400 bg-red-400/10 border-red-400/30";
}

const SEVERITY_CONFIG: Record<string, { icon: typeof AlertTriangle; color: string; bg: string; border: string; label: string }> = {
  critical: { icon: ShieldAlert, color: "text-red-400", bg: "bg-red-400/10", border: "border-red-400/20", label: "Critical" },
  high: { icon: AlertTriangle, color: "text-orange-400", bg: "bg-orange-400/10", border: "border-orange-400/20", label: "High" },
  medium: { icon: AlertCircle, color: "text-yellow-400", bg: "bg-yellow-400/10", border: "border-yellow-400/20", label: "Medium" },
  low: { icon: Info, color: "text-blue-400", bg: "bg-blue-400/10", border: "border-blue-400/20", label: "Low" },
  info: { icon: Eye, color: "text-zinc-400", bg: "bg-white/5", border: "border-white/10", label: "Info" },
};

const LOADING_STEPS = [
  "Fetching contract source code...",
  "Scanning for vulnerabilities...",
  "Analyzing access control patterns...",
  "Checking for unsafe operations...",
  "Computing security score...",
];

// Animated counter hook
function useAnimatedScore(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let start = 0;
    const startTime = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return value;
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

// ── Component ───────────────────────────────────────────────────────────────

export default function ContractAudit() {
  const [address, setAddress] = useState("");
  const [chains, setChains] = useState<Chain[]>([]);
  const [selectedChain, setSelectedChain] = useState(1);
  const [chainDropdownOpen, setChainDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [codeTab, setCodeTab] = useState<"source" | "abi">("source");
  const [codeExpanded, setCodeExpanded] = useState(false);
  const [expandedFinding, setExpandedFinding] = useState<string | null>(null);
  const [fnFilter, setFnFilter] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch chains on mount
  useEffect(() => {
    fetch(`${API}/chains`)
      .then((r) => r.json())
      .then((data) => {
        setChains(data.chains || []);
        setSelectedChain(data.default || 1);
      })
      .catch(() => { });
  }, []);

  // Loading step animation
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setLoadingStep((s) => (s + 1) % LOADING_STEPS.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [loading]);

  // Close chain dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setChainDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleScan = async () => {
    const addr = address.trim();
    if (!addr) return;
    setLoading(true);
    setLoadingStep(0);
    setResult(null);
    setError("");
    setExpandedFinding(null);
    setCodeExpanded(false);
    setCodeTab("source");
    setFnFilter(null);

    try {
      const res = await fetch(
        `${API}/contract-audit/${addr}?chain_id=${selectedChain}`
      );
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setResult(data);
      }
    } catch {
      setError("Failed to connect to backend. Is the server running?");
    } finally {
      setLoading(false);
    }
  };

  const selectedChainData = chains.find((c) => c.id === selectedChain);
  const totalIssues = result
    ? Object.values(result.security_score.severity_counts).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <main className="min-h-screen text-white overflow-hidden relative font-[family-name:var(--font-nuqun)]">
      <Navbar />

      {/* ── Ambient glow ─────────────────────────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-[40%] left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-[#4ADE80]/[0.03] blur-[120px]" />
      </div>

      {/* ── Page Content ──────────────────────────────────────────────── */}
      <section className="min-h-screen px-8 md:px-24 pt-32 pb-20">
        <div className="max-w-6xl mx-auto w-full">

          {/* ── Header ─────────────────────────────────────────────── */}
          <div className="mb-12">
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-[#4ADE80]/10 p-3 rounded-2xl">
                <Shield className="w-8 h-8 text-[#4ADE80]" />
              </div>
              <h1 className="text-5xl md:text-7xl font-medium tracking-wider leading-[0.9]">
                Audit Contract
              </h1>
            </div>
            <p className="text-xl text-zinc-400 font-[family-name:var(--font-spacemono)] max-w-2xl mt-4">
              Static security analysis for any verified smart contract across 14 EVM chains.
            </p>
          </div>

          {/* ── Search Bar + Chain Selector ─────────────────────────── */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            {/* Chain dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setChainDropdownOpen(!chainDropdownOpen)}
                className="h-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 flex items-center gap-2 hover:bg-white/10 transition font-[family-name:var(--font-spacemono)] text-sm min-w-[160px]"
              >
                <span>{selectedChainData?.short || "ETH"}</span>
                <ChevronDown className="w-4 h-4 text-zinc-400" />
              </button>
              {chainDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl z-50 max-h-72 overflow-y-auto">
                  {chains.map((chain) => (
                    <button
                      key={chain.id}
                      onClick={() => { setSelectedChain(chain.id); setChainDropdownOpen(false); }}
                      className={`w-full text-left px-4 py-3 text-sm hover:bg-white/10 transition font-[family-name:var(--font-spacemono)] ${chain.id === selectedChain ? "text-[#4ADE80]" : "text-zinc-300"
                        }`}
                    >
                      {chain.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Input */}
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
              <input
                type="text"
                value={address}
                onChange={(e) => { setAddress(e.target.value); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleScan()}
                placeholder="Enter contract address (0x...)"
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-4 focus:outline-none focus:border-[#4ADE80] transition-colors text-white font-[family-name:var(--font-spacemono)] text-sm"
              />
            </div>

            {/* Scan button */}
            <button
              onClick={handleScan}
              disabled={loading}
              className="bg-white text-black font-bold px-8 py-4 rounded-xl hover:bg-[#4ADE80] transition-colors flex items-center gap-2 font-[family-name:var(--font-spacemono)] disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
              Audit Contract
            </button>
          </div>

          {/* ── Error ────────────────────────────────────────────── */}
          {error && (
            <div className="mb-8 bg-red-400/10 border border-red-400/20 rounded-xl p-4 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
              <p className="text-red-400 font-[family-name:var(--font-spacemono)] text-sm">{error}</p>
            </div>
          )}

          {/* ── Loading State ───────────────────────────────────────── */}
          {loading && (
            <div className="text-center py-20">
              <Loader2 className="w-12 h-12 text-[#4ADE80] mx-auto mb-6 animate-spin" />
              <h3 className="text-2xl text-zinc-300 mb-4">Scanning contract...</h3>
              <div className="space-y-2 max-w-md mx-auto">
                {LOADING_STEPS.map((step, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-3 text-sm font-[family-name:var(--font-spacemono)] transition-all duration-300 ${i < loadingStep ? "text-[#4ADE80]" : i === loadingStep ? "text-white" : "text-zinc-600"
                      }`}
                  >
                    {i < loadingStep ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : i === loadingStep ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-zinc-600" />
                    )}
                    {step}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Results ──────────────────────────────────────────────────── */}
          {result && !loading && (
            <div className="space-y-6 mt-8">

              {/* ── Security Score Hero ──────────────────────────────── */}
              <div
                className={`rounded-2xl border p-8 ${getScoreBg(result.security_score.score)} ${getScoreGlow(result.security_score.score)} transition-shadow duration-700`}
              >
                <div className="flex flex-col md:flex-row items-center gap-8">
                  {/* Score ring */}
                  <ScoreRing score={result.security_score.score} />

                  {/* Score info */}
                  <div className="flex-1 text-center md:text-left">
                    <div className="flex items-center gap-3 justify-center md:justify-start mb-2">
                      <h2 className={`text-3xl font-bold ${getScoreColor(result.security_score.score)}`}>
                        {result.security_score.label}
                      </h2>
                      <span className={`text-xl font-bold px-3 py-1 rounded-lg border font-[family-name:var(--font-spacemono)] ${getGradeColor(result.security_score.grade)}`}>
                        {result.security_score.grade}
                      </span>
                    </div>

                    <p className="text-zinc-500 font-[family-name:var(--font-spacemono)] text-sm mb-5">
                      {result.contract_name || "Unknown Contract"} on {result.chain.name}
                    </p>

                    {/* Severity pills */}
                    <div className="flex flex-wrap gap-2">
                      {(Object.entries(result.security_score.severity_counts) as [string, number][])
                        .filter(([, count]) => count > 0)
                        .map(([severity, count]) => {
                          const config = SEVERITY_CONFIG[severity];
                          if (!config) return null;
                          const Icon = config.icon;
                          return (
                            <span key={severity} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-[family-name:var(--font-spacemono)] ${config.bg} ${config.border} ${config.color}`}>
                              <Icon className="w-3 h-3" />
                              {count} {config.label}
                            </span>
                          );
                        })}
                      {totalIssues === 0 && (
                        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-[family-name:var(--font-spacemono)] bg-green-400/10 border-green-400/20 text-green-400">
                          <CheckCircle className="w-3 h-3" />
                          No Issues Found
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Contract address badge */}
                  <div className="text-right hidden md:flex flex-col items-end gap-2">
                    <a
                      href={`${result.chain.explorer}/address/${result.contract_address}`}
                      target="_blank"
                      className="inline-flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.08] hover:border-white/20 rounded-lg px-3 py-2 text-zinc-400 hover:text-white text-xs font-[family-name:var(--font-spacemono)] transition-all"
                    >
                      {result.contract_address.slice(0, 8)}...{result.contract_address.slice(-6)}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    {result.compiler_version && (
                      <span className="text-xs text-zinc-600 font-[family-name:var(--font-spacemono)]">
                        Solidity v{result.compiler_version}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Stats Overview ───────────────────────────────────── */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  {
                    icon: Bug, label: "Issues Found", value: totalIssues.toString(),
                    color: totalIssues > 0 ? "text-orange-400" : "text-green-400",
                  },
                  {
                    icon: Layers, label: "Functions", value: result.functions.length.toString(),
                    color: "text-blue-400",
                  },
                  {
                    icon: Hash, label: "Source Lines", value: result.metadata.source_lines.toLocaleString(),
                    color: "text-purple-400",
                  },
                  {
                    icon: Cpu, label: "Files", value: result.metadata.source_files_count.toString(),
                    color: "text-cyan-400",
                  },
                ].map((stat, i) => (
                  <div
                    key={i}
                    className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 flex items-center gap-3 hover:bg-white/[0.05] transition-colors"
                  >
                    <div className={`w-9 h-9 rounded-lg bg-white/[0.04] flex items-center justify-center ${stat.color}`}>
                      <stat.icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className={`text-lg font-bold font-[family-name:var(--font-spacemono)] ${stat.color}`}>{stat.value}</p>
                      <p className="text-[11px] text-zinc-600 font-[family-name:var(--font-spacemono)] tracking-wide">{stat.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Findings ───────────────────────────────────────────── */}
              {result.findings.length > 0 && (
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-3 px-6 py-5 border-b border-white/[0.06]">
                    <div className="w-8 h-8 rounded-lg bg-red-400/10 flex items-center justify-center">
                      <Bug className="w-4 h-4 text-red-400" />
                    </div>
                    <h3 className="text-lg font-bold">Security Findings</h3>
                    <span className="ml-auto text-xs text-zinc-600 font-[family-name:var(--font-spacemono)]">
                      {result.findings.length} issue{result.findings.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  <div className="divide-y divide-white/[0.04]">
                    {result.findings.map((finding) => {
                      const config = SEVERITY_CONFIG[finding.severity];
                      const Icon = config?.icon || Info;
                      const isExpanded = expandedFinding === finding.id;
                      return (
                        <div key={finding.id} className="group">
                          <button
                            onClick={() => setExpandedFinding(isExpanded ? null : finding.id)}
                            className="w-full flex items-center gap-4 px-6 py-4 text-left hover:bg-white/[0.02] transition-colors"
                          >
                            <div className={`w-8 h-8 rounded-lg ${config?.bg || "bg-white/5"} flex items-center justify-center shrink-0`}>
                              <Icon className={`w-4 h-4 ${config?.color || "text-zinc-400"}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm text-zinc-200">{finding.title}</p>
                              {finding.line && (
                                <span className="text-[11px] text-zinc-600 font-[family-name:var(--font-spacemono)]">
                                  Line {finding.line}
                                </span>
                              )}
                            </div>
                            <span className={`text-[11px] font-[family-name:var(--font-spacemono)] font-medium px-2.5 py-1 rounded-full ${config?.bg || "bg-white/5"} ${config?.border || "border-white/10"} border ${config?.color || "text-zinc-400"}`}>
                              {config?.label || finding.severity}
                            </span>
                            <ChevronRight className={`w-4 h-4 text-zinc-600 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
                          </button>

                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.25 }}
                                className="overflow-hidden"
                              >
                                <div className="px-6 pb-5 pt-0 ml-12">
                                  <p className="text-sm text-zinc-400 font-[family-name:var(--font-spacemono)] leading-relaxed">
                                    {finding.description}
                                  </p>
                                  {finding.snippet && (
                                    <pre className="mt-3 bg-black/50 border border-white/[0.04] rounded-lg p-3 text-xs font-[family-name:var(--font-spacemono)] text-zinc-500 overflow-x-auto">
                                      <code>{finding.snippet}</code>
                                    </pre>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Contract Metadata + Deployer ─────────────────────── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Contract metadata */}
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden hover:border-white/[0.1] transition-colors">
                  <div className="flex items-center gap-3 px-6 py-5 border-b border-white/[0.06]">
                    <div className="w-8 h-8 rounded-lg bg-blue-400/10 flex items-center justify-center">
                      <FileText className="w-4 h-4 text-blue-400" />
                    </div>
                    <h3 className="text-lg font-bold">Contract Info</h3>
                  </div>
                  <div className="p-6 space-y-3 font-[family-name:var(--font-spacemono)] text-sm">
                    {[
                      { label: "Name", value: result.contract_name || "—" },
                      {
                        label: "Verified",
                        value: result.is_verified ? "Yes" : "No",
                        color: result.is_verified ? "text-green-400" : "text-red-400",
                      },
                      { label: "Compiler", value: result.compiler_version ? `v${result.compiler_version}` : "—" },
                      {
                        label: "Optimization",
                        value: result.metadata.optimization_used
                          ? `Yes (${result.metadata.optimization_runs} runs)`
                          : "No",
                      },
                      { label: "EVM Version", value: result.metadata.evm_version || "—" },
                      { label: "License", value: result.metadata.license || "—" },
                      { label: "Source Lines", value: result.metadata.source_lines.toLocaleString() },
                      { label: "Files", value: result.metadata.source_files_count.toString() },
                      {
                        label: "Proxy",
                        value: result.metadata.is_proxy ? "Yes" : "No",
                        color: result.metadata.is_proxy ? "text-yellow-400" : "text-zinc-300",
                      },
                    ].map((row, i) => (
                      <div key={i} className="flex justify-between items-center py-1">
                        <span className="text-zinc-600">{row.label}</span>
                        <span className={row.color || "text-zinc-300"}>{row.value}</span>
                      </div>
                    ))}
                    {result.metadata.implementation && (
                      <div className="flex justify-between items-center py-1">
                        <span className="text-zinc-600">Implementation</span>
                        <a
                          href={`${result.chain.explorer}/address/${result.metadata.implementation}`}
                          target="_blank"
                          className="text-[#4ADE80] hover:underline flex items-center gap-1"
                        >
                          {result.metadata.implementation.slice(0, 8)}...{result.metadata.implementation.slice(-4)}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Deployer info */}
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden hover:border-white/[0.1] transition-colors">
                  <div className="flex items-center gap-3 px-6 py-5 border-b border-white/[0.06]">
                    <div className="w-8 h-8 rounded-lg bg-purple-400/10 flex items-center justify-center">
                      <User className="w-4 h-4 text-purple-400" />
                    </div>
                    <h3 className="text-lg font-bold">Deployer</h3>
                  </div>
                  {result.creator.address ? (
                    <div className="p-6 space-y-3 font-[family-name:var(--font-spacemono)] text-sm">
                      <div className="flex justify-between items-center py-1">
                        <span className="text-zinc-600">Address</span>
                        <a
                          href={`${result.chain.explorer}/address/${result.creator.address}`}
                          target="_blank"
                          className="text-[#4ADE80] hover:underline flex items-center gap-1"
                        >
                          {result.creator.address.slice(0, 8)}...{result.creator.address.slice(-4)}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      {result.creator.label && (
                        <div className="flex justify-between py-1">
                          <span className="text-zinc-600">Label</span>
                          <span className="text-[#4ADE80]">{result.creator.label}</span>
                        </div>
                      )}
                      <div className="flex justify-between py-1">
                        <span className="text-zinc-600">Balance</span>
                        <span className="text-zinc-300">{result.creator.balance != null ? `${result.creator.balance.toFixed(4)} ETH` : "—"}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-zinc-600">Transactions</span>
                        <span className="text-zinc-300">{result.creator.tx_count.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-zinc-600">Contracts Deployed</span>
                        <span className="text-zinc-300">{result.creator.contracts_deployed}</span>
                      </div>
                      {result.creator.creation_tx && (
                        <div className="flex justify-between items-center py-1">
                          <span className="text-zinc-600">Deploy Tx</span>
                          <a
                            href={`${result.chain.explorer}/tx/${result.creator.creation_tx}`}
                            target="_blank"
                            className="text-[#4ADE80] hover:underline flex items-center gap-1"
                          >
                            {result.creator.creation_tx.slice(0, 10)}...{result.creator.creation_tx.slice(-4)}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-6 flex flex-col items-center justify-center text-center py-12">
                      <div className="w-12 h-12 rounded-full bg-white/[0.03] flex items-center justify-center mb-3">
                        <User className="w-5 h-5 text-zinc-600" />
                      </div>
                      <p className="text-zinc-600 font-[family-name:var(--font-spacemono)] text-sm">
                        Could not identify the deployer wallet.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Function Analysis ─────────────────────────────────── */}
              {result.functions.length > 0 && (
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-3 px-6 py-5 border-b border-white/[0.06]">
                    <div className="w-8 h-8 rounded-lg bg-cyan-400/10 flex items-center justify-center">
                      <Braces className="w-4 h-4 text-cyan-400" />
                    </div>
                    <h3 className="text-lg font-bold">Functions</h3>
                    <span className="ml-auto text-xs text-zinc-600 font-[family-name:var(--font-spacemono)]">
                      {result.functions.length} functions
                    </span>
                  </div>

                  <div className="p-6">
                    {/* Filter tags */}
                    <div className="flex flex-wrap gap-2 mb-5">
                      <button
                        onClick={() => setFnFilter(null)}
                        className={`text-xs font-[family-name:var(--font-spacemono)] px-3 py-1.5 rounded-full border transition-all ${fnFilter === null
                            ? "bg-[#4ADE80]/15 border-[#4ADE80]/30 text-[#4ADE80]"
                            : "bg-white/[0.03] border-white/[0.06] text-zinc-500 hover:text-zinc-300 hover:border-white/[0.12]"
                          }`}
                      >
                        All
                      </button>
                      {["read-only", "payable", "admin", "mint", "pause", "blacklist", "destructive", "upgradeable"].map((tag) => {
                        const count = result.functions.filter((f) => f.risk_tags.includes(tag)).length;
                        if (count === 0) return null;
                        const isActive = fnFilter === tag;
                        const tagColor = ["admin", "mint", "blacklist", "destructive"].includes(tag)
                          ? "bg-red-400/10 border-red-400/20 text-red-400"
                          : tag === "payable"
                            ? "bg-yellow-400/10 border-yellow-400/20 text-yellow-400"
                            : tag === "upgradeable"
                              ? "bg-orange-400/10 border-orange-400/20 text-orange-400"
                              : "bg-blue-400/10 border-blue-400/20 text-blue-400";
                        return (
                          <button
                            key={tag}
                            onClick={() => setFnFilter(isActive ? null : tag)}
                            className={`text-xs font-[family-name:var(--font-spacemono)] px-3 py-1.5 rounded-full border transition-all ${isActive ? tagColor : "bg-white/[0.03] border-white/[0.06] text-zinc-500 hover:text-zinc-300 hover:border-white/[0.12]"
                              }`}
                          >
                            {tag} ({count})
                          </button>
                        );
                      })}
                    </div>

                    {/* Function grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {result.functions
                        .filter((f) => !fnFilter || f.risk_tags.includes(fnFilter))
                        .map((fn, i) => {
                          const isDangerous = fn.risk_tags.some((t) =>
                            ["mint", "blacklist", "destructive", "admin"].includes(t)
                          );
                          const isReadOnly = fn.risk_tags.includes("read-only");
                          return (
                            <div
                              key={i}
                              className={`rounded-lg border px-3 py-2.5 font-[family-name:var(--font-spacemono)] text-xs flex items-center gap-2 hover:bg-white/[0.02] transition-colors ${isDangerous
                                  ? "bg-red-400/[0.04] border-red-400/15"
                                  : isReadOnly
                                    ? "bg-blue-400/[0.04] border-blue-400/15"
                                    : fn.risk_tags.includes("payable")
                                      ? "bg-yellow-400/[0.04] border-yellow-400/15"
                                      : "bg-white/[0.02] border-white/[0.06]"
                                }`}
                            >
                              {isDangerous ? (
                                <Lock className="w-3 h-3 text-red-400 shrink-0" />
                              ) : isReadOnly ? (
                                <Eye className="w-3 h-3 text-blue-400 shrink-0" />
                              ) : fn.risk_tags.includes("payable") ? (
                                <Zap className="w-3 h-3 text-yellow-400 shrink-0" />
                              ) : (
                                <Unlock className="w-3 h-3 text-zinc-600 shrink-0" />
                              )}
                              <span className={`truncate ${isDangerous ? "text-red-400" : isReadOnly ? "text-blue-400" : "text-zinc-400"
                                }`}>
                                {fn.name}()
                              </span>
                              <span className="text-zinc-700 ml-auto shrink-0">
                                {fn.mutability === "view" || fn.mutability === "pure" ? "view" : fn.mutability}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Source Code Viewer ────────────────────────────────── */}
              {result.is_verified && (result.source_code || result.abi) && (
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
                  <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-400/10 flex items-center justify-center">
                        <Code className="w-4 h-4 text-emerald-400" />
                      </div>
                      <h3 className="text-lg font-bold">Contract Code</h3>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1 bg-white/[0.03] rounded-lg p-1 font-[family-name:var(--font-spacemono)] text-xs">
                      {result.source_code && (
                        <button
                          onClick={() => setCodeTab("source")}
                          className={`px-4 py-1.5 rounded-md transition-all ${codeTab === "source"
                              ? "bg-[#4ADE80]/15 text-[#4ADE80]"
                              : "text-zinc-500 hover:text-zinc-300"
                            }`}
                        >
                          Source
                        </button>
                      )}
                      {result.abi && (
                        <button
                          onClick={() => setCodeTab("abi")}
                          className={`px-4 py-1.5 rounded-md transition-all flex items-center gap-1 ${codeTab === "abi"
                              ? "bg-[#4ADE80]/15 text-[#4ADE80]"
                              : "text-zinc-500 hover:text-zinc-300"
                            }`}
                        >
                          <Braces className="w-3 h-3" /> ABI
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="p-6">
                    {/* Source Code Tab */}
                    {codeTab === "source" && result.source_code && (
                      <CodeBlock
                        code={result.source_code}
                        label="source"
                        expanded={codeExpanded}
                        onToggleExpand={() => setCodeExpanded(!codeExpanded)}
                        copied={copied}
                        onCopy={() => {
                          navigator.clipboard.writeText(result.source_code!);
                          setCopied("source");
                          setTimeout(() => setCopied(null), 2000);
                        }}
                      />
                    )}

                    {/* ABI Tab */}
                    {codeTab === "abi" && result.abi && (
                      <CodeBlock
                        code={JSON.stringify(result.abi, null, 2)}
                        label="abi"
                        expanded={codeExpanded}
                        onToggleExpand={() => setCodeExpanded(!codeExpanded)}
                        copied={copied}
                        onCopy={() => {
                          navigator.clipboard.writeText(JSON.stringify(result.abi, null, 2));
                          setCopied("abi");
                          setTimeout(() => setCopied(null), 2000);
                        }}
                      />
                    )}
                  </div>
                </div>
              )}

            </div>
          )}

        </div>
      </section>
    </main>
  );
}

// ── Score Ring Sub-component ────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const animatedScore = useAnimatedScore(score);
  const circumference = 2 * Math.PI * 52;
  const strokeDash = (score / 100) * circumference;
  const ringColor = getScoreRingColor(score);

  return (
    <div className="relative w-36 h-36 shrink-0">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle
          cx="60" cy="60" r="52"
          fill="none"
          stroke="rgba(255,255,255,0.03)"
          strokeWidth="6"
        />
        <motion.circle
          cx="60" cy="60" r="52"
          fill="none"
          stroke={ringColor}
          strokeWidth="6"
          strokeLinecap="round"
          initial={{ strokeDasharray: `0 ${circumference}` }}
          animate={{ strokeDasharray: `${strokeDash} ${circumference}` }}
          transition={{ duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-4xl font-bold font-[family-name:var(--font-spacemono)] ${getScoreColor(score)}`}>
          {animatedScore}
        </span>
        <span className="text-[10px] text-zinc-600 font-[family-name:var(--font-spacemono)] tracking-widest mt-0.5">/ 100</span>
      </div>
    </div>
  );
}

// ── Code Block Sub-component ────────────────────────────────────────────────

function CodeBlock({
  code,
  label,
  expanded,
  onToggleExpand,
  copied,
  onCopy,
}: {
  code: string;
  label: string;
  expanded: boolean;
  onToggleExpand: () => void;
  copied: string | null;
  onCopy: () => void;
}) {
  return (
    <div className="relative group">
      {/* Action buttons */}
      <div className="absolute top-3 right-3 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onCopy}
          className="bg-white/[0.06] hover:bg-white/[0.12] backdrop-blur-sm text-zinc-400 px-3 py-1.5 rounded-lg text-xs font-[family-name:var(--font-spacemono)] flex items-center gap-1.5 transition-all border border-white/[0.06]"
        >
          {copied === label ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
          {copied === label ? "Copied" : "Copy"}
        </button>
      </div>

      {/* Code area */}
      <pre
        data-lenis-prevent
        className={`bg-black/40 border border-white/[0.04] rounded-xl p-4 font-[family-name:var(--font-spacemono)] text-xs text-zinc-500 whitespace-pre overflow-auto transition-all duration-500 ${expanded ? "max-h-[80vh]" : "max-h-[400px]"
          }`}
      >
        <code>{code}</code>
      </pre>

      {/* Expand toggle */}
      <div className="flex justify-center mt-3">
        <button
          onClick={onToggleExpand}
          className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-300 font-[family-name:var(--font-spacemono)] transition-colors px-3 py-1.5 rounded-lg hover:bg-white/[0.03]"
        >
          <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${expanded ? "-rotate-90" : "rotate-90"}`} />
          {expanded ? "Collapse" : `Expand full ${label === "abi" ? "ABI" : "source"}`}
        </button>
      </div>
    </div>
  );
}