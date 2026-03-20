"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { Search, Bell, X, User, Wallet, ChevronDown, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { useWallet } from "@/lib/wallet"
import { useSession } from "@/lib/session"

interface HeaderProps {
  selectedNetwork?: string
  onNetworkChange?: (network: string) => void
}

export default function Header({ selectedNetwork, onNetworkChange }: HeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [walletDropdownOpen, setWalletDropdownOpen] = useState(false)
  const walletDropdownRef = useRef<HTMLDivElement>(null)
  
  const { address, isConnected, linkedWallets, selectedWallet, connect, disconnect, switchWallet } = useWallet()
  const { user } = useSession()

  // Close wallet dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (walletDropdownRef.current && !walletDropdownRef.current.contains(event.target as Node)) {
        setWalletDropdownOpen(false)
      }
    }
    if (walletDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [walletDropdownOpen])

  const formatAddress = (addr: string) => {
    if (!addr) return ""
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="fixed top-0 right-0 z-30 flex h-16 items-center justify-between border-b border-[#1A1A1A] bg-[#000000]/95 px-6 backdrop-blur-sm"
      style={{ left: "16rem" }}
    >
      <div className="flex items-center gap-4">
        {selectedNetwork && onNetworkChange && (
          <select
            value={selectedNetwork}
            onChange={(e) => onNetworkChange(e.target.value)}
            className="rounded-lg border border-[#1A1A1A] bg-[#0A0A0A] px-3 py-2 text-sm text-white focus:border-[#00FF94] focus:outline-none"
          >
            <option value="ETH">ETH</option>
            <option value="BSC">BSC</option>
            <option value="POLYGON">POLYGON</option>
            <option value="ARB">ARB</option>
            <option value="BASE">BASE</option>
          </select>
        )}
        <div className="relative">
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-[#1A1A1A] bg-[#0A0A0A] px-4 py-2 text-sm text-[#888888] hover:border-[#00FF94] hover:text-white"
          >
            <Search className="h-4 w-4" />
            <span>Search wallet address...</span>
            <kbd className="ml-4 rounded bg-[#1A1A1A] px-1.5 py-0.5 text-xs">⌘K</kbd>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Wallet Selector Dropdown */}
        {isConnected && (
          <div className="relative" ref={walletDropdownRef}>
            <button
              onClick={() => setWalletDropdownOpen(!walletDropdownOpen)}
              className="flex items-center gap-2 rounded-lg border border-[#1A1A1A] bg-[#0A0A0A] px-3 py-2 text-sm text-white hover:border-[#00FF94]"
            >
              <Wallet className="h-4 w-4 text-[#00FF94]" />
              <span>{formatAddress(selectedWallet || address || "")}</span>
              <ChevronDown className="h-4 w-4 text-[#888888]" />
            </button>

            <AnimatePresence>
              {walletDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute right-0 mt-2 w-64 rounded-lg border border-[#1A1A1A] bg-[#0A0A0A] shadow-xl"
                >
                  <div className="border-b border-[#1A1A1A] p-3">
                    <p className="text-xs text-[#888888]">Connected Wallet</p>
                    <p className="mt-1 font-mono text-sm text-white">{formatAddress(selectedWallet || address || "")}</p>
                  </div>
                  
                  {/* Linked Wallets List */}
                  {linkedWallets.length > 0 && (
                    <div className="border-b border-[#1A1A1A] p-2">
                      <p className="px-2 py-1 text-xs text-[#888888]">All Wallets</p>
                      {linkedWallets.map((wallet) => (
                        <button
                          key={wallet.address}
                          onClick={() => {
                            switchWallet(wallet.address)
                            setWalletDropdownOpen(false)
                          }}
                          className={cn(
                            "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm",
                            wallet.address === (selectedWallet || address)
                              ? "bg-[#00FF94]/10 text-[#00FF94]"
                              : "text-white hover:bg-[#1A1A1A]"
                          )}
                        >
                          <span className="font-mono">{formatAddress(wallet.address)}</span>
                          {wallet.isPrimary && (
                            <span className="rounded bg-[#00FF94]/20 px-1.5 py-0.5 text-[10px] text-[#00FF94]">Primary</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Disconnect */}
                  <button
                    onClick={() => {
                      disconnect()
                      setWalletDropdownOpen(false)
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[#FF3B3B] hover:bg-[#FF3B3B]/10"
                  >
                    <LogOut className="h-4 w-4" />
                    Disconnect All
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Connect Wallet Button (if not connected) */}
        {!isConnected && (
          <button
            onClick={() => connect()}
            className="flex items-center gap-2 rounded-lg bg-[#00FF94] px-4 py-2 text-sm font-medium text-black hover:bg-[#00FF94]/80"
          >
            <Wallet className="h-4 w-4" />
            Connect Wallet
          </button>
        )}

        <button className="relative rounded-lg p-2 text-[#888888] hover:bg-[#1A1A1A] hover:text-white">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#FF3B3B]" />
        </button>

        <Link href="/profile" className="rounded-lg p-2 text-[#888888] hover:bg-[#1A1A1A] hover:text-white">
          <User className="h-5 w-5" />
        </Link>
      </div>

      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 pt-24 backdrop-blur-sm"
            onClick={() => setSearchOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="w-full max-w-2xl rounded-xl border border-[#1A1A1A] bg-[#0A0A0A] p-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 border-b border-[#1A1A1A] pb-4">
                <Search className="h-5 w-5 text-[#888888]" />
                <input
                  type="text"
                  placeholder="Search wallet address, ENS name, or transaction hash..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent text-white placeholder-[#555555] focus:outline-none"
                  autoFocus
                />
                <button onClick={() => setSearchOpen(false)}>
                  <X className="h-5 w-5 text-[#888888]" />
                </button>
              </div>
              <div className="mt-4">
                <p className="text-xs text-[#555555]">Recent searches</p>
                <div className="mt-2 space-y-2">
                  {["0x742d35Cc6634C0532925a3b844Bc9e7595f2a3b1", "vitalik.eth"].map((item) => (
                    <button
                      key={item}
                      onClick={() => {
                        setSearchQuery(item)
                        setSearchOpen(false)
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#888888] hover:bg-[#1A1A1A] hover:text-white"
                    >
                      <Search className="h-4 w-4" />
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
