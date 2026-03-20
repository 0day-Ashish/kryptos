"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "@/lib/session"
import { X, Wallet, AlertCircle } from "lucide-react"

const STORAGE_KEY = "kryptos_wallet_banner_dismissed"

export default function PersistentBanner() {
  const router = useRouter()
  const { isAuthenticated, hasWalletConnected, isOnboardingComplete } = useSession()
  const [isVisible, setIsVisible] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY)
    if (dismissed) {
      setIsDismissed(true)
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated && !hasWalletConnected && isOnboardingComplete && !isDismissed) {
      setIsVisible(true)
    } else {
      setIsVisible(false)
    }
  }, [isAuthenticated, hasWalletConnected, isOnboardingComplete, isDismissed])

  const handleDismiss = () => {
    setIsVisible(false)
    setIsDismissed(true)
    localStorage.setItem(STORAGE_KEY, "true")
  }

  const handleConnectWallet = () => {
    router.push("/auth?step=wallet")
  }

  if (!isVisible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#FFB800]/10 border-t border-[#FFB800]/30 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-[#FFB800] flex-shrink-0" />
          <p className="text-sm text-white">
            Connect your wallet to unlock full access to wallet scanning and analysis features.
          </p>
        </div>
        
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={handleConnectWallet}
            className="flex items-center gap-2 px-4 py-1.5 bg-[#FFB800] text-black text-sm font-medium rounded-lg hover:bg-[#E5A800] transition-colors"
          >
            <Wallet className="h-4 w-4" />
            Connect Wallet
          </button>
          <button
            onClick={handleDismiss}
            className="p-1.5 text-gray-400 hover:text-white transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}