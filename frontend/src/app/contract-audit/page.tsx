"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import {
  Shield, Search, Loader2, Copy, Check, AlertTriangle, CheckCircle,
  ShieldAlert, ChevronDown, Code, ExternalLink, ChevronRight, Braces,
  Bug, Lock, Unlock, Zap, Eye, AlertCircle, Info, FileText, User,
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

function getScoreBg(score: number) {
  if (score >= 85) return "bg-green-400/10 border-green-400/20";
  if (score >= 70) return "bg-emerald-400/10 border-emerald-400/20";
  if (score >= 50) return "bg-yellow-400/10 border-yellow-400/20";
  if (score >= 30) return "bg-orange-400/10 border-orange-400/20";
  return "bg-red-400/10 border-red-400/20";
}

function getScoreBarColor(score: number) {
  if (score >= 85) return "bg-green-400";
  if (score >= 70) return "bg-emerald-400";
  if (score >= 50) return "bg-yellow-400";
  if (score >= 30) return "bg-orange-400";
  return "bg-red-400";
}

function getGradeColor(grade: string) {
  if (grade === "A") return "text-green-400 bg-green-400/10 border-green-400/20";
  if (grade === "B") return "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
  if (grade === "C") return "text-yellow-400 bg-yellow-400/10 border-yellow-400/20";
  if (grade === "D") return "text-orange-400 bg-orange-400/10 border-orange-400/20";
  return "text-red-400 bg-red-400/10 border-red-400/20";
}

const SEVERITY_CONFIG: Record<string, { icon: typeof AlertTriangle; color: string; bg: string; label: string }> = {
  critical: { icon: ShieldAlert, color: "text-red-400", bg: "bg-red-400/10 border-red-400/20", label: "Critical" },
  high: { icon: AlertTriangle, color: "text-orange-400", bg: "bg-orange-400/10 border-orange-400/20", label: "High" },
  medium: { icon: AlertCircle, color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/20", label: "Medium" },
  low: { icon: Info, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20", label: "Low" },
  info: { icon: Eye, color: "text-zinc-400", bg: "bg-white/5 border-white/10", label: "Info" },
};

const LOADING_STEPS = [
  "Fetching contract source code...",
  "Scanning for vulnerabilities...",
  "Analyzing access control patterns...",
  "Checking for unsafe operations...",
  "Computing security score...",
];

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

  // Fetch chains on mount
  useEffect(() => {
    fetch("http://127.0.0.1:8000/chains")
      .then((r) => r.json())
      .then((data) => {
        setChains(data.chains || []);
        setSelectedChain(data.default || 1);
      })
      .catch(() => {});
  }, []);

  // Loading step animation
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setLoadingStep((s) => (s + 1) % LOADING_STEPS.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [loading]);

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
        `http://127.0.0.1:8000/contract-audit/${addr}?chain_id=${selectedChain}`
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

  return (
    <main className="min-h-screen text-white overflow-hidden relative font-[family-name:var(--font-nuqun)]">
      <Navbar />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <section className="pt-32 pb-12 px-8 md:px-24">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2 mb-8">
            <Shield className="w-4 h-4 text-[#4ADE80]" />
            <span className="text-sm text-zinc-400 font-[family-name:var(--font-spacemono)]">
              Contract Security Auditor
            </span>
          </div>
          <h1 className="text-5xl md:text-7xl font-medium tracking-wider mb-4">
            Audit Contract
          </h1>
          <p className="text-xl text-zinc-400 font-[family-name:var(--font-spacemono)] max-w-xl mx-auto">
            Static security analysis for any verified smart contract across 14 EVM chains.
          </p>
        </div>
      </section>

      {/* ── Search Bar ─────────────────────────────────────────────────── */}
      <section className="px-8 md:px-24 pb-12">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex items-center gap-3">
            {/* Chain selector */}
            <div className="relative">
              <button
                onClick={() => setChainDropdownOpen(!chainDropdownOpen)}
                className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-sm font-[family-name:var(--font-spacemono)] transition whitespace-nowrap"
              >
                {selectedChainData?.short || "ETH"}
                <ChevronDown className="w-4 h-4 text-zinc-400" />
              </button>
              {chainDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl z-50 max-h-64 overflow-y-auto w-56">
                  {chains.map((chain) => (
                    <button
                      key={chain.id}
                      onClick={() => {
                        setSelectedChain(chain.id);
                        setChainDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm font-[family-name:var(--font-spacemono)] hover:bg-white/10 transition flex items-center justify-between ${
                        chain.id === selectedChain ? "text-[#4ADE80]" : "text-zinc-300"
                      }`}
                    >
                      {chain.name}
                      {chain.id === selectedChain && <Check className="w-4 h-4" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Address input */}
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Enter contract address (0x...)"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleScan()}
                className="w-full bg-transparent text-white placeholder-zinc-500 outline-none py-3 px-2 font-[family-name:var(--font-spacemono)] text-sm"
              />
            </div>

            {/* Search button */}
            <button
              onClick={handleScan}
              disabled={loading || !address.trim()}
              className="bg-[#4ADE80] hover:bg-[#22c55e] disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold rounded-xl px-6 py-3 flex items-center gap-2 transition"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Search className="w-5 h-5" />
              )}
              Audit
            </button>
          </div>
        </div>
      </section>

      {/* ── Loading ──────────────────────────────────────────────────── */}
      {loading && (
        <section className="px-8 md:px-24 pb-12">
          <div className="max-w-3xl mx-auto">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-2 border-[#4ADE80]/20 border-t-[#4ADE80] animate-spin" />
                  <Shield className="w-6 h-6 text-[#4ADE80] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <div className="text-center">
                  <p className="text-zinc-300 font-[family-name:var(--font-spacemono)] text-sm animate-pulse">
                    {LOADING_STEPS[loadingStep]}
                  </p>
                  <div className="flex gap-1.5 mt-3 justify-center">
                    {LOADING_STEPS.map((_, i) => (
                      <div
                        key={i}
                        className={`w-2 h-2 rounded-full transition-all duration-300 ${
                          i <= loadingStep ? "bg-[#4ADE80]" : "bg-white/10"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Error ────────────────────────────────────────────────────── */}
      {error && !loading && (
        <section className="px-8 md:px-24 pb-12">
          <div className="max-w-3xl mx-auto">
            <div className="bg-red-400/10 border border-red-400/20 rounded-2xl p-6 flex items-center gap-4">
              <AlertTriangle className="w-6 h-6 text-red-400 shrink-0" />
              <p className="text-red-400 font-[family-name:var(--font-spacemono)] text-sm">{error}</p>
            </div>
          </div>
        </section>
      )}

      {/* ── Results ──────────────────────────────────────────────────── */}
      {result && !loading && (
        <section className="px-8 md:px-24 pb-24">
          <div className="max-w-5xl mx-auto space-y-6">

            {/* ── Security Score Card ────────────────────────────────── */}
            <div className={`rounded-2xl border p-8 ${getScoreBg(result.security_score.score)}`}>
              <div className="flex flex-col md:flex-row items-center gap-8">
                {/* Score circle */}
                <div className="relative w-36 h-36 shrink-0">
                  <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                    <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                    <circle
                      cx="60" cy="60" r="52" fill="none"
                      stroke="currentColor"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${(result.security_score.score / 100) * 327} 327`}
                      className={getScoreColor(result.security_score.score)}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-4xl font-bold font-[family-name:var(--font-spacemono)] ${getScoreColor(result.security_score.score)}`}>
                      {result.security_score.score}
                    </span>
                    <span className="text-xs text-zinc-400 font-[family-name:var(--font-spacemono)]">/ 100</span>
                  </div>
                </div>

                {/* Score info */}
                <div className="flex-1 text-center md:text-left">
                  <div className="flex items-center gap-3 justify-center md:justify-start mb-2">
                    <h2 className={`text-3xl font-bold ${getScoreColor(result.security_score.score)}`}>
                      {result.security_score.label}
                    </h2>
                    <span className={`text-2xl font-bold px-3 py-1 rounded-lg border font-[family-name:var(--font-spacemono)] ${getGradeColor(result.security_score.grade)}`}>
                      {result.security_score.grade}
                    </span>
                  </div>
                  <p className="text-zinc-400 font-[family-name:var(--font-spacemono)] text-sm mb-4">
                    {result.contract_name || "Unknown Contract"} on {result.chain.name}
                  </p>

                  {/* Severity badges */}
                  <div className="flex flex-wrap gap-2">
                    {(Object.entries(result.security_score.severity_counts) as [string, number][])
                      .filter(([, count]) => count > 0)
                      .map(([severity, count]) => {
                        const config = SEVERITY_CONFIG[severity];
                        if (!config) return null;
                        const Icon = config.icon;
                        return (
                          <span key={severity} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-[family-name:var(--font-spacemono)] ${config.bg} ${config.color}`}>
                            <Icon className="w-3 h-3" />
                            {count} {config.label}
                          </span>
                        );
                      })}
                  </div>
                </div>

                {/* Contract address */}
                <div className="text-right hidden md:block">
                  <a
                    href={`${result.chain.explorer}/address/${result.contract_address}`}
                    target="_blank"
                    className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-sm font-[family-name:var(--font-spacemono)] transition"
                  >
                    {result.contract_address.slice(0, 8)}...{result.contract_address.slice(-6)}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  {result.compiler_version && (
                    <p className="text-xs text-zinc-500 font-[family-name:var(--font-spacemono)] mt-1">
                      Solidity v{result.compiler_version}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* ── Findings ───────────────────────────────────────────── */}
            {result.findings.length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-6">
                  <Bug className="w-5 h-5 text-zinc-400" />
                  <h3 className="text-xl font-bold">Security Findings</h3>
                  <span className="text-xs text-zinc-500 font-[family-name:var(--font-spacemono)] ml-auto">
                    {result.findings.length} issue{result.findings.length !== 1 ? "s" : ""} found
                  </span>
                </div>

                <div className="space-y-3">
                  {result.findings.map((finding) => {
                    const config = SEVERITY_CONFIG[finding.severity];
                    const Icon = config?.icon || Info;
                    const isExpanded = expandedFinding === finding.id;
                    return (
                      <div key={finding.id} className={`rounded-xl border overflow-hidden transition-all ${config?.bg || "bg-white/5 border-white/10"}`}>
                        <button
                          onClick={() => setExpandedFinding(isExpanded ? null : finding.id)}
                          className="w-full flex items-center gap-3 p-4 text-left"
                        >
                          <Icon className={`w-5 h-5 shrink-0 ${config?.color || "text-zinc-400"}`} />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{finding.title}</p>
                            {finding.line && (
                              <span className="text-xs text-zinc-500 font-[family-name:var(--font-spacemono)]">
                                Line {finding.line}
                              </span>
                            )}
                          </div>
                          <span className={`text-xs font-[family-name:var(--font-spacemono)] px-2 py-1 rounded-lg ${config?.color || "text-zinc-400"}`}>
                            {config?.label || finding.severity}
                          </span>
                          <ChevronRight className={`w-4 h-4 text-zinc-400 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                        </button>
                        {isExpanded && (
                          <div className="px-4 pb-4 pt-0 border-t border-white/5">
                            <p className="text-sm text-zinc-300 font-[family-name:var(--font-spacemono)] mt-3 leading-relaxed">
                              {finding.description}
                            </p>
                            {finding.snippet && (
                              <pre className="mt-3 bg-black/40 border border-white/5 rounded-lg p-3 text-xs font-[family-name:var(--font-spacemono)] text-zinc-400 overflow-x-auto">
                                <code>{finding.snippet}</code>
                              </pre>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Contract Metadata + Deployer ───────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Contract metadata */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-5">
                  <FileText className="w-5 h-5 text-zinc-400" />
                  <h3 className="text-lg font-bold">Contract Info</h3>
                </div>
                <div className="space-y-3 font-[family-name:var(--font-spacemono)] text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Name</span>
                    <span>{result.contract_name || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Verified</span>
                    <span className={result.is_verified ? "text-green-400" : "text-red-400"}>
                      {result.is_verified ? "Yes" : "No"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Compiler</span>
                    <span>{result.compiler_version ? `v${result.compiler_version}` : "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Optimization</span>
                    <span>
                      {result.metadata.optimization_used
                        ? `Yes (${result.metadata.optimization_runs} runs)`
                        : "No"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">EVM Version</span>
                    <span>{result.metadata.evm_version || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">License</span>
                    <span>{result.metadata.license || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Source Lines</span>
                    <span>{result.metadata.source_lines.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Files</span>
                    <span>{result.metadata.source_files_count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Proxy</span>
                    <span className={result.metadata.is_proxy ? "text-yellow-400" : "text-zinc-300"}>
                      {result.metadata.is_proxy ? "Yes" : "No"}
                    </span>
                  </div>
                  {result.metadata.implementation && (
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500">Implementation</span>
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
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-5">
                  <User className="w-5 h-5 text-zinc-400" />
                  <h3 className="text-lg font-bold">Deployer</h3>
                </div>
                {result.creator.address ? (
                  <div className="space-y-3 font-[family-name:var(--font-spacemono)] text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500">Address</span>
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
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Label</span>
                        <span className="text-[#4ADE80]">{result.creator.label}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Balance</span>
                      <span>{result.creator.balance != null ? `${result.creator.balance.toFixed(4)} ETH` : "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Transactions</span>
                      <span>{result.creator.tx_count.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Contracts Deployed</span>
                      <span>{result.creator.contracts_deployed}</span>
                    </div>
                    {result.creator.creation_tx && (
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500">Deploy Tx</span>
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
                  <p className="text-zinc-500 font-[family-name:var(--font-spacemono)] text-sm">
                    Could not identify the deployer wallet.
                  </p>
                )}
              </div>
            </div>

            {/* ── Function Analysis ───────────────────────────────────── */}
            {result.functions.length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Braces className="w-5 h-5 text-zinc-400" />
                  <h3 className="text-xl font-bold">Functions</h3>
                  <span className="text-xs text-zinc-500 font-[family-name:var(--font-spacemono)] ml-auto">
                    {result.functions.length} functions
                  </span>
                </div>

                {/* Filter tags */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <button
                    onClick={() => setFnFilter(null)}
                    className={`text-xs font-[family-name:var(--font-spacemono)] px-3 py-1.5 rounded-lg border transition ${
                      fnFilter === null
                        ? "bg-[#4ADE80]/20 border-[#4ADE80]/30 text-[#4ADE80]"
                        : "bg-white/5 border-white/10 text-zinc-400 hover:text-white"
                    }`}
                  >
                    All
                  </button>
                  {["read-only", "payable", "admin", "mint", "pause", "blacklist", "destructive", "upgradeable"].map((tag) => {
                    const count = result.functions.filter((f) => f.risk_tags.includes(tag)).length;
                    if (count === 0) return null;
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
                        onClick={() => setFnFilter(fnFilter === tag ? null : tag)}
                        className={`text-xs font-[family-name:var(--font-spacemono)] px-3 py-1.5 rounded-lg border transition ${
                          fnFilter === tag ? tagColor : "bg-white/5 border-white/10 text-zinc-400 hover:text-white"
                        }`}
                      >
                        {tag} ({count})
                      </button>
                    );
                  })}
                </div>

                {/* Function list */}
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
                          className={`rounded-lg border px-3 py-2 font-[family-name:var(--font-spacemono)] text-xs flex items-center gap-2 ${
                            isDangerous
                              ? "bg-red-400/5 border-red-400/20"
                              : isReadOnly
                              ? "bg-blue-400/5 border-blue-400/20"
                              : fn.risk_tags.includes("payable")
                              ? "bg-yellow-400/5 border-yellow-400/20"
                              : "bg-white/5 border-white/10"
                          }`}
                        >
                          {isDangerous ? (
                            <Lock className="w-3 h-3 text-red-400 shrink-0" />
                          ) : isReadOnly ? (
                            <Eye className="w-3 h-3 text-blue-400 shrink-0" />
                          ) : fn.risk_tags.includes("payable") ? (
                            <Zap className="w-3 h-3 text-yellow-400 shrink-0" />
                          ) : (
                            <Unlock className="w-3 h-3 text-zinc-500 shrink-0" />
                          )}
                          <span className={`truncate ${
                            isDangerous ? "text-red-400" : isReadOnly ? "text-blue-400" : "text-zinc-300"
                          }`}>
                            {fn.name}()
                          </span>
                          <span className="text-zinc-600 ml-auto shrink-0">
                            {fn.mutability === "view" || fn.mutability === "pure" ? "view" : fn.mutability}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* ── Source Code Viewer ──────────────────────────────────── */}
            {result.is_verified && (result.source_code || result.abi) && (
              <div className="bg-white/5 border border-white/10 rounded-2xl">
                <div className="flex items-center justify-between p-6 pb-0">
                  <div className="flex items-center gap-2">
                    <Code className="w-5 h-5 text-zinc-400" />
                    <h3 className="text-xl font-bold">Contract Code</h3>
                  </div>
                  <div className="flex gap-1 font-[family-name:var(--font-spacemono)] text-xs">
                    {result.source_code && (
                      <button
                        onClick={() => setCodeTab("source")}
                        className={`px-4 py-2 rounded-lg transition ${
                          codeTab === "source"
                            ? "bg-[#4ADE80]/20 text-[#4ADE80]"
                            : "bg-white/5 text-zinc-400 hover:text-white"
                        }`}
                      >
                        Source Code
                      </button>
                    )}
                    {result.abi && (
                      <button
                        onClick={() => setCodeTab("abi")}
                        className={`px-4 py-2 rounded-lg transition ${
                          codeTab === "abi"
                            ? "bg-[#4ADE80]/20 text-[#4ADE80]"
                            : "bg-white/5 text-zinc-400 hover:text-white"
                        }`}
                      >
                        <span className="flex items-center gap-1"><Braces className="w-3 h-3" /> ABI</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-6">
                  {/* Source Code Tab */}
                  {codeTab === "source" && result.source_code && (
                    <div className="relative">
                      <div className="absolute top-2 right-2 z-10 flex gap-2">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(result.source_code!);
                            setCopied("source");
                            setTimeout(() => setCopied(null), 2000);
                          }}
                          className="bg-white/10 hover:bg-white/20 text-zinc-300 px-3 py-1.5 rounded-lg text-xs font-[family-name:var(--font-spacemono)] flex items-center gap-1 transition"
                        >
                          {copied === "source" ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                          {copied === "source" ? "Copied" : "Copy"}
                        </button>
                      </div>
                      <pre
                        data-lenis-prevent
                        className={`bg-black/40 border border-white/5 rounded-xl p-4 font-[family-name:var(--font-spacemono)] text-xs text-zinc-300 whitespace-pre overflow-auto transition-all duration-300 ${
                          codeExpanded ? "max-h-[80vh]" : "max-h-[400px]"
                        }`}
                      >
                        <code>{result.source_code}</code>
                      </pre>
                      <div className="flex justify-center mt-3">
                        <button
                          onClick={() => setCodeExpanded(!codeExpanded)}
                          className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white font-[family-name:var(--font-spacemono)] transition"
                        >
                          <ChevronRight className={`w-4 h-4 transition-transform ${codeExpanded ? "rotate-[-90deg]" : "rotate-90"}`} />
                          {codeExpanded ? "Collapse" : "Expand full source"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ABI Tab */}
                  {codeTab === "abi" && result.abi && (
                    <div className="relative">
                      <div className="absolute top-2 right-2 z-10 flex gap-2">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(JSON.stringify(result.abi, null, 2));
                            setCopied("abi");
                            setTimeout(() => setCopied(null), 2000);
                          }}
                          className="bg-white/10 hover:bg-white/20 text-zinc-300 px-3 py-1.5 rounded-lg text-xs font-[family-name:var(--font-spacemono)] flex items-center gap-1 transition"
                        >
                          {copied === "abi" ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                          {copied === "abi" ? "Copied" : "Copy"}
                        </button>
                      </div>
                      <pre
                        data-lenis-prevent
                        className={`bg-black/40 border border-white/5 rounded-xl p-4 font-[family-name:var(--font-spacemono)] text-xs text-zinc-300 whitespace-pre overflow-auto transition-all duration-300 ${
                          codeExpanded ? "max-h-[80vh]" : "max-h-[400px]"
                        }`}
                      >
                        <code>{JSON.stringify(result.abi, null, 2)}</code>
                      </pre>
                      <div className="flex justify-center mt-3">
                        <button
                          onClick={() => setCodeExpanded(!codeExpanded)}
                          className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white font-[family-name:var(--font-spacemono)] transition"
                        >
                          <ChevronRight className={`w-4 h-4 transition-transform ${codeExpanded ? "rotate-[-90deg]" : "rotate-90"}`} />
                          {codeExpanded ? "Collapse" : "Expand full ABI"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </section>
      )}
    </main>
  );
}
