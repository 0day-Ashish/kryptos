"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const SLIDE_DURATION = 6000;

interface SlideProps {
  isActive: boolean;
  isPaused: boolean;
}

/* ─────────────────────────────────────────
   Slide 1 — Wallet Scanner
───────────────────────────────────────── */
function WalletScannerSlide({ isActive }: SlideProps) {
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (!isActive) {
      setScanning(false);
      setScanned(false);
      return;
    }
    const t1 = setTimeout(() => setScanning(true), 600);
    const t2 = setTimeout(() => {
      setScanning(false);
      setScanned(true);
    }, 2200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isActive]);

  const circumference = 2 * Math.PI * 38;
  const offset = circumference - (72 / 100) * circumference;

  return (
    <div className="flex h-full flex-col gap-2 bg-[#000] p-2.5">
      {/* Search bar */}
      <div className="flex items-center gap-2 rounded-lg border border-[#1A1A1A] bg-[#0A0A0A] px-3 py-2">
        <svg className="h-3.5 w-3.5 shrink-0 text-[#555]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span className="flex-1 truncate font-mono text-[10px] text-[#555]">0x742d35Cc6634C0532925a3b844Bc9e7595f2bd4...</span>
        <motion.div
          animate={{ backgroundColor: scanning ? "#FFB800" : "#00FF94" }}
          transition={{ duration: 0.3 }}
          className="ml-auto shrink-0 cursor-pointer rounded-md px-2.5 py-1 text-[9px] font-semibold text-black"
          style={{ backgroundColor: "#00FF94" }}
        >
          {scanning ? "Scanning…" : "Scan"}
        </motion.div>
      </div>

      <AnimatePresence mode="wait">
        {scanned ? (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-1 gap-2"
          >
            {/* Gauge */}
            <div className="flex flex-col items-center justify-center rounded-xl border border-[#1A1A1A] bg-[#0A0A0A] p-3" style={{ minWidth: 88 }}>
              <svg width="78" height="78" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="38" fill="none" stroke="#1A1A1A" strokeWidth="8" />
                <circle
                  cx="50" cy="50" r="38" fill="none"
                  stroke="#00FF94" strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  transform="rotate(-90 50 50)"
                />
                <text x="50" y="47" textAnchor="middle" fill="white" fontSize="18" fontWeight="bold">72</text>
                <text x="50" y="59" textAnchor="middle" fill="#00FF94" fontSize="7">LOW RISK</text>
              </svg>
              <span className="mt-1 text-[9px] text-[#555]">Risk Score</span>
            </div>

            {/* Metrics */}
            <div className="flex flex-1 flex-col gap-1.5">
              {[
                { label: "Transactions", value: "1,247", color: "#888" },
                { label: "Balance", value: "4.82 ETH", color: "#888" },
                { label: "Risk Flags", value: "0 detected", color: "#00FF94" },
                { label: "Last Active", value: "2h ago", color: "#888" },
                { label: "Chain", value: "Ethereum", color: "#888" },
              ].map((m, idx) => (
                <motion.div
                  key={m.label}
                  initial={{ opacity: 0, x: 6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.07 }}
                  className="flex items-center justify-between rounded-lg border border-[#1A1A1A] bg-[#0A0A0A] px-2.5 py-1.5"
                >
                  <span className="text-[9px] text-[#555]">{m.label}</span>
                  <span className="text-[9px] font-medium" style={{ color: m.color }}>{m.value}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="idle"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-1 items-center justify-center"
          >
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-[#1A1A1A] bg-[#0A0A0A]">
                <svg className="h-6 w-6 text-[#333]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              {scanning && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                  className="text-[10px] text-[#FFB800]"
                >
                  Analyzing on-chain data…
                </motion.p>
              )}
              {!scanning && (
                <p className="text-[10px] text-[#333]">Enter an address to begin</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────────────────────────────
   Slide 2 — Dashboard Analytics
───────────────────────────────────────── */
function DashboardAnalyticsSlide({ isActive }: SlideProps) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!isActive) { setVisible(false); return; }
    const t = setTimeout(() => setVisible(true), 300);
    return () => clearTimeout(t);
  }, [isActive]);

  const metrics = [
    { label: "Wallets Tracked", value: "24", sub: "+3 this week", color: "#00FF94" },
    { label: "High Risk", value: "3", sub: "needs review", color: "#FF3B3B" },
    { label: "Avg. Score", value: "76", sub: "healthy", color: "#00FF94" },
    { label: "Alerts", value: "2", sub: "unread", color: "#FFB800" },
  ];

  const wallets = [
    { addr: "0x503828…23da", label: "Coinbase", score: 95, risk: "Low", color: "#00FF94" },
    { addr: "0x742d35…bd4f", label: "Unknown", score: 41, risk: "Med", color: "#FFB800" },
    { addr: "0xc098b2…3a94", label: "FTX", score: 10, risk: "High", color: "#FF3B3B" },
  ];

  const bars = [
    { label: "Low Risk", pct: 62, color: "#00FF94" },
    { label: "Medium", pct: 25, color: "#FFB800" },
    { label: "High Risk", pct: 13, color: "#FF3B3B" },
  ];

  return (
    <div className="flex h-full flex-col gap-2 bg-[#000] p-2.5">
      {/* Metric cards */}
      <div className="grid grid-cols-4 gap-1.5">
        {metrics.map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 6 }}
            animate={visible ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: i * 0.08 }}
            className="rounded-lg border border-[#1A1A1A] bg-[#0A0A0A] p-2"
          >
            <p className="text-[7px] text-[#555]">{m.label}</p>
            <p className="mt-0.5 text-sm font-bold leading-none" style={{ color: m.color }}>{m.value}</p>
            <p className="mt-0.5 text-[7px] text-[#333]">{m.sub}</p>
          </motion.div>
        ))}
      </div>

      <div className="flex flex-1 gap-2 overflow-hidden">
        {/* Distribution bars */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={visible ? { opacity: 1 } : {}}
          transition={{ delay: 0.3 }}
          className="flex flex-col justify-center gap-2.5 rounded-xl border border-[#1A1A1A] bg-[#0A0A0A] px-3 py-3"
          style={{ minWidth: 108 }}
        >
          <p className="text-[8px] font-medium text-[#555]">Risk Distribution</p>
          {bars.map((b) => (
            <div key={b.label}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[7px] text-[#555]">{b.label}</span>
                <span className="text-[7px]" style={{ color: b.color }}>{b.pct}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1A1A1A]">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: b.color }}
                  initial={{ width: 0 }}
                  animate={visible ? { width: `${b.pct}%` } : {}}
                  transition={{ delay: 0.45, duration: 0.9, ease: "easeOut" }}
                />
              </div>
            </div>
          ))}
        </motion.div>

        {/* Wallet table */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={visible ? { opacity: 1 } : {}}
          transition={{ delay: 0.35 }}
          className="flex flex-1 flex-col overflow-hidden rounded-xl border border-[#1A1A1A] bg-[#0A0A0A]"
        >
          <div className="border-b border-[#1A1A1A] px-3 py-1.5">
            <p className="text-[8px] font-medium text-[#555]">Tracked Wallets</p>
          </div>
          {wallets.map((w, i) => (
            <motion.div
              key={w.addr}
              initial={{ opacity: 0, x: 8 }}
              animate={visible ? { opacity: 1, x: 0 } : {}}
              transition={{ delay: 0.4 + i * 0.1 }}
              className="flex items-center justify-between border-b border-[#0F0F0F] px-3 py-2 last:border-0"
            >
              <div>
                <p className="font-mono text-[8px] text-[#888]">{w.addr}</p>
                <p className="text-[7px] text-[#444]">{w.label}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className="rounded-full px-1.5 py-0.5 text-[7px] font-medium"
                  style={{ color: w.color, backgroundColor: `${w.color}18` }}
                >
                  {w.risk}
                </span>
                <span className="text-[10px] font-bold" style={{ color: w.color }}>{w.score}</span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Slide 3 — Transaction Flow Graph
───────────────────────────────────────── */
function TransactionFlowSlide({ isActive }: SlideProps) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!isActive) { setVisible(false); return; }
    const t = setTimeout(() => setVisible(true), 400);
    return () => clearTimeout(t);
  }, [isActive]);

  const nodes = [
    { id: "target",   x: 50, y: 50, label: "Target",   addr: "0x742d…", color: "#FFFFFF", bg: "#1A1A1A", border: "#444" },
    { id: "coinbase", x: 20, y: 18, label: "Coinbase",  addr: "0x5038…", color: "#00FF94", bg: "#00FF9412", border: "#00FF9444" },
    { id: "uniswap",  x: 80, y: 20, label: "Uniswap",   addr: "0x7a25…", color: "#00FF94", bg: "#00FF9412", border: "#00FF9444" },
    { id: "mixer",    x: 16, y: 80, label: "Mixer",     addr: "0xD90C…", color: "#FF3B3B", bg: "#FF3B3B12", border: "#FF3B3B44" },
    { id: "flagged",  x: 82, y: 78, label: "Flagged",   addr: "0xc098…", color: "#FF3B3B", bg: "#FF3B3B12", border: "#FF3B3B44" },
  ];

  const edges = [
    { from: "target",  to: "coinbase", color: "#00FF94" },
    { from: "target",  to: "uniswap",  color: "#00FF94" },
    { from: "mixer",   to: "target",   color: "#FF3B3B" },
    { from: "flagged", to: "target",   color: "#FF3B3B" },
  ];

  const getNode = (id: string) => nodes.find((n) => n.id === id)!;

  return (
    <div className="flex h-full flex-col bg-[#000] p-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-[9px] font-medium text-[#888]">Transaction Flow Graph</p>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[7px] text-[#00FF94]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00FF94]" /> Safe flow
          </span>
          <span className="flex items-center gap-1 text-[7px] text-[#FF3B3B]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#FF3B3B]" /> Risky flow
          </span>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden rounded-xl border border-[#1A1A1A] bg-[#040404]">
        {/* Dot grid */}
        <svg className="absolute inset-0 h-full w-full opacity-15">
          <defs>
            <pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.6" fill="#333" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>

        {/* Edges */}
        <svg className="absolute inset-0 h-full w-full">
          <defs>
            <marker id="ag" markerWidth="5" markerHeight="5" refX="2.5" refY="2.5" orient="auto">
              <path d="M0,0 L0,5 L5,2.5 z" fill="#00FF94" fillOpacity="0.7" />
            </marker>
            <marker id="ar" markerWidth="5" markerHeight="5" refX="2.5" refY="2.5" orient="auto">
              <path d="M0,0 L0,5 L5,2.5 z" fill="#FF3B3B" fillOpacity="0.7" />
            </marker>
          </defs>
          {edges.map((edge, i) => {
            const f = getNode(edge.from);
            const t = getNode(edge.to);
            return (
              <motion.line
                key={i}
                x1={`${f.x}%`} y1={`${f.y}%`}
                x2={`${t.x}%`} y2={`${t.y}%`}
                stroke={edge.color}
                strokeWidth="1.5"
                strokeOpacity="0.55"
                strokeDasharray="5 3"
                markerEnd={edge.color === "#00FF94" ? "url(#ag)" : "url(#ar)"}
                initial={{ opacity: 0 }}
                animate={visible ? { opacity: 1 } : {}}
                transition={{ delay: 0.3 + i * 0.18, duration: 0.5 }}
              />
            );
          })}
        </svg>

        {/* Nodes */}
        {nodes.map((node, i) => (
          <motion.div
            key={node.id}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={visible ? { opacity: 1, scale: 1 } : {}}
            transition={{ delay: 0.1 + i * 0.13, type: "spring", stiffness: 280, damping: 22 }}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
          >
            <div className="flex flex-col items-center">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full border text-[7px] font-bold"
                style={{
                  backgroundColor: node.bg,
                  borderColor: node.border,
                  color: node.color,
                  boxShadow: `0 0 14px ${node.color}28`,
                }}
              >
                {node.label.slice(0, 2)}
              </div>
              <div className="mt-0.5 rounded bg-[#0A0A0A]/90 px-1 py-0.5 text-center backdrop-blur-sm">
                <p className="text-[7px] font-semibold leading-none" style={{ color: node.color }}>{node.label}</p>
                <p className="mt-0.5 font-mono text-[6px] leading-none text-[#444]">{node.addr}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Slide 4 — Risk Reports
───────────────────────────────────────── */
function RiskReportsSlide({ isActive }: SlideProps) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!isActive) { setVisible(false); return; }
    const t = setTimeout(() => setVisible(true), 300);
    return () => clearTimeout(t);
  }, [isActive]);

  const countries = [
    { name: "United States", wallets: 10, safe: 8, risky: 0 },
    { name: "British Virgin Islands", wallets: 2, safe: 0, risky: 2 },
    { name: "India", wallets: 4, safe: 2, risky: 1 },
  ];

  return (
    <div className="flex h-full flex-col gap-2 bg-[#000] p-2.5">
      {/* Header + Tabs */}
      <div>
        <p className="mb-1.5 text-[10px] font-bold text-white">Risk Reports</p>
        <div className="flex gap-1.5">
          <div className="flex items-center gap-1 rounded-md border border-white bg-white px-2.5 py-1">
            <svg className="h-2.5 w-2.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-[8px] font-semibold text-black">Known Wallets</span>
          </div>
          <div className="flex items-center rounded-md border border-[#1A1A1A] px-2.5 py-1">
            <span className="text-[8px] text-[#555]">Community Reports</span>
          </div>
        </div>
      </div>

      {/* Safe / Risky labels */}
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1 text-[8px] text-[#888]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#00FF94]" /> Safe Wallets (80+ Trust)
        </span>
        <span className="flex items-center gap-1 text-[8px] text-[#888]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#FF3B3B]" /> High Risk / Unknown
        </span>
      </div>

      {/* Country rows */}
      <div className="flex flex-col gap-1.5">
        {countries.map((c, i) => (
          <motion.div
            key={c.name}
            initial={{ opacity: 0, x: -8 }}
            animate={visible ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.1 + i * 0.13 }}
            className="flex items-center justify-between rounded-lg border border-[#1A1A1A] bg-[#0A0A0A] px-2.5 py-2"
          >
            <div className="flex items-center gap-1.5">
              <svg className="h-3 w-3 text-[#555]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
              </svg>
              <span className="text-[8px] font-medium text-white">{c.name}</span>
              <span className="text-[7px] text-[#555]">({c.wallets} wallets)</span>
            </div>
            <div className="flex items-center gap-1.5">
              {c.safe > 0 && (
                <span className="rounded-full bg-[#00FF94]/10 px-1.5 py-0.5 text-[7px] text-[#00FF94]">{c.safe} safe</span>
              )}
              {c.risky > 0 && (
                <span className="rounded-full bg-[#FF3B3B]/10 px-1.5 py-0.5 text-[7px] text-[#FF3B3B]">{c.risky} risky</span>
              )}
              <svg className="h-2.5 w-2.5 text-[#333]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Flagged address card */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={visible ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: 0.55 }}
        className="flex items-center gap-2.5 rounded-lg border border-[#FF3B3B]/25 bg-[#FF3B3B]/5 px-2.5 py-2"
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#FF3B3B]/10">
          <svg className="h-3.5 w-3.5 text-[#FF3B3B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[8px] font-semibold text-white">FTX Exchange (Defunct)</span>
            <span className="rounded-full bg-[#FF3B3B]/10 px-1.5 py-0.5 text-[7px] text-[#FF3B3B]">High Risk</span>
          </div>
          <p className="font-mono text-[7px] text-[#555]">0xc098b2a3aa256d…3a94</p>
        </div>
        <span className="text-sm font-bold text-[#FF3B3B]">10</span>
      </motion.div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Slide 5 — Portfolio Monitor
───────────────────────────────────────── */
function PortfolioSlide({ isActive }: SlideProps) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!isActive) { setVisible(false); return; }
    const t = setTimeout(() => setVisible(true), 300);
    return () => clearTimeout(t);
  }, [isActive]);

  const tokens = [
    { symbol: "ETH",  name: "Ethereum",  amount: "4.82",  value: "$16,234", risk: "Low", riskColor: "#00FF94", pct: 34 },
    { symbol: "USDC", name: "USD Coin",  amount: "12,000", value: "$12,000", risk: "Low", riskColor: "#00FF94", pct: 25 },
    { symbol: "UNI",  name: "Uniswap",   amount: "342",   value: "$2,188",  risk: "Low", riskColor: "#00FF94", pct: 5  },
    { symbol: "SHIB", name: "Shiba Inu", amount: "50M",   value: "$890",    risk: "Med", riskColor: "#FFB800", pct: 2  },
  ];

  return (
    <div className="flex h-full flex-col gap-2 bg-[#000] p-2.5">
      {/* Portfolio value header */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={visible ? { opacity: 1, y: 0 } : {}}
        className="flex items-end justify-between rounded-xl border border-[#1A1A1A] bg-[#0A0A0A] px-3 py-2.5"
      >
        <div>
          <p className="text-[8px] text-[#555]">Total Portfolio Value</p>
          <p className="mt-0.5 text-xl font-bold leading-none text-white">$48,291</p>
        </div>
        <div className="flex items-center gap-1 text-[#00FF94]">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          <span className="text-[10px] font-bold">+12.4%</span>
        </div>
      </motion.div>

      {/* Token list */}
      <div className="flex flex-1 flex-col gap-1.5">
        {tokens.map((token, i) => (
          <motion.div
            key={token.symbol}
            initial={{ opacity: 0, x: -6 }}
            animate={visible ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.15 + i * 0.08 }}
            className="flex items-center justify-between rounded-lg border border-[#1A1A1A] bg-[#0A0A0A] px-2.5 py-2"
          >
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1A1A1A] text-[9px] font-bold text-white">
                {token.symbol.slice(0, 2)}
              </div>
              <div>
                <p className="text-[9px] font-medium text-white">{token.symbol}</p>
                <p className="text-[7px] text-[#555]">{token.name}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-medium text-white">{token.value}</p>
              <p className="text-[7px]" style={{ color: token.riskColor }}>{token.risk} Risk</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );

}

/* ─────────────────────────────────────────
   Main Dashboard Carousel Component
───────────────────────────────────────── */
export default function DashboardCarousel() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const slides = [
    { id: "wallet", component: WalletScannerSlide },
    { id: "analytics", component: DashboardAnalyticsSlide },
    { id: "flow", component: TransactionFlowSlide },
    { id: "reports", component: RiskReportsSlide },
    { id: "portfolio", component: PortfolioSlide },
  ];

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, SLIDE_DURATION);
    return () => clearInterval(interval);
  }, [isPaused, slides.length]);

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
    setIsPaused(true);
    setTimeout(() => setIsPaused(false), 10000);
  };

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0A0A0A]">
      <div className="aspect-[16/10] w-full">
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            className={`absolute inset-0 h-full w-full transition-opacity duration-700 ${
              index === currentSlide ? "opacity-100 z-10" : "opacity-0 z-0"
            }`}
          >
            {index === currentSlide && (
              <slide.component isActive={true} isPaused={isPaused} />
            )}
          </div>
        ))}
      </div>

      {/* Navigation dots */}
      <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-1.5">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              index === currentSlide
                ? "w-6 bg-white"
                : "w-1.5 bg-white/30 hover:bg-white/50"
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
