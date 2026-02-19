"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import {
  Coins, Search, Loader2, Copy, Check, AlertTriangle, CheckCircle,
  ShieldAlert, Users, PieChart, Lock, ExternalLink, ChevronDown,
  FileText, Code, User, BarChart3, Flag, Braces, ChevronRight,
} from "lucide-react";

// ── Types ───────────────────────────────────────────────────────────────────

type Chain = { id: number; name: string; short: string; explorer: string; native: string };

type TopHolder = {
  address: string;
  balance: number;
  percentage: number;
  label: string | null;
  category: string | null;
};

type TokenScanResult = {
  contract_address: string;
  chain: { id: number; name: string; short: string; explorer: string };
  token: { name: string; symbol: string; decimals: number; contract_address: string };
  risk_score: number;
  risk_label: string;
  flags: string[];
  score_breakdown: Record<string, number>;
  contract_analysis: {
    is_verified: boolean;
    contract_name: string | null;
    compiler_version: string | null;
    is_proxy: boolean;
    has_mint_function: boolean;
    has_pause_function: boolean;
    has_blacklist: boolean;
    has_owner: boolean;
    is_renounced: boolean;
    license: string | null;
    source_code: string | null;
    abi: any[] | null;
  };
  holder_distribution: {
    unique_holders: number;
    top10_pct: number;
    top20_pct: number;
    total_supply_estimated: number;
    total_transfers: number;
    top_holders: TopHolder[];
  };
  creator: {
    address: string | null;
    creation_tx: string | null;
    balance: number | null;
    tx_count: number;
    other_contracts_deployed: number;
  };
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function getRiskColor(score: number) {
  if (score <= 30) return "text-green-400";
  if (score <= 60) return "text-yellow-400";
  if (score <= 80) return "text-orange-400";
  return "text-red-400";
}

function getRiskBg(score: number) {
  if (score <= 30) return "bg-green-400/10 border-green-400/20";
  if (score <= 60) return "bg-yellow-400/10 border-yellow-400/20";
  if (score <= 80) return "bg-orange-400/10 border-orange-400/20";
  return "bg-red-400/10 border-red-400/20";
}

function getRiskBarColor(score: number) {
  if (score <= 30) return "bg-green-400";
  if (score <= 60) return "bg-yellow-400";
  if (score <= 80) return "bg-orange-400";
  return "bg-red-400";
}

const LOADING_STEPS = [
  "Fetching token metadata...",
  "Analyzing contract source code...",
  "Scanning holder distribution...",
  "Identifying deployer wallet...",
  "Computing risk score...",
];

// ── Component ───────────────────────────────────────────────────────────────

export default function TokenScan() {
  const [address, setAddress] = useState("");
  const [chains, setChains] = useState<Chain[]>([]);
  const [selectedChain, setSelectedChain] = useState(1);
  const [chainDropdownOpen, setChainDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [result, setResult] = useState<TokenScanResult | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [codeTab, setCodeTab] = useState<"source" | "abi">("source");
  const [codeExpanded, setCodeExpanded] = useState(false);

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

  // Loading animation
  useEffect(() => {
    if (!loading) return;
    setLoadingStep(0);
    const interval = setInterval(() => {
      setLoadingStep((s) => (s < LOADING_STEPS.length - 1 ? s + 1 : s));
    }, 2500);
    return () => clearInterval(interval);
  }, [loading]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleScan = async () => {
    const addr = address.trim();
    if (!addr) return;
    if (!addr.startsWith("0x") || addr.length !== 42) {
      setError("Enter a valid contract address (0x... 42 characters)");
      return;
    }

    setError("");
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch(
        `http://127.0.0.1:8000/token-scan/${addr}?chain_id=${selectedChain}`
      );
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setResult(data);
      }
    } catch (e) {
      setError("Failed to connect to backend. Is the server running?");
    } finally {
      setLoading(false);
    }
  };

  const selectedChainObj = chains.find((c) => c.id === selectedChain);

  return (
    <main className="min-h-screen text-white overflow-hidden relative font-[family-name:var(--font-nuqun)]">
      <Navbar />

      <section className="min-h-screen px-8 md:px-24 pt-32 pb-20">
        <div className="max-w-6xl mx-auto w-full">

          {/* ── Header ──────────────────────────────────────────────── */}
          <div className="mb-12">
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-[#4ADE80]/10 p-3 rounded-2xl">
                <Coins className="w-8 h-8 text-[#4ADE80]" />
              </div>
              <h1 className="text-5xl md:text-7xl font-medium tracking-wider leading-[0.9]">
                Token Risk Scanner
              </h1>
            </div>
            <p className="text-xl text-zinc-400 font-[family-name:var(--font-spacemono)] max-w-2xl mt-4">
              Paste any ERC-20 token contract address. Get holder distribution, contract
              red flags, deployer info, and a risk score — all in seconds.
            </p>
          </div>

          {/* ── Search Bar + Chain Selector ──────────────────────────── */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            {/* Chain dropdown */}
            <div className="relative">
              <button
                onClick={() => setChainDropdownOpen(!chainDropdownOpen)}
                className="h-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 flex items-center gap-2 hover:bg-white/10 transition font-[family-name:var(--font-spacemono)] text-sm min-w-[160px]"
              >
                <span>{selectedChainObj?.short || "ETH"}</span>
                <ChevronDown className="w-4 h-4 text-zinc-400" />
              </button>
              {chainDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl z-50 max-h-72 overflow-y-auto">
                  {chains.map((chain) => (
                    <button
                      key={chain.id}
                      onClick={() => { setSelectedChain(chain.id); setChainDropdownOpen(false); }}
                      className={`w-full text-left px-4 py-3 text-sm hover:bg-white/10 transition font-[family-name:var(--font-spacemono)] ${
                        chain.id === selectedChain ? "text-[#4ADE80]" : "text-zinc-300"
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
                placeholder="Paste token contract address (0x...)"
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
              Scan Token
            </button>
          </div>

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
              <h3 className="text-2xl text-zinc-300 mb-4">Scanning token contract...</h3>
              <div className="space-y-2 max-w-md mx-auto">
                {LOADING_STEPS.map((step, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-3 text-sm font-[family-name:var(--font-spacemono)] transition-all duration-300 ${
                      i < loadingStep ? "text-[#4ADE80]" : i === loadingStep ? "text-white" : "text-zinc-600"
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

          {/* ── Results ─────────────────────────────────────────────── */}
          {result && !loading && (
            <div className="space-y-6 animate-in fade-in duration-500">

              {/* Risk Score Card */}
              <div className={`p-8 rounded-2xl border ${getRiskBg(result.risk_score)}`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-3xl font-bold">{result.token.name}</h2>
                      <span className="text-xl text-zinc-400 font-[family-name:var(--font-spacemono)]">
                        ${result.token.symbol}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 font-[family-name:var(--font-spacemono)] text-sm text-zinc-400">
                      <span>{result.contract_address.slice(0, 10)}...{result.contract_address.slice(-8)}</span>
                      <button onClick={() => copyToClipboard(result.contract_address)}>
                        {copied === result.contract_address ? (
                          <Check className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4 hover:text-white transition" />
                        )}
                      </button>
                      <a
                        href={`${result.chain.explorer}/address/${result.contract_address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-white transition"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1 font-[family-name:var(--font-spacemono)]">
                      {result.chain.name}
                    </p>
                  </div>
                  <div className="text-center">
                    <div className={`text-7xl font-bold ${getRiskColor(result.risk_score)}`}>
                      {result.risk_score}
                    </div>
                    <div className={`text-sm font-[family-name:var(--font-spacemono)] mt-1 ${getRiskColor(result.risk_score)}`}>
                      {result.risk_label}
                    </div>
                  </div>
                </div>

                {/* Score breakdown bar */}
                <div className="mt-6">
                  <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-white/5">
                    {Object.entries(result.score_breakdown).map(([key, val]) => (
                      val > 0 && (
                        <div
                          key={key}
                          className={`${getRiskBarColor(val * 4)} transition-all`}
                          style={{ width: `${val}%` }}
                          title={`${key}: ${val}`}
                        />
                      )
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-4 mt-3 font-[family-name:var(--font-spacemono)] text-xs text-zinc-400">
                    {Object.entries(result.score_breakdown).map(([key, val]) => (
                      <span key={key} className="flex items-center gap-1">
                        <span className={`w-2 h-2 rounded-full ${getRiskBarColor(val * 4)}`} />
                        {key.replace(/_/g, " ")}: {val}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Flags */}
              {result.flags.length > 0 && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Flag className="w-5 h-5 text-zinc-400" />
                    <h3 className="text-xl font-bold">Risk Flags</h3>
                  </div>
                  <div className="space-y-2">
                    {result.flags.map((flag, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-3 p-3 rounded-xl text-sm font-[family-name:var(--font-spacemono)] ${
                          flag.includes("No major red flags")
                            ? "bg-green-400/10 text-green-400"
                            : "bg-white/5 text-zinc-300"
                        }`}
                      >
                        {flag.includes("No major red flags") ? (
                          <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 mt-0.5 text-yellow-400 shrink-0" />
                        )}
                        {flag}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <Users className="w-5 h-5 text-zinc-400 mb-2" />
                  <p className="text-xs text-zinc-400 font-[family-name:var(--font-spacemono)]">Holders</p>
                  <p className="text-2xl font-bold mt-1">{result.holder_distribution.unique_holders.toLocaleString()}</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <PieChart className="w-5 h-5 text-zinc-400 mb-2" />
                  <p className="text-xs text-zinc-400 font-[family-name:var(--font-spacemono)]">Top 10 Hold</p>
                  <p className={`text-2xl font-bold mt-1 ${result.holder_distribution.top10_pct > 70 ? "text-red-400" : result.holder_distribution.top10_pct > 50 ? "text-yellow-400" : "text-green-400"}`}>
                    {result.holder_distribution.top10_pct}%
                  </p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <BarChart3 className="w-5 h-5 text-zinc-400 mb-2" />
                  <p className="text-xs text-zinc-400 font-[family-name:var(--font-spacemono)]">Transfers</p>
                  <p className="text-2xl font-bold mt-1">{result.holder_distribution.total_transfers.toLocaleString()}</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <Code className="w-5 h-5 text-zinc-400 mb-2" />
                  <p className="text-xs text-zinc-400 font-[family-name:var(--font-spacemono)]">Verified</p>
                  <p className={`text-2xl font-bold mt-1 ${result.contract_analysis.is_verified ? "text-green-400" : "text-red-400"}`}>
                    {result.contract_analysis.is_verified ? "Yes" : "No"}
                  </p>
                </div>
              </div>

              {/* Contract Analysis */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-6">
                  <FileText className="w-5 h-5 text-zinc-400" />
                  <h3 className="text-xl font-bold">Contract Analysis</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-[family-name:var(--font-spacemono)]">
                  {[
                    { label: "Honeypot / Mint", value: result.contract_analysis.has_mint_function, bad: true },
                    { label: "Pausable", value: result.contract_analysis.has_pause_function, bad: true },
                    { label: "Blacklist", value: result.contract_analysis.has_blacklist, bad: true },
                    { label: "Proxy", value: result.contract_analysis.is_proxy, bad: true },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className={`flex items-center gap-3 p-4 rounded-xl ${
                        item.value
                          ? item.bad ? "bg-red-400/10" : "bg-green-400/10"
                          : item.bad ? "bg-green-400/10" : "bg-red-400/10"
                      }`}
                    >
                      {item.value ? (
                        item.bad ? <AlertTriangle className="w-5 h-5 text-red-400" /> : <CheckCircle className="w-5 h-5 text-green-400" />
                      ) : (
                        item.bad ? <CheckCircle className="w-5 h-5 text-green-400" /> : <AlertTriangle className="w-5 h-5 text-red-400" />
                      )}
                      <div>
                        <p className="text-xs text-zinc-400">{item.label}</p>
                        <p className={`text-sm font-bold ${
                          item.value
                            ? item.bad ? "text-red-400" : "text-green-400"
                            : item.bad ? "text-green-400" : "text-red-400"
                        }`}>
                          {item.value ? "Detected" : "Not Detected"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {result.contract_analysis.contract_name && (
                  <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-2 gap-4 font-[family-name:var(--font-spacemono)] text-sm">
                    <div>
                      <span className="text-zinc-400">Contract Name: </span>
                      <span>{result.contract_analysis.contract_name}</span>
                    </div>
                    {result.contract_analysis.compiler_version && (
                      <div>
                        <span className="text-zinc-400">Compiler: </span>
                        <span className="text-xs">{result.contract_analysis.compiler_version}</span>
                      </div>
                    )}
                    {result.contract_analysis.license && (
                      <div>
                        <span className="text-zinc-400">License: </span>
                        <span>{result.contract_analysis.license}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Top Holders */}
              {result.holder_distribution.top_holders.length > 0 && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-6">
                    <Users className="w-5 h-5 text-zinc-400" />
                    <h3 className="text-xl font-bold">Top Holders</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full font-[family-name:var(--font-spacemono)] text-sm">
                      <thead>
                        <tr className="text-zinc-400 text-xs border-b border-white/10">
                          <th className="text-left pb-3 pr-4">#</th>
                          <th className="text-left pb-3 pr-4">Address</th>
                          <th className="text-right pb-3 pr-4">Balance</th>
                          <th className="text-right pb-3">Share</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.holder_distribution.top_holders.map((holder, i) => (
                          <tr key={holder.address} className="border-b border-white/5 hover:bg-white/5 transition">
                            <td className="py-3 pr-4 text-zinc-500">{i + 1}</td>
                            <td className="py-3 pr-4">
                              <div className="flex items-center gap-2">
                                <span className="text-zinc-300">
                                  {holder.address.slice(0, 8)}...{holder.address.slice(-6)}
                                </span>
                                <button onClick={() => copyToClipboard(holder.address)}>
                                  {copied === holder.address ? (
                                    <Check className="w-3 h-3 text-green-400" />
                                  ) : (
                                    <Copy className="w-3 h-3 text-zinc-500 hover:text-white" />
                                  )}
                                </button>
                                {holder.label && (
                                  <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full text-zinc-300">
                                    {holder.label}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 pr-4 text-right text-zinc-300">
                              {holder.balance > 1e6
                                ? `${(holder.balance / 1e6).toFixed(2)}M`
                                : holder.balance > 1e3
                                ? `${(holder.balance / 1e3).toFixed(2)}K`
                                : holder.balance.toFixed(2)}
                            </td>
                            <td className="py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      holder.percentage > 20 ? "bg-red-400" : holder.percentage > 10 ? "bg-yellow-400" : "bg-green-400"
                                    }`}
                                    style={{ width: `${Math.min(holder.percentage, 100)}%` }}
                                  />
                                </div>
                                <span className={`w-12 text-right ${
                                  holder.percentage > 20 ? "text-red-400" : holder.percentage > 10 ? "text-yellow-400" : "text-zinc-300"
                                }`}>
                                  {holder.percentage.toFixed(1)}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Creator Info */}
              {result.creator.address && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-6">
                    <User className="w-5 h-5 text-zinc-400" />
                    <h3 className="text-xl font-bold">Deployer Wallet</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-[family-name:var(--font-spacemono)] text-sm">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-400">Address</span>
                        <span className="flex items-center gap-2">
                          {result.creator.address.slice(0, 10)}...{result.creator.address.slice(-6)}
                          <button onClick={() => copyToClipboard(result.creator.address!)}>
                            {copied === result.creator.address ? (
                              <Check className="w-3 h-3 text-green-400" />
                            ) : (
                              <Copy className="w-3 h-3 text-zinc-500 hover:text-white" />
                            )}
                          </button>
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Balance</span>
                        <span>{result.creator.balance !== null ? `${result.creator.balance.toFixed(4)} ETH` : "N/A"}</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Transaction Count</span>
                        <span>{result.creator.tx_count}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Contracts Deployed</span>
                        <span className={result.creator.other_contracts_deployed > 20 ? "text-red-400" : ""}>
                          {result.creator.other_contracts_deployed}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <Link
                      href={`/analyze?address=${result.creator.address}`}
                      className="inline-flex items-center gap-2 text-[#4ADE80] hover:underline text-sm font-[family-name:var(--font-spacemono)]"
                    >
                      Run full wallet analysis on deployer <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              )}

              {/* Contract Code Viewer */}
              {result.contract_analysis.is_verified && (result.contract_analysis.source_code || result.contract_analysis.abi) && (
                <div className="bg-white/5 border border-white/10 rounded-2xl">
                  <div className="flex items-center justify-between p-6 pb-0">
                    <div className="flex items-center gap-2">
                      <Code className="w-5 h-5 text-zinc-400" />
                      <h3 className="text-xl font-bold">Contract Code</h3>
                    </div>
                    <div className="flex gap-1 font-[family-name:var(--font-spacemono)] text-xs">
                      {result.contract_analysis.source_code && (
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
                      {result.contract_analysis.abi && (
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
                    {codeTab === "source" && result.contract_analysis.source_code && (
                      <div className="relative">
                        <div className="absolute top-2 right-2 z-10 flex gap-2">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(result.contract_analysis.source_code!);
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
                          <code>{result.contract_analysis.source_code}</code>
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
                    {codeTab === "abi" && result.contract_analysis.abi && (
                      <div className="relative">
                        <div className="absolute top-2 right-2 z-10 flex gap-2">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(JSON.stringify(result.contract_analysis.abi, null, 2));
                              setCopied("abi");
                              setTimeout(() => setCopied(null), 2000);
                            }}
                            className="bg-white/10 hover:bg-white/20 text-zinc-300 px-3 py-1.5 rounded-lg text-xs font-[family-name:var(--font-spacemono)] flex items-center gap-1 transition"
                          >
                            {copied === "abi" ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                            {copied === "abi" ? "Copied" : "Copy"}
                          </button>
                        </div>

                        {/* ABI Function List */}
                        <div className="mb-4 flex flex-wrap gap-2">
                          {result.contract_analysis.abi
                            .filter((item: any) => item.type === "function")
                            .map((fn: any, i: number) => (
                              <span
                                key={i}
                                className={`text-xs font-[family-name:var(--font-spacemono)] px-2.5 py-1 rounded-lg border ${
                                  ["mint", "_mint", "pause", "unpause", "blacklist", "addblacklist", "deny", "ban"].includes(
                                    fn.name?.toLowerCase()
                                  )
                                    ? "bg-red-400/10 border-red-400/20 text-red-400"
                                    : fn.stateMutability === "view" || fn.stateMutability === "pure"
                                    ? "bg-blue-400/10 border-blue-400/20 text-blue-400"
                                    : "bg-white/5 border-white/10 text-zinc-300"
                                }`}
                              >
                                {fn.name}()
                              </span>
                            ))}
                        </div>

                        <pre
                          data-lenis-prevent
                          className={`bg-black/40 border border-white/5 rounded-xl p-4 font-[family-name:var(--font-spacemono)] text-xs text-zinc-300 whitespace-pre overflow-auto transition-all duration-300 ${
                            codeExpanded ? "max-h-[80vh]" : "max-h-[400px]"
                          }`}
                        >
                          <code>{JSON.stringify(result.contract_analysis.abi, null, 2)}</code>
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
          )}

          {/* ── Empty State ─────────────────────────────────────────── */}
          {!result && !loading && !error && (
            <div className="text-center py-20">
              <Coins className="w-16 h-16 text-zinc-700 mx-auto mb-6" />
              <h3 className="text-2xl text-zinc-500 mb-2">Paste a token contract address to begin</h3>
              <p className="text-zinc-600 font-[family-name:var(--font-spacemono)] text-sm max-w-md mx-auto">
                Works with any ERC-20 token on Ethereum, Base, Arbitrum, Polygon, and 10 more chains.
                Analyzes contract source, holder distribution, and deployer history.
              </p>
            </div>
          )}

        </div>
      </section>
    </main>
  );
}
