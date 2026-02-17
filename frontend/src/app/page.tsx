"use client";
import { useState, useEffect, useCallback } from "react";
import Graph from "./components/Graph";
import Timeline from "./components/Timeline";
import {
  ShieldAlert, Search, Share2, Activity, CheckCircle, ChevronDown,
  AlertTriangle, Zap, Copy, Check, Download, Clock, Users, Wallet,
  ArrowUpRight, ArrowDownLeft, Loader2,
} from "lucide-react";

type Chain = {
  id: number;
  name: string;
  short: string;
  explorer: string;
  native: string;
};

type Counterparty = {
  address: string;
  label: string | null;
  category: string | null;
  total_value: number;
  tx_count: number;
  sent: number;
  received: number;
};

type TimelineEntry = {
  date: string;
  tx_count: number;
  volume: number;
  in_count: number;
  out_count: number;
};

type AnalysisResult = {
  address: string;
  risk_score: number;
  risk_label: string;
  ml_raw_score: number;
  heuristic_score: number;
  flags: string[];
  feature_summary: Record<string, number>;
  neighbors_analyzed: number;
  tx_count: number;
  internal_tx_count: number;
  token_transfers: number;
  balance: number | null;
  top_counterparties: Counterparty[];
  timeline: TimelineEntry[];
  mixer_interactions: string[];
  chain: Chain;
  graph: { nodes: any[]; links: any[] };
  on_chain: Record<string, any>;
};

type SearchEntry = {
  address: string;
  chain_id: number;
  chain_name: string;
  risk_score: number;
  risk_label: string;
  timestamp: number;
};

const HISTORY_KEY = "kryptos_search_history";
const MAX_HISTORY = 8;

function loadHistory(): SearchEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch { return []; }
}

function saveHistory(entry: SearchEntry) {
  const history = loadHistory().filter((h) => h.address !== entry.address || h.chain_id !== entry.chain_id);
  history.unshift(entry);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
}

const LOADING_STEPS = [
  "Fetching transactions...",
  "Building transaction graph...",
  "Discovering neighbors...",
  "Fetching neighbor data...",
  "Running ML scorer...",
  "Computing counterparties...",
  "Finalizing report...",
];

export default function Home() {
  const [address, setAddress] = useState("");
  const [target, setTarget] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [onChainLoading, setOnChainLoading] = useState(false);
  const [chains, setChains] = useState<Chain[]>([]);
  const [selectedChain, setSelectedChain] = useState<number>(1);
  const [showFeatures, setShowFeatures] = useState(false);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<SearchEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [activeTab, setActiveTab] = useState<"graph" | "timeline" | "counterparties">("graph");

  useEffect(() => {
    fetch("http://127.0.0.1:8000/chains")
      .then((res) => res.json())
      .then((data) => {
        setChains(data.chains || []);
        setSelectedChain(data.default || 1);
      })
      .catch((err) => console.error("Failed to fetch chains:", err));
    setHistory(loadHistory());
  }, []);

  // Address validation
  const validateAddress = useCallback((addr: string): string => {
    if (!addr) return "";
    if (!addr.startsWith("0x")) return "Address must start with 0x";
    if (addr.length !== 42) return `Address must be 42 characters (got ${addr.length})`;
    if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) return "Address contains invalid characters";
    return "";
  }, []);

  // Loading step animation
  useEffect(() => {
    if (!loading) return;
    setLoadingStep(0);
    const interval = setInterval(() => {
      setLoadingStep((s) => (s < LOADING_STEPS.length - 1 ? s + 1 : s));
    }, 2500);
    return () => clearInterval(interval);
  }, [loading]);

  const handleAnalyze = () => {
    const error = validateAddress(address);
    if (error) { setValidationError(error); return; }
    setValidationError("");
    setLoading(true);
    setResult(null);
    setShowFeatures(false);
    setActiveTab("graph");
    fetch(`http://127.0.0.1:8000/analyze/${address}?chain_id=${selectedChain}`)
      .then((res) => res.json())
      .then((data: AnalysisResult) => {
        setTarget(address);
        setResult(data);
        const chain = chains.find((c) => c.id === selectedChain);
        saveHistory({
          address,
          chain_id: selectedChain,
          chain_name: chain?.name || "Unknown",
          risk_score: data.risk_score,
          risk_label: data.risk_label,
          timestamp: Date.now(),
        });
        setHistory(loadHistory());
      })
      .catch((err) => console.error("Failed to analyze:", err))
      .finally(() => setLoading(false));
  };

  const handleVerify = () => {
    if (!target) return;
    setOnChainLoading(true);
    fetch(`http://127.0.0.1:8000/report/${target}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.on_chain && data.explorer) {
          window.open(data.explorer, "_blank");
        } else if (result?.on_chain?.tx_hash) {
          window.open(`https://sepolia.basescan.org/tx/0x${result.on_chain.tx_hash}`, "_blank");
        } else {
          window.open(`https://sepolia.basescan.org/address/0x015ffC4Bb2E5238A1646EC8860030bfb86650Ad2`, "_blank");
        }
      })
      .catch(() => {
        window.open(`https://sepolia.basescan.org/address/0x015ffC4Bb2E5238A1646EC8860030bfb86650Ad2`, "_blank");
      })
      .finally(() => setOnChainLoading(false));
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(target);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportReport = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kryptos-report-${target.slice(0, 10)}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const riskScore = result?.risk_score ?? 0;
  const riskLabel = result?.risk_label ?? "";

  const riskBarColor =
    riskScore >= 75 ? "bg-black" :
    riskScore >= 40 ? "bg-gray-600" :
    "bg-gray-300";

  return (
    <main className="flex flex-col items-center min-h-screen bg-white text-black p-10 font-sans selection:bg-gray-200">

      {/* HEADER */}
      <div className="text-center mb-12">
        <h1 className="text-6xl font-extrabold tracking-tighter text-black mb-4 animate-in fade-in slide-in-from-top-4 duration-700">
          kryptos
        </h1>
        <p className="text-gray-600 text-lg flex items-center justify-center gap-2">
          <Activity size={18} className="text-black" />
          Graph-Based Scam Detection & Fund Tracking
        </p>
      </div>

      {/* INPUT SECTION */}
      <div className="flex flex-col gap-3 mb-10 w-full max-w-2xl relative z-10">
        {/* Chain Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Network</span>
          <div className="relative">
            <select
              value={selectedChain}
              onChange={(e) => setSelectedChain(Number(e.target.value))}
              className="appearance-none bg-white border-2 border-black rounded-lg px-4 py-2 pr-8 text-sm font-bold text-black cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all focus:outline-none focus:ring-2 focus:ring-gray-400"
            >
              {chains.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-black" />
          </div>
        </div>

        {/* Address Input + Button */}
        <div className="flex gap-3">
          <div className="relative flex-grow">
            <Search className="absolute left-4 top-4 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Enter Wallet Address (0x...)"
              className={`w-full pl-12 p-4 rounded-xl bg-white border-2 text-black focus:outline-none focus:ring-2 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] placeholder:text-gray-500 ${
                validationError ? "border-red-500 focus:ring-red-300" : "border-black focus:ring-gray-400"
              }`}
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                setValidationError(validateAddress(e.target.value));
              }}
              onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
              onFocus={() => setShowHistory(true)}
              onBlur={() => setTimeout(() => setShowHistory(false), 200)}
            />
            {/* Validation error */}
            {validationError && (
              <p className="absolute -bottom-5 left-0 text-xs text-red-500 font-medium">{validationError}</p>
            )}
            {/* Search history dropdown */}
            {showHistory && history.length > 0 && !address && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-black rounded-lg shadow-lg z-50 overflow-hidden">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold px-3 pt-2 pb-1">Recent Searches</p>
                {history.map((h, i) => (
                  <button
                    key={i}
                    className="w-full text-left px-3 py-2 hover:bg-gray-100 transition-colors flex items-center justify-between gap-2 border-t border-gray-100"
                    onMouseDown={() => {
                      setAddress(h.address);
                      setSelectedChain(h.chain_id);
                      setShowHistory(false);
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Clock size={12} className="text-gray-400 shrink-0" />
                      <span className="text-xs font-mono truncate">{h.address}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-gray-400">{h.chain_name}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        h.risk_score >= 75 ? "bg-black text-white" :
                        h.risk_score >= 40 ? "bg-gray-600 text-white" :
                        "bg-gray-200 text-black"
                      }`}>
                        {h.risk_score}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={handleAnalyze}
            disabled={loading || !!validationError}
            className="bg-black text-white hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed px-8 py-4 rounded-xl font-bold transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)] hover:translate-x-[2px] hover:translate-y-[2px] flex items-center gap-2 whitespace-nowrap border-2 border-black"
          >
            {loading ? (
              <span className="animate-pulse flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                Scanning
              </span>
            ) : (
              "Analyze"
            )}
          </button>
        </div>
      </div>

      {/* LOADING STEPS INDICATOR */}
      {loading && (
        <div className="w-full max-w-2xl mb-8 animate-in fade-in duration-300">
          <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <Loader2 size={18} className="animate-spin text-black" />
              <span className="text-sm font-semibold text-black">Analyzing wallet...</span>
            </div>
            <div className="space-y-1.5">
              {LOADING_STEPS.map((step, i) => (
                <div key={i} className={`flex items-center gap-2 text-xs transition-all duration-300 ${
                  i < loadingStep ? "text-gray-400" :
                  i === loadingStep ? "text-black font-semibold" :
                  "text-gray-300"
                }`}>
                  {i < loadingStep ? (
                    <Check size={12} className="text-green-500" />
                  ) : i === loadingStep ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <div className="w-3 h-3 rounded-full border border-gray-300" />
                  )}
                  {step}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* RESULTS SECTION */}
      {target && !loading && result && (
        <div className="w-full max-w-5xl animate-in fade-in slide-in-from-bottom-8 duration-700">

          {/* Dashboard Header */}
          <div className="flex justify-between items-end mb-4 px-2">
            <div>
              <h2 className="text-2xl font-bold text-black flex items-center gap-3">
                Analysis Report
                <span className={`text-xs font-mono px-2 py-1 rounded border flex items-center gap-1 ${
                  riskScore >= 75 ? "bg-black text-white border-black" :
                  riskScore >= 40 ? "bg-gray-700 text-white border-gray-700" :
                  "bg-gray-200 text-black border-gray-400"
                }`}>
                  <ShieldAlert size={12} />
                  {riskScore >= 75 ? "THREAT DETECTED" : riskScore >= 40 ? "SUSPICIOUS" : "LOW RISK"}
                </span>
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-mono text-gray-500">{target}</span>
                <button onClick={copyAddress} className="text-gray-400 hover:text-black transition-colors">
                  {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                </button>
                {result.chain && (
                  <span className="text-xs text-gray-400">on {result.chain.name}</span>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={exportReport}
                className="flex items-center gap-1.5 text-xs bg-white hover:bg-gray-50 border border-gray-300 px-3 py-1.5 rounded-lg transition-all text-gray-600 hover:text-black font-medium"
              >
                <Download size={12} />
                Export
              </button>
              <button
                onClick={handleVerify}
                disabled={onChainLoading}
                className="group flex items-center gap-2 text-sm bg-white hover:bg-gray-100 border-2 border-black px-4 py-2 rounded-lg transition-all text-black font-medium shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
              >
                <Share2 size={16} className="text-black transition-colors" />
                {onChainLoading ? "Loading..." : "Verify on Base"}
              </button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="flex gap-3 mb-4 flex-wrap">
            {[
              { label: "Txns", value: result.tx_count, icon: Activity },
              { label: "Internal", value: result.internal_tx_count, icon: ArrowDownLeft },
              { label: "Tokens", value: result.token_transfers, icon: ArrowUpRight },
              { label: "Neighbors", value: result.neighbors_analyzed, icon: Users },
              ...(result.balance != null ? [{ label: `${result.chain?.native || "ETH"}`, value: result.balance.toFixed(4), icon: Wallet }] : []),
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-1.5 bg-gray-100 border border-gray-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-700">
                <s.icon size={12} className="text-gray-400" />
                <span className="text-gray-400">{s.label}</span>
                <span className="text-black font-mono">{s.value}</span>
              </div>
            ))}
          </div>

          {/* Tab Switcher */}
          <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
            {([
              { key: "graph", label: "Transaction Graph" },
              { key: "timeline", label: "Activity Timeline" },
              { key: "counterparties", label: "Top Counterparties" },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 text-xs font-semibold rounded-md transition-all ${
                  activeTab === tab.key
                    ? "bg-black text-white shadow"
                    : "text-gray-500 hover:text-black"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === "graph" && (
            <Graph address={target} graphData={result.graph} />
          )}

          {activeTab === "timeline" && (
            <Timeline data={result.timeline} native={result.chain?.native || "ETH"} />
          )}

          {activeTab === "counterparties" && (
            <div className="border-2 border-black rounded-xl overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white">
              {result.top_counterparties && result.top_counterparties.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b-2 border-black">
                      <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Address</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Label</th>
                      <th className="text-right px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Txns</th>
                      <th className="text-right px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Sent</th>
                      <th className="text-right px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Received</th>
                      <th className="text-right px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.top_counterparties.map((cp, i) => (
                      <tr key={i} className="border-t border-gray-200 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs">{cp.address.slice(0, 10)}...{cp.address.slice(-6)}</td>
                        <td className="px-4 py-3">
                          {cp.label ? (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                              cp.category === "exchange" ? "bg-blue-50 border-blue-200 text-blue-700" :
                              cp.category === "dex" ? "bg-purple-50 border-purple-200 text-purple-700" :
                              cp.category === "defi" ? "bg-green-50 border-green-200 text-green-700" :
                              cp.category === "bridge" ? "bg-orange-50 border-orange-200 text-orange-700" :
                              cp.category === "mixer" ? "bg-red-50 border-red-200 text-red-700" :
                              "bg-gray-50 border-gray-200 text-gray-700"
                            }`}>
                              {cp.label}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">Unknown</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs">{cp.tx_count}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-gray-600">{cp.sent.toFixed(4)}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-gray-600">{cp.received.toFixed(4)}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs font-bold">{cp.total_value.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center text-gray-400 text-sm">No counterparty data available</div>
              )}
            </div>
          )}

          {/* Analysis & Stats Panel */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">

            {/* Risk Score Card */}
            <div className="p-6 bg-white rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center gap-3 mb-2">
                <ShieldAlert className="text-black" size={24} />
                <h3 className="text-black font-bold text-lg">{riskLabel || "Analyzing..."}</h3>
              </div>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
                Combined Risk Score
              </p>
              <p className="text-5xl font-mono mt-2 font-bold text-black tracking-tighter">
                {riskScore}<span className="text-xl text-gray-400">/100</span>
              </p>
              {/* Animated risk bar */}
              <div className="mt-3 w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ease-out ${riskBarColor}`}
                  style={{ width: `${riskScore}%` }}
                />
              </div>
              {/* Score breakdown */}
              <div className="mt-3 flex gap-4 text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <Zap size={10} />
                  <span>ML: <strong className="text-black">{result.ml_raw_score}</strong></span>
                </div>
                <div className="flex items-center gap-1">
                  <AlertTriangle size={10} />
                  <span>Heuristic: <strong className="text-black">{result.heuristic_score}</strong></span>
                </div>
              </div>
              {/* Mixer warning */}
              {result.mixer_interactions && result.mixer_interactions.length > 0 && (
                <div className="mt-3 px-2 py-1.5 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-[10px] text-red-600 font-bold uppercase">Mixer Detected</p>
                  {result.mixer_interactions.map((m, i) => (
                    <p key={i} className="text-xs text-red-700">{m}</p>
                  ))}
                </div>
              )}
            </div>

            {/* Flags + Analysis Card */}
            <div className="p-6 bg-white rounded-xl border-2 border-black col-span-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="text-black" size={20} />
                <h3 className="text-black font-bold text-lg">AI Pattern Analysis</h3>
              </div>
              <p className="text-gray-800 text-sm leading-relaxed mb-3">
                Wallet <span className="text-black font-mono bg-gray-200 px-1 rounded">{target.slice(0, 8)}...</span>{" "}
                {riskScore >= 75 ? (
                  <>has been flagged as <strong className="text-black">high risk</strong> with a combined score of <strong className="text-black">{riskScore}/100</strong>. Transaction patterns show behavior consistent with known suspicious profiles.</>
                ) : riskScore >= 40 ? (
                  <>shows <strong className="text-black">moderate</strong> anomaly signals with a score of <strong className="text-black">{riskScore}/100</strong>. Some transaction patterns deviate from typical wallet behavior. Further monitoring is recommended.</>
                ) : (
                  <>appears to have <strong className="text-black">normal</strong> transaction patterns with a low score of <strong className="text-black">{riskScore}/100</strong>. No significant suspicious behavior detected.</>
                )}
              </p>

              {/* Flags */}
              {result.flags && result.flags.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">Risk Flags</p>
                  <div className="flex flex-wrap gap-2">
                    {result.flags.map((flag, i) => (
                      <span key={i} className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium ${
                        flag.toLowerCase().includes("mixer") ? "border-red-300 bg-red-50 text-red-700" :
                        "border-gray-300 bg-gray-50 text-gray-700"
                      }`}>
                        <AlertTriangle size={10} className={flag.toLowerCase().includes("mixer") ? "text-red-500" : "text-gray-500"} />
                        {flag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Collapsible Feature Details */}
          {result.feature_summary && Object.keys(result.feature_summary).length > 0 && (
            <div className="mt-4">
              <button
                onClick={() => setShowFeatures(!showFeatures)}
                className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-black transition-colors"
              >
                <ChevronDown size={14} className={`transition-transform ${showFeatures ? "rotate-180" : ""}`} />
                Feature Details ({Object.keys(result.feature_summary).length} features)
              </button>
              {showFeatures && (
                <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                  {Object.entries(result.feature_summary).map(([key, val]) => (
                    <div key={key} className="bg-gray-50 rounded-lg p-2 border border-gray-200">
                      <p className="text-[10px] text-gray-400 uppercase truncate">{key.replace(/_/g, " ")}</p>
                      <p className="text-sm font-mono font-bold text-black">{typeof val === "number" ? val.toFixed(4) : val}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </main>
  );
}