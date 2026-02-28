"use client";
import { useState } from "react";
import Navbar from "@/components/Navbar";
import {
  BookOpen, Code, Shield, Globe, Zap, ChevronRight, Copy, Check,
  ExternalLink, ArrowRight, Braces, FileJson, AlertTriangle, Brain,
  BarChart3, Ban, Users, Link2, MessageSquare, Layers, Search,
  Wallet, ScanLine, FileSearch, Eye, Upload, Share2, Lock, Network,
} from "lucide-react";

/* ───────────── Sections sidebar ───────────── */

const sections = [
  { id: "overview", label: "Overview", icon: BookOpen },
  { id: "using-kryptos", label: "Using Kryptos", icon: Search },
  { id: "features", label: "Features", icon: Braces },
  { id: "risk-scoring", label: "Risk Scoring", icon: Shield },
  { id: "chains", label: "Supported Chains", icon: Globe },
  { id: "api-reference", label: "Developer API", icon: Code },
];

/* ───────────── API endpoint data ───────────── */

type Endpoint = {
  method: "GET" | "POST";
  path: string;
  description: string;
  params?: { name: string; type: string; required: boolean; desc: string }[];
  body?: { name: string; type: string; desc: string }[];
  example?: string;
  response?: string;
};

const coreEndpoints: Endpoint[] = [
  {
    method: "GET", path: "/", description: "Health check — returns API version and chain count.",
    example: `curl https://api.kryptos.dev/`,
    response: `{ "status": "Kryptos Backend Running", "version": "4.0.0", "chains": 14 }`,
  },
  {
    method: "GET", path: "/chains", description: "List all 14 supported EVM chains with metadata.",
    example: `curl https://api.kryptos.dev/chains`,
    response: `{ "chains": [{ "id": 1, "name": "Ethereum", "short": "ETH", ... }], "default": 1 }`,
  },
  {
    method: "GET", path: "/analyze/{address}", description: "Full wallet risk analysis — returns risk score, ML/heuristic breakdown, transaction graph, timeline, counterparties, sanctions, GNN, temporal, MEV, and bridge data.",
    params: [
      { name: "address", type: "string", required: true, desc: "Wallet address (0x...) or ENS name" },
      { name: "chain_id", type: "int", required: false, desc: "Chain ID (default: 1 for Ethereum)" },
    ],
    example: `curl "https://api.kryptos.dev/analyze/vitalik.eth?chain_id=1"`,
    response: `{
  "address": "0xd8da6bf2...",
  "ens_name": "vitalik.eth",
  "risk_score": 12,
  "risk_label": "Low Risk",
  "ml_raw_score": 8,
  "heuristic_score": 15,
  "flags": [],
  "feature_summary": { "tx_count": 1842, ... },
  "graph": { "nodes": [...], "links": [...] },
  "timeline": [...],
  "sanctions": { "is_sanctioned": false, ... },
  "gnn": { "gnn_score": 5, ... },
  "temporal": { "temporal_risk_score": 3, ... },
  "mev": { "mev_risk_score": 0, ... },
  "bridges": { "bridge_risk_score": 0, ... }
}`,
  },
  {
    method: "GET", path: "/balance/{address}", description: "Fetch native token balance for a wallet on a specific chain.",
    params: [
      { name: "address", type: "string", required: true, desc: "Wallet address" },
      { name: "chain_id", type: "int", required: false, desc: "Chain ID (default: 1)" },
    ],
    example: `curl "https://api.kryptos.dev/balance/0xd8dA6BF2...?chain_id=1"`,
  },
  {
    method: "GET", path: "/report/{address}", description: "Read an existing on-chain risk report from the RiskRegistry contract.",
    params: [{ name: "address", type: "string", required: true, desc: "Wallet address" }],
  },
  {
    method: "GET", path: "/report/{address}/pdf", description: "Generate and download a PDF investigation report for a wallet.",
    params: [
      { name: "address", type: "string", required: true, desc: "Wallet address" },
      { name: "chain_id", type: "int", required: false, desc: "Chain ID (default: 1)" },
    ],
  },
];

const advancedEndpoints: Endpoint[] = [
  {
    method: "GET", path: "/resolve/{name}", description: "Resolve an ENS name to an address, or reverse-resolve an address to its ENS name.",
    params: [{ name: "name", type: "string", required: true, desc: "ENS name or 0x address" }],
    example: `curl https://api.kryptos.dev/resolve/vitalik.eth`,
  },
  {
    method: "GET", path: "/trace/{address}", description: "Trace fund flow from a wallet — follows transactions up to N hops deep.",
    params: [
      { name: "address", type: "string", required: true, desc: "Wallet address" },
      { name: "chain_id", type: "int", required: false, desc: "Chain ID (default: 1)" },
      { name: "depth", type: "int", required: false, desc: "Max depth 1–5 (default: 3)" },
      { name: "min_value", type: "float", required: false, desc: "Minimum ETH value (default: 0.01)" },
      { name: "direction", type: "string", required: false, desc: "'in' or 'out' (default: 'out')" },
    ],
    example: `curl "https://api.kryptos.dev/trace/0xabc...?depth=3&direction=out"`,
  },
  {
    method: "GET", path: "/cross-chain/{address}", description: "Scan a wallet across all 14 supported EVM chains simultaneously.",
    params: [{ name: "address", type: "string", required: true, desc: "Wallet address" }],
  },
  {
    method: "GET", path: "/sanctions/{address}", description: "Check if a wallet is on OFAC sanctions list, is a known mixer, or is flagged as a scam.",
    params: [{ name: "address", type: "string", required: true, desc: "Wallet address" }],
    response: `{
  "is_sanctioned": false,
  "is_mixer": false,
  "is_scam": false,
  "lists": [],
  "risk_modifier": 0,
  "known_label": null,
  "known_category": null
}`,
  },
  {
    method: "GET", path: "/tokens/{address}", description: "Get ERC-20 token portfolio and transfer analysis for a wallet.",
    params: [
      { name: "address", type: "string", required: true, desc: "Wallet address" },
      { name: "chain_id", type: "int", required: false, desc: "Chain ID (default: 1)" },
    ],
  },
  {
    method: "GET", path: "/similar/{address}", description: "Find wallets with similar behavioral patterns using cosine similarity on feature vectors.",
    params: [
      { name: "address", type: "string", required: true, desc: "Wallet address" },
      { name: "chain_id", type: "int", required: false, desc: "Chain ID (default: 1)" },
      { name: "top_k", type: "int", required: false, desc: "Number of results 1–20 (default: 5)" },
    ],
  },
  {
    method: "GET", path: "/gnn/{address}", description: "Run Graph Neural Network scoring on a wallet's transaction sub-graph.",
    params: [
      { name: "address", type: "string", required: true, desc: "Wallet address" },
      { name: "chain_id", type: "int", required: false, desc: "Chain ID (default: 1)" },
    ],
  },
  {
    method: "GET", path: "/temporal/{address}", description: "Detect temporal anomalies — transaction spikes, regime shifts, and burst patterns.",
    params: [
      { name: "address", type: "string", required: true, desc: "Wallet address" },
      { name: "chain_id", type: "int", required: false, desc: "Chain ID (default: 1)" },
    ],
  },
  {
    method: "GET", path: "/mev/{address}", description: "Detect MEV bot behavior — sandwich attacks, front-running, and arbitrage patterns.",
    params: [
      { name: "address", type: "string", required: true, desc: "Wallet address" },
      { name: "chain_id", type: "int", required: false, desc: "Chain ID (default: 1)" },
    ],
  },
  {
    method: "GET", path: "/bridges/{address}", description: "Detect cross-chain bridge usage and potential fund obfuscation patterns.",
    params: [
      { name: "address", type: "string", required: true, desc: "Wallet address" },
      { name: "chain_id", type: "int", required: false, desc: "Chain ID (default: 1)" },
    ],
  },
];

const tokenContractEndpoints: Endpoint[] = [
  {
    method: "GET", path: "/token-scan/{address}", description: "Deep-dive ERC-20 token risk assessment — contract verification, dangerous functions, holder distribution.",
    params: [
      { name: "address", type: "string", required: true, desc: "Token contract address" },
      { name: "chain_id", type: "int", required: false, desc: "Chain ID (default: 1)" },
    ],
    example: `curl "https://api.kryptos.dev/token-scan/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48?chain_id=1"`,
  },
  {
    method: "GET", path: "/contract-audit/{address}", description: "Automated smart contract security audit — findings classified by severity with source code snippets.",
    params: [
      { name: "address", type: "string", required: true, desc: "Contract address" },
      { name: "chain_id", type: "int", required: false, desc: "Chain ID (default: 1)" },
    ],
  },
];

const batchEndpoints: Endpoint[] = [
  {
    method: "POST", path: "/batch", description: "Analyze multiple wallet addresses in a single request (max 50).",
    body: [
      { name: "addresses", type: "string[]", desc: "List of wallet addresses" },
      { name: "chain_id", type: "int", desc: "Chain ID (default: 1)" },
      { name: "quick", type: "bool", desc: "Quick mode or deep scan (default: true)" },
    ],
    example: `curl -X POST https://api.kryptos.dev/batch \\
  -H "Content-Type: application/json" \\
  -d '{
    "addresses": ["0xd8dA6BF2...", "0xabc..."],
    "chain_id": 1,
    "quick": true
  }'`,
    response: `{
  "results": [{ "address": "0x...", "risk_score": 42, ... }],
  "summary": {
    "total_addresses": 2,
    "successfully_analyzed": 2,
    "avg_risk_score": 35,
    "high_risk_count": 0,
    "medium_risk_count": 1,
    "low_risk_count": 1,
    "sanctioned_count": 0
  }
}`,
  },
  {
    method: "POST", path: "/batch/csv", description: "Analyze addresses extracted from CSV content.",
    body: [
      { name: "csv_content", type: "string", desc: "Raw CSV text with wallet addresses" },
      { name: "chain_id", type: "int", desc: "Chain ID (default: 1)" },
      { name: "quick", type: "bool", desc: "Quick mode (default: true)" },
    ],
  },
];

const shareEndpoints: Endpoint[] = [
  {
    method: "POST", path: "/share", description: "Save an analysis result and get a shareable short link.",
    body: [{ name: "data", type: "object", desc: "Full analysis result JSON from /analyze" }],
    response: `{ "report_id": "NEdDGIDIQD", "url": "/report/NEdDGIDIQD", "address": "0x...", "risk_score": 42 }`,
  },
  {
    method: "GET", path: "/shared/{report_id}", description: "Retrieve a shared report by its short ID.",
    params: [{ name: "report_id", type: "string", required: true, desc: "10-character report ID" }],
  },
  {
    method: "GET", path: "/shared/{report_id}/meta", description: "Lightweight metadata for OG tags and link previews.",
    params: [{ name: "report_id", type: "string", required: true, desc: "Report ID" }],
  },
];

const authEndpoints: Endpoint[] = [
  {
    method: "POST", path: "/auth/nonce", description: "Request a SIWE nonce and message for wallet authentication.",
    body: [{ name: "address", type: "string", desc: "Wallet address (0x...)" }],
    response: `{ "message": "Sign this message to log in to Kryptos...", "nonce": "a1b2c3..." }`,
  },
  {
    method: "POST", path: "/auth/verify", description: "Verify an Ethereum signature and receive a JWT token.",
    body: [
      { name: "address", type: "string", desc: "Wallet address" },
      { name: "signature", type: "string", desc: "Signed message from wallet" },
      { name: "message", type: "string", desc: "Original SIWE message" },
    ],
    response: `{ "token": "eyJ...", "address": "0x..." }`,
  },
  {
    method: "GET", path: "/auth/me", description: "Get the current authenticated user's info. Requires JWT in Authorization header.",
  },
];

const communityEndpoints: Endpoint[] = [
  {
    method: "POST", path: "/community/report", description: "Submit a community scam report for a wallet address.",
    body: [
      { name: "address", type: "string", desc: "Target wallet address" },
      { name: "category", type: "string", desc: "Category: scam, phishing, rugpull, exploit, etc." },
      { name: "description", type: "string", desc: "Description of suspicious activity" },
      { name: "reporter_id", type: "string", desc: "Reporter identifier (default: anonymous)" },
      { name: "evidence_urls", type: "string[]", desc: "Supporting evidence URLs" },
      { name: "chain_id", type: "int", desc: "Chain ID (default: 1)" },
    ],
  },
  {
    method: "GET", path: "/community/reports/{address}", description: "Get all community reports for a specific address.",
    params: [
      { name: "address", type: "string", required: true, desc: "Wallet address" },
      { name: "limit", type: "int", required: false, desc: "Max results 1–200 (default: 50)" },
    ],
  },
  {
    method: "POST", path: "/community/vote", description: "Upvote or downvote a community report.",
    body: [
      { name: "report_id", type: "string", desc: "Report ID to vote on" },
      { name: "vote", type: "string", desc: "'up' or 'down'" },
      { name: "voter_id", type: "string", desc: "Voter identifier (default: anonymous)" },
    ],
  },
  {
    method: "GET", path: "/community/recent", description: "Get the most recent community reports across all addresses.",
    params: [{ name: "limit", type: "int", required: false, desc: "Max results 1–100 (default: 20)" }],
  },
  {
    method: "GET", path: "/community/flagged", description: "Get addresses with the most community reports.",
    params: [{ name: "min_reports", type: "int", required: false, desc: "Minimum report count (default: 2)" }],
  },
];

/* ───────────── Chains data ───────────── */

const chains = [
  { name: "Ethereum", id: 1, short: "ETH" },
  { name: "Base", id: 8453, short: "BASE" },
  { name: "Polygon", id: 137, short: "MATIC" },
  { name: "Arbitrum One", id: 42161, short: "ARB" },
  { name: "Optimism", id: 10, short: "OP" },
  { name: "BNB Smart Chain", id: 56, short: "BNB" },
  { name: "Avalanche C-Chain", id: 43114, short: "AVAX" },
  { name: "Fantom", id: 250, short: "FTM" },
  { name: "Linea", id: 59144, short: "LINEA" },
  { name: "zkSync Era", id: 324, short: "ZK" },
  { name: "Mantle", id: 5000, short: "MNT" },
  { name: "Scroll", id: 534352, short: "SCROLL" },
  { name: "Sepolia", id: 11155111, short: "SEP" },
  { name: "Base Sepolia", id: 84532, short: "BSEP" },
];

/* ───────────── Helper components ───────────── */

function CodeBlock({ code, lang = "bash" }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group rounded-xl overflow-hidden">
      <div className="flex items-center justify-between bg-zinc-900 px-4 py-2 border-b border-white/5">
        <span className="text-xs text-zinc-500 font-[family-name:var(--font-spacemono)]">{lang}</span>
        <button onClick={handleCopy} className="text-zinc-500 hover:text-white transition text-xs flex items-center gap-1 font-[family-name:var(--font-spacemono)]">
          {copied ? <><Check size={12} className="text-[#4ADE80]" />Copied</> : <><Copy size={12} />Copy</>}
        </button>
      </div>
      <pre className="bg-zinc-950 p-4 overflow-x-auto text-sm font-[family-name:var(--font-spacemono)] text-zinc-300 leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function MethodBadge({ method }: { method: "GET" | "POST" }) {
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-[family-name:var(--font-spacemono)] ${method === "GET" ? "bg-blue-400/10 text-blue-400" : "bg-[#4ADE80]/10 text-[#4ADE80]"
      }`}>
      {method}
    </span>
  );
}

function EndpointCard({ ep }: { ep: Endpoint }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden hover:border-white/10 transition">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-3 px-5 py-4 text-left">
        <MethodBadge method={ep.method} />
        <span className="font-[family-name:var(--font-spacemono)] text-sm text-white">{ep.path}</span>
        <span className="text-xs text-zinc-500 hidden md:inline ml-2">{ep.description.slice(0, 70)}{ep.description.length > 70 ? "..." : ""}</span>
        <ChevronRight size={14} className={`ml-auto text-zinc-500 transition-transform ${expanded ? "rotate-90" : ""}`} />
      </button>
      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-white/5 pt-4">
          <p className="text-sm text-zinc-400">{ep.description}</p>

          {ep.params && ep.params.length > 0 && (
            <div>
              <h5 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 font-[family-name:var(--font-spacemono)]">Parameters</h5>
              <div className="space-y-1.5">
                {ep.params.map((p) => (
                  <div key={p.name} className="flex items-start gap-3 text-sm">
                    <code className="text-[#4ADE80] font-[family-name:var(--font-spacemono)] text-xs bg-[#4ADE80]/5 px-1.5 py-0.5 rounded shrink-0">{p.name}</code>
                    <span className="text-zinc-600 text-xs font-[family-name:var(--font-spacemono)]">{p.type}</span>
                    {p.required && <span className="text-[10px] text-red-400 bg-red-400/10 px-1.5 rounded">required</span>}
                    <span className="text-zinc-400 text-xs">{p.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {ep.body && ep.body.length > 0 && (
            <div>
              <h5 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 font-[family-name:var(--font-spacemono)]">Request Body</h5>
              <div className="space-y-1.5">
                {ep.body.map((b) => (
                  <div key={b.name} className="flex items-start gap-3 text-sm">
                    <code className="text-[#4ADE80] font-[family-name:var(--font-spacemono)] text-xs bg-[#4ADE80]/5 px-1.5 py-0.5 rounded shrink-0">{b.name}</code>
                    <span className="text-zinc-600 text-xs font-[family-name:var(--font-spacemono)]">{b.type}</span>
                    <span className="text-zinc-400 text-xs">{b.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {ep.example && <CodeBlock code={ep.example} lang="bash" />}
          {ep.response && <CodeBlock code={ep.response} lang="json" />}
        </div>
      )}
    </div>
  );
}

function SectionHeader({ id, icon: Icon, title, subtitle }: { id: string; icon: any; title: string; subtitle: string }) {
  return (
    <div id={id} className="scroll-mt-32 mb-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="bg-[#4ADE80]/10 p-2 rounded-xl">
          <Icon className="w-5 h-5 text-[#4ADE80]" />
        </div>
        <h2 className="text-3xl font-bold">{title}</h2>
      </div>
      <p className="text-zinc-400 font-[family-name:var(--font-spacemono)] text-sm ml-12">{subtitle}</p>
    </div>
  );
}

/* ───────────── Main Component ───────────── */

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("overview");

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <main className="min-h-screen text-white overflow-x-hidden relative font-[family-name:var(--font-nuqun)]">
      <Navbar />

      <div className="flex pt-24">
        {/* ── Sidebar ── */}
        <aside className="hidden lg:block w-64 shrink-0 fixed top-24 left-0 h-[calc(100vh-6rem)] border-r border-white/5 overflow-y-auto px-6 py-8">
          <div className="mb-6">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 font-[family-name:var(--font-spacemono)]">Documentation</h3>
          </div>
          <nav className="space-y-1">
            {sections.map((s) => (
              <button key={s.id} onClick={() => scrollToSection(s.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition ${activeSection === s.id
                    ? "bg-[#4ADE80]/10 text-[#4ADE80]"
                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                  } font-[family-name:var(--font-spacemono)]`}
              >
                <s.icon size={16} />
                {s.label}
              </button>
            ))}
          </nav>

          <div className="mt-8 pt-6 border-t border-white/5">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3 font-[family-name:var(--font-spacemono)]">Quick Links</h3>
            <div className="space-y-2">
              <a href="/analyze" className="flex items-center gap-2 text-xs text-zinc-400 hover:text-[#4ADE80] transition font-[family-name:var(--font-spacemono)]">
                <ArrowRight size={12} />Try Analyzer
              </a>
              <a href="/services/token-scanner" className="flex items-center gap-2 text-xs text-zinc-400 hover:text-[#4ADE80] transition font-[family-name:var(--font-spacemono)]">
                <ArrowRight size={12} />Token Scanner
              </a>
              <a href="/services/contract-auditor" className="flex items-center gap-2 text-xs text-zinc-400 hover:text-[#4ADE80] transition font-[family-name:var(--font-spacemono)]">
                <ArrowRight size={12} />Contract Auditor
              </a>
            </div>
          </div>
        </aside>

        {/* ── Main Content ── */}
        <div className="flex-1 lg:ml-64 px-8 md:px-16 lg:px-20 pb-32">
          <div className="max-w-4xl mx-auto space-y-20">

            {/* ==================== OVERVIEW ==================== */}
            <section id="overview" className="scroll-mt-32 pt-8">
              <div className="mb-8">
                <h1 className="text-5xl md:text-7xl font-medium mb-4 leading-[0.9]">
                  Documentation
                </h1>
                <p className="text-xl text-zinc-400 font-[family-name:var(--font-spacemono)] max-w-2xl">
                  Learn how to use Kryptos to analyze wallets, scan tokens, audit contracts,
                  and integrate our API into your own applications — all across 14 EVM chains.
                </p>
              </div>

              {/* Quick overview cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { icon: Shield, title: "Risk Scoring", desc: "ML + heuristics produce a 0–100 risk score for any wallet", color: "text-green-400" },
                  { icon: Globe, title: "14 EVM Chains", desc: "Ethereum, Base, Polygon, Arbitrum, Optimism, and 9 more", color: "text-blue-400" },
                  { icon: Code, title: "29+ Endpoints", desc: "RESTful API for developers — analyze, scan, audit, batch, share", color: "text-purple-400" },
                ].map((card) => (
                  <div key={card.title} className="bg-white/5 border border-white/10 rounded-2xl p-6">
                    <card.icon className={`w-6 h-6 ${card.color} mb-3`} />
                    <h3 className="text-lg font-bold mb-1">{card.title}</h3>
                    <p className="text-sm text-zinc-400 font-[family-name:var(--font-spacemono)]">{card.desc}</p>
                  </div>
                ))}
              </div>

              {/* Base URL */}
              <div className="mt-6 bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-3">
                <span className="text-xs text-zinc-500 font-[family-name:var(--font-spacemono)]">API Base URL</span>
                <code className="text-[#4ADE80] font-[family-name:var(--font-spacemono)] text-sm">https://api.kryptos.dev</code>
              </div>
            </section>

            {/* ==================== USING KRYPTOS ==================== */}
            <section>
              <SectionHeader id="using-kryptos" icon={Search} title="Using Kryptos" subtitle="How to use each tool from your browser — no setup required." />

              <div className="space-y-6">
                {/* Wallet Analyzer */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                    <Wallet size={18} className="text-[#4ADE80]" />Wallet Risk Analyzer
                  </h3>
                  <p className="text-sm text-zinc-400 mb-4 font-[family-name:var(--font-spacemono)]">
                    Our flagship tool. Enter any wallet address or ENS name to get a comprehensive risk assessment.
                  </p>
                  <div className="space-y-3">
                    {[
                      { step: "1", title: "Navigate to Analyze", desc: "Go to the Analyze page from the navbar or visit kryptos.dev/analyze directly." },
                      { step: "2", title: "Enter an address", desc: "Paste a wallet address (0x...) or type an ENS name (e.g. vitalik.eth). Select the chain from the dropdown." },
                      { step: "3", title: "View results", desc: "The dashboard shows the risk score, transaction graph, timeline, counterparty analysis, sanctions status, and more." },
                      { step: "4", title: "Share or download", desc: "Click Share to generate a shareable link, or download a PDF report for your records." },
                    ].map((s) => (
                      <div key={s.step} className="flex gap-4">
                        <div className="shrink-0 w-8 h-8 bg-[#4ADE80]/10 rounded-lg flex items-center justify-center">
                          <span className="text-xs font-bold text-[#4ADE80] font-[family-name:var(--font-spacemono)]">{s.step}</span>
                        </div>
                        <div>
                          <h4 className="font-bold text-sm">{s.title}</h4>
                          <p className="text-xs text-zinc-400 mt-0.5 font-[family-name:var(--font-spacemono)]">{s.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <a href="/analyze" className="mt-4 inline-flex items-center gap-2 text-sm text-[#4ADE80] hover:underline font-[family-name:var(--font-spacemono)]">
                    Open Analyzer <ArrowRight size={14} />
                  </a>
                </div>

                {/* Token Scanner */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                    <ScanLine size={18} className="text-blue-400" />Token Risk Scanner
                  </h3>
                  <p className="text-sm text-zinc-400 mb-4 font-[family-name:var(--font-spacemono)]">
                    Evaluate any ERC-20 token before buying. Checks contract verification, dangerous functions (mint, pause, blacklist),
                    ownership concentration, liquidity, and holder distribution. Produces a risk verdict from Safe to Critical.
                  </p>
                  <a href="/services/token-scanner" className="inline-flex items-center gap-2 text-sm text-blue-400 hover:underline font-[family-name:var(--font-spacemono)]">
                    Open Token Scanner <ArrowRight size={14} />
                  </a>
                </div>

                {/* Contract Auditor */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                    <FileSearch size={18} className="text-yellow-400" />Contract Auditor
                  </h3>
                  <p className="text-sm text-zinc-400 mb-4 font-[family-name:var(--font-spacemono)]">
                    Automated security audit for any verified smart contract. Scans for re-entrancy, unchecked external calls,
                    access control issues, and more. Findings are classified by severity (Critical, High, Medium, Low, Info) with
                    source code snippets.
                  </p>
                  <a href="/services/contract-auditor" className="inline-flex items-center gap-2 text-sm text-yellow-400 hover:underline font-[family-name:var(--font-spacemono)]">
                    Open Contract Auditor <ArrowRight size={14} />
                  </a>
                </div>

                {/* Wallet Watchlist */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                    <Eye size={18} className="text-purple-400" />Wallet Watchlist
                  </h3>
                  <p className="text-sm text-zinc-400 mb-4 font-[family-name:var(--font-spacemono)]">
                    Connect your wallet to save addresses you want to monitor. Add notes and labels, then re-analyze anytime
                    to check for score changes. Requires wallet authentication (Sign-In with Ethereum).
                  </p>
                  <a href="/services/wallet-watchlist" className="inline-flex items-center gap-2 text-sm text-purple-400 hover:underline font-[family-name:var(--font-spacemono)]">
                    Open Watchlist <ArrowRight size={14} />
                  </a>
                </div>

                {/* Bulk Screening */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                    <Upload size={18} className="text-orange-400" />Bulk Screening
                  </h3>
                  <p className="text-sm text-zinc-400 mb-4 font-[family-name:var(--font-spacemono)]">
                    Analyze up to 50 wallet addresses at once. Paste addresses or upload a CSV. Get a summary table with
                    risk scores, flags, and an aggregate breakdown (high/medium/low risk counts, average score, sanctioned count).
                  </p>
                  <a href="/services/bulk-screening" className="inline-flex items-center gap-2 text-sm text-orange-400 hover:underline font-[family-name:var(--font-spacemono)]">
                    Open Bulk Screening <ArrowRight size={14} />
                  </a>
                </div>

                {/* Shareable Reports */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                    <Share2 size={18} className="text-[#4ADE80]" />Shareable Reports
                  </h3>
                  <p className="text-sm text-zinc-400 font-[family-name:var(--font-spacemono)]">
                    After analyzing a wallet, click the <strong className="text-white">Share Report</strong> button to generate a unique link.
                    Anyone with the link can view the full analysis without needing an account. Shared reports include
                    dynamic Open Graph meta tags for rich previews when pasted in Slack, Twitter, or Discord.
                  </p>
                </div>

                {/* Connect Wallet */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                    <Lock size={18} className="text-zinc-400" />Connect Wallet
                  </h3>
                  <p className="text-sm text-zinc-400 font-[family-name:var(--font-spacemono)]">
                    Kryptos supports MetaMask and Coinbase Wallet through Sign-In with Ethereum (SIWE).
                    Connecting your wallet unlocks the Watchlist feature and persists your session for 72 hours.
                    No private keys are ever sent — authentication is done via message signing.
                  </p>
                </div>
              </div>
            </section>

            {/* ==================== FEATURES ==================== */}
            <section>
              <SectionHeader id="features" icon={Braces} title="Platform Features" subtitle="What powers Kryptos under the hood." />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { icon: Brain, title: "ML Anomaly Detection", desc: "Isolation Forest model trained on 32+ behavioral features identifies statistically abnormal wallet activity.", color: "text-purple-400" },
                  { icon: Network, title: "Graph Neural Network", desc: "GNN analyzes transaction network topology — node degree, centrality, and structural anomaly patterns.", color: "text-blue-400" },
                  { icon: BarChart3, title: "Temporal Analysis", desc: "Detects transaction spikes, regime shifts, burst patterns, and suspicious timing (night-time clustering).", color: "text-yellow-400" },
                  { icon: Ban, title: "Sanctions Screening", desc: "Real-time checks against OFAC SDN lists, known mixer addresses, and community-flagged scam databases.", color: "text-red-400" },
                  { icon: Zap, title: "MEV Detection", desc: "Identifies sandwich attacks, front-running, and arbitrage bot behavior from transaction patterns.", color: "text-orange-400" },
                  { icon: Layers, title: "Bridge Tracking", desc: "Tracks cross-chain bridge usage and detects potential fund obfuscation through bridge-hopping patterns.", color: "text-cyan-400" },
                  { icon: Users, title: "Community Reports", desc: "Crowdsourced intelligence — users can report, vote on, and query flagged addresses with category labels.", color: "text-pink-400" },
                  { icon: Search, title: "Fund Tracing", desc: "Follows fund flow up to 5 hops deep in either direction with configurable minimum value thresholds.", color: "text-[#4ADE80]" },
                ].map((feat) => (
                  <div key={feat.title} className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-white/20 transition">
                    <feat.icon className={`w-6 h-6 ${feat.color} mb-3`} />
                    <h3 className="text-base font-bold mb-1">{feat.title}</h3>
                    <p className="text-xs text-zinc-400 font-[family-name:var(--font-spacemono)]">{feat.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* ==================== RISK SCORING ==================== */}
            <section>
              <SectionHeader id="risk-scoring" icon={Shield} title="Risk Scoring" subtitle="How Kryptos calculates the risk score for any wallet." />

              <div className="space-y-6">
                {/* Score ranges */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <h3 className="text-lg font-bold mb-4">Score Ranges</h3>
                  <div className="space-y-3">
                    {[
                      { range: "0–30", label: "Low Risk", color: "bg-green-400", textColor: "text-green-400", desc: "Normal wallet activity — no suspicious patterns detected." },
                      { range: "31–60", label: "Medium Risk", color: "bg-yellow-400", textColor: "text-yellow-400", desc: "Some unusual patterns — moderate anomalies in behavior." },
                      { range: "61–80", label: "High Risk", color: "bg-orange-400", textColor: "text-orange-400", desc: "Multiple suspicious indicators — potential scam or money laundering." },
                      { range: "81–100", label: "Critical Risk", color: "bg-red-400", textColor: "text-red-400", desc: "Strong scam/fraud signals — may be sanctioned or known mixer." },
                    ].map((row) => (
                      <div key={row.range} className="flex items-center gap-4 py-3 border-b border-white/5 last:border-0">
                        <div className={`w-3 h-3 rounded-full ${row.color}`} />
                        <span className={`font-bold font-[family-name:var(--font-spacemono)] text-sm w-16 ${row.textColor}`}>{row.range}</span>
                        <span className={`font-bold text-sm w-28 ${row.textColor}`}>{row.label}</span>
                        <span className="text-sm text-zinc-400">{row.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* How it works */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <h3 className="text-lg font-bold mb-4">How It Works</h3>
                  <div className="space-y-4">
                    {[
                      { pct: "70%", name: "ML Score (Isolation Forest)", desc: "Unsupervised anomaly detection on 32+ behavioral features. The model learns what 'normal' wallet behavior looks like and flags statistical outliers.", icon: Brain },
                      { pct: "30%", name: "Heuristic Score", desc: "Rule-based checks: empty wallets, single counterparty, low gas usage, high-value concentration, mixer interactions, round-number patterns.", icon: BarChart3 },
                      { pct: "+", name: "GNN Modifier", desc: "Graph neural network analysis of the transaction network topology. Produces a supplementary anomaly score based on structural patterns.", icon: Network },
                      { pct: "+", name: "Sanctions Modifier", desc: "If the address or its counterparties are on OFAC sanctions lists, the score is boosted by 20–50 points. Sanctioned addresses are auto-labeled Critical Risk.", icon: Ban },
                      { pct: "+", name: "Community Modifier", desc: "If the address has been flagged by community reports, a modifier based on report count and credibility is applied.", icon: Users },
                    ].map((step) => (
                      <div key={step.name} className="flex gap-4">
                        <div className="shrink-0 w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center">
                          <span className="text-[10px] font-bold text-[#4ADE80] font-[family-name:var(--font-spacemono)]">{step.pct}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <step.icon size={14} className="text-zinc-400" />
                            <h4 className="font-bold text-sm">{step.name}</h4>
                          </div>
                          <p className="text-xs text-zinc-400 mt-1 font-[family-name:var(--font-spacemono)]">{step.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Risk flags */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><AlertTriangle size={18} className="text-yellow-400" />Common Risk Flags</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {[
                      "Empty wallet (0 balance, few txns)",
                      "Single counterparty concentration",
                      "Interacted with known mixer",
                      "OFAC sanctioned address",
                      "High round-number transaction ratio",
                      "Abnormal gas price patterns",
                      "Night-time transaction clustering",
                      "Burst activity pattern detected",
                      "MEV bot behavior detected",
                      "High bridge usage / fund obfuscation",
                      "Community flagged address",
                      "Transacted with sanctioned counterparty",
                    ].map((flag) => (
                      <div key={flag} className="flex items-center gap-2 text-sm py-1.5">
                        <AlertTriangle size={12} className="text-yellow-400 shrink-0" />
                        <span className="text-zinc-400 font-[family-name:var(--font-spacemono)] text-xs">{flag}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* ==================== CHAINS ==================== */}
            <section>
              <SectionHeader id="chains" icon={Globe} title="Supported Chains" subtitle="14 EVM-compatible chains supported via the Etherscan V2 unified API." />

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {chains.map((chain) => (
                  <div key={chain.id} className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-white/20 transition">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm">{chain.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500 font-[family-name:var(--font-spacemono)]">ID: {chain.id}</span>
                      <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-zinc-400 font-[family-name:var(--font-spacemono)]">{chain.short}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 bg-white/[0.02] border border-white/5 rounded-xl p-4">
                <p className="text-xs text-zinc-500 font-[family-name:var(--font-spacemono)]">
                  Pass <code className="text-[#4ADE80]">?chain_id=N</code> as a query parameter on any endpoint. Default is <code className="text-[#4ADE80]">1</code> (Ethereum Mainnet).
                  Testnet chains (Sepolia, Base Sepolia) are included for development and testing.
                </p>
              </div>
            </section>

            {/* ==================== DEVELOPER API ==================== */}
            <section>
              <SectionHeader id="api-reference" icon={Code} title="Developer API" subtitle="Integrate Kryptos into your applications with our REST API." />

              <div className="mb-6 bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-sm text-zinc-400 font-[family-name:var(--font-spacemono)]">
                  All endpoints are relative to <code className="text-[#4ADE80]">https://api.kryptos.dev</code>.
                  Responses are JSON. No API key is required for public endpoints.
                  Authenticated endpoints require a JWT token in the <code className="text-[#4ADE80]">Authorization: Bearer</code> header.
                </p>
              </div>

              <div className="space-y-8">
                {/* Core */}
                <div>
                  <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                    <Zap size={16} className="text-[#4ADE80]" />Core Analysis
                  </h3>
                  <div className="space-y-2">
                    {coreEndpoints.map((ep) => <EndpointCard key={ep.path} ep={ep} />)}
                  </div>
                </div>

                {/* Advanced */}
                <div>
                  <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                    <Brain size={16} className="text-purple-400" />Advanced Analytics
                  </h3>
                  <div className="space-y-2">
                    {advancedEndpoints.map((ep) => <EndpointCard key={ep.path} ep={ep} />)}
                  </div>
                </div>

                {/* Token & Contract */}
                <div>
                  <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                    <FileJson size={16} className="text-yellow-400" />Token & Contract
                  </h3>
                  <div className="space-y-2">
                    {tokenContractEndpoints.map((ep) => <EndpointCard key={ep.path} ep={ep} />)}
                  </div>
                </div>

                {/* Batch */}
                <div>
                  <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                    <Layers size={16} className="text-blue-400" />Batch Analysis
                  </h3>
                  <div className="space-y-2">
                    {batchEndpoints.map((ep) => <EndpointCard key={ep.path} ep={ep} />)}
                  </div>
                </div>

                {/* Share */}
                <div>
                  <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                    <Link2 size={16} className="text-[#4ADE80]" />Shareable Reports
                  </h3>
                  <div className="space-y-2">
                    {shareEndpoints.map((ep) => <EndpointCard key={ep.path} ep={ep} />)}
                  </div>
                </div>

                {/* Auth */}
                <div>
                  <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                    <Shield size={16} className="text-orange-400" />Authentication (SIWE)
                  </h3>
                  <p className="text-sm text-zinc-500 mb-3 font-[family-name:var(--font-spacemono)]">
                    Wallet-based auth using Sign-In with Ethereum. JWT tokens expire after 72 hours.
                  </p>
                  <div className="space-y-2">
                    {authEndpoints.map((ep) => <EndpointCard key={ep.path} ep={ep} />)}
                  </div>
                </div>

                {/* Community */}
                <div>
                  <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                    <MessageSquare size={16} className="text-pink-400" />Community Reports
                  </h3>
                  <div className="space-y-2">
                    {communityEndpoints.map((ep) => <EndpointCard key={ep.path} ep={ep} />)}
                  </div>
                </div>
              </div>
            </section>

            {/* ── Footer ── */}
            <div className="border-t border-white/5 pt-8 text-center">
              <p className="text-zinc-500 text-sm font-[family-name:var(--font-spacemono)]">
                Kryptos v4.0.0 · Built for blockchain intelligence.
              </p>
            </div>

          </div>
        </div>
      </div>
    </main>
  );
}
