"use client";
import { useState, useEffect, useCallback } from "react";
import Graph from "../components/Graph";
import Timeline from "../components/Timeline";
import Navbar from "@/components/Navbar";
import {
  ShieldAlert, Search, Share2, Activity, CheckCircle, ChevronDown,
  AlertTriangle, Zap, Copy, Check, Download, Clock, Users, Wallet,
  ArrowUpRight, ArrowDownLeft, Loader2, FileText, Link2,
  Globe, Ban, Fingerprint, GitBranch, Brain, TrendingUp, Bot,
  BarChart3, Flag, MessageSquare, SendHorizontal, ThumbsUp, ThumbsDown,
  Layers, ExternalLink,
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
  gnn: GnnResult | null;
  temporal: TemporalResult | null;
  mev: MevResult | null;
  bridges: BridgeResult | null;
  community_risk_modifier: number;
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

type GnnResult = {
  gnn_score: number;
  gnn_embedding: number[];
  mahalanobis_distance: number;
  cosine_anomaly: number;
  degree_ratio: number;
  graph_stats: {
    n_nodes: number;
    n_edges: number;
    avg_degree: number;
    target_degree: number;
  };
};

type TemporalAnomaly = {
  date: string;
  z_score?: number;
  value?: number;
  type?: string;
  direction?: string;
};

type TemporalResult = {
  temporal_risk_score: number;
  zscore_anomalies: TemporalAnomaly[];
  volume_anomalies: TemporalAnomaly[];
  changepoints_txcount: TemporalAnomaly[];
  regime_shifts: TemporalAnomaly[];
  burst_analysis: {
    burst_count: number;
    longest_burst: number;
    avg_burst_gap_sec: number;
    burst_pct: number;
  };
  days_analyzed: number;
};

type MevResult = {
  is_mev_bot: boolean;
  mev_risk_score: number;
  sandwiches: any[];
  frontrunning: any[];
  gas_analysis: Record<string, any>;
  dex_pattern: Record<string, any>;
  known_bots: { address: string; label: string }[];
  arb_analysis: Record<string, any>;
  mev_flags: string[];
};

type BridgeUsed = {
  protocol: string;
  txn_count: number;
  volume_eth: number;
  contracts: string[];
  directions: string[];
};

type BridgeResult = {
  bridges_used: BridgeUsed[];
  total_bridge_txns: number;
  total_bridge_volume: number;
  bridge_risk_score: number;
  bridge_flags: string[];
  bridge_timeline: any[];
};

type CommunityReport = {
  id: string;
  address: string;
  category: string;
  description: string;
  reporter_id: string;
  date: string;
  upvotes: number;
  downvotes: number;
  status: string;
};

const HISTORY_KEY = "kryptos_search_history";
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
  "Running GNN analysis...",
  "Temporal anomaly detection...",
  "MEV bot detection...",
  "Bridge tracking...",
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

  // Extra data tabs
  const [fundFlow, setFundFlow] = useState<any>(null);
  const [fundFlowLoading, setFundFlowLoading] = useState(false);
  const [crossChainData, setCrossChainData] = useState<any>(null);
  const [crossChainLoading, setCrossChainLoading] = useState(false);
  const [tokenData, setTokenData] = useState<any>(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [similarData, setSimilarData] = useState<any>(null);
  const [similarLoading, setSimilarLoading] = useState(false);

  // Advanced data tabs
  const [communityData, setCommunityData] = useState<any>(null);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [reportCategory, setReportCategory] = useState("scam");
  const [reportDescription, setReportDescription] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [batchInput, setBatchInput] = useState("");
  const [batchResult, setBatchResult] = useState<any>(null);
  const [batchLoading, setBatchLoading] = useState(false);

  // Share link state
  const [shareLoading, setShareLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/chains")
      .then((r) => r.json())
      .then((data) => { setChains(data.chains || []); setSelectedChain(data.default || 1); })
      .catch(() => { });
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
    setCommunityData(null);
    setBatchResult(null);
    setShareUrl(null);
    setShareCopied(false);
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
      .catch(() => { })
      .finally(() => setFundFlowLoading(false));
  };

  const loadCrossChain = () => {
    if (crossChainData || crossChainLoading) return;
    setCrossChainLoading(true);
    fetch(`http://127.0.0.1:8000/cross-chain/${target}`)
      .then((r) => r.json())
      .then(setCrossChainData)
      .catch(() => { })
      .finally(() => setCrossChainLoading(false));
  };

  const loadTokens = () => {
    if (tokenData || tokenLoading) return;
    setTokenLoading(true);
    fetch(`http://127.0.0.1:8000/tokens/${target}?chain_id=${selectedChain}`)
      .then((r) => r.json())
      .then(setTokenData)
      .catch(() => { })
      .finally(() => setTokenLoading(false));
  };

  const loadSimilar = () => {
    if (similarData || similarLoading) return;
    setSimilarLoading(true);
    fetch(`http://127.0.0.1:8000/similar/${target}?chain_id=${selectedChain}&top_k=5`)
      .then((r) => r.json())
      .then(setSimilarData)
      .catch(() => { })
      .finally(() => setSimilarLoading(false));
  };

  const loadCommunity = () => {
    if (communityData || communityLoading) return;
    setCommunityLoading(true);
    fetch(`http://127.0.0.1:8000/community/reports/${target}`)
      .then((r) => r.json())
      .then(setCommunityData)
      .catch(() => { })
      .finally(() => setCommunityLoading(false));
  };

  const submitCommunityReport = () => {
    if (!target || reportSubmitting) return;
    setReportSubmitting(true);
    fetch("http://127.0.0.1:8000/community/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: target, category: reportCategory, description: reportDescription, chain_id: selectedChain }),
    })
      .then((r) => r.json())
      .then(() => { setCommunityData(null); loadCommunity(); setReportDescription(""); })
      .catch(() => { })
      .finally(() => setReportSubmitting(false));
  };

  const voteReport = (reportId: string, vote: string) => {
    fetch("http://127.0.0.1:8000/community/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ report_id: reportId, vote }),
    })
      .then(() => { setCommunityData(null); loadCommunity(); })
      .catch(() => { });
  };

  const runBatchAnalysis = () => {
    if (!batchInput.trim() || batchLoading) return;
    setBatchLoading(true);
    const addresses = batchInput.split(/[\n,]/).map((a) => a.trim()).filter(Boolean);
    fetch("http://127.0.0.1:8000/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addresses, chain_id: selectedChain, quick: true }),
    })
      .then((r) => r.json())
      .then(setBatchResult)
      .catch(() => { })
      .finally(() => setBatchLoading(false));
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

  const shareReport = async () => {
    if (!result || shareLoading) return;
    setShareLoading(true);
    setShareUrl(null);
    try {
      const res = await fetch("http://127.0.0.1:8000/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: result }),
      });
      const data = await res.json();
      if (data.report_id) {
        const fullUrl = `${window.location.origin}/report/${data.report_id}`;
        setShareUrl(fullUrl);
        navigator.clipboard.writeText(fullUrl);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 3000);
      }
    } catch {
      // silent fail
    } finally {
      setShareLoading(false);
    }
  };

  const riskScore = result?.risk_score ?? 0;
  const riskLabel = result?.risk_label ?? "";
  const riskBarColor = riskScore >= 75 ? "bg-red-400" : riskScore >= 40 ? "bg-yellow-400" : "bg-green-400";

  function getRiskColor(score: number) {
    if (score >= 75) return "text-red-400";
    if (score >= 40) return "text-yellow-400";
    return "text-green-400";
  }
  function getRiskBg(score: number) {
    if (score >= 75) return "bg-red-400/10 border-red-400/20";
    if (score >= 40) return "bg-yellow-400/10 border-yellow-400/20";
    return "bg-green-400/10 border-green-400/20";
  }

  // Fund flow recursive renderer
  const renderFlowNode = (node: FundFlowNode, depth: number = 0): React.JSX.Element => (
    <div key={node.address + depth} className={`${depth > 0 ? "ml-6 border-l-2 border-zinc-700 pl-4" : ""}`}>
      <div className="flex items-center gap-2 py-1">
        <div className={`w-2 h-2 rounded-full ${node.category === "mixer" ? "bg-red-500" : node.category === "exchange" ? "bg-blue-500" : "bg-zinc-500"}`} />
        <span className="font-[family-name:var(--font-spacemono)] text-xs text-white">{node.address.slice(0, 10)}...{node.address.slice(-4)}</span>
        {node.label && <span className="text-xs px-1.5 py-0.5 rounded bg-white/10 text-zinc-400">{node.label}</span>}
        {node.value !== undefined && <span className="text-xs text-zinc-400">{node.value.toFixed(4)} ETH</span>}
      </div>
      {node.children?.map((child) => renderFlowNode(child, depth + 1))}
    </div>
  );

  return (
    <main className="min-h-screen text-white overflow-hidden relative font-[family-name:var(--font-nuqun)]">
      <Navbar />

      <section className="min-h-screen px-8 md:px-24 pt-32 pb-20">
        <div className="max-w-6xl mx-auto w-full">

          {/* ── Header ──────────────────────────────────────────────── */}
          <div className="mb-12">
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-[#4ADE80]/10 p-3 rounded-2xl">
                <ShieldAlert className="w-8 h-8 text-[#4ADE80]" />
              </div>
              <h1 className="text-5xl md:text-7xl font-medium tracking-wider leading-[0.9]">
                Wallet Analyzer
              </h1>
            </div>
            <p className="text-xl text-zinc-400 font-[family-name:var(--font-spacemono)] max-w-2xl mt-4">
              Paste any wallet address or ENS name. Get risk scoring, transaction graph,
              sanctions check, and deep ML analysis — all in seconds.
            </p>
          </div>

          {/* ── Search Bar + Chain Selector ──────────────────────────── */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            {/* Chain dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowHistory(false)}
                className="h-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 flex items-center gap-2 hover:bg-white/10 transition font-[family-name:var(--font-spacemono)] text-sm min-w-[160px]"
              >
                <select
                  value={selectedChain}
                  onChange={(e) => setSelectedChain(Number(e.target.value))}
                  className="bg-transparent outline-none cursor-pointer w-full appearance-none"
                >
                  {chains.map((c) => <option key={c.id} value={c.id} className="bg-zinc-900">{c.name}</option>)}
                </select>
                <ChevronDown className="w-4 h-4 text-zinc-400 shrink-0 pointer-events-none -ml-6" />
              </button>
            </div>

            {/* Input */}
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
              <input
                type="text"
                value={address}
                onChange={(e) => { setAddress(e.target.value); setValidationError(validateAddress(e.target.value)); }}
                onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                onFocus={() => setShowHistory(true)}
                onBlur={() => setTimeout(() => setShowHistory(false), 200)}
                placeholder="Wallet address (0x...) or ENS name (vitalik.eth)"
                className={`w-full bg-white/5 border rounded-xl pl-12 pr-4 py-4 focus:outline-none focus:border-[#4ADE80] transition-colors text-white font-[family-name:var(--font-spacemono)] text-sm ${validationError ? "border-red-400" : "border-white/10"}`}
              />
              {validationError && <p className="absolute -bottom-5 left-0 text-xs text-red-400 font-[family-name:var(--font-spacemono)]">{validationError}</p>}
              {showHistory && history.length > 0 && !address && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold px-3 pt-2 pb-1 font-[family-name:var(--font-spacemono)]">Recent Searches</p>
                  {history.map((h, i) => (
                    <button
                      key={i}
                      className="w-full text-left px-3 py-2 hover:bg-white/10 transition-colors flex items-center justify-between gap-2 border-t border-white/5"
                      onMouseDown={() => { setAddress(h.address); setSelectedChain(h.chain_id); setShowHistory(false); }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Clock size={12} className="text-zinc-500 shrink-0" />
                        <span className="text-xs font-[family-name:var(--font-spacemono)] truncate">{h.address}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-zinc-500">{h.chain_name}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${h.risk_score >= 75 ? "bg-red-400/20 text-red-400" :
                          h.risk_score >= 40 ? "bg-yellow-400/20 text-yellow-400" :
                            "bg-green-400/20 text-green-400"
                          }`}>{h.risk_score}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Scan button */}
            <button
              onClick={handleAnalyze}
              disabled={loading || !!validationError}
              className="bg-white text-black font-bold px-8 py-4 rounded-xl hover:bg-[#4ADE80] transition-colors flex items-center gap-2 font-[family-name:var(--font-spacemono)] disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
              Analyze
            </button>
          </div>

          {validationError && !loading && (
            <div className="mb-8 bg-red-400/10 border border-red-400/20 rounded-xl p-4 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
              <p className="text-red-400 font-[family-name:var(--font-spacemono)] text-sm">{validationError}</p>
            </div>
          )}

          {/* ── Loading State ───────────────────────────────────────── */}
          {loading && (
            <div className="text-center py-20">
              <Loader2 className="w-12 h-12 text-[#4ADE80] mx-auto mb-6 animate-spin" />
              <h3 className="text-2xl text-zinc-300 mb-4">Analyzing wallet...</h3>
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

          {/* ── Results ─────────────────────────────────────────────── */}
          {target && !loading && result && (
            <div className="space-y-6 animate-in fade-in duration-500">

              {/* Risk Score Card */}
              <div className={`p-8 rounded-2xl border ${getRiskBg(riskScore)}`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <h2 className="text-3xl font-bold flex items-center gap-3 mb-2">
                      Analysis Report
                      {result.sanctions?.is_sanctioned && (
                        <span className="text-xs font-[family-name:var(--font-spacemono)] px-2 py-1 rounded-lg border bg-red-400/10 text-red-400 border-red-400/20 flex items-center gap-1">
                          <Ban size={12} />SANCTIONED
                        </span>
                      )}
                    </h2>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-[family-name:var(--font-spacemono)] text-zinc-400">{target}</span>
                      <button onClick={copyAddress} className="text-zinc-400 hover:text-white transition-colors">
                        {copied ? <Check size={14} className="text-[#4ADE80]" /> : <Copy size={14} />}
                      </button>
                      {result.ens_name && (
                        <span className="text-xs px-2 py-0.5 rounded-lg bg-purple-400/10 text-purple-400 border border-purple-400/20 font-[family-name:var(--font-spacemono)]">{result.ens_name}</span>
                      )}
                      {result.chain && <span className="text-xs text-zinc-500 font-[family-name:var(--font-spacemono)]">on {result.chain.name}</span>}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className={`text-7xl font-bold font-[family-name:var(--font-spacemono)] ${getRiskColor(riskScore)}`}>
                      {riskScore}
                    </div>
                    <div className={`text-sm font-[family-name:var(--font-spacemono)] mt-1 ${getRiskColor(riskScore)}`}>
                      {riskLabel}
                    </div>
                  </div>
                </div>

                {/* Score breakdown bar */}
                <div className="mt-6">
                  <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-white/5">
                    <div className={`${riskBarColor} transition-all`} style={{ width: `${riskScore}%` }} />
                  </div>
                  <div className="flex gap-4 mt-3 font-[family-name:var(--font-spacemono)] text-xs text-zinc-400">
                    <span className="flex items-center gap-1"><Zap size={10} />ML: {result.ml_raw_score}</span>
                    <span className="flex items-center gap-1"><AlertTriangle size={10} />Heuristic: {result.heuristic_score}</span>
                    {result.gnn?.gnn_score !== undefined && (
                      <span className="flex items-center gap-1"><Brain size={10} />GNN: {result.gnn.gnn_score}</span>
                    )}
                    {result.temporal?.temporal_risk_score !== undefined && result.temporal.temporal_risk_score > 0 && (
                      <span className="flex items-center gap-1"><TrendingUp size={10} />Temporal: {result.temporal.temporal_risk_score}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 flex-wrap items-center">
                <button onClick={downloadPdf} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 hover:bg-white/10 transition font-[family-name:var(--font-spacemono)] text-sm">
                  <FileText size={14} />PDF Report
                </button>
                <button onClick={exportReport} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 hover:bg-white/10 transition font-[family-name:var(--font-spacemono)] text-sm">
                  <Download size={14} />Export JSON
                </button>
                <button onClick={shareReport} disabled={shareLoading}
                  className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 hover:bg-white/10 transition font-[family-name:var(--font-spacemono)] text-sm disabled:opacity-50"
                >
                  {shareLoading ? (
                    <><Loader2 size={14} className="animate-spin" />Generating...</>
                  ) : shareCopied ? (
                    <><Check size={14} className="text-[#4ADE80]" />Link Copied!</>
                  ) : (
                    <><Link2 size={14} />Share Report</>
                  )}
                </button>
                {shareUrl && (
                  <div className="flex items-center gap-2 bg-[#4ADE80]/10 border border-[#4ADE80]/20 rounded-xl px-3 py-2 text-xs font-[family-name:var(--font-spacemono)]">
                    <Link2 size={12} className="text-[#4ADE80] shrink-0" />
                    <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="text-[#4ADE80] hover:underline truncate max-w-[260px]">{shareUrl}</a>
                    <button onClick={() => { navigator.clipboard.writeText(shareUrl); setShareCopied(true); setTimeout(() => setShareCopied(false), 2000); }}
                      className="text-zinc-400 hover:text-white transition ml-1"
                    >
                      <Copy size={12} />
                    </button>
                  </div>
                )}
                <button onClick={handleVerify} disabled={onChainLoading}
                  className="flex items-center gap-2 bg-[#4ADE80] text-black font-bold rounded-xl px-5 py-2.5 hover:bg-[#22c55e] transition disabled:opacity-50 font-[family-name:var(--font-spacemono)] text-sm ml-auto"
                >
                  <Share2 size={14} />{onChainLoading ? "Loading..." : "Verify on Base"}
                </button>
              </div>

              {/* Sanctions Banner */}
              {result.sanctions?.is_sanctioned && (
                <div className="p-4 bg-red-400/10 border border-red-400/20 rounded-2xl flex items-start gap-3">
                  <Ban size={20} className="text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-red-400">OFAC Sanctioned Address</p>
                    <p className="text-sm text-red-400/80 font-[family-name:var(--font-spacemono)]">This address is on the U.S. Treasury OFAC SDN list. Interacting with it may violate U.S. law.</p>
                    {result.sanctions.lists.map((l, i) => (
                      <span key={i} className="inline-block text-xs bg-red-400/10 text-red-400 px-2 py-0.5 rounded mt-1 mr-1 font-[family-name:var(--font-spacemono)]">{l.list_name}: {l.label}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Counterparty Sanctions Summary */}
              {result.counterparty_sanctions && result.counterparty_sanctions.sanctioned_count > 0 && (
                <div className="p-3 bg-orange-400/10 border border-orange-400/20 rounded-xl text-sm font-[family-name:var(--font-spacemono)]">
                  <span className="font-bold text-orange-400">Warning:</span>{" "}
                  <span className="text-orange-400/80">
                    This wallet has transacted with {result.counterparty_sanctions.sanctioned_count} sanctioned address(es)
                    {result.counterparty_sanctions.mixer_count > 0 && ` and ${result.counterparty_sanctions.mixer_count} mixer(s)`}.
                  </span>
                </div>
              )}

              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                  { label: "Txns", value: result.tx_count, icon: Activity },
                  { label: "Internal", value: result.internal_tx_count, icon: ArrowDownLeft },
                  { label: "Tokens", value: result.token_transfers, icon: ArrowUpRight },
                  { label: "Neighbors", value: result.neighbors_analyzed, icon: Users },
                  ...(result.balance != null ? [{ label: result.chain?.native || "ETH", value: result.balance.toFixed(4), icon: Wallet }] : []),
                ].map((s) => (
                  <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl p-5">
                    <s.icon className="w-5 h-5 text-zinc-400 mb-2" />
                    <p className="text-xs text-zinc-400 font-[family-name:var(--font-spacemono)]">{s.label}</p>
                    <p className="text-2xl font-bold mt-1 font-[family-name:var(--font-spacemono)]">{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Tab Switcher */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-1.5 flex flex-wrap gap-1">
                {([
                  { key: "graph", label: "Graph", icon: Share2 },
                  { key: "timeline", label: "Timeline", icon: Activity },
                  { key: "counterparties", label: "Counterparties", icon: Users },
                  { key: "fundflow", label: "Fund Flow", icon: GitBranch },
                  { key: "crosschain", label: "Cross-Chain", icon: Globe },
                  { key: "tokens", label: "Tokens", icon: Wallet },
                  { key: "similar", label: "Similar", icon: Fingerprint },
                  { key: "gnn", label: "GNN", icon: Brain },
                  { key: "temporal", label: "Temporal", icon: TrendingUp },
                  { key: "mev", label: "MEV", icon: Bot },
                  { key: "bridges", label: "Bridges", icon: Layers },
                  { key: "community", label: "Reports", icon: Flag },
                ]).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => {
                      setActiveTab(tab.key);
                      if (tab.key === "fundflow") loadFundFlow();
                      if (tab.key === "crosschain") loadCrossChain();
                      if (tab.key === "tokens") loadTokens();
                      if (tab.key === "similar") loadSimilar();
                      if (tab.key === "community") loadCommunity();
                    }}
                    className={`px-3 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 font-[family-name:var(--font-spacemono)] ${activeTab === tab.key ? "bg-[#4ADE80] text-black" : "text-zinc-400 hover:text-white hover:bg-white/5"
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
                <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                  {result.top_counterparties?.length > 0 ? (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10">
                          {["Address", "Label", "Txns", "Sent", "Received", "Total"].map((h) => (
                            <th key={h} className={`${h === "Address" || h === "Label" ? "text-left" : "text-right"} px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider font-[family-name:var(--font-spacemono)]`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.top_counterparties.map((cp, i) => (
                          <tr key={i} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                            <td className="px-4 py-3 font-[family-name:var(--font-spacemono)] text-xs">{cp.address.slice(0, 10)}...{cp.address.slice(-6)}</td>
                            <td className="px-4 py-3">
                              {cp.label ? (
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${cp.category === "exchange" ? "bg-blue-400/10 border-blue-400/20 text-blue-400" :
                                  cp.category === "dex" ? "bg-purple-400/10 border-purple-400/20 text-purple-400" :
                                    cp.category === "defi" ? "bg-green-400/10 border-green-400/20 text-green-400" :
                                      cp.category === "mixer" ? "bg-red-400/10 border-red-400/20 text-red-400" :
                                        "bg-white/5 border-white/10 text-zinc-400"
                                  }`}>{cp.label}</span>
                              ) : <span className="text-xs text-zinc-500">Unknown</span>}
                            </td>
                            <td className="px-4 py-3 text-right font-[family-name:var(--font-spacemono)] text-xs">{cp.tx_count}</td>
                            <td className="px-4 py-3 text-right font-[family-name:var(--font-spacemono)] text-xs text-zinc-400">{cp.sent.toFixed(4)}</td>
                            <td className="px-4 py-3 text-right font-[family-name:var(--font-spacemono)] text-xs text-zinc-400">{cp.received.toFixed(4)}</td>
                            <td className="px-4 py-3 text-right font-[family-name:var(--font-spacemono)] text-xs font-bold">{cp.total_value.toFixed(4)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : <div className="p-8 text-center text-zinc-500 text-sm font-[family-name:var(--font-spacemono)]">No counterparty data available</div>}
                </div>
              )}

              {activeTab === "fundflow" && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><GitBranch size={16} className="text-[#4ADE80]" />Fund Flow Trace (3 hops)</h3>
                  {fundFlowLoading ? (
                    <div className="flex items-center gap-2 text-sm text-zinc-400 font-[family-name:var(--font-spacemono)]"><Loader2 size={14} className="animate-spin" />Tracing fund flow...</div>
                  ) : fundFlow?.tree ? (
                    <>
                      <div className="flex gap-4 mb-3 text-xs text-zinc-400 font-[family-name:var(--font-spacemono)]">
                        <span>Nodes: <strong className="text-white">{fundFlow.summary?.total_nodes}</strong></span>
                        <span>Unique: <strong className="text-white">{fundFlow.summary?.unique_addresses}</strong></span>
                        <span>Value: <strong className="text-white">{fundFlow.summary?.total_value_traced?.toFixed(4)} ETH</strong></span>
                      </div>
                      <div className="max-h-96 overflow-y-auto" data-lenis-prevent>{renderFlowNode(fundFlow.tree)}</div>
                    </>
                  ) : <div className="text-sm text-zinc-500 font-[family-name:var(--font-spacemono)]">No fund flow data available</div>}
                </div>
              )}

              {activeTab === "crosschain" && (
                <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2">
                    <Globe size={16} className="text-[#4ADE80]" /><h3 className="font-bold text-sm">Cross-Chain Activity</h3>
                    {crossChainData && <span className="text-xs text-zinc-500 font-[family-name:var(--font-spacemono)]">Active on {crossChainData.total_chains_active} chain(s)</span>}
                  </div>
                  {crossChainLoading ? (
                    <div className="p-8 flex items-center justify-center gap-2 text-sm text-zinc-400 font-[family-name:var(--font-spacemono)]"><Loader2 size={14} className="animate-spin" />Scanning 14 chains...</div>
                  ) : crossChainData?.active_chains?.length > 0 ? (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10">
                          {["Chain", "Txns", "Balance", "Sent", "Received"].map((h) => (
                            <th key={h} className={`${h === "Chain" ? "text-left" : "text-right"} px-4 py-2 text-xs font-bold text-zinc-500 uppercase font-[family-name:var(--font-spacemono)]`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {crossChainData.active_chains.map((ch: CrossChainEntry, i: number) => (
                          <tr key={i} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                            <td className="px-4 py-3 text-xs font-medium">{ch.chain_name}</td>
                            <td className="px-4 py-3 text-right font-[family-name:var(--font-spacemono)] text-xs">{ch.tx_count}</td>
                            <td className="px-4 py-3 text-right font-[family-name:var(--font-spacemono)] text-xs">{ch.balance?.toFixed(4)} {ch.native}</td>
                            <td className="px-4 py-3 text-right font-[family-name:var(--font-spacemono)] text-xs text-zinc-400">{ch.total_sent?.toFixed(4)}</td>
                            <td className="px-4 py-3 text-right font-[family-name:var(--font-spacemono)] text-xs text-zinc-400">{ch.total_received?.toFixed(4)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : <div className="p-8 text-center text-zinc-500 text-sm font-[family-name:var(--font-spacemono)]">No cross-chain activity found</div>}
                </div>
              )}

              {activeTab === "tokens" && (
                <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2">
                    <Wallet size={16} className="text-[#4ADE80]" /><h3 className="font-bold text-sm">Token Portfolio</h3>
                    {tokenData?.summary && <span className="text-xs text-zinc-500 font-[family-name:var(--font-spacemono)]">{tokenData.summary.total_tokens} tokens, {tokenData.summary.total_transfers} transfers</span>}
                  </div>
                  {tokenLoading ? (
                    <div className="p-8 flex items-center justify-center gap-2 text-sm text-zinc-400 font-[family-name:var(--font-spacemono)]"><Loader2 size={14} className="animate-spin" />Loading tokens...</div>
                  ) : tokenData?.tokens?.length > 0 ? (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10">
                          {["Token", "Transfers In", "Transfers Out", "Vol In", "Vol Out", "Flags"].map((h) => (
                            <th key={h} className={`${h === "Token" || h === "Flags" ? "text-left" : "text-right"} px-4 py-2 text-xs font-bold text-zinc-500 uppercase font-[family-name:var(--font-spacemono)]`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tokenData.tokens.slice(0, 20).map((t: TokenEntry, i: number) => (
                          <tr key={i} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                            <td className="px-4 py-3">
                              <span className="text-xs font-bold">{t.symbol}</span>
                              <span className="text-[10px] text-zinc-500 ml-1">{t.name.slice(0, 20)}</span>
                            </td>
                            <td className="px-4 py-3 text-right font-[family-name:var(--font-spacemono)] text-xs">{t.transfers_in}</td>
                            <td className="px-4 py-3 text-right font-[family-name:var(--font-spacemono)] text-xs">{t.transfers_out}</td>
                            <td className="px-4 py-3 text-right font-[family-name:var(--font-spacemono)] text-xs text-zinc-400">{t.volume_in?.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right font-[family-name:var(--font-spacemono)] text-xs text-zinc-400">{t.volume_out?.toFixed(2)}</td>
                            <td className="px-4 py-3">
                              {t.flags?.map((f, j) => (
                                <span key={j} className="text-[10px] px-1.5 py-0.5 rounded bg-red-400/10 text-red-400 border border-red-400/20 mr-1">{f.replace(/_/g, " ")}</span>
                              ))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : <div className="p-8 text-center text-zinc-500 text-sm font-[family-name:var(--font-spacemono)]">No token data available</div>}
                </div>
              )}

              {activeTab === "similar" && (
                <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2">
                    <Fingerprint size={16} className="text-[#4ADE80]" /><h3 className="font-bold text-sm">Similar Wallets</h3>
                    {similarData && <span className="text-xs text-zinc-500 font-[family-name:var(--font-spacemono)]">{similarData.candidates_checked} candidates checked</span>}
                  </div>
                  {similarLoading ? (
                    <div className="p-8 flex items-center justify-center gap-2 text-sm text-zinc-400 font-[family-name:var(--font-spacemono)]"><Loader2 size={14} className="animate-spin" />Finding similar wallets...</div>
                  ) : similarData?.similar?.length > 0 ? (
                    <div className="divide-y divide-white/5">
                      {similarData.similar.map((s: any, i: number) => (
                        <div key={i} className="px-5 py-3 flex items-center justify-between hover:bg-white/5 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="text-lg font-bold text-zinc-500 w-6">#{i + 1}</div>
                            <div>
                              <p className="font-[family-name:var(--font-spacemono)] text-xs">{s.address.slice(0, 14)}...{s.address.slice(-6)}</p>
                              {s.label && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-zinc-400">{s.label}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-xs text-zinc-500 font-[family-name:var(--font-spacemono)]">Similarity</p>
                              <p className="font-[family-name:var(--font-spacemono)] font-bold text-sm">{(s.similarity * 100).toFixed(1)}%</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-zinc-500 font-[family-name:var(--font-spacemono)]">Txns</p>
                              <p className="font-[family-name:var(--font-spacemono)] text-sm">{s.tx_count}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : <div className="p-8 text-center text-zinc-500 text-sm font-[family-name:var(--font-spacemono)]">No similar wallets found</div>}
                </div>
              )}

              {/* GNN Tab */}
              {activeTab === "gnn" && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <h3 className="font-bold text-sm mb-4 flex items-center gap-2"><Brain size={16} className="text-[#4ADE80]" />Graph Neural Network Analysis</h3>
                  {result.gnn && result.gnn.gnn_score !== undefined ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                          <p className="text-[10px] text-zinc-500 uppercase font-[family-name:var(--font-spacemono)]">GNN Score</p>
                          <p className={`text-2xl font-[family-name:var(--font-spacemono)] font-bold ${result.gnn.gnn_score >= 60 ? "text-red-400" : result.gnn.gnn_score >= 30 ? "text-yellow-400" : "text-green-400"}`}>{result.gnn.gnn_score}<span className="text-sm text-zinc-500">/100</span></p>
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                          <p className="text-[10px] text-zinc-500 uppercase font-[family-name:var(--font-spacemono)]">Mahalanobis Dist</p>
                          <p className="text-lg font-[family-name:var(--font-spacemono)] font-bold">{result.gnn.mahalanobis_distance}</p>
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                          <p className="text-[10px] text-zinc-500 uppercase font-[family-name:var(--font-spacemono)]">Cosine Anomaly</p>
                          <p className="text-lg font-[family-name:var(--font-spacemono)] font-bold">{result.gnn.cosine_anomaly}</p>
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                          <p className="text-[10px] text-zinc-500 uppercase font-[family-name:var(--font-spacemono)]">Degree Ratio</p>
                          <p className="text-lg font-[family-name:var(--font-spacemono)] font-bold">{result.gnn.degree_ratio}</p>
                        </div>
                      </div>
                      {result.gnn.graph_stats && (
                        <div className="text-xs text-zinc-400 flex gap-4 flex-wrap font-[family-name:var(--font-spacemono)]">
                          <span>Graph Nodes: <strong className="text-white">{result.gnn.graph_stats.n_nodes}</strong></span>
                          <span>Edges: <strong className="text-white">{result.gnn.graph_stats.n_edges}</strong></span>
                          <span>Avg Degree: <strong className="text-white">{result.gnn.graph_stats.avg_degree}</strong></span>
                          <span>Target Degree: <strong className="text-white">{result.gnn.graph_stats.target_degree}</strong></span>
                        </div>
                      )}
                      <p className="text-xs text-zinc-500 font-[family-name:var(--font-spacemono)]">The GNN propagates features through the transaction graph via 2-layer Graph Convolution, then measures how the target node&apos;s embedding deviates from the graph-level distribution.</p>
                    </div>
                  ) : <div className="text-sm text-zinc-500 font-[family-name:var(--font-spacemono)]">GNN analysis not available for this wallet</div>}
                </div>
              )}

              {/* Temporal Tab */}
              {activeTab === "temporal" && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <h3 className="font-bold text-sm mb-4 flex items-center gap-2"><TrendingUp size={16} className="text-[#4ADE80]" />Temporal Anomaly Detection</h3>
                  {result.temporal && result.temporal.temporal_risk_score !== undefined ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                          <p className="text-[10px] text-zinc-500 uppercase font-[family-name:var(--font-spacemono)]">Temporal Risk</p>
                          <p className={`text-2xl font-[family-name:var(--font-spacemono)] font-bold ${result.temporal.temporal_risk_score >= 60 ? "text-red-400" : result.temporal.temporal_risk_score >= 30 ? "text-yellow-400" : "text-green-400"}`}>{result.temporal.temporal_risk_score}<span className="text-sm text-zinc-500">/100</span></p>
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                          <p className="text-[10px] text-zinc-500 uppercase font-[family-name:var(--font-spacemono)]">Days Analyzed</p>
                          <p className="text-lg font-[family-name:var(--font-spacemono)] font-bold">{result.temporal.days_analyzed}</p>
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                          <p className="text-[10px] text-zinc-500 uppercase font-[family-name:var(--font-spacemono)]">Spikes Detected</p>
                          <p className="text-lg font-[family-name:var(--font-spacemono)] font-bold">{result.temporal.zscore_anomalies?.length || 0}</p>
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                          <p className="text-[10px] text-zinc-500 uppercase font-[family-name:var(--font-spacemono)]">Regime Shifts</p>
                          <p className="text-lg font-[family-name:var(--font-spacemono)] font-bold">{result.temporal.regime_shifts?.length || 0}</p>
                        </div>
                      </div>
                      {result.temporal.burst_analysis && (
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                          <p className="text-xs font-bold mb-2">Burst Analysis</p>
                          <div className="flex gap-4 text-xs text-zinc-400 font-[family-name:var(--font-spacemono)]">
                            <span>Bursts: <strong className="text-white">{result.temporal.burst_analysis.burst_count}</strong></span>
                            <span>Longest streak: <strong className="text-white">{result.temporal.burst_analysis.longest_burst} txns</strong></span>
                            <span>Burst %: <strong className="text-white">{result.temporal.burst_analysis.burst_pct}%</strong></span>
                            <span>Avg gap: <strong className="text-white">{result.temporal.burst_analysis.avg_burst_gap_sec}s</strong></span>
                          </div>
                        </div>
                      )}
                      {result.temporal.zscore_anomalies?.length > 0 && (
                        <div>
                          <p className="text-xs font-bold mb-2">Activity Spikes</p>
                          <div className="flex flex-wrap gap-2">
                            {result.temporal.zscore_anomalies.slice(0, 8).map((a, i) => (
                              <span key={i} className={`text-[10px] px-2 py-1 rounded-lg border font-[family-name:var(--font-spacemono)] ${a.type === "spike" ? "bg-red-400/10 border-red-400/20 text-red-400" : "bg-blue-400/10 border-blue-400/20 text-blue-400"}`}>
                                {a.date} ({a.type}) z={a.z_score}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : <div className="text-sm text-zinc-500 font-[family-name:var(--font-spacemono)]">Temporal analysis not available</div>}
                </div>
              )}

              {/* MEV Tab */}
              {activeTab === "mev" && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <h3 className="font-bold text-sm mb-4 flex items-center gap-2"><Bot size={16} className="text-[#4ADE80]" />MEV Bot Detection</h3>
                  {result.mev && result.mev.mev_risk_score !== undefined ? (
                    <div className="space-y-4">
                      {result.mev.is_mev_bot && (
                        <div className="p-3 bg-red-400/10 border border-red-400/20 rounded-xl text-sm font-bold text-red-400 flex items-center gap-2">
                          <Bot size={16} />This address exhibits MEV bot behavior
                        </div>
                      )}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                          <p className="text-[10px] text-zinc-500 uppercase font-[family-name:var(--font-spacemono)]">MEV Risk</p>
                          <p className={`text-2xl font-[family-name:var(--font-spacemono)] font-bold ${result.mev.mev_risk_score >= 60 ? "text-red-400" : result.mev.mev_risk_score >= 30 ? "text-yellow-400" : "text-green-400"}`}>{result.mev.mev_risk_score}<span className="text-sm text-zinc-500">/100</span></p>
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                          <p className="text-[10px] text-zinc-500 uppercase font-[family-name:var(--font-spacemono)]">Sandwiches</p>
                          <p className="text-lg font-[family-name:var(--font-spacemono)] font-bold">{result.mev.sandwiches?.length || 0}</p>
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                          <p className="text-[10px] text-zinc-500 uppercase font-[family-name:var(--font-spacemono)]">Front-runs</p>
                          <p className="text-lg font-[family-name:var(--font-spacemono)] font-bold">{result.mev.frontrunning?.length || 0}</p>
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                          <p className="text-[10px] text-zinc-500 uppercase font-[family-name:var(--font-spacemono)]">DEX Ratio</p>
                          <p className="text-lg font-[family-name:var(--font-spacemono)] font-bold">{((result.mev.dex_pattern?.dex_ratio || 0) * 100).toFixed(0)}%</p>
                        </div>
                      </div>
                      {result.mev.gas_analysis && (
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                          <p className="text-xs font-bold mb-2">Gas Analysis</p>
                          <div className="flex gap-4 text-xs text-zinc-400 flex-wrap font-[family-name:var(--font-spacemono)]">
                            <span>Mean: <strong className="text-white">{result.mev.gas_analysis.mean_gas_gwei} Gwei</strong></span>
                            <span>Max: <strong className="text-white">{result.mev.gas_analysis.max_gas_gwei} Gwei</strong></span>
                            <span>CV: <strong className="text-white">{result.mev.gas_analysis.gas_cv}</strong></span>
                            {result.mev.gas_analysis.is_gas_outlier && <span className="text-red-400 font-bold">Gas Outlier</span>}
                          </div>
                        </div>
                      )}
                      {result.mev.mev_flags?.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {result.mev.mev_flags.map((f, i) => (
                            <span key={i} className="text-[10px] px-2 py-1 rounded-lg bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 flex items-center gap-1 font-[family-name:var(--font-spacemono)]"><AlertTriangle size={10} />{f}</span>
                          ))}
                        </div>
                      )}
                      {result.mev.known_bots?.length > 0 && (
                        <div>
                          <p className="text-xs font-bold mb-2">Known Bot Interactions</p>
                          {result.mev.known_bots.map((b, i) => (
                            <div key={i} className="text-xs text-zinc-400 py-1 font-[family-name:var(--font-spacemono)]">
                              <span>{b.address.slice(0, 10)}...</span> → <span className="font-medium text-white">{b.label}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : <div className="text-sm text-zinc-500 font-[family-name:var(--font-spacemono)]">MEV analysis not available</div>}
                </div>
              )}

              {/* Bridges Tab */}
              {activeTab === "bridges" && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <h3 className="font-bold text-sm mb-4 flex items-center gap-2"><Layers size={16} className="text-[#4ADE80]" />Bridge Protocol Tracking</h3>
                  {result.bridges && result.bridges.bridge_risk_score !== undefined ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                          <p className="text-[10px] text-zinc-500 uppercase font-[family-name:var(--font-spacemono)]">Bridge Risk</p>
                          <p className={`text-2xl font-[family-name:var(--font-spacemono)] font-bold ${result.bridges.bridge_risk_score >= 60 ? "text-red-400" : result.bridges.bridge_risk_score >= 30 ? "text-yellow-400" : "text-green-400"}`}>{result.bridges.bridge_risk_score}<span className="text-sm text-zinc-500">/100</span></p>
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                          <p className="text-[10px] text-zinc-500 uppercase font-[family-name:var(--font-spacemono)]">Bridge Txns</p>
                          <p className="text-lg font-[family-name:var(--font-spacemono)] font-bold">{result.bridges.total_bridge_txns}</p>
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                          <p className="text-[10px] text-zinc-500 uppercase font-[family-name:var(--font-spacemono)]">Volume Bridged</p>
                          <p className="text-lg font-[family-name:var(--font-spacemono)] font-bold">{result.bridges.total_bridge_volume} ETH</p>
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                          <p className="text-[10px] text-zinc-500 uppercase font-[family-name:var(--font-spacemono)]">Protocols</p>
                          <p className="text-lg font-[family-name:var(--font-spacemono)] font-bold">{result.bridges.bridges_used?.length || 0}</p>
                        </div>
                      </div>
                      {result.bridges.bridges_used?.length > 0 && (
                        <div>
                          <p className="text-xs font-bold mb-2">Bridges Used</p>
                          <div className="space-y-2">
                            {result.bridges.bridges_used.map((b, i) => (
                              <div key={i} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl p-4">
                                <div>
                                  <span className="text-sm font-bold">{b.protocol}</span>
                                  <span className="text-xs text-zinc-500 ml-2 font-[family-name:var(--font-spacemono)]">{b.directions.join(", ")}</span>
                                </div>
                                <div className="flex gap-4 text-xs text-zinc-400 font-[family-name:var(--font-spacemono)]">
                                  <span>Txns: <strong className="text-white">{b.txn_count}</strong></span>
                                  <span>Vol: <strong className="text-white">{b.volume_eth} ETH</strong></span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {result.bridges.bridge_flags?.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {result.bridges.bridge_flags.map((f, i) => (
                            <span key={i} className="text-[10px] px-2 py-1 rounded-lg bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 flex items-center gap-1 font-[family-name:var(--font-spacemono)]"><AlertTriangle size={10} />{f}</span>
                          ))}
                        </div>
                      )}
                      {result.bridges.bridges_used?.length === 0 && <div className="text-sm text-zinc-500 font-[family-name:var(--font-spacemono)]">No bridge interactions detected</div>}
                    </div>
                  ) : <div className="text-sm text-zinc-500 font-[family-name:var(--font-spacemono)]">Bridge analysis not available</div>}
                </div>
              )}

              {/* Community Reports Tab */}
              {activeTab === "community" && (
                <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2">
                    <Flag size={16} className="text-[#4ADE80]" /><h3 className="font-bold text-sm">Community Reports</h3>
                    {communityData && <span className="text-xs text-zinc-500 font-[family-name:var(--font-spacemono)]">{communityData.total_reports} report(s)</span>}
                    {result.community_risk_modifier > 0 && <span className="text-xs text-red-400 font-bold ml-2 font-[family-name:var(--font-spacemono)]">+{result.community_risk_modifier} risk modifier</span>}
                  </div>
                  <div className="p-4 space-y-4">
                    {/* Submit Report Form */}
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                      <p className="text-xs font-bold mb-3 flex items-center gap-1"><MessageSquare size={12} className="text-[#4ADE80]" />Submit a Report</p>
                      <div className="flex gap-2 mb-2">
                        <select value={reportCategory} onChange={(e) => setReportCategory(e.target.value)}
                          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-[#4ADE80] font-[family-name:var(--font-spacemono)] text-white">
                          {["scam", "phishing", "rug_pull", "honeypot", "impersonation", "wash_trading", "drainer", "fake_token", "ponzi", "other"].map((c) => (
                            <option key={c} value={c} className="bg-zinc-900">{c.replace(/_/g, " ")}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <input type="text" value={reportDescription} onChange={(e) => setReportDescription(e.target.value)}
                          placeholder="Describe the issue (optional)..."
                          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-[#4ADE80] placeholder:text-zinc-500 font-[family-name:var(--font-spacemono)] text-white" />
                        <button onClick={submitCommunityReport} disabled={reportSubmitting}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#4ADE80] text-black rounded-lg text-xs font-bold hover:bg-[#22c55e] disabled:opacity-40 transition font-[family-name:var(--font-spacemono)]">
                          {reportSubmitting ? <Loader2 size={12} className="animate-spin" /> : <SendHorizontal size={12} />}Submit
                        </button>
                      </div>
                    </div>

                    {/* Existing Reports */}
                    {communityLoading ? (
                      <div className="p-4 flex items-center gap-2 text-sm text-zinc-400 font-[family-name:var(--font-spacemono)]"><Loader2 size={14} className="animate-spin" />Loading reports...</div>
                    ) : communityData?.reports?.length > 0 ? (
                      <div className="space-y-2">
                        {communityData.reports.map((r: CommunityReport) => (
                          <div key={r.id} className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border font-[family-name:var(--font-spacemono)] ${r.status === "confirmed" ? "bg-red-400/10 border-red-400/20 text-red-400" :
                                  r.status === "dismissed" ? "bg-white/5 border-white/10 text-zinc-500" :
                                    "bg-yellow-400/10 border-yellow-400/20 text-yellow-400"
                                  }`}>{r.category.replace(/_/g, " ")}</span>
                                <span className="text-[10px] text-zinc-500 font-[family-name:var(--font-spacemono)]">{r.date}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium font-[family-name:var(--font-spacemono)] ${r.status === "confirmed" ? "bg-red-400/10 text-red-400" :
                                  r.status === "dismissed" ? "bg-white/5 text-zinc-500" :
                                    "bg-yellow-400/10 text-yellow-400"
                                  }`}>{r.status}</span>
                              </div>
                              {r.description && <p className="text-xs text-zinc-400 mt-1 truncate font-[family-name:var(--font-spacemono)]">{r.description}</p>}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button onClick={() => voteReport(r.id, "up")} className="p-1 hover:bg-green-400/10 rounded transition-colors" title="Upvote">
                                <ThumbsUp size={12} className="text-green-400" />
                              </button>
                              <span className="text-xs font-[family-name:var(--font-spacemono)] min-w-[24px] text-center">{(r.upvotes || 0) - (r.downvotes || 0)}</span>
                              <button onClick={() => voteReport(r.id, "down")} className="p-1 hover:bg-red-400/10 rounded transition-colors" title="Downvote">
                                <ThumbsDown size={12} className="text-red-400" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : <div className="text-sm text-zinc-500 text-center py-4 font-[family-name:var(--font-spacemono)]">No community reports yet for this address</div>}
                  </div>
                </div>
              )}

              {/* Analysis Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">

                {/* Risk Score Card */}
                <div className="p-6 bg-white/5 border border-white/10 rounded-2xl">
                  <div className="flex items-center gap-3 mb-2">
                    <ShieldAlert size={24} className="text-[#4ADE80]" />
                    <h3 className="font-bold text-lg">{riskLabel || "Analyzing..."}</h3>
                  </div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold font-[family-name:var(--font-spacemono)]">Combined Risk Score</p>
                  <p className="text-5xl font-[family-name:var(--font-spacemono)] mt-2 font-bold tracking-tighter">
                    {riskScore}<span className="text-xl text-zinc-500">/100</span>
                  </p>
                  <div className="mt-3 w-full bg-white/10 rounded-full h-2 overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-1000 ease-out ${riskBarColor}`} style={{ width: `${riskScore}%` }} />
                  </div>
                  <div className="mt-3 flex gap-4 text-xs text-zinc-400 font-[family-name:var(--font-spacemono)]">
                    <div className="flex items-center gap-1"><Zap size={10} /><span>ML: <strong className="text-white">{result.ml_raw_score}</strong></span></div>
                    <div className="flex items-center gap-1"><AlertTriangle size={10} /><span>Heuristic: <strong className="text-white">{result.heuristic_score}</strong></span></div>
                    {result.gnn?.gnn_score !== undefined && (
                      <div className="flex items-center gap-1"><Brain size={10} /><span>GNN: <strong className="text-white">{result.gnn.gnn_score}</strong></span></div>
                    )}
                  </div>
                  {result.temporal?.temporal_risk_score !== undefined && result.temporal.temporal_risk_score > 0 && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-zinc-400 font-[family-name:var(--font-spacemono)]">
                      <TrendingUp size={10} />Temporal: <strong className="text-white">{result.temporal.temporal_risk_score}</strong>
                      {result.mev?.mev_risk_score !== undefined && result.mev.mev_risk_score > 0 && (
                        <span className="ml-2 flex items-center gap-1"><Bot size={10} />MEV: <strong className="text-white">{result.mev.mev_risk_score}</strong></span>
                      )}
                    </div>
                  )}
                  {result.sanctions?.risk_modifier > 0 && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-red-400">
                      <Ban size={10} />Sanctions modifier: +{result.sanctions.risk_modifier}
                    </div>
                  )}
                  {result.mixer_interactions?.length > 0 && (
                    <div className="mt-3 px-2 py-1.5 bg-red-400/10 border border-red-400/20 rounded-lg">
                      <p className="text-[10px] text-red-400 font-bold uppercase font-[family-name:var(--font-spacemono)]">Mixer Detected</p>
                      {result.mixer_interactions.map((m, i) => <p key={i} className="text-xs text-red-400 font-[family-name:var(--font-spacemono)]">{m}</p>)}
                    </div>
                  )}
                </div>

                {/* Flags Card */}
                <div className="p-6 bg-white/5 border border-white/10 rounded-2xl col-span-2">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle size={20} className="text-[#4ADE80]" />
                    <h3 className="font-bold text-lg">AI Pattern Analysis</h3>
                  </div>
                  <p className="text-sm leading-relaxed mb-3 text-zinc-400 font-[family-name:var(--font-spacemono)]">
                    Wallet <span className="font-[family-name:var(--font-spacemono)] bg-white/10 px-1 rounded text-white">{target.slice(0, 8)}...</span>{" "}
                    {riskScore >= 75 ? <>has been flagged as <strong className="text-white">high risk</strong> with a score of <strong>{riskScore}/100</strong>.</> :
                      riskScore >= 40 ? <>shows <strong className="text-white">moderate</strong> anomaly signals with a score of <strong>{riskScore}/100</strong>.</> :
                        <>appears <strong className="text-white">normal</strong> with a low score of <strong>{riskScore}/100</strong>.</>}
                  </p>
                  {result.flags?.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-2 font-[family-name:var(--font-spacemono)]">Risk Flags</p>
                      <div className="flex flex-wrap gap-2">
                        {result.flags.map((flag, i) => (
                          <span key={i} className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium font-[family-name:var(--font-spacemono)] ${flag.toLowerCase().includes("sanctioned") ? "border-red-400/20 bg-red-400/10 text-red-400" :
                            flag.toLowerCase().includes("mixer") ? "border-red-400/20 bg-red-400/10 text-red-400" :
                              "border-white/10 bg-white/5 text-zinc-400"
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
                  <button onClick={() => setShowFeatures(!showFeatures)} className="flex items-center gap-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider hover:text-white transition-colors font-[family-name:var(--font-spacemono)]">
                    <ChevronDown size={14} className={`transition-transform ${showFeatures ? "rotate-180" : ""}`} />
                    Feature Details ({Object.keys(result.feature_summary).length} features)
                  </button>
                  {showFeatures && (
                    <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                      {Object.entries(result.feature_summary).map(([key, val]) => (
                        <div key={key} className="bg-white/5 rounded-xl p-2 border border-white/10">
                          <p className="text-[10px] text-zinc-500 uppercase truncate font-[family-name:var(--font-spacemono)]">{key.replace(/_/g, " ")}</p>
                          <p className="text-sm font-[family-name:var(--font-spacemono)] font-bold">{typeof val === "number" ? val.toFixed(4) : val}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
          )}
        </div>
      </section>
    </main>
  );
}