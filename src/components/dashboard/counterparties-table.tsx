"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Copy, ChevronUp, ChevronDown, Search, Filter, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CounterpartyInfo } from "@/types"

interface CounterpartiesTableProps {
  counterparties?: CounterpartyInfo[]
}

function formatAddress(addr: string): string {
  if (!addr) return ""
  if (addr.length <= 12) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function formatCurrency(value: number): string {
  if (!value || isNaN(value)) return "$0.00"
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`
  if (value >= 1000) return `$${(value / 1000).toFixed(2)}K`
  return `$${value.toFixed(2)}`
}

export default function CounterpartiesTable({ counterparties: propCounterparties }: CounterpartiesTableProps) {
  const counterparties = propCounterparties?.map(cp => ({
    address: cp.address,
    transactionCount: cp.tx_count,
    totalValue: (cp.total_value || 0) * 1800,
    riskScore: cp.category === "suspect" || cp.category === "scam" ? 20 : 
               cp.category === "high_risk" ? 40 : 80,
    riskLabel: (cp.category === "suspect" ? "HIGH" : "LOW") as "HIGH" | "LOW" | "MEDIUM",
  })) || []
  
  const hasData = counterparties.length > 0

  const [sortField, setSortField] = useState<"transactionCount" | "totalValue" | "riskScore">("totalValue")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const handleSort = (field: "transactionCount" | "totalValue" | "riskScore") => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDir("desc")
    }
  }

  const sortedData = [...counterparties].sort((a, b) => {
    const multiplier = sortDir === "asc" ? 1 : -1
    return (a[sortField] - b[sortField]) * multiplier
  })

  const getRiskBadge = (score: number, label: string) => {
    const bgColor = label === "LOW" ? "bg-[#00FF94]/10" : label === "MEDIUM" ? "bg-[#FFB800]/10" : "bg-[#FF3B3B]/10"
    const textColor = label === "LOW" ? "text-[#00FF94]" : label === "MEDIUM" ? "text-[#FFB800]" : "text-[#FF3B3B]"
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-white">{score}</span>
        <span className={`rounded-full ${bgColor} px-2 py-0.5 text-xs font-medium ${textColor}`}>
          {label}
        </span>
      </div>
    )
  }

  const SortButton = ({ field, label }: { field: "transactionCount" | "totalValue" | "riskScore"; label: string }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-white"
    >
      {label}
      {sortField === field && (
        sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
      )}
    </button>
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-[#1A1A1A] bg-[#0A0A0A]"
    >
      <div className="flex items-center justify-between border-b border-[#1A1A1A] p-4">
        <div>
          <h3 className="text-sm font-medium text-gray-400">Top Counterparties</h3>
          <p className="mt-0.5 text-xs text-gray-600">Most interacted wallets</p>
        </div>
        {hasData && (
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" />
              <input
                type="text"
                placeholder="Search..."
                className="h-8 rounded-lg border border-[#1A1A1A] bg-[#1A1A1A] pl-9 pr-3 text-sm text-white placeholder-gray-600 focus:border-white focus:outline-none"
              />
            </div>
            <button className="flex items-center gap-1.5 rounded-lg border border-[#1A1A1A] px-3 py-1.5 text-xs text-gray-400 hover:bg-white/10 hover:text-white">
              <Filter className="h-3.5 w-3.5" />
              Filter
            </button>
          </div>
        )}
      </div>

      {hasData ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1A1A1A] text-left text-xs text-gray-600">
                <th className="px-4 py-3 font-medium">Rank</th>
                <th className="px-4 py-3 font-medium">Address</th>
                <th className="px-4 py-3 font-medium">
                  <SortButton field="transactionCount" label="Transactions" />
                </th>
                <th className="px-4 py-3 font-medium">
                  <SortButton field="totalValue" label="Total Value" />
                </th>
                <th className="px-4 py-3 font-medium">
                  <SortButton field="riskScore" label="Risk" />
                </th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map((cp, index) => (
                <motion.tr
                  key={cp.address}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className="border-b border-[#1A1A1A] transition-colors hover:bg-white/5"
                >
                  <td className="px-4 py-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded bg-[#1A1A1A]">
                      <span className="text-xs font-medium text-gray-500">{index + 1}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-sm text-white">
                        {formatAddress(cp.address)}
                      </code>
                      <button
                        onClick={() => copyToClipboard(cp.address)}
                        className="rounded p-1 text-gray-600 hover:bg-white/10 hover:text-white"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-white">
                    {cp.transactionCount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-white">
                      {formatCurrency(cp.totalValue)}
                    </span>
                  </td>
                  <td className="px-4 py-3">{getRiskBadge(cp.riskScore, cp.riskLabel)}</td>
                  <td className="px-4 py-3">
                    <button className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10">
                      Analyze
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16">
          <Users className="h-12 w-12 text-gray-600" />
          <p className="mt-4 text-lg text-gray-400">No counterparties found</p>
          <p className="text-sm text-gray-600">Analyze a wallet to see counterparties</p>
        </div>
      )}
    </motion.div>
  )
}
