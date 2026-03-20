"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import { Copy, ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownLeft, Loader2, ArrowRight, Activity } from "lucide-react"
import { cn, formatAddress, formatCurrency, formatDate, formatTime } from "@/lib/utils"
import type { Transaction, PaginationData } from "@/types"

interface TransactionsTableProps {
  showAll?: boolean
  transactions?: Transaction[]
}

export default function TransactionsTable({ showAll = false, transactions: propTransactions }: TransactionsTableProps) {
  const [page, setPage] = useState(1)
  const limit = showAll ? 10 : 5
  const [loading, setLoading] = useState(false)
  const transactions = propTransactions || []
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  })

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const StatusBadge = ({ status }: { status: "success" | "failed" }) => (
    <span
      className={cn(
        "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        status === "success"
          ? "bg-white/10 text-white"
          : "bg-white/10 text-gray-500"
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "success" ? "bg-white" : "bg-gray-500"
        )}
      />
      {status === "success" ? "Success" : "Failed"}
    </span>
  )

  const NetworkBadge = ({ network }: { network: string }) => (
    <span className={cn("flex items-center gap-1.5 text-xs text-white")}>
      <span className={cn("h-2 w-2 rounded-full", "bg-white")} />
      {network}
    </span>
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-[#1A1A1A] bg-[#0A0A0A]"
    >
      <div className="flex items-center justify-between border-b border-[#1A1A1A] p-4">
        <div>
          <h3 className="text-sm font-medium text-gray-400">Recent Transactions</h3>
          <p className="mt-0.5 text-xs text-gray-600">
            {showAll ? "Server-side pagination (first 10 shown)" : "Latest wallet transactions"}
          </p>
        </div>
        {!showAll && (
          <Link 
            href="/portfolio"
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-white"
          >
            View All <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>

      <div className="relative overflow-x-auto">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0A0A0A]/80">
            <Loader2 className="h-6 w-6 animate-spin text-white" />
          </div>
        )}

        {transactions.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Activity className="h-12 w-12 text-gray-600" />
            <p className="mt-4 text-lg text-gray-400">No transactions found</p>
            <p className="text-sm text-gray-600">Connect a wallet to view transactions</p>
          </div>
        ) : (
          <table className="w-full">
          <thead>
            <tr className="border-b border-[#1A1A1A] text-left text-xs text-gray-600">
              <th className="px-4 py-3 font-medium">Transaction Hash</th>
              <th className="px-4 py-3 font-medium">Time</th>
              <th className="px-4 py-3 font-medium">From</th>
              <th className="px-4 py-3 font-medium">To</th>
              <th className="px-4 py-3 font-medium">Value</th>
              <th className="px-4 py-3 font-medium">Token</th>
              <th className="px-4 py-3 font-medium">Network</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Gas</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx, index) => (
              <motion.tr
                key={tx.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.02 }}
                className="border-b border-[#1A1A1A] transition-colors hover:bg-white/5"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <code className="font-mono text-xs text-gray-400">
                      {formatAddress(tx.hash, 8)}
                    </code>
                    <button
                      onClick={() => copyToClipboard(tx.hash)}
                      className="rounded p-0.5 text-gray-600 hover:text-white"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div>
                    <p className="text-sm text-white">{formatDate(tx.timestamp)}</p>
                    <p className="text-xs text-gray-600">{formatTime(tx.timestamp)}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <ArrowUpRight className="h-3 w-3 text-gray-500" />
                    <code className="font-mono text-xs text-gray-500">
                      {formatAddress(tx.from, 6)}
                    </code>
                    <button
                      onClick={() => copyToClipboard(tx.from)}
                      className="rounded p-0.5 text-gray-600 hover:text-white"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <ArrowDownLeft className="h-3 w-3 text-gray-500" />
                    <code className="font-mono text-xs text-gray-500">
                      {formatAddress(tx.to, 6)}
                    </code>
                    <button
                      onClick={() => copyToClipboard(tx.to)}
                      className="rounded p-0.5 text-gray-600 hover:text-white"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-white">
                      {tx.value.toFixed(4)} {tx.token}
                    </p>
                    <p className="text-xs text-gray-600">{formatCurrency(tx.valueUsd)}</p>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">{tx.token}</td>
                <td className="px-4 py-3">
                  <NetworkBadge network={tx.network} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={tx.status} />
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {tx.gasUsed.toLocaleString()}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        )}
      </div>

      {showAll && (
        <div className="flex items-center justify-between border-t border-[#1A1A1A] p-4">
          <p className="text-sm text-gray-600">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to{" "}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
            {pagination.total} transactions
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 rounded-lg border border-[#1A1A1A] px-3 py-1.5 text-sm text-gray-400 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>

            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page === pagination.totalPages}
              className="flex items-center gap-1 rounded-lg border border-[#1A1A1A] px-3 py-1.5 text-sm text-gray-400 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </motion.div>
  )
}
