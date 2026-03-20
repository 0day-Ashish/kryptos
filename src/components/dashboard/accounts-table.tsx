"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Copy, ExternalLink, Trash2, Eye, ArrowRight, Wallet, Plus } from "lucide-react"
import { cn, formatAddress, formatCurrency, formatDate } from "@/lib/utils"
import type { Wallet as WalletType } from "@/types"

interface AccountsTableProps {
  showAll?: boolean
  wallets?: WalletType[]
  onAddWallet?: () => void
  onRemoveWallet?: (address: string) => void
  onAnalyzeWallet?: (address: string, chainId?: number) => void
}

export default function AccountsTable({ 
  showAll = false, 
  wallets: propWallets,
  onAddWallet,
  onRemoveWallet,
  onAnalyzeWallet,
}: AccountsTableProps) {
  const router = useRouter()
  const wallets = propWallets && propWallets.length > 0 
    ? (showAll ? propWallets : propWallets.slice(0, 3))
    : []

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const getRiskBadge = (score: number, label: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      LOW: { bg: "bg-white/10 text-white", text: "text-white" },
      MEDIUM: { bg: "bg-white/10 text-gray-300", text: "text-gray-300" },
      HIGH: { bg: "bg-white/20 text-gray-400", text: "text-gray-400" },
      CRITICAL: { bg: "bg-white/20 text-gray-500", text: "text-gray-500" },
    }
    const color = colors[label] || colors.LOW

    return (
      <div className="flex items-center gap-2">
        <span className={cn("text-sm font-medium", color.text)}>{score}</span>
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", color.bg)}>
          {label}
        </span>
      </div>
    )
  }

  const getNetworkBadge = (network: string) => {
    return (
      <div className="flex items-center gap-2">
        <span className={cn("h-2 w-2 rounded-full", network === "ETH" || network === "BTC" || network === "SOL" ? "bg-white" : "bg-gray-500")} />
        <span className="text-sm text-white">{network}</span>
      </div>
    )
  }

  const handleAnalyze = (address: string) => {
    if (onAnalyzeWallet) {
      onAnalyzeWallet(address)
    } else {
      const params = new URLSearchParams({ address })
      router.push(`/dashboard?${params.toString()}`)
    }
  }

  const handleRemove = (address: string) => {
    if (onRemoveWallet) {
      onRemoveWallet(address)
    }
  }

  const handleViewOnExplorer = (address: string) => {
    const explorers: Record<string, string> = {
      ETH: "https://etherscan.io/address/",
      BTC: "https://blockstream.info/address/",
      SOL: "https://solscan.io/account/",
    }
    const explorer = explorers[wallets.find(w => w.address === address)?.network || "ETH"]
    window.open(`${explorer}${address}`, "_blank")
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-[#1A1A1A] bg-[#0A0A0A]"
    >
      <div className="flex items-center justify-between border-b border-[#1A1A1A] p-4">
        <div>
          <h3 className="text-sm font-medium text-gray-400">Portfolio Accounts</h3>
          <p className="mt-0.5 text-xs text-gray-600">Manage your tracked wallets</p>
        </div>
        <div className="flex items-center gap-2">
          {!showAll && (
            <Link 
              href="/portfolio"
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-white"
            >
              View All <ArrowRight className="h-3 w-3" />
            </Link>
          )}
          <button 
            onClick={onAddWallet}
            className="rounded-lg border border-white/20 bg-white px-4 py-2 text-sm font-medium text-black hover:bg-gray-200"
          >
            + Add Wallet
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        {wallets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Wallet className="h-12 w-12 text-gray-600" />
            <p className="mt-4 text-lg text-gray-400">No wallets in portfolio</p>
            <p className="text-sm text-gray-600">Add wallets to start tracking</p>
            <button 
              onClick={onAddWallet}
              className="mt-4 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-gray-200"
            >
              <Plus className="mr-2 inline h-4 w-4" />
              Add Wallet
            </button>
          </div>
        ) : (
          <table className="w-full">
          <thead>
            <tr className="border-b border-[#1A1A1A] text-left text-xs text-gray-600">
              <th className="px-4 py-3 font-medium">Wallet Address</th>
              <th className="px-4 py-3 font-medium">Network</th>
              <th className="px-4 py-3 font-medium">Balance</th>
              <th className="px-4 py-3 font-medium">Risk Score</th>
              <th className="px-4 py-3 font-medium">Label</th>
              <th className="px-4 py-3 font-medium">Last Seen</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {wallets.map((wallet, index) => (
              <motion.tr
                key={wallet.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="border-b border-[#1A1A1A] transition-colors hover:bg-white/5"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-sm text-white">
                      {formatAddress(wallet.address)}
                    </code>
                    <button
                      onClick={() => copyToClipboard(wallet.address)}
                      className="rounded p-1 text-gray-600 hover:bg-white/10 hover:text-white"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    {wallet.ensName && (
                      <span className="text-xs text-gray-500">{wallet.ensName}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">{getNetworkBadge(wallet.network)}</td>
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium text-white">{wallet.balance.toFixed(4)} {wallet.network}</p>
                    <p className="text-xs text-gray-600">{formatCurrency(wallet.balanceUsd)}</p>
                  </div>
                </td>
                <td className="px-4 py-3">{getRiskBadge(wallet.riskScore, wallet.riskLabel)}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-white/10 px-2 py-1 text-xs text-gray-400">
                    {wallet.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {formatDate(wallet.lastSeen)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => handleAnalyze(wallet.address)}
                      className="rounded p-1.5 text-gray-600 hover:bg-white/10 hover:text-white"
                      title="Analyze"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => handleViewOnExplorer(wallet.address)}
                      className="rounded p-1.5 text-gray-600 hover:bg-white/10 hover:text-white"
                      title="View on Explorer"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => handleRemove(wallet.address)}
                      className="rounded p-1.5 text-gray-600 hover:bg-white/10 hover:text-red-400"
                      title="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        )}
      </div>
    </motion.div>
  )
}
