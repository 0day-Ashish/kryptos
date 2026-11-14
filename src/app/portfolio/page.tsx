"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Search, Loader2, Shield, AlertTriangle, Users, ArrowRight,
  Activity, PieChart, TrendingUp, Wallet, ExternalLink, ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Sidebar from "@/components/dashboard/sidebar"
import Header from "@/components/dashboard/header"
import { api } from "@/lib/api"
import { useSession } from "@/lib/session"
import { CHAINS } from "@/lib/constants"

interface Counterparty {
  address: string
  risk_score: number
  risk_label: string
  interaction_count: number
}

interface PortfolioData {
  address: string
  chain_id: number
  portfolio_risk_score: number
  portfolio_risk_label: string
  avg_counterparty_risk: number
  counterparties_scanned: number
  risk_breakdown: { low: number; medium: number; high: number; critical: number }
  counterparties: Counterparty[]
}

function riskColor(score: number) {
  if (score >= 80) return "#ef4444"
  if (score >= 60) return "#f97316"
  if (score >= 30) return "#eab308"
  return "#10b981"
}

function riskTextColor(score: number) {
  if (score >= 80) return "text-red-400"
  if (score >= 60) return "text-orange-400"
  if (score >= 30) return "text-yellow-400"
  return "text-emerald-400"
}

function riskBgColor(score: number) {
  if (score >= 80) return "bg-red-500/10 border-red-500/20"
  if (score >= 60) return "bg-orange-500/10 border-orange-500/20"
  if (score >= 30) return "bg-yellow-500/10 border-yellow-500/20"
  return "bg-emerald-500/10 border-emerald-500/20"
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export default function PortfolioRiskPage() {
  const router = useRouter()
  const { user, isAuthenticated } = useSession()
  const [mounted, setMounted] = useState(false)
  const [address, setAddress] = useState("")
  const [chainId, setChainId] = useState(1)
  const [loading, setLoading] = useState(false)
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const analyzePortfolio = async () => {
    if (!address.trim()) return

    setLoading(true)
    setError(null)
    setPortfolio(null)

    try {
      const data = await api.portfolio(address.trim(), chainId)
      setPortfolio(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze portfolio")
    } finally {
      setLoading(false)
    }
  }

  if (!mounted) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    )
  }

  const breakdown = portfolio?.risk_breakdown
  const total = breakdown
    ? breakdown.low + breakdown.medium + breakdown.high + breakdown.critical
    : 0

  return (
    <div className="min-h-screen bg-black">
      <Sidebar />
      <Header />

      <main className="pt-16 transition-all duration-300" style={{ marginLeft: "16rem" }}>
        <div className="p-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
                <PieChart className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Portfolio Risk Dashboard</h1>
                <p className="text-sm text-gray-500">
                  Analyze your exposure — scan who you interact with
                </p>
              </div>
            </div>
          </motion.div>

          {/* Search Bar */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-6 rounded-xl border border-white/10 bg-[#0A0A0A] p-5"
          >
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && analyzePortfolio()}
                  placeholder="Enter your wallet address (0x...) or ENS name"
                  className="w-full rounded-lg border border-white/10 bg-black py-3 pl-12 pr-4 text-white placeholder-gray-500 focus:border-white/30 focus:outline-none"
                />
              </div>
              <select
                value={chainId}
                onChange={(e) => setChainId(Number(e.target.value))}
                className="rounded-lg border border-white/10 bg-black px-4 py-3 text-white focus:border-white/30 focus:outline-none"
              >
                {CHAINS.filter((c: any) => c.id !== 84532 && c.id !== 11155111).map((chain: any) => (
                  <option key={chain.id} value={chain.id}>{chain.name}</option>
                ))}
              </select>
              <button
                onClick={analyzePortfolio}
                disabled={loading || !address.trim()}
                className="flex items-center gap-2 rounded-lg bg-white px-6 py-3 font-medium text-black hover:bg-gray-200 disabled:opacity-50 transition-all"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4" />
                    Analyze
                  </>
                )}
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-600">
              We will scan your top 10 counterparties and calculate your exposure risk.
            </p>
          </motion.div>

          {/* Loading State */}
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <div className="relative">
                <Loader2 className="h-16 w-16 animate-spin text-white" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Shield className="h-6 w-6 text-white" />
                </div>
              </div>
              <p className="mt-4 text-lg text-gray-300">Scanning counterparties...</p>
              <p className="text-sm text-gray-500 mt-1">
                Analyzing up to 10 wallets you&apos;ve interacted with
              </p>
            </motion.div>
          )}

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-red-500/20 bg-red-500/5 p-6"
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-6 w-6 text-red-400" />
                <div>
                  <h3 className="font-semibold text-red-400">Analysis Failed</h3>
                  <p className="text-sm text-gray-400">{error}</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Results */}
          {portfolio && !loading && (
            <div className="space-y-6">
              {/* Portfolio Risk Score */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="rounded-xl border border-white/10 bg-[#0A0A0A] p-6"
              >
                <div className="flex items-center gap-6">
                  {/* Score Circle */}
                  <div className="relative h-32 w-32 flex-shrink-0">
                    <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="#1A1A1A" strokeWidth="8" />
                      <circle
                        cx="50" cy="50" r="42" fill="none"
                        stroke={riskColor(portfolio.portfolio_risk_score)}
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={`${(portfolio.portfolio_risk_score / 100) * 264} 264`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-bold text-white">{portfolio.portfolio_risk_score}</span>
                      <span className="text-[10px] text-gray-500">/ 100</span>
                    </div>
                  </div>

                  <div className="flex-1">
                    <h2 className="text-lg font-semibold text-white">Portfolio Risk</h2>
                    <span className={cn("text-2xl font-bold", riskTextColor(portfolio.portfolio_risk_score))}>
                      {portfolio.portfolio_risk_label}
                    </span>
                    <p className="text-sm text-gray-400 mt-2">
                      Based on scanning {portfolio.counterparties_scanned} counterparties
                      with an average risk of {portfolio.avg_counterparty_risk}/100.
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      Address: <span className="font-mono">{shortAddr(portfolio.address)}</span>
                    </p>
                  </div>

                  {/* Risk Breakdown Bars */}
                  {breakdown && total > 0 && (
                    <div className="flex-shrink-0 w-48 space-y-2">
                      <div className="text-xs text-gray-400 mb-2">Risk Breakdown</div>
                      {[
                        { label: "Critical", count: breakdown.critical, color: "bg-red-500" },
                        { label: "High", count: breakdown.high, color: "bg-orange-500" },
                        { label: "Medium", count: breakdown.medium, color: "bg-yellow-500" },
                        { label: "Low", count: breakdown.low, color: "bg-emerald-500" },
                      ].map(({ label, count, color }) => (
                        <div key={label} className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-500 w-12">{label}</span>
                          <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className={cn("h-full rounded-full transition-all", color)}
                              style={{ width: `${(count / total) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-400 w-4 text-right">{count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Counterparties Table */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-xl border border-white/10 bg-[#0A0A0A] overflow-hidden"
              >
                <div className="flex items-center justify-between p-4 border-b border-white/5">
                  <h3 className="text-sm font-medium text-gray-400 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Counterparty Risk Analysis ({portfolio.counterparties.length})
                  </h3>
                </div>

                <div className="divide-y divide-white/5">
                  {portfolio.counterparties.map((cp, i) => (
                    <motion.div
                      key={cp.address}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 * i }}
                    >
                      <Link
                        href={`/dashboard?address=${cp.address}&chain=${portfolio.chain_id}`}
                        className="flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors group"
                      >
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "h-10 w-10 rounded-xl flex items-center justify-center border",
                            riskBgColor(cp.risk_score)
                          )}>
                            <span className="text-sm font-bold" style={{ color: riskColor(cp.risk_score) }}>
                              {cp.risk_score}
                            </span>
                          </div>
                          <div>
                            <span className="font-mono text-sm text-white">{shortAddr(cp.address)}</span>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className={cn("text-xs font-medium", riskTextColor(cp.risk_score))}>
                                {cp.risk_label.toUpperCase()}
                              </span>
                              {cp.interaction_count > 0 && (
                                <span className="text-xs text-gray-500">
                                  {cp.interaction_count} interactions
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {/* Risk bar */}
                          <div className="w-24 h-2 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${cp.risk_score}%`,
                                backgroundColor: riskColor(cp.risk_score),
                              }}
                            />
                          </div>
                          <ChevronRight className="h-4 w-4 text-gray-600 group-hover:text-white transition-colors" />
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>

                {portfolio.counterparties.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                    <Users className="h-10 w-10 mb-3 opacity-30" />
                    <p>No counterparties found</p>
                    <p className="text-sm mt-1">This wallet may have no on-chain activity</p>
                  </div>
                )}
              </motion.div>
            </div>
          )}

          {/* Empty state */}
          {!portfolio && !loading && !error && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-xl border border-white/10 bg-[#0A0A0A] p-12 text-center"
            >
              <div className="mx-auto h-16 w-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                <PieChart className="h-8 w-8 text-gray-600" />
              </div>
              <h3 className="text-lg font-semibold text-white">Analyze Your Exposure</h3>
              <p className="text-sm text-gray-400 mt-2 max-w-md mx-auto">
                Enter your wallet address above to scan all the wallets you&apos;ve interacted with.
                We&apos;ll score each counterparty and give you an aggregate risk profile.
              </p>
              <div className="mt-6 flex items-center justify-center gap-6 text-xs text-gray-500">
                <div className="flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5" />
                  Top 10 counterparties scanned
                </div>
                <div className="flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5" />
                  ML + heuristic scoring
                </div>
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Aggregate risk profile
                </div>
              </div>
            </motion.div>
          )}

          {/* Footer */}
          <motion.footer
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-8 border-t border-[#1A1A1A] py-6"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded bg-white">
                  <span className="text-xs font-bold text-black">K</span>
                </div>
                <span className="text-sm font-medium text-gray-400">KRYPTOS</span>
              </div>
              <p className="text-xs text-gray-600">
                © 2026 KRYPTOS. Blockchain Intelligence Platform.
              </p>
            </div>
          </motion.footer>
        </div>
      </main>
    </div>
  )
}
