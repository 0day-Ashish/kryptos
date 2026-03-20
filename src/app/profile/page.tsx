"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "@/lib/session"
import { useWallet, formatAddress } from "@/lib/wallet"
import Image from "next/image"
import { 
  User, Mail, Wallet as WalletIcon, CreditCard, Shield, LogOut, 
  ChevronRight, Crown, Check, AlertCircle, Loader2, Camera, Link2, Unlink
} from "lucide-react"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "demo"
const CLOUDINARY_UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "ml_default"

const tierColors = {
  free: "text-gray-400 bg-gray-500/10 border-gray-500/30",
  pro: "text-[#00FF94] bg-[#00FF94]/10 border-[#00FF94]/30",
  enterprise: "text-[#FFB800] bg-[#FFB800]/10 border-[#FFB800]/30",
}

const tierFeatures = {
  free: ["5 scans/day", "Basic risk score", "1 blockchain"],
  pro: ["Unlimited scans", "All 14 chains", "PDF reports", "20 wallet watchlist"],
  enterprise: ["Everything in Pro", "API access", "Priority support", "50 wallet batch scan"],
}

function getAvatarUrl(email: string): string {
  const hash = email.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(email)}&backgroundColor=1a1a1a&textColor=ffffff`
}

export default function ProfilePage() {
  const router = useRouter()
  const { user, isAuthenticated, token, logout, updateProfile } = useSession()
  const { address: walletAddress, isConnected: isWalletConnected, connect: connectWallet, disconnect: disconnectWallet } = useWallet()
  
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>("expired")
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)

  useEffect(() => {
    async function fetchProfile() {
      if (!token) {
        setIsLoadingProfile(false)
        return
      }
      
      try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: {
            "Authorization": `Bearer ${token}`,
          },
        })
        
        if (response.ok) {
          const data = await response.json()
          setSubscriptionStatus(data.subscription_status)
          if (data.avatar_url) {
            setAvatarUrl(data.avatar_url)
          }
          // Always update premium_tier and subscription_status from backend
          updateProfile({
            ...user!,
            linked_wallets: data.linked_wallets || user?.linked_wallets || [],
            premium_tier: data.premium_tier,
            subscription_status: data.subscription_status,
          })
        }
      } catch (error) {
        console.error("Failed to fetch profile:", error)
      } finally {
        setIsLoadingProfile(false)
      }
    }
    
    fetchProfile()
  }, [token])

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-gray-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Please Sign In</h2>
          <p className="text-gray-400 mb-4">You need to sign in to view your profile</p>
          <button
            onClick={() => router.push("/auth")}
            className="px-6 py-2 bg-white text-black rounded-lg font-medium hover:bg-gray-200"
          >
            Sign In
          </button>
        </div>
      </div>
    )
  }

  if (isLoadingProfile) {
    return (
      <div className="min-h-screen bg-black p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="h-8 w-24 bg-white/10 rounded animate-pulse" />
          <div className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl p-6">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-white/10 animate-pulse" />
              <div className="space-y-2">
                <div className="h-5 w-32 bg-white/10 rounded animate-pulse" />
                <div className="h-4 w-24 bg-white/10 rounded animate-pulse" />
                <div className="h-6 w-20 bg-white/10 rounded animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const handleUpgrade = async (tier: string) => {
    if (!token) return
    
    setIsLoadingSubscription(true)
    try {
      const response = await fetch(`${API_BASE_URL}/auth/upgrade`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ tier }),
      })
      
      if (!response.ok) throw new Error("Failed to create checkout")
      
      const data = await response.json()
      window.location.href = data.checkout_url
    } catch (error) {
      console.error("Upgrade error:", error)
    } finally {
      setIsLoadingSubscription(false)
    }
  }

  const handleCancelSubscription = async () => {
    if (!token) return
    
    setIsLoadingSubscription(true)
    try {
      await fetch(`${API_BASE_URL}/auth/cancel`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      })
      
      if (user) {
        updateProfile({ ...user, premium_tier: "free", subscription_status: "expired" })
      }
    } catch (error) {
      console.error("Cancel error:", error)
    } finally {
      setIsLoadingSubscription(false)
    }
  }

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords don't match")
      return
    }
    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters")
      return
    }
    
    if (!token) return
    
    setPasswordError(null)
    setPasswordSuccess(false)
    
    try {
      const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || "Failed to change password")
      }
      
      setPasswordSuccess(true)
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setTimeout(() => setShowChangePassword(false), 2000)
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "Failed to change password")
    }
  }

  const handleLogout = () => {
    logout()
    router.push("/")
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploadingAvatar(true)
    
    const formData = new FormData()
    formData.append("file", file)
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET)

    try {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        {
          method: "POST",
          body: formData,
        }
      )
      const data = await response.json()
      const uploadedUrl = data.secure_url
      
      setAvatarUrl(uploadedUrl)
      
      // Save to database
      if (token) {
        await fetch(`${API_BASE_URL}/auth/update-profile`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify({ avatar_url: uploadedUrl }),
        })
        
        if (user) {
          updateProfile({ ...user, avatar_url: uploadedUrl })
        }
      }
    } catch (error) {
      console.error("Upload failed:", error)
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const handleDisconnectWallet = () => {
    disconnectWallet()
  }

  const linkedWallets = user?.linked_wallets || []
  const primaryWallet = linkedWallets.find(w => w.is_primary) || linkedWallets[0]
  const displayAvatar = avatarUrl || user?.avatar_url || (user?.email ? getAvatarUrl(user.email) : null)

  return (
    <div className="min-h-screen bg-black p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Profile</h1>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>

        <div className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="relative group">
              {isUploadingAvatar ? (
                <div className="h-16 w-16 rounded-full bg-white/10 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 text-white animate-spin" />
                </div>
              ) : displayAvatar ? (
                <img 
                  src={displayAvatar}
                  alt="Profile"
                  className="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                <div className="h-16 w-16 rounded-full bg-white/10 flex items-center justify-center">
                  <User className="h-8 w-8 text-white" />
                </div>
              )}
              {!isUploadingAvatar && (
                <label className="absolute bottom-0 right-0 h-6 w-6 bg-white rounded-full flex items-center justify-center cursor-pointer shadow-lg group-hover:scale-110 transition-transform">
                  <Camera className="h-3 w-3 text-black" />
                  <input 
                    type="file" 
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                </label>
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">{user?.email || "User"}</h2>
              <p className="text-sm text-gray-400">Joined {user?.created_at ? new Date(user.created_at).toLocaleDateString() : "N/A"}</p>
              <div className={`inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full border text-xs font-medium ${tierColors[user?.premium_tier || "free"]}`}>
                <Crown className="h-3 w-3" />
                {user?.premium_tier?.toUpperCase() || "FREE"} Plan
              </div>
            </div>
          </div>
        </div>

        {/* Connected Wallet Section */}
        <div className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl p-6">
          <h3 className="text-sm font-medium text-gray-400 mb-4 flex items-center gap-2">
            <WalletIcon className="h-4 w-4" />
            Connected Wallet
          </h3>
          {isWalletConnected && walletAddress ? (
            <div className="flex items-center justify-between p-3 bg-[#111] rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-[#00FF94]" />
                <span className="text-white font-mono text-sm">{formatAddress(walletAddress)}</span>
                <span className="text-xs text-[#00FF94] bg-[#00FF94]/10 px-2 py-0.5 rounded">Connected</span>
              </div>
              <button
                onClick={handleDisconnectWallet}
                className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                <Unlink className="h-3 w-3" />
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={connectWallet}
              className="w-full py-3 border border-dashed border-gray-600 rounded-lg text-gray-400 hover:text-white hover:border-gray-400 transition-colors flex items-center justify-center gap-2"
            >
              <Link2 className="h-4 w-4" />
              Connect Wallet
            </button>
          )}
        </div>

        <div className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl p-6">
          <h3 className="text-sm font-medium text-gray-400 mb-4 flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Subscription
          </h3>
          
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white font-medium capitalize">{user?.premium_tier || "Free"} Plan</span>
              <span className={`text-xs px-2 py-1 rounded ${subscriptionStatus === "active" ? "bg-[#00FF94]/10 text-[#00FF94]" : "bg-gray-500/10 text-gray-400"}`}>
                {subscriptionStatus}
              </span>
            </div>
            <p className="text-sm text-gray-400">
              {tierFeatures[user?.premium_tier || "free"].join(" • ")}
            </p>
          </div>

          {(user?.premium_tier === "free" || user?.premium_tier === undefined) && (
            <button
              onClick={() => router.push("/pricing")}
              className="w-full py-2.5 bg-white text-black rounded-lg font-medium hover:bg-gray-200 flex items-center justify-center gap-2"
            >
              Upgrade Plan
              <ChevronRight className="h-4 w-4" />
            </button>
          )}

          {(user?.premium_tier === "pro" || user?.premium_tier === "enterprise") && subscriptionStatus === "active" && (
            <div className="flex gap-3">
              <button
                onClick={() => handleUpgrade("enterprise")}
                disabled={isLoadingSubscription}
                className="flex-1 py-2.5 border border-gray-600 text-white rounded-lg font-medium hover:border-gray-400 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoadingSubscription ? <Loader2 className="h-4 w-4 animate-spin" /> : "Upgrade to Enterprise"}
              </button>
              <button
                onClick={handleCancelSubscription}
                disabled={isLoadingSubscription}
                className="px-4 py-2.5 text-gray-400 hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        <div className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl p-6">
          <h3 className="text-sm font-medium text-gray-400 mb-4 flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Security
          </h3>

          {!showChangePassword ? (
            <button
              onClick={() => setShowChangePassword(true)}
              className="w-full py-2.5 border border-gray-600 text-white rounded-lg font-medium hover:border-gray-400 transition-colors"
            >
              Change Password
            </button>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-1.5 block">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full bg-[#111] border border-[#1A1A1A] rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:border-white focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1.5 block">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-[#111] border border-[#1A1A1A] rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:border-white focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1.5 block">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-[#111] border border-[#1A1A1A] rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:border-white focus:outline-none"
                />
              </div>
              
              {passwordError && <p className="text-red-400 text-sm">{passwordError}</p>}
              {passwordSuccess && <p className="text-[#00FF94] text-sm">Password changed successfully!</p>}
              
              <div className="flex gap-3">
                <button
                  onClick={handleChangePassword}
                  className="flex-1 py-2.5 bg-white text-black rounded-lg font-medium hover:bg-gray-200"
                >
                  Update Password
                </button>
                <button
                  onClick={() => { setShowChangePassword(false); setPasswordError(null); setPasswordSuccess(false) }}
                  className="px-4 py-2.5 text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}