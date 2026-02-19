"use client";
import { useState, useEffect, use } from "react";
import Navbar from "@/components/Navbar";
import Graph from "../../components/Graph";
import Timeline from "../../components/Timeline";
import {
  ShieldAlert, Activity, AlertTriangle, Zap, Copy, Check, Clock,
  Users, Wallet, ArrowUpRight, ArrowDownLeft, Loader2, ExternalLink,
  Globe, Ban, Brain, TrendingUp, Eye, Share2, Link2, Flag,
  BarChart3, Layers, GitBranch, Bot,
} from "lucide-react";

/* ───────────── Types (mirrors analyze page) ───────────── */

type Chain = { id: number; name: string; short: string; explorer: string; native: string };

type Counterparty = {
  address: string; label: string | null; category: string | null;
  total_value: number; tx_count: number; sent: number; received: number;
};

type TimelineEntry = { date: string; tx_count: number; volume: number; in_count: number; out_count: number };

type SanctionsResult = {
  is_sanctioned: boolean; is_mixer: boolean; is_scam: boolean;
  lists: { list_name: string; label: string }[]; risk_modifier: number;
  known_label: string | null; known_category: string | null;
};

type CounterpartySanctions = {
  total_checked: number; sanctioned_count: number; mixer_count: number; scam_count: number;
  sanctioned_addresses: { address: string; label: string }[];
  mixer_addresses: { address: string; label: string }[];
  scam_addresses: { address: string; label: string }[];
  risk_level: string;
};

type GnnResult = {
  gnn_score: number; gnn_embedding: number[]; mahalanobis_distance: number;
  cosine_anomaly: number; degree_ratio: number;
  graph_stats: { n_nodes: number; n_edges: number; avg_degree: number; target_degree: number };
};

type TemporalAnomaly = { date: string; z_score?: number; value?: number; type?: string; direction?: string };

type TemporalResult = {
  temporal_risk_score: number; zscore_anomalies: TemporalAnomaly[];
  volume_anomalies: TemporalAnomaly[]; changepoints_txcount: TemporalAnomaly[];
  regime_shifts: TemporalAnomaly[];
  burst_analysis: { burst_count: number; longest_burst: number; avg_burst_gap_sec: number; burst_pct: number };
  days_analyzed: number;
};

type MevResult = {
  is_mev_bot: boolean; mev_risk_score: number; sandwiches: any[];
  frontrunning: any[]; gas_analysis: Record<string, any>;
  dex_pattern: Record<string, any>; known_bots: { address: string; label: string }[];
  arb_analysis: Record<string, any>; mev_flags: string[];
};

type BridgeUsed = { protocol: string; txn_count: number; volume_eth: number; contracts: string[]; directions: string[] };

type BridgeResult = {
  bridges_used: BridgeUsed[]; total_bridge_txns: number; total_bridge_volume: number;
  bridge_risk_score: number; bridge_flags: string[]; bridge_timeline: any[];
};

type AnalysisResult = {
  address: string; ens_name: string | null; risk_score: number; risk_label: string;
  ml_raw_score: number; heuristic_score: number; flags: string[];
  feature_summary: Record<string, number>; neighbors_analyzed: number;
  tx_count: number; internal_tx_count: number; token_transfers: number;
  balance: number | null; top_counterparties: Counterparty[];
  timeline: TimelineEntry[]; mixer_interactions: string[];
  sanctions: SanctionsResult; counterparty_sanctions: CounterpartySanctions;
  chain: Chain; graph: { nodes: any[]; links: any[] };
  gnn: GnnResult | null; temporal: TemporalResult | null;
  mev: MevResult | null; bridges: BridgeResult | null;
  community_risk_modifier: number; on_chain: Record<string, any>;
};

type SharedReportData = {
  report_id: string; address: string; chain_id: number; chain_name: string;
  risk_score: number; risk_label: string; created_at: string | null;
  views: number; data: AnalysisResult;
};

/* ───────────── Helpers ───────────── */

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

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

/* ───────────── Component ───────────── */

export default function SharedReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [report, setReport] = useState<SharedReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("overview");

  useEffect(() => {
    if (!id) return;
    fetch(`http://127.0.0.1:8000/shared/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setReport(data);
        }
      })
      .catch(() => setError("Failed to load report"))
      .finally(() => setLoading(false));
  }, [id]);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
  };

  if (loading) {
    return (
      <main className="min-h-screen text-white font-[family-name:var(--font-nuqun)]">
        <Navbar />
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#4ADE80]" />
          <p className="text-zinc-400 font-[family-name:var(--font-spacemono)]">Loading shared report...</p>
        </div>
      </main>
    );
  }

  if (error || !report) {
    return (
      <main className="min-h-screen text-white font-[family-name:var(--font-nuqun)]">
        <Navbar />
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
          <ShieldAlert className="w-12 h-12 text-red-400" />
          <h2 className="text-2xl font-bold">Report Not Found</h2>
          <p className="text-zinc-400 font-[family-name:var(--font-spacemono)]">
            This shared report link is invalid or has been removed.
          </p>
          <a href="/analyze" className="mt-4 px-6 py-3 bg-[#4ADE80] text-black font-bold rounded-xl hover:bg-[#22c55e] transition font-[family-name:var(--font-spacemono)] text-sm">
            Analyze a Wallet
          </a>
        </div>
      </main>
    );
  }

  const result = report.data;
  const riskScore = result.risk_score ?? 0;
  const riskLabel = result.risk_label ?? "";
  const riskBarColor = riskScore >= 75 ? "bg-red-400" : riskScore >= 40 ? "bg-yellow-400" : "bg-green-400";

  const tabs = [
    { key: "overview", label: "Overview", icon: BarChart3 },
    { key: "graph", label: "Graph", icon: Share2 },
    { key: "timeline", label: "Timeline", icon: Activity },
    { key: "flags", label: "Flags", icon: Flag },
    ...(result.gnn ? [{ key: "gnn", label: "GNN", icon: Brain }] : []),
    ...(result.temporal ? [{ key: "temporal", label: "Temporal", icon: TrendingUp }] : []),
    ...(result.mev ? [{ key: "mev", label: "MEV", icon: Bot }] : []),
    ...(result.bridges?.bridges_used?.length ? [{ key: "bridges", label: "Bridges", icon: Layers }] : []),
  ];

  return (
    <main className="min-h-screen text-white overflow-hidden relative font-[family-name:var(--font-nuqun)]">
      <Navbar />

      <section className="min-h-screen px-8 md:px-24 pt-32 pb-20">
        <div className="max-w-6xl mx-auto w-full space-y-6">

          {/* ── Shared Report Banner ── */}
          <div className="bg-[#4ADE80]/5 border border-[#4ADE80]/20 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-[#4ADE80]/10 p-2 rounded-xl">
                <Link2 className="w-5 h-5 text-[#4ADE80]" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#4ADE80]">Shared Report</p>
                <p className="text-xs text-zinc-400 font-[family-name:var(--font-spacemono)]">
                  Created {timeAgo(report.created_at)} · {report.views} view{report.views !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={copyLink}
                className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2 hover:bg-white/10 transition font-[family-name:var(--font-spacemono)] text-xs"
              >
                {copied ? <Check size={12} className="text-[#4ADE80]" /> : <Copy size={12} />}
                {copied ? "Copied!" : "Copy Link"}
              </button>
              <a href={`/analyze`}
                className="flex items-center gap-2 bg-[#4ADE80] text-black font-bold rounded-xl px-4 py-2 hover:bg-[#22c55e] transition font-[family-name:var(--font-spacemono)] text-xs"
              >
                Analyze Another <ArrowUpRight size={12} />
              </a>
            </div>
          </div>

          {/* ── Risk Score Header ── */}
          <div className={`${getRiskBg(riskScore)} border rounded-2xl p-8`}>
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <ShieldAlert className={`w-8 h-8 ${getRiskColor(riskScore)}`} />
                  <h1 className="text-3xl font-bold">Risk Assessment</h1>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <button onClick={() => copyAddress(result.address)}
                    className="font-[family-name:var(--font-spacemono)] text-sm text-zinc-300 hover:text-white transition cursor-pointer"
                  >
                    {result.address.slice(0, 10)}...{result.address.slice(-6)}
                  </button>
                  {result.ens_name && (
                    <span className="text-xs bg-white/10 px-2 py-0.5 rounded text-zinc-300 font-[family-name:var(--font-spacemono)]">
                      {result.ens_name}
                    </span>
                  )}
                  {result.chain && (
                    <span className="text-xs text-zinc-500 font-[family-name:var(--font-spacemono)]">on {result.chain.name}</span>
                  )}
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

          {/* Sanctions Banner */}
          {result.sanctions?.is_sanctioned && (
            <div className="p-4 bg-red-400/10 border border-red-400/20 rounded-2xl flex items-start gap-3">
              <Ban size={20} className="text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-red-400">OFAC Sanctioned Address</p>
                <p className="text-sm text-red-400/80 font-[family-name:var(--font-spacemono)]">This address is on the U.S. Treasury OFAC SDN list.</p>
                {result.sanctions.lists.map((l, i) => (
                  <span key={i} className="inline-block text-xs bg-red-400/10 text-red-400 px-2 py-0.5 rounded mt-1 mr-1 font-[family-name:var(--font-spacemono)]">{l.list_name}: {l.label}</span>
                ))}
              </div>
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
            {tabs.map((tab) => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition font-[family-name:var(--font-spacemono)] ${
                  activeTab === tab.key ? "bg-white/10 text-white" : "text-zinc-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <tab.icon size={14} />{tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="space-y-6">

            {/* Overview */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                {/* Flags */}
                {result.flags && result.flags.length > 0 && (
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Flag size={18} className="text-[#4ADE80]" />Risk Flags</h3>
                    <div className="space-y-2">
                      {result.flags.map((f, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <AlertTriangle size={14} className="text-yellow-400 shrink-0 mt-0.5" />
                          <span className="font-[family-name:var(--font-spacemono)] text-zinc-300">{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top Counterparties */}
                {result.top_counterparties && result.top_counterparties.length > 0 && (
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-6 overflow-x-auto">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Users size={18} className="text-[#4ADE80]" />Top Counterparties</h3>
                    <table className="w-full text-sm font-[family-name:var(--font-spacemono)]">
                      <thead>
                        <tr className="text-zinc-400 text-xs border-b border-white/10">
                          <th className="text-left py-2">Address</th>
                          <th className="text-left py-2">Label</th>
                          <th className="text-right py-2">Volume</th>
                          <th className="text-right py-2">Txns</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.top_counterparties.slice(0, 8).map((cp: Counterparty) => (
                          <tr key={cp.address} className="border-b border-white/5 hover:bg-white/5 transition">
                            <td className="py-2 text-zinc-300">{cp.address.slice(0, 10)}...{cp.address.slice(-4)}</td>
                            <td className="py-2">
                              {cp.label ? (
                                <span className={`text-xs px-2 py-0.5 rounded ${
                                  cp.category === "mixer" ? "bg-red-400/10 text-red-400" :
                                  cp.category === "exchange" ? "bg-blue-400/10 text-blue-400" :
                                  cp.category === "dex" ? "bg-purple-400/10 text-purple-400" :
                                  "bg-white/10 text-zinc-400"
                                }`}>{cp.label}</span>
                              ) : <span className="text-zinc-600">—</span>}
                            </td>
                            <td className="py-2 text-right text-zinc-300">{cp.total_value.toFixed(4)}</td>
                            <td className="py-2 text-right text-zinc-400">{cp.tx_count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Feature Summary */}
                {result.feature_summary && Object.keys(result.feature_summary).length > 0 && (
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><BarChart3 size={18} className="text-[#4ADE80]" />Feature Summary</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {Object.entries(result.feature_summary).map(([key, val]) => (
                        <div key={key} className="bg-white/5 rounded-xl p-3">
                          <p className="text-xs text-zinc-400 font-[family-name:var(--font-spacemono)] truncate">{key.replace(/_/g, " ")}</p>
                          <p className="text-lg font-bold font-[family-name:var(--font-spacemono)] mt-1">{typeof val === "number" ? val.toFixed(4) : String(val)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Graph */}
            {activeTab === "graph" && result.graph && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Share2 size={18} className="text-[#4ADE80]" />Transaction Graph</h3>
                <div className="h-[500px] rounded-xl overflow-hidden bg-black/20">
                  <Graph nodes={result.graph.nodes} links={result.graph.links} />
                </div>
                <div className="flex flex-wrap gap-3 mt-4">
                  {[
                    { color: "bg-red-500", label: "Suspect" },
                    { color: "bg-blue-500", label: "Exchange" },
                    { color: "bg-purple-500", label: "DEX" },
                    { color: "bg-orange-500", label: "Bridge" },
                    { color: "bg-green-500", label: "DeFi" },
                    { color: "bg-zinc-500", label: "Neighbor" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-1.5 text-xs text-zinc-400 font-[family-name:var(--font-spacemono)]">
                      <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />{item.label}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Timeline */}
            {activeTab === "timeline" && result.timeline && result.timeline.length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Activity size={18} className="text-[#4ADE80]" />Transaction Timeline</h3>
                <div className="h-[350px]">
                  <Timeline data={result.timeline} />
                </div>
              </div>
            )}

            {/* Flags */}
            {activeTab === "flags" && (
              <div className="space-y-4">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Flag size={18} className="text-[#4ADE80]" />All Risk Flags ({result.flags?.length || 0})</h3>
                  {result.flags && result.flags.length > 0 ? (
                    <div className="space-y-3">
                      {result.flags.map((f, i) => (
                        <div key={i} className={`flex items-start gap-3 p-3 rounded-xl ${
                          f.includes("SANCTIONED") || f.includes("sanctioned") ? "bg-red-400/10 border border-red-400/20" :
                          f.includes("mixer") || f.includes("MEV") ? "bg-orange-400/10 border border-orange-400/20" :
                          "bg-yellow-400/5 border border-yellow-400/10"
                        }`}>
                          <AlertTriangle size={16} className={`shrink-0 mt-0.5 ${
                            f.includes("SANCTIONED") || f.includes("sanctioned") ? "text-red-400" :
                            f.includes("mixer") || f.includes("MEV") ? "text-orange-400" :
                            "text-yellow-400"
                          }`} />
                          <span className="font-[family-name:var(--font-spacemono)] text-sm text-zinc-300">{f}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-zinc-500 font-[family-name:var(--font-spacemono)] text-sm">No risk flags detected.</p>
                  )}
                </div>

                {/* Counterparty sanctions */}
                {result.counterparty_sanctions && result.counterparty_sanctions.sanctioned_count > 0 && (
                  <div className="bg-red-400/5 border border-red-400/20 rounded-2xl p-6">
                    <h3 className="text-lg font-bold mb-3 text-red-400 flex items-center gap-2"><Ban size={18} />Sanctioned Counterparties</h3>
                    <div className="space-y-2">
                      {result.counterparty_sanctions.sanctioned_addresses.map((s, i) => (
                        <div key={i} className="flex items-center gap-2 font-[family-name:var(--font-spacemono)] text-sm">
                          <Ban size={12} className="text-red-400" />
                          <span className="text-zinc-300">{s.address.slice(0, 14)}...{s.address.slice(-6)}</span>
                          <span className="text-xs bg-red-400/10 text-red-400 px-2 py-0.5 rounded">{s.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* GNN */}
            {activeTab === "gnn" && result.gnn && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Brain size={18} className="text-[#4ADE80]" />GNN Analysis</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "GNN Score", value: result.gnn.gnn_score },
                    { label: "Mahalanobis Distance", value: result.gnn.mahalanobis_distance?.toFixed(4) },
                    { label: "Cosine Anomaly", value: result.gnn.cosine_anomaly?.toFixed(4) },
                    { label: "Degree Ratio", value: result.gnn.degree_ratio?.toFixed(4) },
                  ].map((item) => (
                    <div key={item.label} className="bg-white/5 rounded-xl p-4">
                      <p className="text-xs text-zinc-400 font-[family-name:var(--font-spacemono)]">{item.label}</p>
                      <p className="text-2xl font-bold font-[family-name:var(--font-spacemono)] mt-1">{item.value}</p>
                    </div>
                  ))}
                </div>
                {result.gnn.graph_stats && (
                  <div className="mt-4 flex gap-4 text-xs text-zinc-500 font-[family-name:var(--font-spacemono)]">
                    <span>Nodes: {result.gnn.graph_stats.n_nodes}</span>
                    <span>Edges: {result.gnn.graph_stats.n_edges}</span>
                    <span>Avg Degree: {result.gnn.graph_stats.avg_degree?.toFixed(2)}</span>
                    <span>Target Degree: {result.gnn.graph_stats.target_degree}</span>
                  </div>
                )}
              </div>
            )}

            {/* Temporal */}
            {activeTab === "temporal" && result.temporal && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><TrendingUp size={18} className="text-[#4ADE80]" />Temporal Analysis</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-white/5 rounded-xl p-4">
                    <p className="text-xs text-zinc-400 font-[family-name:var(--font-spacemono)]">Temporal Risk</p>
                    <p className={`text-2xl font-bold font-[family-name:var(--font-spacemono)] mt-1 ${getRiskColor(result.temporal.temporal_risk_score)}`}>
                      {result.temporal.temporal_risk_score}
                    </p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4">
                    <p className="text-xs text-zinc-400 font-[family-name:var(--font-spacemono)]">Days Analyzed</p>
                    <p className="text-2xl font-bold font-[family-name:var(--font-spacemono)] mt-1">{result.temporal.days_analyzed}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4">
                    <p className="text-xs text-zinc-400 font-[family-name:var(--font-spacemono)]">Burst Count</p>
                    <p className="text-2xl font-bold font-[family-name:var(--font-spacemono)] mt-1">{result.temporal.burst_analysis?.burst_count ?? 0}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4">
                    <p className="text-xs text-zinc-400 font-[family-name:var(--font-spacemono)]">Z-Score Anomalies</p>
                    <p className="text-2xl font-bold font-[family-name:var(--font-spacemono)] mt-1">{result.temporal.zscore_anomalies?.length ?? 0}</p>
                  </div>
                </div>
              </div>
            )}

            {/* MEV */}
            {activeTab === "mev" && result.mev && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Bot size={18} className="text-[#4ADE80]" />MEV Analysis</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                  <div className="bg-white/5 rounded-xl p-4">
                    <p className="text-xs text-zinc-400 font-[family-name:var(--font-spacemono)]">MEV Risk Score</p>
                    <p className={`text-2xl font-bold font-[family-name:var(--font-spacemono)] mt-1 ${getRiskColor(result.mev.mev_risk_score)}`}>
                      {result.mev.mev_risk_score}
                    </p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4">
                    <p className="text-xs text-zinc-400 font-[family-name:var(--font-spacemono)]">Is MEV Bot?</p>
                    <p className={`text-2xl font-bold font-[family-name:var(--font-spacemono)] mt-1 ${result.mev.is_mev_bot ? "text-red-400" : "text-green-400"}`}>
                      {result.mev.is_mev_bot ? "YES" : "NO"}
                    </p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4">
                    <p className="text-xs text-zinc-400 font-[family-name:var(--font-spacemono)]">Sandwiches</p>
                    <p className="text-2xl font-bold font-[family-name:var(--font-spacemono)] mt-1">{result.mev.sandwiches?.length ?? 0}</p>
                  </div>
                </div>
                {result.mev.mev_flags && result.mev.mev_flags.length > 0 && (
                  <div className="space-y-2">
                    {result.mev.mev_flags.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <Bot size={12} className="text-orange-400" />
                        <span className="font-[family-name:var(--font-spacemono)] text-zinc-300">{f}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Bridges */}
            {activeTab === "bridges" && result.bridges && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Layers size={18} className="text-[#4ADE80]" />Bridge Usage</h3>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-white/5 rounded-xl p-4">
                    <p className="text-xs text-zinc-400 font-[family-name:var(--font-spacemono)]">Bridge Txns</p>
                    <p className="text-2xl font-bold font-[family-name:var(--font-spacemono)] mt-1">{result.bridges.total_bridge_txns}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4">
                    <p className="text-xs text-zinc-400 font-[family-name:var(--font-spacemono)]">Volume</p>
                    <p className="text-2xl font-bold font-[family-name:var(--font-spacemono)] mt-1">{result.bridges.total_bridge_volume?.toFixed(4)}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4">
                    <p className="text-xs text-zinc-400 font-[family-name:var(--font-spacemono)]">Risk Score</p>
                    <p className={`text-2xl font-bold font-[family-name:var(--font-spacemono)] mt-1 ${getRiskColor(result.bridges.bridge_risk_score)}`}>
                      {result.bridges.bridge_risk_score}
                    </p>
                  </div>
                </div>
                {result.bridges.bridges_used.map((b, i) => (
                  <div key={i} className="bg-white/5 rounded-xl p-4 mb-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold font-[family-name:var(--font-spacemono)] text-sm">{b.protocol}</span>
                      <span className="text-xs text-zinc-400 font-[family-name:var(--font-spacemono)]">{b.txn_count} txns · {b.volume_eth.toFixed(4)} ETH</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer CTA */}
          <div className="mt-12 text-center border-t border-white/5 pt-8">
            <p className="text-zinc-500 text-sm font-[family-name:var(--font-spacemono)] mb-4">
              This report was generated by Kryptos — AI-powered blockchain intelligence.
            </p>
            <div className="flex justify-center gap-3">
              <a href="/analyze"
                className="px-6 py-3 bg-[#4ADE80] text-black font-bold rounded-xl hover:bg-[#22c55e] transition font-[family-name:var(--font-spacemono)] text-sm"
              >
                Analyze a Wallet
              </a>
              <a href="/"
                className="px-6 py-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition font-[family-name:var(--font-spacemono)] text-sm"
              >
                Learn More
              </a>
            </div>
          </div>

        </div>
      </section>
    </main>
  );
}
