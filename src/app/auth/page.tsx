"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession } from "@/lib/session"
import { useWallet } from "@/lib/wallet"
import { Loader2, Mail, Lock, Wallet, Check, ChevronRight, Sparkles } from "lucide-react"

type AuthStep = "register" | "login" | "wallet" | "plan" | "tour"

function AuthPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated, isEmailVerified, hasWalletConnected, login, register, completeOnboarding, isOnboardingComplete, token, user, refreshUserProfile } = useSession()
  const { address: walletAddress, isConnected: isWalletConnected, connect: connectWallet } = useWallet()

  const [step, setStep] = useState<AuthStep>("register")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [selectedPlan, setSelectedPlan] = useState<string>("free")
  const [tourStep, setTourStep] = useState(0)

  useEffect(() => {
    const stepParam = searchParams.get("step") as AuthStep
    if (stepParam && ["register", "login", "wallet", "plan", "tour"].includes(stepParam)) {
      setStep(stepParam)
    }
  }, [searchParams])

  const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Perfect for exploring Kryptos",
    features: ["5 scans/day", "Basic risk score", "1 blockchain"],
    tier: "free" as const,
  },
  {
    name: "Pro",
    price: "$19",
    period: "/month",
    description: "For serious traders & analysts",
    features: ["Unlimited scans", "All 14 chains", "PDF reports", "Watchlist (20 wallets)"],
    tier: "pro" as const,
  },
  {
    name: "Enterprise",
    price: "$99",
    period: "/month",
    description: "For teams & businesses",
    features: ["Everything in Pro", "API access", "Priority support", "Bulk scan (50/batch)"],
    tier: "enterprise" as const,
  },
]

  useEffect(() => {
    const userTier = user?.premium_tier || "free"
    const hasLinkedWallet = (user?.linked_wallets?.length ?? 0) > 0
    
    if (isAuthenticated && isOnboardingComplete) {
      // User is authenticated and completed onboarding - go to dashboard
      router.push("/dashboard")
    } else if (isAuthenticated && userTier !== "free" && hasLinkedWallet) {
      // Pro user with wallet linked - skip to dashboard
      completeOnboarding()
      router.push("/dashboard")
    } else if (isAuthenticated && userTier !== "free" && !hasLinkedWallet) {
      // Pro user but no wallet linked - show wallet step
      setStep("wallet")
    } else if (isAuthenticated && hasLinkedWallet) {
      // Free user but has wallet - skip wallet step, go to plan
      setStep("plan")
    } else if (isAuthenticated && !hasLinkedWallet) {
      // Free user with no wallet - show wallet step
      setStep("wallet")
    }
  }, [isAuthenticated, isOnboardingComplete, user, router, completeOnboarding])

  const handleRegister = async () => {
    if (password !== confirmPassword) {
      setError("Passwords don't match")
      return
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      await register(email, password)
      // Skip OTP verification - auto-verified on backend
      setStep("wallet")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed")
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogin = async () => {
    setIsLoading(true)
    setError(null)

    try {
      await login(email, password)
      // Login now fetches full profile - give a small delay for state to update
      await new Promise(resolve => setTimeout(resolve, 200))
      
      // Use the user from the session (now populated with full profile)
      const userTier = user?.premium_tier || "free"
      const hasLinkedWallet = (user?.linked_wallets?.length ?? 0) > 0
      
      // Skip based on tier and wallet status
      if (userTier !== "free") {
        completeOnboarding()
        router.push("/dashboard")
      } else if (hasLinkedWallet) {
        setStep("plan")
      } else {
        setStep("wallet")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed")
    } finally {
      setIsLoading(false)
    }
  }

  const handleConnectWallet = async () => {
    setIsLoading(true)
    setError(null)

    try {
      await connectWallet()
      setStep("plan")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect wallet")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSkipWallet = () => {
    setStep("plan")
  }

  const handleSelectPlan = async (plan: string) => {
    setSelectedPlan(plan)
    if (plan === "free") {
      completeOnboarding()
      router.push("/dashboard")
    } else {
      try {
        const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
        const response = await fetch(`${API_BASE_URL}/auth/upgrade`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ tier: plan })
        })
        
        if (response.ok) {
          const data = await response.json()
          if (data.checkout_url) {
            window.location.href = data.checkout_url
            return
          }
        }
      } catch (err) {
        console.error("Upgrade error:", err)
      }
      setStep("tour")
    }
  }

  const handleSkipTour = () => {
    completeOnboarding()
    router.push("/dashboard")
  }

  const tourSteps = [
    { title: "Scan Any Wallet", description: "Analyze risk scores, transaction history, and token holdings across 14 chains" },
    { title: "Track Suspicious Addresses", description: "Add wallets to your watchlist and get instant alerts on activity" },
    { title: "Generate Reports", description: "Export detailed PDF risk reports for any wallet address" },
  ]

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white mb-4">
            <span className="text-xl font-bold text-black">K</span>
          </div>
          <h1 className="text-3xl font-bold text-white font-quicktext">KRYPTOS</h1>
          <p className="text-gray-400 mt-2">Blockchain Intelligence Platform</p>
        </div>

        <div className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-2xl p-6">
          {step === "register" && (
            <>
              <h2 className="text-xl font-semibold text-white mb-6">Create Account</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400 mb-1.5 block">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full bg-[#111] border border-[#1A1A1A] rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-gray-600 focus:border-white focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm text-gray-400 mb-1.5 block">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 8 characters"
                      className="w-full bg-[#111] border border-[#1A1A1A] rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-gray-600 focus:border-white focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm text-gray-400 mb-1.5 block">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm password"
                      className="w-full bg-[#111] border border-[#1A1A1A] rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-gray-600 focus:border-white focus:outline-none"
                    />
                  </div>
                </div>

                {error && <p className="text-red-400 text-sm">{error}</p>}

                <button
                  onClick={handleRegister}
                  disabled={isLoading}
                  className="w-full bg-white text-black py-2.5 rounded-lg font-medium hover:bg-gray-200 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Account"}
                  <ChevronRight className="h-4 w-4" />
                </button>

                <p className="text-center text-gray-400 text-sm">
                  Already have an account?{" "}
                  <button onClick={() => { setStep("login"); setError(null) }} className="text-white hover:underline">
                    Sign in
                  </button>
                </p>
              </div>
            </>
          )}

          {step === "login" && (
            <>
              <h2 className="text-xl font-semibold text-white mb-6">Welcome Back</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400 mb-1.5 block">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full bg-[#111] border border-[#1A1A1A] rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-gray-600 focus:border-white focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm text-gray-400 mb-1.5 block">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      className="w-full bg-[#111] border border-[#1A1A1A] rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-gray-600 focus:border-white focus:outline-none"
                    />
                  </div>
                </div>

                {error && <p className="text-red-400 text-sm">{error}</p>}

                <button
                  onClick={handleLogin}
                  disabled={isLoading}
                  className="w-full bg-white text-black py-2.5 rounded-lg font-medium hover:bg-gray-200 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}
                  <ChevronRight className="h-4 w-4" />
                </button>

                <p className="text-center text-gray-400 text-sm">
                  Don't have an account?{" "}
                  <button onClick={() => { setStep("register"); setError(null) }} className="text-white hover:underline">
                    Sign up
                  </button>
                </p>
              </div>
            </>
          )}

          {step === "wallet" && (
            <>
              <div className="text-center mb-6">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/10 mb-4">
                  <Wallet className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-xl font-semibold text-white">Connect Your Wallet</h2>
                <p className="text-gray-400 text-sm mt-2">Connect your wallet to unlock full access to Kryptos</p>
              </div>

              <div className="space-y-4">
                {isWalletConnected ? (
                  <div className="bg-[#111] border border-[#00FF94] rounded-lg p-4 flex items-center gap-3">
                    <Check className="h-5 w-5 text-[#00FF94]" />
                    <span className="text-white">Wallet connected!</span>
                  </div>
                ) : (
                  <button
                    onClick={handleConnectWallet}
                    disabled={isLoading}
                    className="w-full bg-white text-black py-2.5 rounded-lg font-medium hover:bg-gray-200 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Connect Wallet"}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                )}

                {error && <p className="text-red-400 text-sm">{error}</p>}

                <button
                  onClick={handleSkipWallet}
                  className="w-full text-gray-400 py-2 text-sm hover:text-white"
                >
                  Skip for now
                </button>

                <p className="text-center text-gray-500 text-xs">
                  You'll need to connect a wallet to scan addresses
                </p>
              </div>
            </>
          )}

          {step === "plan" && (
            <>
              <div className="text-center mb-6">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/10 mb-4">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-xl font-semibold text-white">Choose Your Plan</h2>
                <p className="text-gray-400 text-sm mt-2">Select a plan that fits your needs</p>
              </div>

              <div className="space-y-3">
                {plans.map((plan) => (
                  <button
                    key={plan.name}
                    onClick={() => handleSelectPlan(plan.tier)}
                    className={`w-full p-4 rounded-lg border text-left transition-all ${
                      selectedPlan === plan.tier
                        ? "border-white bg-white/10"
                        : "border-[#1A1A1A] hover:border-gray-600"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium text-white">{plan.name}</h3>
                        <p className="text-xs text-gray-400 mt-1">{plan.description}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-white">{plan.price}</span>
                        <span className="text-xs text-gray-400">{plan.period}</span>
                      </div>
                    </div>
                  </button>
                ))}

                <button
                  onClick={() => handleSelectPlan("free")}
                  className="w-full text-gray-400 py-2 text-sm hover:text-white"
                >
                  Continue with Free
                </button>
              </div>
            </>
          )}

          {step === "tour" && (
            <>
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center">
                  <div className="flex gap-2 mb-4">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className={`h-2 rounded-full transition-all ${
                          i === tourStep ? "w-8 bg-white" : "w-2 bg-gray-600"
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <h2 className="text-xl font-semibold text-white mt-4">{tourSteps[tourStep].title}</h2>
                <p className="text-gray-400 text-sm mt-2">{tourSteps[tourStep].description}</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSkipTour}
                  className="flex-1 py-2.5 text-gray-400 hover:text-white"
                >
                  Skip
                </button>
                <button
                  onClick={() => {
                    if (tourStep < 2) {
                      setTourStep(tourStep + 1)
                    } else {
                      completeOnboarding()
                      router.push("/dashboard")
                    }
                  }}
                  className="flex-1 bg-white text-black py-2.5 rounded-lg font-medium hover:bg-gray-200 flex items-center justify-center gap-2"
                >
                  {tourStep < 2 ? "Next" : "Get Started"}
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <Loader2 className="h-8 w-8 animate-spin text-white" />
    </div>
  )
}

export default function AuthPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AuthPageContent />
    </Suspense>
  )
}