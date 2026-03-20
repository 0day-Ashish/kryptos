"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Loader2, Plus, X, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { CHAINS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useWallet } from "@/lib/wallet";
import { useSession } from "@/lib/session";
import type { BatchResult } from "@/types";

const MAX_BATCH_SIZE = 50;

type RankedWallet = BatchResult["results"][number] & {
  rank: number;
};

function getRiskSeverity(label: string | undefined): number {
  const normalized = (label || "").toLowerCase();
  if (normalized.includes("critical")) return 4;
  if (normalized.includes("high")) return 3;
  if (normalized.includes("medium")) return 2;
  if (normalized.includes("low")) return 1;
  return 0;
}

function getRiskColorClass(
  label: string | undefined,
  score: number | undefined,
): string {
  const normalized = (label || "").toLowerCase();
  if (normalized.includes("low")) return "text-[#00FF94]";
  if (normalized.includes("medium")) return "text-[#FFB800]";
  if (normalized.includes("high") || normalized.includes("critical"))
    return "text-[#FF3B3B]";

  const safeScore = Number.isFinite(score) ? Number(score) : 50;
  if (safeScore <= 40) return "text-[#00FF94]";
  if (safeScore <= 70) return "text-[#FFB800]";
  return "text-[#FF3B3B]";
}

function formatAddress(addr: string): string {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function parseWallets(input: string): string[] {
  const parsed = input
    .replace(/\n/g, ",")
    .split(",")
    .map((w) => w.trim().toLowerCase())
    .filter((w) => /^0x[a-fA-F0-9]{40}$/.test(w));

  return [...new Set(parsed)];
}

function rankResults(results: BatchResult["results"]): RankedWallet[] {
  const sorted = [...results].sort((a, b) => {
    if (a.error && !b.error) return 1;
    if (!a.error && b.error) return -1;

    const severityDelta =
      getRiskSeverity(b.risk_label) - getRiskSeverity(a.risk_label);
    if (severityDelta !== 0) return severityDelta;

    return (b.risk_score ?? -1) - (a.risk_score ?? -1);
  });

  return sorted.map((r, idx) => ({ ...r, rank: idx + 1 }));
}

export default function BatchAnalysis() {
  const router = useRouter();
  const { address: connectedAddress } = useWallet();
  const { user } = useSession();

  const [walletInput, setWalletInput] = useState("");
  const [selectedChainId, setSelectedChainId] = useState(1);
  const [quickMode, setQuickMode] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<RankedWallet[]>([]);
  const [summary, setSummary] = useState<BatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isPro =
    user?.premium_tier === "pro" || user?.premium_tier === "enterprise";
  const wallets = useMemo(() => parseWallets(walletInput), [walletInput]);

  const canAnalyze =
    wallets.length > 0 && wallets.length <= MAX_BATCH_SIZE && !isAnalyzing;

  const isTopWalletRestricted = (index: number): boolean => !isPro && index < 3;

  const addConnectedWallet = () => {
    if (!connectedAddress) return;
    const normalized = connectedAddress.toLowerCase();
    if (wallets.includes(normalized)) return;

    setWalletInput((prev) =>
      prev.trim() ? `${prev}, ${normalized}` : normalized,
    );
  };

  const removeWallet = (walletAddress: string) => {
    const next = wallets.filter((w) => w !== walletAddress);
    setWalletInput(next.join(", "));
  };

  const handleAnalyze = async () => {
    if (!canAnalyze) return;

    setIsAnalyzing(true);
    setError(null);
    setResults([]);
    setSummary(null);

    try {
      const response = await api.batch({
        addresses: wallets,
        chain_id: selectedChainId,
        quick: quickMode,
      });

      setSummary(response);
      setResults(rankResults(response.results || []));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Batch analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="rounded-xl border border-[#1A1A1A] bg-[#0A0A0A] p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">
            Batch Wallet Analysis
          </h3>
          <p className="text-sm text-[#888]">
            Submit multiple wallets and rank them by risk severity.
          </p>
        </div>
        {isPro ? (
          <span className="rounded-full bg-[#00FF94]/10 px-3 py-1 text-xs font-medium text-[#00FF94]">
            Pro Enabled
          </span>
        ) : (
          <span className="rounded-full bg-[#FFB800]/10 px-3 py-1 text-xs font-medium text-[#FFB800]">
            Free Preview
          </span>
        )}
      </div>

      {!isPro && (
        <div className="mb-5 rounded-lg border border-[#FFB800]/30 bg-[#FFB800]/5 p-5 text-center">
          <Zap className="mx-auto mb-2 h-7 w-7 text-[#FFB800]" />
          <p className="text-sm text-[#BFBFBF]">
            Free users can analyze wallets, but top 3 ranked wallets are hidden.
          </p>
          <button
            onClick={() => {
              window.location.href = "/pricing";
            }}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#FFB800] px-4 py-2 text-sm font-medium text-black"
          >
            Upgrade to Pro
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <div className="md:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-[#888]">
              Wallet Addresses ({wallets.length}/{MAX_BATCH_SIZE})
            </span>
            <button
              onClick={addConnectedWallet}
              disabled={!connectedAddress || wallets.length >= MAX_BATCH_SIZE}
              className="flex items-center gap-1 text-xs text-[#00FF94] disabled:text-[#555]"
            >
              <Plus className="h-3 w-3" />
              Add Connected
            </button>
          </div>
          <textarea
            value={walletInput}
            onChange={(e) => setWalletInput(e.target.value)}
            rows={4}
            placeholder="Paste wallet addresses, comma or newline separated"
            disabled={isAnalyzing}
            className={cn(
              "w-full rounded-lg border bg-[#111] px-3 py-2 text-sm font-mono text-white placeholder-[#555] focus:outline-none",
              wallets.length > MAX_BATCH_SIZE
                ? "border-[#FF3B3B]"
                : "border-[#1A1A1A]",
            )}
          />
          {wallets.length > MAX_BATCH_SIZE && (
            <p className="mt-1 text-xs text-[#FF3B3B]">
              Maximum {MAX_BATCH_SIZE} wallets allowed.
            </p>
          )}
          {wallets.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {wallets.map((wallet) => (
                <div
                  key={wallet}
                  className="flex items-center gap-2 rounded-lg border border-[#1A1A1A] bg-[#111] px-3 py-1.5"
                >
                  <span className="font-mono text-xs text-white">
                    {formatAddress(wallet)}
                  </span>
                  <button
                    onClick={() => removeWallet(wallet)}
                    className="text-[#888] hover:text-[#FF3B3B]"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <label className="block text-sm text-[#888]">
            Chain
            <select
              value={selectedChainId}
              onChange={(e) => setSelectedChainId(Number(e.target.value))}
              disabled={isAnalyzing}
              className="mt-1 w-full rounded-lg border border-[#1A1A1A] bg-[#111] px-3 py-2 text-sm text-white"
            >
              {CHAINS.filter((c) => c.id !== 84532 && c.id !== 11155111).map(
                (chain) => (
                  <option key={chain.id} value={chain.id}>
                    {chain.name}
                  </option>
                ),
              )}
            </select>
          </label>

          <label className="flex items-center gap-2 rounded-lg border border-[#1A1A1A] bg-[#111] px-3 py-2 text-sm text-[#BFBFBF]">
            <input
              type="checkbox"
              checked={quickMode}
              onChange={(e) => setQuickMode(e.target.checked)}
              disabled={isAnalyzing}
              className="h-4 w-4 accent-[#00FF94]"
            />
            Quick mode
          </label>

          <button
            onClick={handleAnalyze}
            disabled={!canAnalyze}
            className="w-full rounded-lg bg-[#00FF94] py-2.5 text-sm font-semibold text-black transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isAnalyzing ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing {wallets.length} wallets...
              </span>
            ) : (
              `Analyze ${wallets.length || 0} Wallet${wallets.length === 1 ? "" : "s"}`
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-[#FF3B3B]/30 bg-[#FF3B3B]/10 p-3 text-sm text-[#FF3B3B]">
          {error}
        </div>
      )}

      {summary && (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
          <div className="rounded-lg bg-[#111] p-3 text-center">
            <p className="text-xl font-bold text-white">
              {summary.total_analyzed}
            </p>
            <p className="text-xs text-[#888]">Analyzed</p>
          </div>
          <div className="rounded-lg bg-[#111] p-3 text-center">
            <p className="text-xl font-bold text-[#FF3B3B]">
              {summary.high_risk_count}
            </p>
            <p className="text-xs text-[#888]">High Risk</p>
          </div>
          <div className="rounded-lg bg-[#111] p-3 text-center">
            <p className="text-xl font-bold text-[#FFB800]">
              {summary.medium_risk_count}
            </p>
            <p className="text-xs text-[#888]">Medium Risk</p>
          </div>
          <div className="rounded-lg bg-[#111] p-3 text-center">
            <p className="text-xl font-bold text-[#00FF94]">
              {summary.low_risk_count}
            </p>
            <p className="text-xs text-[#888]">Low Risk</p>
          </div>
          <div className="rounded-lg bg-[#111] p-3 text-center">
            <p className="text-xl font-bold text-white">
              {results.filter((r) => r.error).length}
            </p>
            <p className="text-xs text-[#888]">Errors</p>
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-[#1A1A1A]">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="bg-[#111] text-left text-xs text-[#888]">
                <th className="px-3 py-2">Rank</th>
                <th className="px-3 py-2">Wallet</th>
                <th className="px-3 py-2">Risk Score</th>
                <th className="px-3 py-2">Risk Label</th>
                <th className="px-3 py-2">Flags</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Single Analyze</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result, idx) => {
                const riskColor = getRiskColorClass(
                  result.risk_label,
                  result.risk_score,
                );
                const restricted = isTopWalletRestricted(idx);
                return (
                  <motion.tr
                    key={`${result.address}-${idx}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="border-t border-[#1A1A1A] text-sm"
                  >
                    <td
                      className={cn(
                        "px-3 py-2 font-semibold text-white",
                        restricted && "blur-sm select-none",
                      )}
                    >
                      #{result.rank}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 font-mono text-white",
                        restricted && "blur-sm select-none",
                      )}
                    >
                      {restricted
                        ? "0x******...****"
                        : formatAddress(result.address)}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 font-semibold",
                        riskColor,
                        restricted && "blur-sm select-none",
                      )}
                    >
                      {restricted
                        ? "--"
                        : typeof result.risk_score === "number"
                          ? result.risk_score.toFixed(0)
                          : "N/A"}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2",
                        riskColor,
                        restricted && "blur-sm select-none",
                      )}
                    >
                      {restricted ? "Premium" : result.risk_label || "Unknown"}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 text-[#BFBFBF]",
                        restricted && "blur-sm select-none",
                      )}
                    >
                      {restricted
                        ? "Unlock top wallets"
                        : result.error
                          ? "-"
                          : result.flags?.length
                            ? result.flags.slice(0, 2).join(" | ")
                            : "None"}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2",
                        restricted
                          ? "text-[#FFB800]"
                          : result.error
                            ? "text-[#FF3B3B]"
                            : "text-[#00FF94]",
                      )}
                    >
                      {restricted
                        ? "Locked"
                        : result.error
                          ? result.error
                          : "Complete"}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() =>
                          router.push(
                            `/wallet-scanner?address=${encodeURIComponent(result.address)}&chain=${selectedChainId}`,
                          )
                        }
                        disabled={restricted}
                        className="rounded-lg border border-[#1A1A1A] bg-[#111] px-2 py-1 text-xs text-white hover:border-[#00FF94] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Analyze
                      </button>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!isPro && results.length > 0 && (
        <div className="mt-4 rounded-lg border border-[#FFB800]/30 bg-[#FFB800]/5 p-4 text-center">
          <p className="text-sm text-[#BFBFBF]">
            Top 3 ranked wallets are hidden on Free. Upgrade to Pro to unlock
            full rankings.
          </p>
          <button
            onClick={() => {
              window.location.href = "/pricing";
            }}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#FFB800] px-4 py-2 text-sm font-medium text-black"
          >
            Buy Premium
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
