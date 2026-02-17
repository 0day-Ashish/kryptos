"use client";
import { useState, useEffect, useCallback } from "react";
import Graph from "./components/Graph";
import Timeline from "./components/Timeline";
import {
  ShieldAlert, Search, Share2, Activity, CheckCircle, ChevronDown,
  AlertTriangle, Zap, Copy, Check, Download, Clock, Users, Wallet,
  ArrowUpRight, ArrowDownLeft, Loader2, Moon, Sun, FileText, Radar,
  Globe, Ban, Fingerprint, GitBranch,
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

type SanctionsResult = {
  is_sanctioned: boolean;
  is_mixer: boolean;
  is_scam: boolean;
  lists: { list_name: string; label: string }[];
  risk_modifier: number;
  known_label: string | null;
  known_category: string | null;
};

type CounterpartySanctions = {
  total_checked: number;
  sanctioned_count: number;
  mixer_count: number;
  scam_count: number;
  sanctioned_addresses: { address: string; label: string }[];
  mixer_addresses: { address: string; label: string }[];
  scam_addresses: { address: string; label: string }[];
  risk_level: string;
};

type AnalysisResult = {
  address: string;
  ens_name: string | null;
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
  sanctions: SanctionsResult;
  counterparty_sanctions: CounterpartySanctions;
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

type FundFlowNode = {
  address: string;
  label: string | null;
  category: string | null;
  depth: number;
  value?: number;
  tx_hash?: string;
  children: FundFlowNode[];
};

type CrossChainEntry = {
  chain_id: number;
  chain_name: string;
  native: string;
  tx_count: number;
  balance: number;
  total_sent: number;
  total_received: number;
};

type TokenEntry = {
  symbol: string;
  name: string;
  contract: string;
  tx_count: number;
  transfers_in: number;
  transfers_out: number;
  volume_in: number;
  volume_out: number;
  flags: string[];
};

const HISTORY_KEY = "kryptos_search_history";
const THEME_KEY = "kryptos_theme";
const MAX_HISTORY = 8;

function loadHistory(): SearchEntry[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); }
  catch { return []; }
}
function saveHistory(entry: SearchEntry) {
  const history = loadHistory().filter((h) => h.address !== entry.address || h.chain_id !== entry.chain_id);
  history.unshift(entry);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
}

const LOADING_STEPS = [
  "Resolving address...",
  "Checking sanctions...",
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
  const [activeTab, setActiveTab] = useState<string>("graph");
  const [dark, setDark] = useState(false);

  // Extra data tabs
  const [fundFlow, setFundFlow] = useState<any>(null);
  const [fundFlowLoading, setFundFlowLoading] = useState(false);
  const [crossChainData, setCrossChainData] = useState<any>(null);
  const [crossChainLoading, setCrossChainLoading] = useState(false);
  const [tokenData, setTokenData] = useState<any>(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [similarData, setSimilarData] = useState<any>(null);
  const [similarLoading, setSimilarLoading] = useState(false);

  // Dark mode init
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(THEME_KEY);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = saved === "dark" || (!saved && prefersDark);
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem(THEME_KEY, next ? "dark" : "light");
  };

  useEffect(() => {
    fetch("http://127.0.0.1:8000/chains")
      .then((r) => r.json())
      .then((data) => { setChains(data.chains || []); setSelectedChain(data.default || 1); })
      .catch(() => {});
    setHistory(loadHistory());
  }, []);

  // Address / ENS validation
  const validateAddress = useCallback((addr: string): string => {
    if (!addr) return "";
    // ENS names are valid
    if (/^[a-zA-Z0-9\-]+\.eth$/.test(addr.trim())) return "";
    if (!addr.startsWith("0x")) return "Address must start with 0x";
    if (addr.length !== 42) return `Address must be 42 characters (got ${addr.length})`;
    if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) return "Address contains invalid characters";
    return "";
  }, []);

  useEffect(() => {
    if (!loading) return;
    setLoadingStep(0);
    const interval = setInterval(() => { setLoadingStep((s) => (s < LOADING_STEPS.length - 1 ? s + 1 : s)); }, 2200);
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
    setFundFlow(null);
    setCrossChainData(null);
    setTokenData(null);
    setSimilarData(null);
    fetch(`http://127.0.0.1:8000/analyze/${address}?chain_id=${selectedChain}`)
      .then((r) => r.json())
      .then((data: AnalysisResult) => {
        setTarget(data.address || address);
        setResult(data);
        const chain = chains.find((c) => c.id === selectedChain);
        saveHistory({
          address: data.address || address,
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

  // Lazy loaders for extra tabs
  const loadFundFlow = () => {
    if (fundFlow || fundFlowLoading) return;
    setFundFlowLoading(true);
    fetch(`http://127.0.0.1:8000/trace/${target}?chain_id=${selectedChain}&depth=3&direction=out`)
      .then((r) => r.json())
      .then(setFundFlow)
      .catch(() => {})
      .finally(() => setFundFlowLoading(false));
  };

  const loadCrossChain = () => {
    if (crossChainData || crossChainLoading) return;
    setCrossChainLoading(true);
    fetch(`http://127.0.0.1:8000/cross-chain/${target}`)
      .then((r) => r.json())
      .then(setCrossChainData)
      .catch(() => {})
      .finally(() => setCrossChainLoading(false));
  };

  const loadTokens = () => {
    if (tokenData || tokenLoading) return;
    setTokenLoading(true);
    fetch(`http://127.0.0.1:8000/tokens/${target}?chain_id=${selectedChain}`)
      .then((r) => r.json())
      .then(setTokenData)
      .catch(() => {})
      .finally(() => setTokenLoading(false));
  };

  const loadSimilar = () => {
    if (similarData || similarLoading) return;
    setSimilarLoading(true);
    fetch(`http://127.0.0.1:8000/similar/${target}?chain_id=${selectedChain}&top_k=5`)
      .then((r) => r.json())
      .then(setSimilarData)
      .catch(() => {})
      .finally(() => setSimilarLoading(false));
  };

  const handleVerify = () => {
    if (!target) return;
    setOnChainLoading(true);
    fetch(`http://127.0.0.1:8000/report/${target}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.on_chain && data.explorer) window.open(data.explorer, "_blank");
        else if (result?.on_chain?.tx_hash) window.open(`https://sepolia.basescan.org/tx/0x${result.on_chain.tx_hash}`, "_blank");
        else window.open("https://sepolia.basescan.org/address/0x015ffC4Bb2E5238A1646EC8860030bfb86650Ad2", "_blank");
      })
      .catch(() => window.open("https://sepolia.basescan.org/address/0x015ffC4Bb2E5238A1646EC8860030bfb86650Ad2", "_blank"))
      .finally(() => setOnChainLoading(false));
  };

  const downloadPdf = () => {
    if (!target) return;
    window.open(`http://127.0.0.1:8000/report/${target}/pdf?chain_id=${selectedChain}`, "_blank");
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
  const riskBarColor = riskScore >= 75 ? "bg-black dark:bg-white" : riskScore >= 40 ? "bg-gray-600 dark:bg-gray-400" : "bg-gray-300 dark:bg-gray-600";

  // Fund flow recursive renderer
  const renderFlowNode = (node: FundFlowNode, depth: number = 0): JSX.Element => (
    <div key={node.address + depth} className={`${depth > 0 ? "ml-6 border-l-2 border-gray-200 dark:border-zinc-700 pl-4" : ""}`}>
      <div className="flex items-center gap-2 py-1">
        <div className={`w-2 h-2 rounded-full ${
          node.category === "mixer" ? "bg-red-500" : node.category === "exchange" ? "bg-blue-500" : "bg-gray-400 dark:bg-zinc-500"
        }`} />
        <span className="font-mono text-xs text-foreground">{node.address.slice(0, 10)}...{node.address.slice(-4)}</span>
        {node.label && <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--muted)] text-[var(--muted-fg)]">{node.label}</span>}
        {node.value !== undefined && <span className="text-xs text-[var(--muted-fg)]">{node.value.toFixed(4)} ETH</span>}
      </div>
      {node.children?.map((child) => renderFlowNode(child, depth + 1))}
    </div>
  );

  return (
    <main className="flex flex-col items-center min-h-screen bg-[var(--background)] text-[var(--foreground)] p-10 font-sans transition-colors duration-300">

      {/* DARK MODE TOGGLE */}
      <button
        onClick={toggleDark}
        className="fixed top-4 right-4 z-50 p-2 rounded-lg border-2 border-[var(--card-border)] bg-[var(--card-bg)] shadow-[2px_2px_0px_0px_var(--shadow)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
        aria-label="Toggle dark mode"
      >
        {dark ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      {/* HEADER */}
      <div className="text-center mb-12">
        <h1 className="text-6xl font-extrabold tracking-tighter mb-4 animate-in fade-in slide-in-from-top-4 duration-700">
          kryptos
        </h1>
        <p className="text-[var(--muted-fg)] text-lg flex items-center justify-center gap-2">
          <Activity size={18} />
          Graph-Based Scam Detection & Fund Tracking
        </p>
      </div>

      {/* INPUT SECTION */}
      <div className="flex flex-col gap-3 mb-10 w-full max-w-2xl relative z-10">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[var(--muted-fg)] uppercase tracking-wider">Network</span>
          <div className="relative">
            <select
              value={selectedChain}
              onChange={(e) => setSelectedChain(Number(e.target.value))}
              className="appearance-none bg-[var(--card-bg)] border-2 border-[var(--card-border)] rounded-lg px-4 py-2 pr-8 text-sm font-bold cursor-pointer shadow-[2px_2px_0px_0px_var(--shadow)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all focus:outline-none"
            >
              {chains.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        <div className="flex gap-3">
          <div className="relative grow">
            <Search className="absolute left-4 top-4 text-[var(--muted-fg)]" size={20} />
            <input
              type="text"
              placeholder="Wallet address (0x...) or ENS name (vitalik.eth)"
              className={`w-full pl-12 p-4 rounded-xl bg-[var(--card-bg)] border-2 focus:outline-none focus:ring-2 transition-all shadow-[4px_4px_0px_0px_var(--shadow)] placeholder:text-[var(--muted-fg)] ${
                validationError ? "border-red-500 focus:ring-red-300" : "border-[var(--card-border)] focus:ring-gray-400"
              }`}
              value={address}
              onChange={(e) => { setAddress(e.target.value); setValidationError(validateAddress(e.target.value)); }}
              onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
              onFocus={() => setShowHistory(true)}
              onBlur={() => setTimeout(() => setShowHistory(false), 200)}
            />
            {validationError && <p className="absolute -bottom-5 left-0 text-xs text-red-500 font-medium">{validationError}</p>}
            {showHistory && history.length > 0 && !address && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--card-bg)] border-2 border-[var(--card-border)] rounded-lg shadow-lg z-50 overflow-hidden">
                <p className="text-[10px] text-[var(--muted-fg)] uppercase tracking-wider font-semibold px-3 pt-2 pb-1">Recent Searches</p>
                {history.map((h, i) => (
                  <button
                    key={i}
                    className="w-full text-left px-3 py-2 hover:bg-[var(--muted)] transition-colors flex items-center justify-between gap-2 border-t border-[var(--muted)]"
                    onMouseDown={() => { setAddress(h.address); setSelectedChain(h.chain_id); setShowHistory(false); }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Clock size={12} className="text-[var(--muted-fg)] shrink-0" />
                      <span className="text-xs font-mono truncate">{h.address}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-[var(--muted-fg)]">{h.chain_name}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        h.risk_score >= 75 ? "bg-black text-white dark:bg-white dark:text-black" :
                        h.risk_score >= 40 ? "bg-gray-600 text-white" :
                        "bg-gray-200 text-black dark:bg-zinc-700 dark:text-white"
                      }`}>{h.risk_score}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={handleAnalyze}
            disabled={loading || !!validationError}
            className="bg-[var(--accent)] text-[var(--accent-fg)] hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed px-8 py-4 rounded-xl font-bold transition-all shadow-[4px_4px_0px_0px_var(--shadow)] hover:shadow-[2px_2px_0px_0px_var(--shadow)] hover:translate-x-0.5 hover:translate-y-0.5 flex items-center gap-2 whitespace-nowrap border-2 border-[var(--card-border)]"
          >
            {loading ? <span className="animate-pulse flex items-center gap-2"><Loader2 size={16} className="animate-spin" />Scanning</span> : "Analyze"}
          </button>
        </div>
      </div>

      {/* LOADING */}
      {loading && (
        <div className="w-full max-w-2xl mb-8 animate-in fade-in duration-300">
          <div className="bg-[var(--muted)] border-2 border-[var(--card-border)] rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm font-semibold">Analyzing wallet...</span>
            </div>
            <div className="space-y-1.5">
              {LOADING_STEPS.map((step, i) => (
                <div key={i} className={`flex items-center gap-2 text-xs transition-all duration-300 ${
                  i < loadingStep ? "text-[var(--muted-fg)]" : i === loadingStep ? "font-semibold" : "text-[var(--muted-fg)] opacity-40"
                }`}>
                  {i < loadingStep ? <Check size={12} className="text-green-500" /> : i === loadingStep ? <Loader2 size={12} className="animate-spin" /> : <div className="w-3 h-3 rounded-full border border-[var(--muted-fg)]" />}
                  {step}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* RESULTS */}
      {target && !loading && result && (
        <div className="w-full max-w-5xl animate-in fade-in slide-in-from-bottom-8 duration-700">

          {/* Header */}
          <div className="flex justify-between items-end mb-4 px-2">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-3">
                Analysis Report
                {result.sanctions?.is_sanctioned && (
                  <span className="text-xs font-mono px-2 py-1 rounded border bg-red-600 text-white border-red-600 flex items-center gap-1">
                    <Ban size={12} />SANCTIONED
                  </span>
                )}
                <span className={`text-xs font-mono px-2 py-1 rounded border flex items-center gap-1 ${
                  riskScore >= 75 ? "bg-[var(--accent)] text-[var(--accent-fg)] border-[var(--card-border)]" :
                  riskScore >= 40 ? "bg-gray-700 text-white border-gray-700" :
                  "bg-gray-200 dark:bg-zinc-700 border-gray-400 dark:border-zinc-600"
                }`}>
                  <ShieldAlert size={12} />
                  {riskScore >= 75 ? "THREAT DETECTED" : riskScore >= 40 ? "SUSPICIOUS" : "LOW RISK"}
                </span>
              </h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs font-mono text-[var(--muted-fg)]">{target}</span>
                <button onClick={copyAddress} className="text-[var(--muted-fg)] hover:text-[var(--foreground)] transition-colors">
                  {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                </button>
                {result.ens_name && (
                  <span className="text-xs px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 font-medium">{result.ens_name}</span>
                )}
                {result.chain && <span className="text-xs text-[var(--muted-fg)]">on {result.chain.name}</span>}
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              <button onClick={downloadPdf} className="flex items-center gap-1.5 text-xs bg-[var(--card-bg)] hover:bg-[var(--muted)] border border-[var(--card-border)] px-3 py-1.5 rounded-lg transition-all font-medium" title="Download PDF Report">
                <FileText size={12} />PDF
              </button>
              <button onClick={exportReport} className="flex items-center gap-1.5 text-xs bg-[var(--card-bg)] hover:bg-[var(--muted)] border border-[var(--card-border)] px-3 py-1.5 rounded-lg transition-all font-medium">
                <Download size={12} />JSON
              </button>
              <button onClick={handleVerify} disabled={onChainLoading}
                className="group flex items-center gap-2 text-sm bg-[var(--card-bg)] hover:bg-[var(--muted)] border-2 border-[var(--card-border)] px-4 py-2 rounded-lg transition-all font-medium shadow-[2px_2px_0px_0px_var(--shadow)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5"
              >
                <Share2 size={16} />{onChainLoading ? "Loading..." : "Verify on Base"}
              </button>
            </div>
          </div>

          {/* Sanctions Banner */}
          {result.sanctions?.is_sanctioned && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-950 border-2 border-red-500 rounded-xl flex items-start gap-3">
              <Ban size={20} className="text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-red-700 dark:text-red-400">OFAC Sanctioned Address</p>
                <p className="text-sm text-red-600 dark:text-red-400">This address is on the U.S. Treasury OFAC SDN list. Interacting with it may violate U.S. law.</p>
                {result.sanctions.lists.map((l, i) => (
                  <span key={i} className="inline-block text-xs bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-300 px-2 py-0.5 rounded mt-1 mr-1">{l.list_name}: {l.label}</span>
                ))}
              </div>
            </div>
          )}

          {/* Counterparty Sanctions Summary */}
          {result.counterparty_sanctions && result.counterparty_sanctions.sanctioned_count > 0 && (
            <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-950 border border-orange-400 rounded-xl text-sm">
              <span className="font-bold text-orange-700 dark:text-orange-400">Warning:</span>{" "}
              <span className="text-orange-600 dark:text-orange-400">
                This wallet has transacted with {result.counterparty_sanctions.sanctioned_count} sanctioned address(es)
                {result.counterparty_sanctions.mixer_count > 0 && ` and ${result.counterparty_sanctions.mixer_count} mixer(s)`}.
              </span>
            </div>
          )}

          {/* Stats Bar */}
          <div className="flex gap-3 mb-4 flex-wrap">
            {[
              { label: "Txns", value: result.tx_count, icon: Activity },
              { label: "Internal", value: result.internal_tx_count, icon: ArrowDownLeft },
              { label: "Tokens", value: result.token_transfers, icon: ArrowUpRight },
              { label: "Neighbors", value: result.neighbors_analyzed, icon: Users },
              ...(result.balance != null ? [{ label: result.chain?.native || "ETH", value: result.balance.toFixed(4), icon: Wallet }] : []),
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-1.5 bg-[var(--muted)] border border-[var(--card-border)] rounded-lg px-3 py-1.5 text-xs font-semibold">
                <s.icon size={12} className="text-[var(--muted-fg)]" />
                <span className="text-[var(--muted-fg)]">{s.label}</span>
                <span className="font-mono">{s.value}</span>
              </div>
            ))}
          </div>

          {/* Tab Switcher */}
          <div className="flex gap-1 mb-4 bg-[var(--muted)] p-1 rounded-lg w-fit flex-wrap">
            {([
              { key: "graph", label: "Graph", icon: Share2 },
              { key: "timeline", label: "Timeline", icon: Activity },
              { key: "counterparties", label: "Counterparties", icon: Users },
              { key: "fundflow", label: "Fund Flow", icon: GitBranch },
              { key: "crosschain", label: "Cross-Chain", icon: Globe },
              { key: "tokens", label: "Tokens", icon: Wallet },
              { key: "similar", label: "Similar", icon: Fingerprint },
            ]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key);
                  if (tab.key === "fundflow") loadFundFlow();
                  if (tab.key === "crosschain") loadCrossChain();
                  if (tab.key === "tokens") loadTokens();
                  if (tab.key === "similar") loadSimilar();
                }}
                className={`px-3 py-2 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                  activeTab === tab.key ? "bg-[var(--accent)] text-[var(--accent-fg)] shadow" : "text-[var(--muted-fg)] hover:text-[var(--foreground)]"
                }`}
              >
                <tab.icon size={12} />{tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === "graph" && <Graph address={target} graphData={result.graph} />}

          {activeTab === "timeline" && <Timeline data={result.timeline} native={result.chain?.native || "ETH"} />}

          {activeTab === "counterparties" && (
            <div className="border-2 border-[var(--card-border)] rounded-xl overflow-hidden shadow-[4px_4px_0px_0px_var(--shadow)] bg-[var(--card-bg)]">
              {result.top_counterparties?.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[var(--muted)] border-b-2 border-[var(--card-border)]">
                      {["Address", "Label", "Txns", "Sent", "Received", "Total"].map((h) => (
                        <th key={h} className={`${h === "Address" || h === "Label" ? "text-left" : "text-right"} px-4 py-3 text-xs font-bold text-[var(--muted-fg)] uppercase tracking-wider`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.top_counterparties.map((cp, i) => (
                      <tr key={i} className="border-t border-[var(--muted)] hover:bg-[var(--muted)] transition-colors">
                        <td className="px-4 py-3 font-mono text-xs">{cp.address.slice(0, 10)}...{cp.address.slice(-6)}</td>
                        <td className="px-4 py-3">
                          {cp.label ? (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                              cp.category === "exchange" ? "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300" :
                              cp.category === "dex" ? "bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300" :
                              cp.category === "defi" ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300" :
                              cp.category === "mixer" ? "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300" :
                              "bg-[var(--muted)] border-[var(--card-border)] text-[var(--muted-fg)]"
                            }`}>{cp.label}</span>
                          ) : <span className="text-xs text-[var(--muted-fg)]">Unknown</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs">{cp.tx_count}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-[var(--muted-fg)]">{cp.sent.toFixed(4)}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-[var(--muted-fg)]">{cp.received.toFixed(4)}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs font-bold">{cp.total_value.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <div className="p-8 text-center text-[var(--muted-fg)] text-sm">No counterparty data available</div>}
            </div>
          )}

          {activeTab === "fundflow" && (
            <div className="border-2 border-[var(--card-border)] rounded-xl shadow-[4px_4px_0px_0px_var(--shadow)] bg-[var(--card-bg)] p-5">
              <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><GitBranch size={16} />Fund Flow Trace (3 hops)</h3>
              {fundFlowLoading ? (
                <div className="flex items-center gap-2 text-sm text-[var(--muted-fg)]"><Loader2 size={14} className="animate-spin" />Tracing fund flow...</div>
              ) : fundFlow?.tree ? (
                <>
                  <div className="flex gap-4 mb-3 text-xs text-[var(--muted-fg)]">
                    <span>Nodes: <strong className="text-[var(--foreground)]">{fundFlow.summary?.total_nodes}</strong></span>
                    <span>Unique: <strong className="text-[var(--foreground)]">{fundFlow.summary?.unique_addresses}</strong></span>
                    <span>Value: <strong className="text-[var(--foreground)]">{fundFlow.summary?.total_value_traced?.toFixed(4)} ETH</strong></span>
                  </div>
                  <div className="max-h-96 overflow-y-auto">{renderFlowNode(fundFlow.tree)}</div>
                </>
              ) : <div className="text-sm text-[var(--muted-fg)]">No fund flow data available</div>}
            </div>
          )}

          {activeTab === "crosschain" && (
            <div className="border-2 border-[var(--card-border)] rounded-xl shadow-[4px_4px_0px_0px_var(--shadow)] bg-[var(--card-bg)] overflow-hidden">
              <div className="px-5 py-3 border-b border-[var(--muted)] bg-[var(--muted)] flex items-center gap-2">
                <Globe size={16} /><h3 className="font-bold text-sm">Cross-Chain Activity</h3>
                {crossChainData && <span className="text-xs text-[var(--muted-fg)]">Active on {crossChainData.total_chains_active} chain(s)</span>}
              </div>
              {crossChainLoading ? (
                <div className="p-8 flex items-center justify-center gap-2 text-sm text-[var(--muted-fg)]"><Loader2 size={14} className="animate-spin" />Scanning 14 chains...</div>
              ) : crossChainData?.active_chains?.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--muted)]">
                      {["Chain", "Txns", "Balance", "Sent", "Received"].map((h) => (
                        <th key={h} className={`${h === "Chain" ? "text-left" : "text-right"} px-4 py-2 text-xs font-bold text-[var(--muted-fg)] uppercase`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {crossChainData.active_chains.map((ch: CrossChainEntry, i: number) => (
                      <tr key={i} className="border-t border-[var(--muted)] hover:bg-[var(--muted)] transition-colors">
                        <td className="px-4 py-3 text-xs font-medium">{ch.chain_name}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs">{ch.tx_count}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs">{ch.balance?.toFixed(4)} {ch.native}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-[var(--muted-fg)]">{ch.total_sent?.toFixed(4)}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-[var(--muted-fg)]">{ch.total_received?.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <div className="p-8 text-center text-[var(--muted-fg)] text-sm">No cross-chain activity found</div>}
            </div>
          )}

          {activeTab === "tokens" && (
            <div className="border-2 border-[var(--card-border)] rounded-xl shadow-[4px_4px_0px_0px_var(--shadow)] bg-[var(--card-bg)] overflow-hidden">
              <div className="px-5 py-3 border-b border-[var(--muted)] bg-[var(--muted)] flex items-center gap-2">
                <Wallet size={16} /><h3 className="font-bold text-sm">Token Portfolio</h3>
                {tokenData?.summary && <span className="text-xs text-[var(--muted-fg)]">{tokenData.summary.total_tokens} tokens, {tokenData.summary.total_transfers} transfers</span>}
              </div>
              {tokenLoading ? (
                <div className="p-8 flex items-center justify-center gap-2 text-sm text-[var(--muted-fg)]"><Loader2 size={14} className="animate-spin" />Loading tokens...</div>
              ) : tokenData?.tokens?.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--muted)]">
                      {["Token", "Transfers In", "Transfers Out", "Vol In", "Vol Out", "Flags"].map((h) => (
                        <th key={h} className={`${h === "Token" || h === "Flags" ? "text-left" : "text-right"} px-4 py-2 text-xs font-bold text-[var(--muted-fg)] uppercase`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tokenData.tokens.slice(0, 20).map((t: TokenEntry, i: number) => (
                      <tr key={i} className="border-t border-[var(--muted)] hover:bg-[var(--muted)] transition-colors">
                        <td className="px-4 py-3">
                          <span className="text-xs font-bold">{t.symbol}</span>
                          <span className="text-[10px] text-[var(--muted-fg)] ml-1">{t.name.slice(0, 20)}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs">{t.transfers_in}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs">{t.transfers_out}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-[var(--muted-fg)]">{t.volume_in?.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-[var(--muted-fg)]">{t.volume_out?.toFixed(2)}</td>
                        <td className="px-4 py-3">
                          {t.flags?.map((f, j) => (
                            <span key={j} className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 mr-1">{f.replace(/_/g, " ")}</span>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <div className="p-8 text-center text-[var(--muted-fg)] text-sm">No token data available</div>}
            </div>
          )}

          {activeTab === "similar" && (
            <div className="border-2 border-[var(--card-border)] rounded-xl shadow-[4px_4px_0px_0px_var(--shadow)] bg-[var(--card-bg)] overflow-hidden">
              <div className="px-5 py-3 border-b border-[var(--muted)] bg-[var(--muted)] flex items-center gap-2">
                <Fingerprint size={16} /><h3 className="font-bold text-sm">Similar Wallets</h3>
                {similarData && <span className="text-xs text-[var(--muted-fg)]">{similarData.candidates_checked} candidates checked</span>}
              </div>
              {similarLoading ? (
                <div className="p-8 flex items-center justify-center gap-2 text-sm text-[var(--muted-fg)]"><Loader2 size={14} className="animate-spin" />Finding similar wallets...</div>
              ) : similarData?.similar?.length > 0 ? (
                <div className="divide-y divide-[var(--muted)]">
                  {similarData.similar.map((s: any, i: number) => (
                    <div key={i} className="px-5 py-3 flex items-center justify-between hover:bg-[var(--muted)] transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="text-lg font-bold text-[var(--muted-fg)] w-6">#{i + 1}</div>
                        <div>
                          <p className="font-mono text-xs">{s.address.slice(0, 14)}...{s.address.slice(-6)}</p>
                          {s.label && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--muted)] text-[var(--muted-fg)]">{s.label}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-xs text-[var(--muted-fg)]">Similarity</p>
                          <p className="font-mono font-bold text-sm">{(s.similarity * 100).toFixed(1)}%</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-[var(--muted-fg)]">Txns</p>
                          <p className="font-mono text-sm">{s.tx_count}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <div className="p-8 text-center text-[var(--muted-fg)] text-sm">No similar wallets found</div>}
            </div>
          )}

          {/* Analysis Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">

            {/* Risk Score Card */}
            <div className="p-6 bg-[var(--card-bg)] rounded-xl border-2 border-[var(--card-border)] shadow-[4px_4px_0px_0px_var(--shadow)]">
              <div className="flex items-center gap-3 mb-2">
                <ShieldAlert size={24} />
                <h3 className="font-bold text-lg">{riskLabel || "Analyzing..."}</h3>
              </div>
              <p className="text-xs text-[var(--muted-fg)] uppercase tracking-wider font-semibold">Combined Risk Score</p>
              <p className="text-5xl font-mono mt-2 font-bold tracking-tighter">
                {riskScore}<span className="text-xl text-[var(--muted-fg)]">/100</span>
              </p>
              <div className="mt-3 w-full bg-[var(--muted)] rounded-full h-2 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-1000 ease-out ${riskBarColor}`} style={{ width: `${riskScore}%` }} />
              </div>
              <div className="mt-3 flex gap-4 text-xs text-[var(--muted-fg)]">
                <div className="flex items-center gap-1"><Zap size={10} /><span>ML: <strong className="text-[var(--foreground)]">{result.ml_raw_score}</strong></span></div>
                <div className="flex items-center gap-1"><AlertTriangle size={10} /><span>Heuristic: <strong className="text-[var(--foreground)]">{result.heuristic_score}</strong></span></div>
              </div>
              {result.sanctions?.risk_modifier > 0 && (
                <div className="mt-2 flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                  <Ban size={10} />Sanctions modifier: +{result.sanctions.risk_modifier}
                </div>
              )}
              {result.mixer_interactions?.length > 0 && (
                <div className="mt-3 px-2 py-1.5 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md">
                  <p className="text-[10px] text-red-600 dark:text-red-400 font-bold uppercase">Mixer Detected</p>
                  {result.mixer_interactions.map((m, i) => <p key={i} className="text-xs text-red-700 dark:text-red-400">{m}</p>)}
                </div>
              )}
            </div>

            {/* Flags Card */}
            <div className="p-6 bg-[var(--card-bg)] rounded-xl border-2 border-[var(--card-border)] col-span-2 shadow-[4px_4px_0px_0px_var(--shadow)]">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle size={20} />
                <h3 className="font-bold text-lg">AI Pattern Analysis</h3>
              </div>
              <p className="text-sm leading-relaxed mb-3 text-[var(--muted-fg)]">
                Wallet <span className="font-mono bg-[var(--muted)] px-1 rounded text-[var(--foreground)]">{target.slice(0, 8)}...</span>{" "}
                {riskScore >= 75 ? <>has been flagged as <strong className="text-[var(--foreground)]">high risk</strong> with a score of <strong>{riskScore}/100</strong>.</> :
                 riskScore >= 40 ? <>shows <strong className="text-[var(--foreground)]">moderate</strong> anomaly signals with a score of <strong>{riskScore}/100</strong>.</> :
                 <>appears <strong className="text-[var(--foreground)]">normal</strong> with a low score of <strong>{riskScore}/100</strong>.</>}
              </p>
              {result.flags?.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-[var(--muted-fg)] uppercase tracking-wider font-semibold mb-2">Risk Flags</p>
                  <div className="flex flex-wrap gap-2">
                    {result.flags.map((flag, i) => (
                      <span key={i} className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium ${
                        flag.toLowerCase().includes("sanctioned") ? "border-red-500 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400" :
                        flag.toLowerCase().includes("mixer") ? "border-red-300 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400" :
                        "border-[var(--card-border)] bg-[var(--muted)] text-[var(--muted-fg)]"
                      }`}>
                        <AlertTriangle size={10} />{flag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Feature Details */}
          {result.feature_summary && Object.keys(result.feature_summary).length > 0 && (
            <div className="mt-4">
              <button onClick={() => setShowFeatures(!showFeatures)} className="flex items-center gap-2 text-xs font-semibold text-[var(--muted-fg)] uppercase tracking-wider hover:text-[var(--foreground)] transition-colors">
                <ChevronDown size={14} className={`transition-transform ${showFeatures ? "rotate-180" : ""}`} />
                Feature Details ({Object.keys(result.feature_summary).length} features)
              </button>
              {showFeatures && (
                <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                  {Object.entries(result.feature_summary).map(([key, val]) => (
                    <div key={key} className="bg-[var(--muted)] rounded-lg p-2 border border-[var(--card-border)]">
                      <p className="text-[10px] text-[var(--muted-fg)] uppercase truncate">{key.replace(/_/g, " ")}</p>
                      <p className="text-sm font-mono font-bold">{typeof val === "number" ? val.toFixed(4) : val}</p>
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