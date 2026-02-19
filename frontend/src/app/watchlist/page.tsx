"use client";

import { useState, useEffect, useCallback } from "react";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/context/AuthContext";
import {
  Radar, Search, Loader2, Copy, Check, Plus, Trash2, RefreshCw,
  AlertTriangle, CheckCircle, ShieldAlert, ChevronDown, ExternalLink,
  TrendingUp, TrendingDown, Minus, Clock, Eye, Download, Wallet,
  X, Bell, BellOff, ArrowUpDown, Unplug, CircleDot, LogIn,
} from "lucide-react";

// ── Types ───────────────────────────────────────────────────────────────────

type Chain = { id: number; name: string; short: string; explorer: string; native: string };

type WatchedWallet = {
  id: number;
  address: string;
  label: string;
  chain_id: number;
  chain_name: string;
  alert_threshold: number;
  added_at: string;
  risk_score: number | null;
  risk_label: string | null;
  prev_score: number | null;
  flags: string[];
  balance: string | null;
  ens_name: string | null;
  tx_count: number | null;
  last_checked: string | null;
  is_sanctioned: boolean;
};

type SortField = "label" | "risk_score" | "last_checked" | "added_at";
type SortDir = "asc" | "desc";

// ── Helpers ─────────────────────────────────────────────────────────────────

const API = "http://127.0.0.1:8000";

function getRiskColor(score: number | null) {
  if (score === null) return "text-zinc-500";
  if (score <= 30) return "text-green-400";
  if (score <= 60) return "text-yellow-400";
  if (score <= 80) return "text-orange-400";
  return "text-red-400";
}

function getRiskBg(score: number | null) {
  if (score === null) return "bg-white/5 border-white/10";
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

function shortenAddress(addr: string) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatBalance(bal: string | null): string {
  if (!bal) return "—";
  const num = parseFloat(bal);
  if (num === 0) return "0";
  if (num < 0.0001) return "<0.0001";
  if (num < 1) return num.toFixed(4);
  if (num < 1000) return num.toFixed(3);
  return num.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

// ── Component ───────────────────────────────────────────────────────────────

export default function Watchlist() {
  const { isAuthenticated, address: authAddress, getAuthHeaders, signIn, isConnecting: authConnecting } = useAuth();
  const [watchlist, setWatchlist] = useState<WatchedWallet[]>([]);
  const [chains, setChains] = useState<Chain[]>([]);
  const [selectedChain, setSelectedChain] = useState(1);
  const [chainDropdownOpen, setChainDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Add form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAddress, setNewAddress] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newThreshold, setNewThreshold] = useState(70);
  const [addError, setAddError] = useState("");

  // Refresh state
  const [refreshingId, setRefreshingId] = useState<number | null>(null);
  const [refreshingAll, setRefreshingAll] = useState(false);

  // UI state
  const [copied, setCopied] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [sortField, setSortField] = useState<SortField>("added_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filterRisk, setFilterRisk] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  // ── Load watchlist from API when authenticated ──────────────────────────

  const fetchWatchlist = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/watchlist/items`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setWatchlist(data.items || []);
      }
    } catch (e) {
      console.error("Failed to fetch watchlist:", e);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, getAuthHeaders]);

  useEffect(() => {
    fetchWatchlist();
  }, [fetchWatchlist]);

  // Load chains on mount
  useEffect(() => {
    fetch(`${API}/chains`)
      .then((r) => r.json())
      .then((data) => {
        setChains(data.chains || []);
        setSelectedChain(data.default || 1);
      })
      .catch(() => {});
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  // ── Add wallet (via API) ────────────────────────────────────────────────

  const handleAddWallet = async () => {
    const addr = newAddress.trim().toLowerCase();
    if (!addr) return;
    if (!addr.startsWith("0x") || addr.length !== 42) {
      setAddError("Enter a valid wallet address (0x... 42 characters)");
      return;
    }

    const chain = chains.find((c) => c.id === selectedChain);
    try {
      const res = await fetch(`${API}/watchlist/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          address: addr,
          label: newLabel.trim() || `${addr.slice(0, 6)}...${addr.slice(-4)}`,
          chain_id: selectedChain,
          chain_name: chain?.name || "Ethereum",
          alert_threshold: newThreshold,
        }),
      });

      if (res.status === 409) {
        setAddError("This address is already in your watchlist for this chain");
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setAddError(err.detail || "Failed to add wallet");
        return;
      }

      const item = await res.json();
      setWatchlist((prev) => [item, ...prev]);
      setNewAddress("");
      setNewLabel("");
      setNewThreshold(70);
      setAddError("");
      setShowAddForm(false);

      // Auto-refresh the new item
      refreshItem(item.id);
    } catch (e) {
      setAddError("Network error – is the backend running?");
    }
  };

  // ── Refresh wallet (via API) ────────────────────────────────────────────

  const refreshItem = useCallback(
    async (itemId: number) => {
      setRefreshingId(itemId);
      try {
        const res = await fetch(`${API}/watchlist/items/${itemId}/refresh`, {
          method: "POST",
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const updated = await res.json();
          setWatchlist((prev) =>
            prev.map((w) => (w.id === itemId ? updated : w))
          );
        }
      } catch (e) {
        console.error("Refresh failed:", e);
      } finally {
        setRefreshingId(null);
      }
    },
    [getAuthHeaders]
  );

  const refreshAll = async () => {
    setRefreshingAll(true);
    try {
      const res = await fetch(`${API}/watchlist/refresh-all`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        // Reload the full list
        await fetchWatchlist();
      }
    } catch (e) {
      console.error("Refresh all failed:", e);
    } finally {
      setRefreshingAll(false);
    }
  };

  // ── Remove wallet (via API) ─────────────────────────────────────────────

  const removeWallet = async (itemId: number) => {
    try {
      const res = await fetch(`${API}/watchlist/items/${itemId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setWatchlist((prev) => prev.filter((w) => w.id !== itemId));
      }
    } catch (e) {
      console.error("Delete failed:", e);
    }
    setConfirmDelete(null);
    setExpandedId(null);
  };

  // ── Export ────────────────────────────────────────────────────────────────

  const exportWatchlist = () => {
    const data = JSON.stringify(watchlist, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kryptos-watchlist-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  // ── Sort / Filter ─────────────────────────────────────────────────────────

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "risk_score" ? "desc" : "asc");
    }
  };

  const filteredWatchlist = watchlist
    .filter((w) => {
      if (!filterRisk) return true;
      if (filterRisk === "critical") return (w.risk_score ?? 0) > 80;
      if (filterRisk === "high") return (w.risk_score ?? 0) > 60 && (w.risk_score ?? 0) <= 80;
      if (filterRisk === "medium") return (w.risk_score ?? 0) > 30 && (w.risk_score ?? 0) <= 60;
      if (filterRisk === "low") return (w.risk_score ?? 0) <= 30;
      if (filterRisk === "unchecked") return w.risk_score === null;
      return true;
    })
    .sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortField === "label") return dir * a.label.localeCompare(b.label);
      if (sortField === "risk_score") return dir * ((a.risk_score ?? -1) - (b.risk_score ?? -1));
      if (sortField === "last_checked") {
        const ta = a.last_checked ? new Date(a.last_checked).getTime() : 0;
        const tb = b.last_checked ? new Date(b.last_checked).getTime() : 0;
        return dir * (ta - tb);
      }
      // added_at
      return dir * (new Date(a.added_at).getTime() - new Date(b.added_at).getTime());
    });

  // Stats
  const totalWallets = watchlist.length;
  const alertedWallets = watchlist.filter(
    (w) => w.risk_score !== null && w.risk_score >= w.alert_threshold
  ).length;
  const sanctionedWallets = watchlist.filter((w) => w.is_sanctioned).length;
  const avgScore = watchlist.filter((w) => w.risk_score !== null).length > 0
    ? Math.round(
        watchlist.filter((w) => w.risk_score !== null).reduce((s, w) => s + (w.risk_score ?? 0), 0) /
          watchlist.filter((w) => w.risk_score !== null).length
      )
    : null;

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
                <Radar className="w-8 h-8 text-[#4ADE80]" />
              </div>
              <h1 className="text-5xl md:text-7xl font-medium tracking-wider leading-[0.9]">
                Wallet Watchlist
              </h1>
            </div>
            <p className="text-xl text-zinc-400 font-[family-name:var(--font-spacemono)] ml-1">
              Monitor wallets and track risk score changes over time.
            </p>
          </div>

          {/* ── Auth Gate ───────────────────────────────────────────── */}
          {!isAuthenticated ? (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="bg-white/5 p-6 rounded-full mb-6">
                <Wallet className="w-12 h-12 text-zinc-600" />
              </div>
              <p className="text-2xl text-zinc-400 mb-2">Connect your wallet to continue</p>
              <p className="text-zinc-600 font-[family-name:var(--font-spacemono)] text-sm mb-6 text-center max-w-md">
                Sign in with your Ethereum wallet to access your persistent watchlist.
                Your data is stored securely and synced across devices.
              </p>
              <button
                onClick={() => signIn()}
                disabled={authConnecting}
                className="flex items-center gap-2 px-8 py-4 bg-[#4ADE80] text-black rounded-xl font-[family-name:var(--font-spacemono)] text-sm font-bold hover:bg-[#22c55e] transition-colors disabled:opacity-50"
              >
                <LogIn className="w-4 h-4" />
                {authConnecting ? "Connecting..." : "Sign In With Wallet"}
              </button>
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center py-24">
              <Loader2 className="w-8 h-8 animate-spin text-[#4ADE80] mb-4" />
              <p className="text-zinc-500 font-[family-name:var(--font-spacemono)] text-sm">Loading watchlist...</p>
            </div>
          ) : (
          <>

          {/* ── Stats Bar ───────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <p className="text-xs text-zinc-500 font-[family-name:var(--font-spacemono)] mb-1">WATCHING</p>
              <p className="text-2xl font-medium">{totalWallets}</p>
            </div>
            <div className={`border rounded-2xl p-4 ${alertedWallets > 0 ? "bg-red-400/5 border-red-400/20" : "bg-white/5 border-white/10"}`}>
              <p className="text-xs text-zinc-500 font-[family-name:var(--font-spacemono)] mb-1">ALERTS</p>
              <p className={`text-2xl font-medium ${alertedWallets > 0 ? "text-red-400" : ""}`}>{alertedWallets}</p>
            </div>
            <div className={`border rounded-2xl p-4 ${sanctionedWallets > 0 ? "bg-red-400/5 border-red-400/20" : "bg-white/5 border-white/10"}`}>
              <p className="text-xs text-zinc-500 font-[family-name:var(--font-spacemono)] mb-1">SANCTIONED</p>
              <p className={`text-2xl font-medium ${sanctionedWallets > 0 ? "text-red-400" : ""}`}>{sanctionedWallets}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <p className="text-xs text-zinc-500 font-[family-name:var(--font-spacemono)] mb-1">AVG RISK</p>
              <p className={`text-2xl font-medium ${avgScore !== null ? getRiskColor(avgScore) : "text-zinc-500"}`}>
                {avgScore !== null ? `${avgScore}/100` : "—"}
              </p>
            </div>
          </div>

          {/* ── Actions Bar ─────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-2 px-5 py-3 bg-[#4ADE80] text-black rounded-xl font-[family-name:var(--font-spacemono)] text-sm font-bold hover:bg-[#22c55e] transition-colors"
            >
              {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showAddForm ? "Cancel" : "Add Wallet"}
            </button>

            {totalWallets > 0 && (
              <>
                <button
                  onClick={refreshAll}
                  disabled={refreshingAll || refreshingId !== null}
                  className="flex items-center gap-2 px-5 py-3 bg-white/5 border border-white/10 rounded-xl font-[family-name:var(--font-spacemono)] text-sm hover:bg-white/10 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshingAll ? "animate-spin" : ""}`} />
                  {refreshingAll ? "Refreshing..." : "Refresh All"}
                </button>

                <button
                  onClick={exportWatchlist}
                  className="flex items-center gap-2 px-4 py-3 bg-white/5 border border-white/10 rounded-xl font-[family-name:var(--font-spacemono)] text-sm hover:bg-white/10 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </>
            )}
          </div>

          {/* ── Add Wallet Form ─────────────────────────────────────── */}
          {showAddForm && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8">
              <h3 className="text-lg font-medium mb-4">Add Wallet to Watchlist</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/* Address */}
                <div>
                  <label className="block text-xs text-zinc-500 font-[family-name:var(--font-spacemono)] mb-2">
                    WALLET ADDRESS
                  </label>
                  <input
                    type="text"
                    value={newAddress}
                    onChange={(e) => { setNewAddress(e.target.value); setAddError(""); }}
                    placeholder="0x..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-600 font-[family-name:var(--font-spacemono)] text-sm focus:outline-none focus:border-[#4ADE80]/40"
                    onKeyDown={(e) => e.key === "Enter" && handleAddWallet()}
                  />
                </div>

                {/* Label */}
                <div>
                  <label className="block text-xs text-zinc-500 font-[family-name:var(--font-spacemono)] mb-2">
                    LABEL (OPTIONAL)
                  </label>
                  <input
                    type="text"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="e.g. Suspicious DEX Trader"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-600 font-[family-name:var(--font-spacemono)] text-sm focus:outline-none focus:border-[#4ADE80]/40"
                    onKeyDown={(e) => e.key === "Enter" && handleAddWallet()}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/* Chain selector */}
                <div>
                  <label className="block text-xs text-zinc-500 font-[family-name:var(--font-spacemono)] mb-2">
                    CHAIN
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setChainDropdownOpen(!chainDropdownOpen)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-left text-sm font-[family-name:var(--font-spacemono)] flex items-center justify-between hover:bg-white/10 transition-colors"
                    >
                      <span>{selectedChainObj?.name || "Ethereum Mainnet"}</span>
                      <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${chainDropdownOpen ? "rotate-180" : ""}`} />
                    </button>
                    {chainDropdownOpen && (
                      <div className="absolute z-50 top-full mt-1 w-full bg-zinc-900 border border-white/10 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                        {chains.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => { setSelectedChain(c.id); setChainDropdownOpen(false); }}
                            className={`w-full px-4 py-2.5 text-left text-sm font-[family-name:var(--font-spacemono)] hover:bg-white/10 transition-colors ${c.id === selectedChain ? "text-[#4ADE80] bg-white/5" : "text-zinc-300"}`}
                          >
                            {c.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Alert threshold */}
                <div>
                  <label className="block text-xs text-zinc-500 font-[family-name:var(--font-spacemono)] mb-2">
                    ALERT THRESHOLD (SCORE ≥)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={10}
                      max={100}
                      step={5}
                      value={newThreshold}
                      onChange={(e) => setNewThreshold(Number(e.target.value))}
                      className="flex-1 accent-[#4ADE80]"
                    />
                    <span className={`text-sm font-[family-name:var(--font-spacemono)] min-w-[48px] text-right ${getRiskColor(newThreshold)}`}>
                      {newThreshold}
                    </span>
                  </div>
                </div>
              </div>

              {addError && (
                <p className="text-red-400 text-sm font-[family-name:var(--font-spacemono)] mb-3">
                  {addError}
                </p>
              )}

              <button
                onClick={handleAddWallet}
                className="px-6 py-3 bg-[#4ADE80] text-black rounded-xl font-[family-name:var(--font-spacemono)] text-sm font-bold hover:bg-[#22c55e] transition-colors"
              >
                Add & Scan
              </button>
            </div>
          )}

          {/* ── Filter Bar ──────────────────────────────────────────── */}
          {totalWallets > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="text-xs text-zinc-500 font-[family-name:var(--font-spacemono)] mr-1">FILTER:</span>
              {[
                { key: null, label: "All" },
                { key: "critical", label: "Critical" },
                { key: "high", label: "High" },
                { key: "medium", label: "Medium" },
                { key: "low", label: "Low" },
                { key: "unchecked", label: "Unchecked" },
              ].map(({ key, label }) => (
                <button
                  key={label}
                  onClick={() => setFilterRisk(key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-[family-name:var(--font-spacemono)] transition-colors border ${
                    filterRisk === key
                      ? "border-[#4ADE80]/40 bg-[#4ADE80]/10 text-[#4ADE80]"
                      : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* ── Watchlist Table ──────────────────────────────────────── */}
          {totalWallets === 0 ? (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="bg-white/5 p-6 rounded-full mb-6">
                <Radar className="w-12 h-12 text-zinc-600" />
              </div>
              <p className="text-2xl text-zinc-400 mb-2">Your watchlist is empty</p>
              <p className="text-zinc-600 font-[family-name:var(--font-spacemono)] text-sm mb-6">
                Add wallet addresses to start monitoring risk scores.
              </p>
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-2 px-6 py-3 bg-[#4ADE80] text-black rounded-xl font-[family-name:var(--font-spacemono)] text-sm font-bold hover:bg-[#22c55e] transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Your First Wallet
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Sort header */}
              <div className="hidden md:grid grid-cols-12 gap-4 px-5 py-2 text-xs text-zinc-500 font-[family-name:var(--font-spacemono)]">
                <button onClick={() => toggleSort("label")} className="col-span-4 flex items-center gap-1 hover:text-zinc-300 transition-colors text-left">
                  WALLET {sortField === "label" && <ArrowUpDown className="w-3 h-3" />}
                </button>
                <div className="col-span-2 text-center">CHAIN</div>
                <button onClick={() => toggleSort("risk_score")} className="col-span-2 flex items-center justify-center gap-1 hover:text-zinc-300 transition-colors">
                  RISK {sortField === "risk_score" && <ArrowUpDown className="w-3 h-3" />}
                </button>
                <button onClick={() => toggleSort("last_checked")} className="col-span-2 flex items-center justify-center gap-1 hover:text-zinc-300 transition-colors">
                  CHECKED {sortField === "last_checked" && <ArrowUpDown className="w-3 h-3" />}
                </button>
                <div className="col-span-2 text-right">ACTIONS</div>
              </div>

              {/* Wallet rows */}
              {filteredWatchlist.map((w) => {
                const isExpanded = expandedId === w.id;
                const isRefreshing = refreshingId === w.id;
                const scoreChanged = w.prev_score !== null && w.risk_score !== null && w.prev_score !== w.risk_score;
                const scoreDelta = scoreChanged ? (w.risk_score! - w.prev_score!) : 0;
                const isAlerted = w.risk_score !== null && w.risk_score >= w.alert_threshold;

                return (
                  <div
                    key={w.id}
                    className={`border rounded-2xl transition-all ${
                      isAlerted
                        ? "bg-red-400/5 border-red-400/20"
                        : "bg-white/5 border-white/10 hover:border-white/20"
                    }`}
                  >
                    {/* Main row */}
                    <div
                      className="grid grid-cols-1 md:grid-cols-12 gap-4 px-5 py-4 cursor-pointer items-center"
                      onClick={() => setExpandedId(isExpanded ? null : w.id)}
                    >
                      {/* Wallet info */}
                      <div className="col-span-4 flex items-center gap-3">
                        {isAlerted && (
                          <Bell className="w-4 h-4 text-red-400 shrink-0 animate-pulse" />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium truncate">{w.label}</p>
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-zinc-500 font-[family-name:var(--font-spacemono)]">
                              {w.ens_name || shortenAddress(w.address)}
                            </p>
                            <button
                              onClick={(e) => { e.stopPropagation(); copyToClipboard(w.address); }}
                              className="text-zinc-600 hover:text-zinc-300 transition-colors"
                            >
                              {copied === w.address ? (
                                <Check className="w-3 h-3 text-[#4ADE80]" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Chain */}
                      <div className="col-span-2 flex justify-center">
                        <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-xs text-zinc-400 font-[family-name:var(--font-spacemono)]">
                          {w.chain_name.replace(" Mainnet", "").replace(" One", "")}
                        </span>
                      </div>

                      {/* Risk score */}
                      <div className="col-span-2 flex items-center justify-center gap-2">
                        {isRefreshing ? (
                          <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
                        ) : w.risk_score !== null ? (
                          <>
                            <span className={`text-xl font-medium ${getRiskColor(w.risk_score)}`}>
                              {w.risk_score}
                            </span>
                            <span className="text-xs text-zinc-600">/100</span>
                            {scoreChanged && (
                              <span className={`flex items-center gap-0.5 text-xs ${scoreDelta > 0 ? "text-red-400" : "text-green-400"}`}>
                                {scoreDelta > 0 ? (
                                  <TrendingUp className="w-3 h-3" />
                                ) : (
                                  <TrendingDown className="w-3 h-3" />
                                )}
                                {Math.abs(scoreDelta)}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-zinc-600 text-sm">—</span>
                        )}
                      </div>

                      {/* Last checked */}
                      <div className="col-span-2 flex items-center justify-center gap-1 text-xs text-zinc-500 font-[family-name:var(--font-spacemono)]">
                        {w.last_checked ? (
                          <>
                            <Clock className="w-3 h-3" />
                            {timeAgo(w.last_checked)}
                          </>
                        ) : (
                          "Not checked"
                        )}
                      </div>

                      {/* Actions */}
                      <div className="col-span-2 flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => refreshItem(w.id)}
                          disabled={isRefreshing || refreshingAll}
                          className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
                          title="Refresh score"
                        >
                          <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-[#4ADE80]" : "text-zinc-400"}`} />
                        </button>
                        <a
                          href={`/analyze?address=${w.address}&chain=${w.chain_id}`}
                          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                          title="Full analysis"
                        >
                          <Eye className="w-4 h-4 text-zinc-400" />
                        </a>
                        {confirmDelete === w.id ? (
                          <button
                            onClick={() => removeWallet(w.id)}
                            className="p-2 bg-red-400/10 hover:bg-red-400/20 rounded-lg transition-colors text-red-400 text-xs font-[family-name:var(--font-spacemono)]"
                          >
                            Confirm
                          </button>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(w.id)}
                            className="p-2 hover:bg-red-400/10 rounded-lg transition-colors"
                            title="Remove"
                          >
                            <Trash2 className="w-4 h-4 text-zinc-500 hover:text-red-400" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="border-t border-white/10 px-5 py-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Left: Info */}
                        <div className="space-y-3">
                          <h4 className="text-xs text-zinc-500 font-[family-name:var(--font-spacemono)] mb-2">DETAILS</h4>
                          <div className="flex justify-between text-sm">
                            <span className="text-zinc-500">Address</span>
                            <span className="font-[family-name:var(--font-spacemono)] text-xs max-w-[200px] truncate">
                              {w.address}
                            </span>
                          </div>
                          {w.ens_name && (
                            <div className="flex justify-between text-sm">
                              <span className="text-zinc-500">ENS</span>
                              <span className="text-[#4ADE80]">{w.ens_name}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-sm">
                            <span className="text-zinc-500">Balance</span>
                            <span>{formatBalance(w.balance)} ETH</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-zinc-500">Transactions</span>
                            <span>{w.tx_count ?? "—"}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-zinc-500">Alert Threshold</span>
                            <span className={getRiskColor(w.alert_threshold)}>≥ {w.alert_threshold}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-zinc-500">Added</span>
                            <span className="text-zinc-400">{new Date(w.added_at).toLocaleDateString()}</span>
                          </div>
                          {w.is_sanctioned && (
                            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                              <ShieldAlert className="w-4 h-4" />
                              OFAC Sanctioned
                            </div>
                          )}
                        </div>

                        {/* Middle: Risk score visual */}
                        <div className="flex flex-col items-center justify-center">
                          {w.risk_score !== null ? (
                            <>
                              <div className={`relative w-32 h-32 rounded-full border-4 ${getRiskBg(w.risk_score)} flex items-center justify-center mb-3`}>
                                <div className="text-center">
                                  <p className={`text-3xl font-bold ${getRiskColor(w.risk_score)}`}>{w.risk_score}</p>
                                  <p className="text-[10px] text-zinc-500">/100</p>
                                </div>
                              </div>
                              <span className={`px-3 py-1 rounded-lg text-sm font-[family-name:var(--font-spacemono)] ${getRiskBg(w.risk_score)} border`}>
                                {w.risk_label}
                              </span>
                              {scoreChanged && (
                                <p className={`text-xs mt-2 flex items-center gap-1 ${scoreDelta > 0 ? "text-red-400" : "text-green-400"}`}>
                                  {scoreDelta > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                  {scoreDelta > 0 ? "+" : ""}{scoreDelta} from last check
                                </p>
                              )}
                            </>
                          ) : (
                            <div className="text-center">
                              <div className="w-32 h-32 rounded-full border-4 border-white/10 bg-white/5 flex items-center justify-center mb-3">
                                <p className="text-zinc-600 text-sm">Not<br />checked</p>
                              </div>
                              <button
                                onClick={() => refreshItem(w.id)}
                                className="px-4 py-2 bg-[#4ADE80] text-black rounded-lg text-xs font-[family-name:var(--font-spacemono)] font-bold hover:bg-[#22c55e] transition-colors"
                              >
                                Scan Now
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Right: Flags */}
                        <div>
                          <h4 className="text-xs text-zinc-500 font-[family-name:var(--font-spacemono)] mb-2">
                            FLAGS ({w.flags.length})
                          </h4>
                          {w.flags.length > 0 ? (
                            <div className="space-y-2 max-h-48 overflow-y-auto" data-lenis-prevent>
                              {w.flags.map((f, i) => (
                                <div
                                  key={i}
                                  className="flex items-start gap-2 text-sm bg-white/5 border border-white/10 rounded-lg px-3 py-2"
                                >
                                  <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 shrink-0 mt-0.5" />
                                  <span className="text-zinc-300 font-[family-name:var(--font-spacemono)] text-xs">{f}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-zinc-600 text-sm font-[family-name:var(--font-spacemono)]">
                              {w.risk_score !== null ? "No flags detected" : "Scan to check for flags"}
                            </p>
                          )}

                          {/* Quick links */}
                          <div className="mt-4 flex flex-wrap gap-2">
                            <a
                              href={`/analyze?address=${w.address}&chain=${w.chain_id}`}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-[family-name:var(--font-spacemono)] text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                            >
                              <Search className="w-3 h-3" />
                              Full Analysis
                            </a>
                            {chains.find((c) => c.id === w.chain_id)?.explorer && (
                              <a
                                href={`${chains.find((c) => c.id === w.chain_id)!.explorer}/address/${w.address}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-[family-name:var(--font-spacemono)] text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Explorer
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* No results for filter */}
              {filteredWatchlist.length === 0 && totalWallets > 0 && (
                <div className="text-center py-12">
                  <p className="text-zinc-500 font-[family-name:var(--font-spacemono)] text-sm">
                    No wallets match the selected filter.
                  </p>
                </div>
              )}
            </div>
          )}

          </>
          )}
        </div>
      </section>
    </main>
  );
}
