"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Zap,
  Lock,
  Code2,
  Globe,
  BarChart3,
  Shield,
  GitBranch,
  Layers,
  ChevronRight,
  ChevronDown,
  Copy,
  Check,
  Search,
  Menu,
  X,
  ArrowRight,
  Terminal,
  Cpu,
  Database,
  AlertTriangle,
  Activity,
  FileCode,
  ExternalLink,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  children?: { id: string; label: string }[];
}

// ─── Sidebar navigation data ──────────────────────────────────────────────────

const navSections: NavItem[] = [
  {
    id: "introduction",
    label: "Introduction",
    icon: <BookOpen className="h-4 w-4" />,
    children: [
      { id: "what-is-kryptos", label: "What is Kryptos?" },
      { id: "core-features", label: "Core Features" },
      { id: "supported-chains", label: "Supported Chains" },
    ],
  },
  {
    id: "quickstart",
    label: "Quick Start",
    icon: <Zap className="h-4 w-4" />,
    children: [
      { id: "getting-an-api-key", label: "Getting an API Key" },
      { id: "first-request", label: "Your First Request" },
      { id: "response-format", label: "Response Format" },
    ],
  },
  {
    id: "authentication",
    label: "Authentication",
    icon: <Lock className="h-4 w-4" />,
    children: [
      { id: "jwt-auth", label: "JWT Authentication" },
      { id: "wallet-auth", label: "Wallet Authentication" },
      { id: "api-keys", label: "API Keys" },
    ],
  },
  {
    id: "api-reference",
    label: "API Reference",
    icon: <Code2 className="h-4 w-4" />,
    children: [
      { id: "wallet-scanner", label: "Wallet Scanner" },
      { id: "risk-score", label: "Risk Scoring" },
      { id: "portfolio", label: "Portfolio Analysis" },
      { id: "smart-contract", label: "Smart Contract Audit" },
      { id: "fund-flow", label: "Fund Flow Tracing" },
      { id: "bulk-screening", label: "Bulk Screening" },
    ],
  },
  {
    id: "risk-model",
    label: "Risk Model",
    icon: <Cpu className="h-4 w-4" />,
    children: [
      { id: "scoring-methodology", label: "Scoring Methodology" },
      { id: "risk-categories", label: "Risk Categories" },
      { id: "gnn-model", label: "GNN Architecture" },
    ],
  },
  {
    id: "on-chain-registry",
    label: "On-Chain Registry",
    icon: <Database className="h-4 w-4" />,
    children: [
      { id: "registry-overview", label: "Registry Overview" },
      { id: "contract-abi", label: "Contract ABI" },
    ],
  },
  {
    id: "rate-limits",
    label: "Rate Limits",
    icon: <Activity className="h-4 w-4" />,
    children: [
      { id: "plan-limits", label: "Plan Limits" },
      { id: "error-codes", label: "Error Codes" },
    ],
  },
  {
    id: "sdk",
    label: "SDK & Extensions",
    icon: <Layers className="h-4 w-4" />,
    children: [
      { id: "javascript-sdk", label: "JavaScript / TypeScript" },
      { id: "python-sdk", label: "Python SDK" },
      { id: "chrome-extension", label: "Chrome Extension" },
    ],
  },
];

// ─── Supported chains data ────────────────────────────────────────────────────

const chains = [
  { name: "Ethereum", id: 1, symbol: "ETH", color: "#627EEA" },
  { name: "BNB Chain", id: 56, symbol: "BNB", color: "#F3BA2F" },
  { name: "Polygon", id: 137, symbol: "MATIC", color: "#8247E5" },
  { name: "Arbitrum", id: 42161, symbol: "ARB", color: "#28A0F0" },
  { name: "Optimism", id: 10, symbol: "OP", color: "#FF0420" },
  { name: "Avalanche", id: 43114, symbol: "AVAX", color: "#E84142" },
  { name: "Base", id: 8453, symbol: "BASE", color: "#0052FF" },
  { name: "zkSync", id: 324, symbol: "ZK", color: "#8C8DFC" },
  { name: "Linea", id: 59144, symbol: "ETH", color: "#61DFFF" },
  { name: "Scroll", id: 534352, symbol: "ETH", color: "#EEB14B" },
  { name: "Fantom", id: 250, symbol: "FTM", color: "#1969FF" },
  { name: "Gnosis", id: 100, symbol: "xDAI", color: "#04795B" },
  { name: "Cronos", id: 25, symbol: "CRO", color: "#002D74" },
  { name: "Celo", id: 42220, symbol: "CELO", color: "#35D07F" },
];

// ─── API endpoints ────────────────────────────────────────────────────────────

const endpoints = [
  {
    method: "GET",
    path: "/api/v1/wallet/{address}",
    description: "Retrieve full risk analysis for a wallet address.",
    params: [
      {
        name: "address",
        type: "string",
        required: true,
        desc: "EVM wallet address (0x...)",
      },
      {
        name: "chain_id",
        type: "integer",
        required: false,
        desc: "Chain ID (default: 1 for Ethereum)",
      },
      {
        name: "depth",
        type: "integer",
        required: false,
        desc: "Fund flow trace depth, 1–5 (default: 2)",
      },
    ],
    response: `{
  "address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  "chain_id": 1,
  "risk_score": 12,
  "risk_label": "low",
  "flags": [],
  "transaction_count": 4821,
  "first_seen": "2020-01-14T09:32:11Z",
  "last_seen": "2025-06-01T17:04:52Z",
  "balance_usd": 2341850.44,
  "labels": ["known-entity", "vitalik.eth"]
}`,
  },
  {
    method: "POST",
    path: "/api/v1/wallet/bulk",
    description: "Screen up to 50 wallet addresses in a single request.",
    params: [
      {
        name: "addresses",
        type: "string[]",
        required: true,
        desc: "Array of EVM wallet addresses",
      },
      {
        name: "chain_id",
        type: "integer",
        required: false,
        desc: "Chain ID applied to all addresses",
      },
    ],
    response: `{
  "results": [
    {
      "address": "0xabc...",
      "risk_score": 87,
      "risk_label": "critical",
      "flags": ["mixer_linked", "sanctioned"]
    },
    {
      "address": "0xdef...",
      "risk_score": 5,
      "risk_label": "low",
      "flags": []
    }
  ],
  "processed": 2,
  "failed": 0
}`,
  },
  {
    method: "GET",
    path: "/api/v1/portfolio/{address}",
    description:
      "Get token holdings, DeFi positions, and portfolio risk breakdown.",
    params: [
      {
        name: "address",
        type: "string",
        required: true,
        desc: "EVM wallet address",
      },
      {
        name: "chain_ids",
        type: "string",
        required: false,
        desc: "Comma-separated chain IDs (default: all)",
      },
    ],
    response: `{
  "address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  "total_value_usd": 2341850.44,
  "tokens": [...],
  "defi_positions": [...],
  "nfts": [...],
  "portfolio_risk_score": 18,
  "chains_active": [1, 137, 42161]
}`,
  },
  {
    method: "POST",
    path: "/api/v1/contract/audit",
    description:
      "Submit a smart contract address for automated security audit.",
    params: [
      {
        name: "address",
        type: "string",
        required: true,
        desc: "Contract address",
      },
      {
        name: "chain_id",
        type: "integer",
        required: true,
        desc: "Chain ID where the contract is deployed",
      },
      {
        name: "verify_source",
        type: "boolean",
        required: false,
        desc: "Attempt to fetch verified source from block explorer",
      },
    ],
    response: `{
  "contract": "0x...",
  "grade": "B+",
  "score": 74,
  "findings": [
    {
      "id": "REEN-001",
      "severity": "high",
      "title": "Reentrancy in withdraw()",
      "line": 142,
      "description": "...",
      "recommendation": "..."
    }
  ],
  "summary": {
    "critical": 0,
    "high": 1,
    "medium": 3,
    "low": 5,
    "informational": 8
  }
}`,
  },
  {
    method: "GET",
    path: "/api/v1/trace/{tx_hash}",
    description: "Trace fund flows from a transaction hash up to N hops.",
    params: [
      {
        name: "tx_hash",
        type: "string",
        required: true,
        desc: "Transaction hash (0x...)",
      },
      { name: "chain_id", type: "integer", required: true, desc: "Chain ID" },
      {
        name: "hops",
        type: "integer",
        required: false,
        desc: "Max hops to trace, 1–5 (default: 3)",
      },
    ],
    response: `{
  "origin_tx": "0xabc...",
  "total_hops": 3,
  "total_value_usd": 150000,
  "nodes": [...],
  "edges": [...],
  "flagged_addresses": [
    {
      "address": "0x...",
      "hop": 2,
      "flag": "tornado_cash_linked"
    }
  ]
}`,
  },
];

// ─── Risk categories ──────────────────────────────────────────────────────────

const riskCategories = [
  {
    score: "0–25",
    label: "Low",
    color: "#00FF94",
    bg: "rgba(0,255,148,0.08)",
    border: "rgba(0,255,148,0.2)",
    desc: "Address shows no significant risk signals. Safe to transact.",
  },
  {
    score: "26–50",
    label: "Moderate",
    color: "#FFB800",
    bg: "rgba(255,184,0,0.08)",
    border: "rgba(255,184,0,0.2)",
    desc: "Minor flags detected. Proceed with normal due diligence.",
  },
  {
    score: "51–75",
    label: "High",
    color: "#FF8C00",
    bg: "rgba(255,140,0,0.08)",
    border: "rgba(255,140,0,0.2)",
    desc: "Multiple risk signals. Enhanced due diligence recommended.",
  },
  {
    score: "76–100",
    label: "Critical",
    color: "#FF3B3B",
    bg: "rgba(255,59,59,0.08)",
    border: "rgba(255,59,59,0.2)",
    desc: "Severe risk indicators. Mixer-linked, sanctioned, or exploit-related.",
  },
];

// ─── Rate limit plans ─────────────────────────────────────────────────────────

const rateLimitPlans = [
  {
    plan: "Free",
    requests: "100 / day",
    burst: "5 / min",
    concurrent: 1,
    bulk: "—",
  },
  {
    plan: "Pro",
    requests: "10,000 / day",
    burst: "60 / min",
    concurrent: 5,
    bulk: "50 addresses",
  },
  {
    plan: "Enterprise",
    requests: "Unlimited",
    burst: "600 / min",
    concurrent: 20,
    bulk: "500 addresses",
  },
];

// ─── Error codes ──────────────────────────────────────────────────────────────

const errorCodes = [
  {
    code: 400,
    name: "Bad Request",
    desc: "Malformed request or invalid parameters.",
  },
  {
    code: 401,
    name: "Unauthorized",
    desc: "Missing or invalid API key / JWT.",
  },
  {
    code: 403,
    name: "Forbidden",
    desc: "Feature not available on current plan.",
  },
  { code: 404, name: "Not Found", desc: "Address or resource not indexed." },
  {
    code: 422,
    name: "Unprocessable Entity",
    desc: "Invalid Ethereum address format.",
  },
  {
    code: 429,
    name: "Too Many Requests",
    desc: "Rate limit exceeded. See Retry-After header.",
  },
  {
    code: 500,
    name: "Internal Server Error",
    desc: "Unexpected server error. Contact support.",
  },
];

// ─── Code block component ─────────────────────────────────────────────────────

function CodeBlock({
  code,
  language = "bash",
}: {
  code: string;
  language?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative my-5 overflow-hidden rounded-xl border border-[#1A1A1A] bg-[#0A0A0A]">
      <div className="flex items-center justify-between border-b border-[#1A1A1A] px-4 py-2.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#555555]">
          {language}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[#555555] transition-colors hover:bg-white/5 hover:text-white"
          aria-label="Copy code"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-[#00FF94]" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          <span className="font-mono text-[10px]">
            {copied ? "Copied" : "Copy"}
          </span>
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-[#E5E7EB]">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// ─── Method badge ─────────────────────────────────────────────────────────────

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: "rgba(0,255,148,0.1)",
    POST: "rgba(99,102,241,0.1)",
    PUT: "rgba(255,184,0,0.1)",
    DELETE: "rgba(255,59,59,0.1)",
    PATCH: "rgba(255,140,0,0.1)",
  };
  const textColors: Record<string, string> = {
    GET: "#00FF94",
    POST: "#818CF8",
    PUT: "#FFB800",
    DELETE: "#FF3B3B",
    PATCH: "#FF8C00",
  };

  return (
    <span
      className="inline-block rounded-md px-2.5 py-0.5 font-mono text-xs font-bold uppercase tracking-wide"
      style={{
        background: colors[method] ?? "rgba(255,255,255,0.05)",
        color: textColors[method] ?? "#fff",
      }}
    >
      {method}
    </span>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────

function SectionHeading({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  return (
    <h2
      id={id}
      className="group mt-14 scroll-mt-24 font-array text-2xl font-semibold tracking-tight text-white first:mt-0"
    >
      {children}
      <a
        href={`#${id}`}
        className="ml-2 inline-block align-middle text-[#2A2A2A] opacity-0 transition-opacity group-hover:opacity-100"
        aria-label={`Link to ${children}`}
      >
        #
      </a>
    </h2>
  );
}

function SubHeading({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  return (
    <h3
      id={id}
      className="group mt-9 scroll-mt-24 font-array text-lg font-semibold tracking-tight text-white"
    >
      {children}
    </h3>
  );
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 font-array text-[15px] leading-relaxed text-[#888888]">
      {children}
    </p>
  );
}

function Callout({
  type = "info",
  children,
}: {
  type?: "info" | "warning" | "tip" | "danger";
  children: React.ReactNode;
}) {
  const styles = {
    info: {
      border: "rgba(99,102,241,0.3)",
      bg: "rgba(99,102,241,0.06)",
      icon: <Activity className="h-4 w-4 text-indigo-400 shrink-0" />,
      text: "text-indigo-300",
    },
    warning: {
      border: "rgba(255,184,0,0.3)",
      bg: "rgba(255,184,0,0.06)",
      icon: <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0" />,
      text: "text-yellow-300",
    },
    tip: {
      border: "rgba(0,255,148,0.25)",
      bg: "rgba(0,255,148,0.05)",
      icon: <Zap className="h-4 w-4 text-[#00FF94] shrink-0" />,
      text: "text-[#00FF94]",
    },
    danger: {
      border: "rgba(255,59,59,0.3)",
      bg: "rgba(255,59,59,0.06)",
      icon: <X className="h-4 w-4 text-red-400 shrink-0" />,
      text: "text-red-300",
    },
  };
  const s = styles[type];

  return (
    <div
      className="my-5 flex items-start gap-3 rounded-xl border p-4"
      style={{ borderColor: s.border, background: s.bg }}
    >
      {s.icon}
      <p className={`font-array text-sm leading-relaxed ${s.text}`}>
        {children}
      </p>
    </div>
  );
}

// ─── Param table ──────────────────────────────────────────────────────────────

function ParamTable({
  params,
}: {
  params: { name: string; type: string; required: boolean; desc: string }[];
}) {
  return (
    <div className="my-5 overflow-hidden rounded-xl border border-[#1A1A1A]">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[#1A1A1A] bg-[#0A0A0A]">
            <th className="px-4 py-2.5 font-mono text-[11px] uppercase tracking-widest text-[#555555]">
              Parameter
            </th>
            <th className="px-4 py-2.5 font-mono text-[11px] uppercase tracking-widest text-[#555555]">
              Type
            </th>
            <th className="px-4 py-2.5 font-mono text-[11px] uppercase tracking-widest text-[#555555]">
              Required
            </th>
            <th className="px-4 py-2.5 font-mono text-[11px] uppercase tracking-widest text-[#555555]">
              Description
            </th>
          </tr>
        </thead>
        <tbody>
          {params.map((p, i) => (
            <tr
              key={p.name}
              className="border-b border-[#111111] transition-colors hover:bg-white/[0.02]"
            >
              <td className="px-4 py-3 font-mono text-xs text-[#00FF94]">
                {p.name}
              </td>
              <td className="px-4 py-3 font-mono text-xs text-indigo-400">
                {p.type}
              </td>
              <td className="px-4 py-3">
                {p.required ? (
                  <span className="rounded-full bg-red-500/10 px-2 py-0.5 font-mono text-[10px] text-red-400">
                    required
                  </span>
                ) : (
                  <span className="rounded-full bg-white/5 px-2 py-0.5 font-mono text-[10px] text-[#555555]">
                    optional
                  </span>
                )}
              </td>
              <td className="px-4 py-3 font-array text-xs leading-relaxed text-[#888888]">
                {p.desc}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({
  activeSection,
  onNavigate,
}: {
  activeSection: string;
  onNavigate: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(navSections.map((s) => [s.id, true])),
  );

  const toggle = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <nav
      className="flex flex-col gap-1 py-6"
      aria-label="Documentation navigation"
    >
      {navSections.map((section) => (
        <div key={section.id}>
          <button
            onClick={() => {
              toggle(section.id);
              if (section.children?.[0]) onNavigate(section.children[0].id);
            }}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left font-array text-sm transition-colors ${
              activeSection === section.id
                ? "bg-white/5 text-white"
                : "text-[#888888] hover:bg-white/[0.03] hover:text-white"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <span
                className={
                  activeSection === section.id
                    ? "text-[#00FF94]"
                    : "text-[#555555]"
                }
              >
                {section.icon}
              </span>
              {section.label}
            </span>
            {section.children && (
              <span
                className={`transition-transform duration-200 ${expanded[section.id] ? "rotate-90" : ""}`}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </span>
            )}
          </button>

          <AnimatePresence initial={false}>
            {expanded[section.id] && section.children && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="ml-3 mt-0.5 flex flex-col gap-0.5 border-l border-[#1A1A1A] pl-3">
                  {section.children.map((child) => (
                    <button
                      key={child.id}
                      onClick={() => onNavigate(child.id)}
                      className={`rounded-md px-2 py-1.5 text-left font-array text-xs transition-colors ${
                        activeSection === child.id
                          ? "text-[#00FF94]"
                          : "text-[#555555] hover:text-[#888888]"
                      }`}
                    >
                      {child.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </nav>
  );
}

// ─── Main docs content ────────────────────────────────────────────────────────

function DocsContent() {
  return (
    <div className="min-w-0 max-w-none">
      {/* ── INTRODUCTION ─────────────────────────────────────────── */}
      <section id="introduction">
        <div className="mb-3 flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#00FF94]/10 text-[#00FF94]">
            <BookOpen className="h-4 w-4" />
          </span>
          <span className="font-array text-xs uppercase tracking-[0.3em] text-[#00FF94]">
            Introduction
          </span>
        </div>
        <h1 className="font-array text-[clamp(2rem,4vw,3.5rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-white">
          Kryptos Documentation
        </h1>
        <Paragraph>
          Welcome to the official Kryptos developer documentation. Kryptos is a
          full-stack blockchain intelligence platform combining machine
          learning, graph neural networks, and on-chain data analysis to provide
          real-time risk intelligence across 14 EVM-compatible chains.
        </Paragraph>
        <Paragraph>
          Whether you're a developer integrating wallet risk checks into your
          dApp, a compliance team running AML/KYC screening, or a security
          researcher tracing stolen funds — this documentation covers everything
          you need to get started.
        </Paragraph>

        <div className="my-8 grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: <Zap className="h-5 w-5" />,
              title: "Quick Start",
              desc: "Make your first API call in under 5 minutes.",
              href: "#first-request",
            },
            {
              icon: <Code2 className="h-5 w-5" />,
              title: "API Reference",
              desc: "Complete endpoint reference with examples.",
              href: "#wallet-scanner",
            },
            {
              icon: <Shield className="h-5 w-5" />,
              title: "Risk Model",
              desc: "Understand how scores are computed.",
              href: "#scoring-methodology",
            },
          ].map((card) => (
            <a
              key={card.title}
              href={card.href}
              className="group flex flex-col gap-3 rounded-xl border border-[#1A1A1A] bg-[#0A0A0A] p-5 transition-all hover:border-[#2A2A2A] hover:bg-[#111111]"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-[#00FF94] transition-colors group-hover:bg-[#00FF94]/10">
                {card.icon}
              </span>
              <div>
                <p className="font-array text-sm font-semibold text-white">
                  {card.title}
                </p>
                <p className="mt-1 font-array text-xs leading-relaxed text-[#555555]">
                  {card.desc}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-[#555555] transition-transform group-hover:translate-x-1 group-hover:text-[#00FF94]" />
            </a>
          ))}
        </div>
      </section>

      {/* What is Kryptos */}
      <SectionHeading id="what-is-kryptos">What is Kryptos?</SectionHeading>
      <Paragraph>
        Kryptos is an on-chain intelligence platform that assigns a 0–100 risk
        score to any EVM wallet address. Under the hood, our system processes
        raw transaction graphs through a{" "}
        <span className="text-white">Graph Neural Network (GNN)</span> ensemble
        combined with an <span className="text-white">Isolation Forest</span>{" "}
        for anomaly detection.
      </Paragraph>
      <Paragraph>
        Results are published to a smart contract on Base Sepolia, creating a
        permanent, public, censorship-resistant risk registry. Every score is
        reproducible, auditable, and tied to a block hash.
      </Paragraph>

      {/* Core Features */}
      <SectionHeading id="core-features">Core Features</SectionHeading>

      <div className="my-6 grid gap-3 sm:grid-cols-2">
        {[
          {
            icon: <Shield className="h-4 w-4" />,
            title: "Wallet Risk Scoring",
            desc: "0–100 risk score powered by GNN + Isolation Forest ensemble.",
          },
          {
            icon: <FileCode className="h-4 w-4" />,
            title: "Smart Contract Audit",
            desc: "Automated severity-classified findings with an A–F letter grade.",
          },
          {
            icon: <GitBranch className="h-4 w-4" />,
            title: "Fund Flow Tracing",
            desc: "Trace stolen funds up to 5 hops across all supported chains.",
          },
          {
            icon: <Layers className="h-4 w-4" />,
            title: "Portfolio Analysis",
            desc: "Aggregate holdings, DeFi positions, and NFTs across 14 chains.",
          },
          {
            icon: <Globe className="h-4 w-4" />,
            title: "Bulk Screening",
            desc: "Batch-analyze up to 500 wallets via API or CSV upload.",
          },
          {
            icon: <Database className="h-4 w-4" />,
            title: "On-Chain Registry",
            desc: "Every score stored permanently on Base Sepolia.",
          },
        ].map((f) => (
          <div
            key={f.title}
            className="flex items-start gap-3 rounded-xl border border-[#1A1A1A] bg-[#0A0A0A] p-4"
          >
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#00FF94]/10 text-[#00FF94]">
              {f.icon}
            </span>
            <div>
              <p className="font-array text-sm font-semibold text-white">
                {f.title}
              </p>
              <p className="mt-0.5 font-array text-xs leading-relaxed text-[#555555]">
                {f.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Supported Chains */}
      <SectionHeading id="supported-chains">Supported Chains</SectionHeading>
      <Paragraph>
        Kryptos indexes and analyzes data across 14 EVM-compatible chains. Pass
        a{" "}
        <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-[#00FF94]">
          chain_id
        </code>{" "}
        parameter to any endpoint to scope your request to a specific network.
      </Paragraph>

      <div className="my-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {chains.map((chain) => (
          <div
            key={chain.id}
            className="flex items-center gap-3 rounded-lg border border-[#1A1A1A] bg-[#0A0A0A] px-3.5 py-2.5"
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: chain.color }}
            />
            <span className="font-array text-sm text-white">{chain.name}</span>
            <span className="ml-auto font-mono text-[10px] text-[#555555]">
              {chain.id}
            </span>
          </div>
        ))}
      </div>

      {/* ── QUICKSTART ───────────────────────────────────────────── */}
      <div className="mt-16 mb-3 flex items-center gap-2 border-t border-[#111111] pt-16">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#00FF94]/10 text-[#00FF94]">
          <Zap className="h-4 w-4" />
        </span>
        <span className="font-array text-xs uppercase tracking-[0.3em] text-[#00FF94]">
          Quick Start
        </span>
      </div>

      <SectionHeading id="getting-an-api-key">
        Getting an API Key
      </SectionHeading>
      <Paragraph>
        All API requests must be authenticated. To get your API key, create a
        free account at{" "}
        <a
          href="/auth"
          className="text-[#00FF94] underline underline-offset-2 hover:no-underline"
        >
          kryptos.io/auth
        </a>{" "}
        and navigate to{" "}
        <strong className="text-white">Settings → API Keys</strong>. Free-tier
        keys are issued immediately. Pro and Enterprise keys unlock higher rate
        limits and bulk endpoints.
      </Paragraph>
      <Callout type="tip">
        Store your API key in an environment variable — never hard-code it in
        client-side code.
      </Callout>

      <SectionHeading id="first-request">Your First Request</SectionHeading>
      <Paragraph>
        Scan any Ethereum address with a single cURL call. Replace{" "}
        <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-[#00FF94]">
          YOUR_API_KEY
        </code>{" "}
        with the key from your dashboard.
      </Paragraph>
      <CodeBlock
        language="bash"
        code={`curl -X GET \\
  "https://api.kryptos.io/api/v1/wallet/0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json"`}
      />
      <Paragraph>You'll receive a JSON response like this:</Paragraph>
      <CodeBlock
        language="json"
        code={`{
  "address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  "chain_id": 1,
  "risk_score": 12,
  "risk_label": "low",
  "flags": [],
  "transaction_count": 4821,
  "first_seen": "2020-01-14T09:32:11Z",
  "last_seen": "2025-06-01T17:04:52Z",
  "balance_usd": 2341850.44,
  "labels": ["known-entity", "vitalik.eth"]
}`}
      />

      <SectionHeading id="response-format">Response Format</SectionHeading>
      <Paragraph>
        All endpoints return{" "}
        <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-[#00FF94]">
          application/json
        </code>
        . Successful responses use HTTP{" "}
        <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-[#00FF94]">
          200
        </code>
        . Errors always include a top-level{" "}
        <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-[#00FF94]">
          detail
        </code>{" "}
        field describing what went wrong.
      </Paragraph>
      <CodeBlock
        language="json"
        code={`// Error response shape
{
  "detail": "Rate limit exceeded. Retry after 60 seconds.",
  "code": 429,
  "retry_after": 60
}`}
      />

      {/* ── AUTHENTICATION ───────────────────────────────────────── */}
      <div className="mt-16 mb-3 flex items-center gap-2 border-t border-[#111111] pt-16">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#00FF94]/10 text-[#00FF94]">
          <Lock className="h-4 w-4" />
        </span>
        <span className="font-array text-xs uppercase tracking-[0.3em] text-[#00FF94]">
          Authentication
        </span>
      </div>

      <SectionHeading id="jwt-auth">JWT Authentication</SectionHeading>
      <Paragraph>
        Email/password login returns a short-lived JWT. Include it in every
        request as a{" "}
        <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-[#00FF94]">
          Bearer
        </code>{" "}
        token. JWTs expire after 24 hours — use the{" "}
        <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-[#00FF94]">
          /auth/refresh
        </code>{" "}
        endpoint to rotate.
      </Paragraph>
      <CodeBlock
        language="bash"
        code={`# Login
curl -X POST https://api.kryptos.io/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email": "you@example.com", "password": "••••••••"}'

# Response
{
  "access_token": "eyJhbGci...",
  "token_type": "bearer",
  "expires_in": 86400
}`}
      />

      <SectionHeading id="wallet-auth">Wallet Authentication</SectionHeading>
      <Paragraph>
        Connect your EVM wallet via a sign-in-with-Ethereum (SIWE) flow. The
        backend issues a JWT bound to your wallet address — no email required.
      </Paragraph>
      <CodeBlock
        language="typescript"
        code={`import { signMessage } from "wagmi/actions";

// 1. Request a nonce
const { nonce } = await fetch("/auth/nonce").then(r => r.json());

// 2. Sign the message
const signature = await signMessage({
  message: \`Sign in to Kryptos\\nNonce: \${nonce}\`,
});

// 3. Verify and receive JWT
const { access_token } = await fetch("/auth/wallet", {
  method: "POST",
  body: JSON.stringify({ address, signature, nonce }),
}).then(r => r.json());`}
      />

      <SectionHeading id="api-keys">API Keys</SectionHeading>
      <Paragraph>
        Long-lived API keys are available for server-to-server integrations.
        Generate them from your dashboard and pass them via the{" "}
        <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-[#00FF94]">
          X-API-Key
        </code>{" "}
        header or as a{" "}
        <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-[#00FF94]">
          Bearer
        </code>{" "}
        token. API keys inherit the rate limits of the plan they were created
        under.
      </Paragraph>
      <Callout type="warning">
        API keys do not expire automatically. Rotate them immediately if you
        suspect a leak. You can revoke any key from the API Keys section of your
        dashboard.
      </Callout>

      {/* ── API REFERENCE ────────────────────────────────────────── */}
      <div className="mt-16 mb-3 flex items-center gap-2 border-t border-[#111111] pt-16">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#00FF94]/10 text-[#00FF94]">
          <Code2 className="h-4 w-4" />
        </span>
        <span className="font-array text-xs uppercase tracking-[0.3em] text-[#00FF94]">
          API Reference
        </span>
      </div>

      <p className="mt-2 font-array text-[15px] leading-relaxed text-[#888888]">
        Base URL:{" "}
        <code className="rounded bg-white/5 px-2 py-0.5 font-mono text-sm text-white">
          https://api.kryptos.io
        </code>
      </p>

      {/* Wallet Scanner */}
      <SubHeading id="wallet-scanner">Wallet Scanner</SubHeading>
      <div className="my-3 flex items-center gap-3">
        <MethodBadge method="GET" />
        <code className="font-mono text-sm text-[#E5E7EB]">
          /api/v1/wallet/{"{address}"}
        </code>
      </div>
      <Paragraph>{endpoints[0].description}</Paragraph>
      <ParamTable params={endpoints[0].params} />
      <p className="mt-4 font-array text-xs uppercase tracking-[0.2em] text-[#555555]">
        Response
      </p>
      <CodeBlock language="json" code={endpoints[0].response} />

      {/* Risk Score */}
      <SubHeading id="risk-score">Risk Scoring</SubHeading>
      <Paragraph>
        Risk scores are pre-computed and cached for 15 minutes. To force a fresh
        computation pass the query parameter{" "}
        <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-[#00FF94]">
          refresh=true
        </code>
        . This counts as two API calls.
      </Paragraph>
      <CodeBlock
        language="bash"
        code={`# Force refresh
curl "https://api.kryptos.io/api/v1/wallet/0xabc...?refresh=true" \\
  -H "Authorization: Bearer YOUR_API_KEY"`}
      />
      <Callout type="info">
        The <strong>risk_label</strong> field is one of:{" "}
        <code className="font-mono text-xs">low</code>,{" "}
        <code className="font-mono text-xs">moderate</code>,{" "}
        <code className="font-mono text-xs">high</code>, or{" "}
        <code className="font-mono text-xs">critical</code>. See the Risk Model
        section for thresholds.
      </Callout>

      {/* Portfolio */}
      <SubHeading id="portfolio">Portfolio Analysis</SubHeading>
      <div className="my-3 flex items-center gap-3">
        <MethodBadge method="GET" />
        <code className="font-mono text-sm text-[#E5E7EB]">
          /api/v1/portfolio/{"{address}"}
        </code>
      </div>
      <Paragraph>{endpoints[2].description}</Paragraph>
      <ParamTable params={endpoints[2].params} />
      <CodeBlock language="json" code={endpoints[2].response} />

      {/* Smart Contract */}
      <SubHeading id="smart-contract">Smart Contract Audit</SubHeading>
      <div className="my-3 flex items-center gap-3">
        <MethodBadge method="POST" />
        <code className="font-mono text-sm text-[#E5E7EB]">
          /api/v1/contract/audit
        </code>
      </div>
      <Paragraph>{endpoints[3].description}</Paragraph>
      <ParamTable params={endpoints[3].params} />
      <CodeBlock language="json" code={endpoints[3].response} />
      <Callout type="tip">
        Audits are queued and typically complete within 30–90 seconds. Poll{" "}
        <code className="font-mono text-xs">
          /api/v1/contract/audit/{"{job_id}"}/status
        </code>{" "}
        or provide a webhook URL in the request body to receive a callback.
      </Callout>

      {/* Fund Flow */}
      <SubHeading id="fund-flow">Fund Flow Tracing</SubHeading>
      <div className="my-3 flex items-center gap-3">
        <MethodBadge method="GET" />
        <code className="font-mono text-sm text-[#E5E7EB]">
          /api/v1/trace/{"{tx_hash}"}
        </code>
      </div>
      <Paragraph>{endpoints[4].description}</Paragraph>
      <ParamTable params={endpoints[4].params} />
      <CodeBlock language="json" code={endpoints[4].response} />

      {/* Bulk Screening */}
      <SubHeading id="bulk-screening">Bulk Screening</SubHeading>
      <div className="my-3 flex items-center gap-3">
        <MethodBadge method="POST" />
        <code className="font-mono text-sm text-[#E5E7EB]">
          /api/v1/wallet/bulk
        </code>
      </div>
      <Paragraph>{endpoints[1].description}</Paragraph>
      <ParamTable params={endpoints[1].params} />
      <CodeBlock language="json" code={endpoints[1].response} />
      <Callout type="warning">
        Bulk screening is available on Pro and Enterprise plans only. Free-tier
        requests to this endpoint return HTTP 403.
      </Callout>

      {/* ── RISK MODEL ───────────────────────────────────────────── */}
      <div className="mt-16 mb-3 flex items-center gap-2 border-t border-[#111111] pt-16">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#00FF94]/10 text-[#00FF94]">
          <Cpu className="h-4 w-4" />
        </span>
        <span className="font-array text-xs uppercase tracking-[0.3em] text-[#00FF94]">
          Risk Model
        </span>
      </div>

      <SectionHeading id="scoring-methodology">
        Scoring Methodology
      </SectionHeading>
      <Paragraph>
        The Kryptos risk score (0–100) is a weighted ensemble of four sub-models
        evaluated on each wallet's transaction graph:
      </Paragraph>
      <div className="my-5 space-y-3">
        {[
          {
            weight: "40%",
            name: "GNN Behavioral Model",
            desc: "A heterogeneous graph neural network trained on labeled transaction graphs. Captures multi-hop interaction patterns that classical heuristics miss.",
          },
          {
            weight: "30%",
            name: "Isolation Forest",
            desc: "An unsupervised anomaly detector that flags statistically unusual transaction patterns — high-frequency micro-transactions, unusual time distributions, etc.",
          },
          {
            weight: "20%",
            name: "Blacklist Matching",
            desc: "Cross-references against OFAC SDN list, known mixer contracts (Tornado Cash, Railgun), and community-flagged addresses.",
          },
          {
            weight: "10%",
            name: "Heuristic Rules",
            desc: "Hard-coded signals: dust attack detection, phishing patterns, sandwich bot behavior, and flash loan abuse.",
          },
        ].map((m) => (
          <div
            key={m.name}
            className="flex items-start gap-4 rounded-xl border border-[#1A1A1A] bg-[#0A0A0A] p-4"
          >
            <span
              className="shrink-0 rounded-lg px-2.5 py-1 font-mono text-xs font-bold text-[#00FF94]"
              style={{ background: "rgba(0,255,148,0.08)" }}
            >
              {m.weight}
            </span>
            <div>
              <p className="font-array text-sm font-semibold text-white">
                {m.name}
              </p>
              <p className="mt-1 font-array text-xs leading-relaxed text-[#555555]">
                {m.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      <SectionHeading id="risk-categories">Risk Categories</SectionHeading>
      <Paragraph>
        Final scores map to four risk labels. Your application should handle
        each appropriately:
      </Paragraph>
      <div className="my-5 space-y-2">
        {riskCategories.map((cat) => (
          <div
            key={cat.label}
            className="flex items-start gap-4 rounded-xl border p-4"
            style={{ borderColor: cat.border, background: cat.bg }}
          >
            <div className="flex w-24 shrink-0 flex-col">
              <span
                className="font-array text-sm font-bold"
                style={{ color: cat.color }}
              >
                {cat.label}
              </span>
              <span className="font-mono text-xs text-[#555555]">
                {cat.score}
              </span>
            </div>
            <p
              className="font-array text-sm leading-relaxed"
              style={{ color: cat.color, opacity: 0.8 }}
            >
              {cat.desc}
            </p>
          </div>
        ))}
      </div>

      <SectionHeading id="gnn-model">GNN Architecture</SectionHeading>
      <Paragraph>
        Our GNN is a{" "}
        <span className="text-white">
          heterogeneous graph attention network (HAN)
        </span>{" "}
        with two node types (<em className="text-[#888888]">wallets</em> and{" "}
        <em className="text-[#888888]">contracts</em>) and four edge types
        (transfer, approve, call, create). Each node is featurized with 42
        on-chain statistics including:
      </Paragraph>
      <ul className="my-4 space-y-1.5 pl-4">
        {[
          "Transaction frequency over 1d / 7d / 30d windows",
          "Value distribution skewness and kurtosis",
          "Unique counterparty count",
          "Mixer interaction depth (BFS from known mixer contracts)",
          "Token diversity index",
          "Gas price behavior anomaly score",
        ].map((item) => (
          <li
            key={item}
            className="flex items-start gap-2 font-array text-sm text-[#888888]"
          >
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#00FF94]/40" />
            {item}
          </li>
        ))}
      </ul>
      <Paragraph>
        The model is retrained weekly on fresh labeled data sourced from
        Chainalysis case reports, on-chain phishing databases, and community
        submissions. Retraining is fully automated via a Prefect pipeline.
      </Paragraph>

      {/* ── ON-CHAIN REGISTRY ────────────────────────────────────── */}
      <div className="mt-16 mb-3 flex items-center gap-2 border-t border-[#111111] pt-16">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#00FF94]/10 text-[#00FF94]">
          <Database className="h-4 w-4" />
        </span>
        <span className="font-array text-xs uppercase tracking-[0.3em] text-[#00FF94]">
          On-Chain Registry
        </span>
      </div>

      <SectionHeading id="registry-overview">Registry Overview</SectionHeading>
      <Paragraph>
        Every risk score computed by Kryptos is anchored to a smart contract
        deployed on <span className="text-white">Base Sepolia</span> (chain ID
        84532). The contract stores a mapping of{" "}
        <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-[#00FF94]">
          address → RiskEntry
        </code>
        , where each entry contains the score, timestamp, block number, and a
        content hash of the full analysis JSON stored on IPFS.
      </Paragraph>
      <Callout type="tip">
        You can verify any score independently by reading the registry contract
        directly — no need to trust the Kryptos API. The contract is verified
        and open-source.
      </Callout>
      <CodeBlock
        language="solidity"
        code={`// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IKryptosRegistry {
    struct RiskEntry {
        uint8   score;        // 0–100
        uint8   riskLabel;    // 0=low 1=moderate 2=high 3=critical
        uint64  timestamp;
        uint64  blockNumber;
        bytes32 ipfsHash;     // keccak256 of IPFS CID
    }

    function getScore(address wallet) external view returns (RiskEntry memory);
    function getLatestBlock(address wallet) external view returns (uint64);
}`}
      />

      <SectionHeading id="contract-abi">Contract ABI (Excerpt)</SectionHeading>
      <CodeBlock
        language="json"
        code={`[
  {
    "name": "getScore",
    "type": "function",
    "stateMutability": "view",
    "inputs": [{ "name": "wallet", "type": "address" }],
    "outputs": [{
      "name": "",
      "type": "tuple",
      "components": [
        { "name": "score",       "type": "uint8"   },
        { "name": "riskLabel",   "type": "uint8"   },
        { "name": "timestamp",   "type": "uint64"  },
        { "name": "blockNumber", "type": "uint64"  },
        { "name": "ipfsHash",    "type": "bytes32" }
      ]
    }]
  }
]`}
      />

      {/* ── RATE LIMITS ──────────────────────────────────────────── */}
      <div className="mt-16 mb-3 flex items-center gap-2 border-t border-[#111111] pt-16">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#00FF94]/10 text-[#00FF94]">
          <Activity className="h-4 w-4" />
        </span>
        <span className="font-array text-xs uppercase tracking-[0.3em] text-[#00FF94]">
          Rate Limits
        </span>
      </div>

      <SectionHeading id="plan-limits">Plan Limits</SectionHeading>
      <Paragraph>
        Rate limits are enforced per API key using a sliding window algorithm.
        The current limit state is returned in every response via headers.
      </Paragraph>
      <CodeBlock
        language="bash"
        code={`X-RateLimit-Limit: 10000
X-RateLimit-Remaining: 9847
X-RateLimit-Reset: 1735689600
Retry-After: 60   # only present on 429 responses`}
      />
      <div className="my-5 overflow-hidden rounded-xl border border-[#1A1A1A]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#1A1A1A] bg-[#0A0A0A]">
              {[
                "Plan",
                "Requests / Day",
                "Burst",
                "Concurrent",
                "Bulk Limit",
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-2.5 font-mono text-[11px] uppercase tracking-widest text-[#555555]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rateLimitPlans.map((row) => (
              <tr
                key={row.plan}
                className="border-b border-[#111111] hover:bg-white/[0.02]"
              >
                <td className="px-4 py-3 font-array text-sm font-semibold text-white">
                  {row.plan}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-[#888888]">
                  {row.requests}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-[#888888]">
                  {row.burst}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-[#888888]">
                  {row.concurrent}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-[#888888]">
                  {row.bulk}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SectionHeading id="error-codes">Error Codes</SectionHeading>
      <div className="my-5 overflow-hidden rounded-xl border border-[#1A1A1A]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#1A1A1A] bg-[#0A0A0A]">
              {["Status", "Name", "Description"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-2.5 font-mono text-[11px] uppercase tracking-widest text-[#555555]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {errorCodes.map((e) => (
              <tr
                key={e.code}
                className="border-b border-[#111111] hover:bg-white/[0.02]"
              >
                <td className="px-4 py-3">
                  <span
                    className="inline-block rounded-md px-2 py-0.5 font-mono text-xs font-bold"
                    style={{
                      background:
                        e.code >= 500
                          ? "rgba(255,59,59,0.1)"
                          : e.code === 429
                            ? "rgba(255,184,0,0.1)"
                            : "rgba(255,255,255,0.05)",
                      color:
                        e.code >= 500
                          ? "#FF3B3B"
                          : e.code === 429
                            ? "#FFB800"
                            : "#888888",
                    }}
                  >
                    {e.code}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-[#888888]">
                  {e.name}
                </td>
                <td className="px-4 py-3 font-array text-xs text-[#555555]">
                  {e.desc}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── SDK & EXTENSIONS ─────────────────────────────────────── */}
      <div className="mt-16 mb-3 flex items-center gap-2 border-t border-[#111111] pt-16">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#00FF94]/10 text-[#00FF94]">
          <Layers className="h-4 w-4" />
        </span>
        <span className="font-array text-xs uppercase tracking-[0.3em] text-[#00FF94]">
          SDK & Extensions
        </span>
      </div>

      <SectionHeading id="javascript-sdk">
        JavaScript / TypeScript
      </SectionHeading>
      <CodeBlock
        language="bash"
        code={`npm install @kryptos/sdk
# or
yarn add @kryptos/sdk`}
      />
      <CodeBlock
        language="typescript"
        code={`import { KryptosClient } from "@kryptos/sdk";

const client = new KryptosClient({ apiKey: process.env.KRYPTOS_API_KEY });

// Scan a wallet
const result = await client.wallet.scan("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");
console.log(result.risk_score); // 12

// Bulk screen
const bulk = await client.wallet.bulkScan([
  "0xabc...",
  "0xdef...",
]);

// Audit a contract
const audit = await client.contract.audit({
  address: "0x...",
  chain_id: 1,
});
console.log(audit.grade); // "B+"

// Trace fund flows
const trace = await client.trace.fromTx({
  tx_hash: "0x...",
  chain_id: 1,
  hops: 3,
});`}
      />

      <SectionHeading id="python-sdk">Python SDK</SectionHeading>
      <CodeBlock language="bash" code={`pip install kryptos-sdk`} />
      <CodeBlock
        language="python"
        code={`from kryptos import KryptosClient
import os

client = KryptosClient(api_key=os.environ["KRYPTOS_API_KEY"])

# Scan a wallet
result = client.wallet.scan("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")
print(result.risk_score)   # 12
print(result.risk_label)   # "low"

# Bulk screen (Pro/Enterprise only)
results = client.wallet.bulk_scan([
    "0xabc...",
    "0xdef...",
])
for r in results:
    print(r.address, r.risk_score, r.flags)

# Async support
import asyncio
from kryptos import AsyncKryptosClient

async def main():
    async with AsyncKryptosClient(api_key=os.environ["KRYPTOS_API_KEY"]) as c:
        result = await c.wallet.scan("0xabc...")
        print(result)

asyncio.run(main())`}
      />

      <SectionHeading id="chrome-extension">Chrome Extension</SectionHeading>
      <Paragraph>
        The Kryptos Chrome Extension injects a risk badge directly onto any
        Ethereum address found on Etherscan, BscScan, PolygonScan, and 10 other
        block explorers — no copy-pasting required.
      </Paragraph>
      <div className="my-6 grid gap-4 sm:grid-cols-3">
        {[
          {
            step: "01",
            title: "Install",
            desc: "Download from the Chrome Web Store and pin the extension.",
          },
          {
            step: "02",
            title: "Connect",
            desc: "Click the extension icon and sign in with your Kryptos account or API key.",
          },
          {
            step: "03",
            title: "Browse",
            desc: "Visit any supported block explorer — risk badges appear automatically on every address.",
          },
        ].map((s) => (
          <div
            key={s.step}
            className="rounded-xl border border-[#1A1A1A] bg-[#0A0A0A] p-5"
          >
            <span className="font-mono text-[11px] text-[#00FF94]">
              [{s.step}]
            </span>
            <p className="mt-2 font-array text-sm font-semibold text-white">
              {s.title}
            </p>
            <p className="mt-1 font-array text-xs leading-relaxed text-[#555555]">
              {s.desc}
            </p>
          </div>
        ))}
      </div>
      <Callout type="info">
        The extension uses your account's API quota. Free-tier users get up to
        100 inline lookups per day. Upgrade to Pro for unlimited in-browser
        scanning.
      </Callout>

      {/* ── BOTTOM CTA ───────────────────────────────────────────── */}
      <div className="mt-16 rounded-2xl border border-[#1A1A1A] bg-[#0A0A0A] p-10 text-center">
        <div
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 h-40 w-80 rounded-full blur-[80px]"
          style={{ background: "rgba(0,255,148,0.05)" }}
          aria-hidden
        />
        <p className="font-array text-xs uppercase tracking-[0.4em] text-[#00FF94]">
          Ready to integrate?
        </p>
        <h2 className="mt-4 font-array text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Start building with Kryptos
        </h2>
        <p className="mx-auto mt-4 max-w-md font-array text-sm leading-relaxed text-[#888888]">
          Create a free account, grab your API key, and make your first request
          in under five minutes.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <a
            href="/auth"
            className="inline-flex items-center gap-2 rounded-full px-7 py-3 font-array text-sm font-semibold tracking-tight text-black transition-all hover:opacity-80 hover:shadow-[0_0_24px_rgba(0,255,148,0.3)]"
            style={{ backgroundColor: "#00FF94" }}
          >
            Get Started Free
            <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href="mailto:team@kryptos.io"
            className="inline-flex items-center gap-2 rounded-full border border-[#2A2A2A] px-7 py-3 font-array text-sm font-semibold tracking-tight text-[#888888] transition-all hover:border-[#444444] hover:text-white"
          >
            Contact Support
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Page wrapper ─────────────────────────────────────────────────────────────

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("introduction");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);

  const navigateTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveSection(id);
      setMobileOpen(false);
    }
  }, []);

  // Update active section on scroll
  useEffect(() => {
    const allIds = navSections.flatMap((s) =>
      s.children ? [s.id, ...s.children.map((c) => c.id)] : [s.id],
    );

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );

    allIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  // Close mobile sidebar on outside click
  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e: MouseEvent) => {
      const sidebar = document.getElementById("mobile-sidebar");
      if (sidebar && !sidebar.contains(e.target as Node)) {
        setMobileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [mobileOpen]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-white">
      <Navbar />

      {/* ── Page hero ── */}
      <div className="relative overflow-hidden border-b border-[#111111] bg-[#050505] px-6 py-14 sm:px-8 lg:px-12">
        <div
          className="pointer-events-none absolute left-1/2 top-0 h-64 w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[120px]"
          style={{ background: "rgba(0,255,148,0.05)" }}
          aria-hidden
        />
        <div className="relative mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="font-array text-xs uppercase tracking-[0.4em] text-[#00FF94]">
              Documentation
            </p>
            <h1 className="mt-3 font-array text-[clamp(2rem,4vw,3rem)] font-semibold tracking-[-0.03em] text-white">
              Kryptos Developer Docs
            </h1>
            <p className="mt-3 max-w-2xl font-array text-base leading-relaxed text-[#888888]">
              Everything you need to integrate Kryptos blockchain intelligence
              into your application — from quick start guides to the full API
              reference.
            </p>
          </motion.div>

          {/* Search bar */}
          <div className="relative mt-7 max-w-md">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#555555]" />
            <input
              type="text"
              placeholder="Search documentation…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-[#1A1A1A] bg-[#0A0A0A] py-3 pl-11 pr-4 font-array text-sm text-white placeholder:text-[#555555] focus:border-[#2A2A2A] focus:outline-none"
            />
            <kbd className="absolute right-4 top-1/2 -translate-y-1/2 rounded border border-[#2A2A2A] px-1.5 py-0.5 font-mono text-[10px] text-[#555555]">
              ⌘K
            </kbd>
          </div>
        </div>
      </div>

      {/* ── Main layout ── */}
      <div className="mx-auto max-w-7xl px-0 sm:px-6 lg:px-8">
        <div className="flex gap-0 lg:gap-8">
          {/* ── Desktop sidebar ── */}
          <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 overflow-y-auto border-r border-[#111111] pr-2 lg:block">
            <Sidebar activeSection={activeSection} onNavigate={navigateTo} />
          </aside>

          {/* ── Mobile sidebar toggle ── */}
          <div className="fixed bottom-6 right-6 z-50 lg:hidden">
            <button
              onClick={() => setMobileOpen(true)}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-[#2A2A2A] bg-[#0A0A0A] text-white shadow-xl transition hover:bg-[#111111]"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>

          {/* ── Mobile sidebar drawer ── */}
          <AnimatePresence>
            {mobileOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
                  onClick={() => setMobileOpen(false)}
                />
                <motion.aside
                  id="mobile-sidebar"
                  initial={{ x: "-100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "-100%" }}
                  transition={{ type: "spring", damping: 28, stiffness: 300 }}
                  className="fixed inset-y-0 left-0 z-50 w-72 overflow-y-auto border-r border-[#1A1A1A] bg-[#050505] px-4 lg:hidden"
                >
                  <div className="flex items-center justify-between py-5">
                    <span className="font-array text-sm font-semibold text-white">
                      Documentation
                    </span>
                    <button
                      onClick={() => setMobileOpen(false)}
                      className="text-[#555555] transition hover:text-white"
                      aria-label="Close navigation"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <Sidebar
                    activeSection={activeSection}
                    onNavigate={navigateTo}
                  />
                </motion.aside>
              </>
            )}
          </AnimatePresence>

          {/* ── Content ── */}
          <main
            ref={contentRef}
            className="min-w-0 flex-1 px-6 py-12 sm:px-8 lg:px-0 lg:py-14"
          >
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <DocsContent />
            </motion.div>
          </main>

          {/* ── Right TOC (desktop) ── */}
          <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-52 shrink-0 overflow-y-auto xl:block">
            <nav className="py-6" aria-label="On this page">
              <p className="mb-3 font-array text-[10px] uppercase tracking-[0.3em] text-[#555555]">
                On this page
              </p>
              <div className="flex flex-col gap-1">
                {navSections.map((section) =>
                  section.children?.map((child) => (
                    <button
                      key={child.id}
                      onClick={() => navigateTo(child.id)}
                      className={`rounded px-2 py-1.5 text-left font-array text-xs transition-colors ${
                        activeSection === child.id
                          ? "text-[#00FF94]"
                          : "text-[#555555] hover:text-[#888888]"
                      }`}
                    >
                      {child.label}
                    </button>
                  )),
                )}
              </div>
            </nav>
          </aside>
        </div>
      </div>

      <Footer />
    </div>
  );
}
