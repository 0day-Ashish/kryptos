"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import Sidebar from "@/components/dashboard/sidebar"
import Header from "@/components/dashboard/header"
import {
  AlertTriangle, Shield, Activity, RefreshCw, ExternalLink,
  Loader2, Radio, Eye, ChevronRight, Flame, Clock
} from "lucide-react"

interface FeedItem {
  address: string
  risk_score: number
  risk_label: string
  chain: string
  chain_id: number
  flags_count: number
  top_flags: string[]
  tx_count: number
  is_sanctioned: boolean
  scanned_at: string
}

interface FeedStats {
  total_recent: number
  high_risk: number
  medium_risk: number
  low_risk: number
}

function riskColor(score: number) {
  if (score >= 80) return "text-red-400"
  if (score >= 60) return "text-orange-400"
  if (score >= 30) return "text-yellow-400"
  return "text-emerald-400"
}

function riskBg(score: number) {
  if (score >= 80) return "bg-red-500/10 border-red-500/20"
  if (score >= 60) return "bg-orange-500/10 border-orange-500/20"
  if (score >= 30) return "bg-yellow-500/10 border-yellow-500/20"
  return "bg-emerald-500/10 border-emerald-500/20"
}

function riskDot(score: number) {
  if (score >= 80) return "bg-red-500"
  if (score >= 60) return "bg-orange-500"
  if (score >= 30) return "bg-yellow-500"
  return "bg-emerald-500"
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export default function ThreatFeedPage() {
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [stats, setStats] = useState<FeedStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [mounted, setMounted] = useState(false)

  const loadFeed = useCallback(async () => {
    try {
      const data = await api.liveFeed(50)
      setFeed(data.feed)
      setStats(data.stats)
    } catch (err) {
      console.error("Feed load error:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setMounted(true)
    loadFeed()
  }, [loadFeed])

  // Auto-refresh every 15 seconds
  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(loadFeed, 15000)
    return () => clearInterval(interval)
  }, [autoRefresh, loadFeed])

  if (!mounted) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    )
  }

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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">
                  <Radio className="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">Live Threat Feed</h1>
                  <p className="text-sm text-gray-500">
                    Real-time scans across the platform
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                    autoRefresh
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-white/5 text-gray-400 border border-white/10"
                  )}
                >
                  <span className={cn("h-2 w-2 rounded-full", autoRefresh ? "bg-emerald-400 animate-pulse" : "bg-gray-600")} />
                  {autoRefresh ? "Live" : "Paused"}
                </button>
                <button
                  onClick={loadFeed}
                  className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-300 hover:bg-white/10 transition-colors"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </button>
              </div>
            </div>
          </motion.div>

          {/* Stats Cards */}
          {stats && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mb-6 grid gap-4 grid-cols-4"
            >
              <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-4">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                  <Eye className="h-3.5 w-3.5" /> Total Scans
                </div>
                <p className="text-2xl font-bold text-white">{stats.total_recent}</p>
              </div>
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                <div className="flex items-center gap-2 text-red-400 text-xs mb-1">
                  <Flame className="h-3.5 w-3.5" /> High Risk
                </div>
                <p className="text-2xl font-bold text-red-400">{stats.high_risk}</p>
              </div>
              <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
                <div className="flex items-center gap-2 text-yellow-400 text-xs mb-1">
                  <AlertTriangle className="h-3.5 w-3.5" /> Medium Risk
                </div>
                <p className="text-2xl font-bold text-yellow-400">{stats.medium_risk}</p>
              </div>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <div className="flex items-center gap-2 text-emerald-400 text-xs mb-1">
                  <Shield className="h-3.5 w-3.5" /> Low Risk
                </div>
                <p className="text-2xl font-bold text-emerald-400">{stats.low_risk}</p>
              </div>
            </motion.div>
          )}

          {/* Feed List */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-xl border border-white/10 bg-[#0A0A0A] overflow-hidden"
          >
            <div className="flex items-center justify-between p-4 border-b border-white/5">
              <h3 className="text-sm font-medium text-gray-400 flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Recent Scans
              </h3>
              {autoRefresh && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Auto-refreshing every 15s
                </span>
              )}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : feed.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                <Activity className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-lg">No scans yet</p>
                <p className="text-sm mt-1">Scan a wallet to see it appear here</p>
                <Link
                  href="/wallet-scanner"
                  className="mt-4 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-gray-200"
                >
                  Scan a Wallet
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                <AnimatePresence mode="popLayout">
                  {feed.map((item, index) => (
                    <motion.div
                      key={`${item.address}-${item.scanned_at}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: index * 0.03 }}
                    >
                      <Link
                        href={`/dashboard?address=${item.address}&chain=${item.chain_id}`}
                        className="flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors group"
                      >
                        <div className="flex items-center gap-4">
                          {/* Risk indicator dot */}
                          <div className={cn(
                            "h-10 w-10 rounded-xl flex items-center justify-center border",
                            riskBg(item.risk_score)
                          )}>
                            <span className="text-sm font-bold" style={{
                              color: item.risk_score >= 80 ? "#ef4444" :
                                     item.risk_score >= 60 ? "#f97316" :
                                     item.risk_score >= 30 ? "#eab308" : "#10b981"
                            }}>
                              {item.risk_score}
                            </span>
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm text-white">
                                {shortAddr(item.address)}
                              </span>
                              <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-gray-400">
                                {item.chain}
                              </span>
                              {item.is_sanctioned && (
                                <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-400 font-medium">
                                  SANCTIONED
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                              <span className={cn("text-xs font-medium", riskColor(item.risk_score))}>
                                {item.risk_label}
                              </span>
                              {item.flags_count > 0 && (
                                <span className="text-xs text-gray-500">
                                  {item.flags_count} flag{item.flags_count > 1 ? "s" : ""}
                                </span>
                              )}
                              <span className="text-xs text-gray-600">
                                {item.tx_count} txns
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <Clock className="h-3 w-3" />
                              {timeAgo(item.scanned_at)}
                            </div>
                            {item.top_flags.length > 0 && (
                              <p className="text-[10px] text-gray-600 mt-0.5 max-w-[200px] truncate">
                                {item.top_flags[0]}
                              </p>
                            )}
                          </div>
                          <ChevronRight className="h-4 w-4 text-gray-600 group-hover:text-white transition-colors" />
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </motion.div>

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
