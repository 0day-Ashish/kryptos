"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import Link from "next/link"
import { useSession } from "@/lib/session"
import { Check, X, Zap, Shield, Globe, CreditCard, Users, FileText, Server, ChevronRight, ArrowRight, CheckCircle2, Crown, Loader2, User } from "lucide-react"
import { cn } from "@/lib/utils"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

const sidebarItems = [
  { id: "dashboard", label: "Dashboard", icon: "LayoutDashboard", href: "/dashboard" },
  { id: "portfolio", label: "Portfolio", icon: "Wallet", href: "/portfolio" },
  { id: "wallet-scanner", label: "Wallet Scanner", icon: "Search", href: "/wallet-scanner" },
  { id: "token-scanner", label: "Token Scanner", icon: "Coins", href: "/token-scanner" },
  { id: "risk-reports", label: "Risk Reports", icon: "FileWarning", href: "/risk-reports" },
  { id: "community", label: "Community Intelligence", icon: "MessageSquare", href: "/community" },
  { id: "leaderboard", label: "Leaderboard", icon: "Trophy", href: "/leaderboard" },
  { id: "pricing", label: "Pricing", icon: "CreditCard", href: "/pricing" },
  { id: "settings", label: "Settings", icon: "Settings", href: "/settings" },
]

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard: ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" /><rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" /></svg>,
  Wallet: ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 4v4a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" /><path d="M3 5v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1" /><circle cx="17" cy="14" r="2" /></svg>,
  Search: ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>,
  Coins: ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="8" cy="8" r="6" /><path d="M19 8.5A6.5 6.5 0 0 1 8.5 19" /><path d="M8.5 5.5a6.5 6.5 0 0 1 10.5 5.5" /></svg>,
  FileWarning: ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>,
  MessageSquare: ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /></svg>,
  Trophy: ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m6 9 6 6 6-6" /><path d="M12 15V3" /><path d="M22 10H2" /></svg>,
  CreditCard: ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="20" height="14" x="2" y="5" rx="2" /><path d="M2 10h20" /></svg>,
  Settings: ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>,
}

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Perfect for exploring Kryptos",
    gradient: "from-gray-800 to-gray-900",
    features: [
      { name: "5 scans/day", included: true },
      { name: "Basic risk score", included: true },
      { name: "1 blockchain", included: true },
      { name: "Basic wallet analysis", included: true },
    ],
    notIncluded: ["Unlimited scans", "All 14 chains", "PDF reports", "API access"],
    cta: "Get Started",
    ctaVariant: "outline",
  },
  {
    name: "Pro",
    price: "$19",
    period: "/month",
    description: "For serious traders & analysts",
    gradient: "from-white to-gray-200",
    popular: true,
    features: [
      { name: "Unlimited scans", included: true },
      { name: "All 14 chains", included: true },
      { name: "PDF reports", included: true },
      { name: "Watchlist (20 wallets)", included: true },
      { name: "Fund flow tracing", included: true },
      { name: "Bulk scan (10/batch)", included: true },
      { name: "CSV export", included: true },
      { name: "On-chain reports", included: true },
    ],
    notIncluded: ["API access", "Priority support"],
    cta: "Subscribe Now",
    ctaVariant: "solid",
  },
  {
    name: "Enterprise",
    price: "$99",
    period: "/month",
    description: "For teams & businesses",
    gradient: "from-gray-700 to-gray-800",
    features: [
      { name: "Everything in Pro", included: true },
      { name: "Bulk scan (50/batch)", included: true },
      { name: "API access", included: true },
      { name: "Priority support", included: true },
      { name: "CSV export", included: true },
      { name: "On-chain reports", included: true },
      { name: "Custom integrations", included: true },
      { name: "Dedicated account manager", included: true },
    ],
    notIncluded: [],
    cta: "Contact Sales",
    ctaVariant: "outline",
  },
]

const apiPlans = [
  {
    name: "Developer",
    price: "$49",
    period: "/mo",
    rateLimit: "1,000 requests/day",
    description: "For indie hackers",
    features: ["Basic wallet data", "Risk scores", "Email support"],
  },
  {
    name: "Business",
    price: "$199",
    period: "/mo",
    rateLimit: "10,000 requests/day",
    description: "For products & teams",
    features: ["Webhook alerts", "Higher rate limits", "Priority support"],
  },
  {
    name: "Unlimited",
    price: "$499",
    period: "/mo",
    rateLimit: "100,000 requests/day",
    description: "For scaling platforms",
    features: ["Custom endpoints", "Dedicated support", "SLA guarantee"],
  },
]

const faqs = [
  { q: "Can I cancel anytime?", a: "Yes, you can cancel your subscription at any time. No questions asked." },
  { q: "What payment methods do you accept?", a: "We accept all major credit cards, crypto payments, and wire transfers for Enterprise." },
  { q: "Is there a refund policy?", a: "Yes, we offer a 30-day money-back guarantee for all paid plans." },
  { q: "Can I upgrade or downgrade?", a: "Absolutely. Switch between plans anytime. We'll prorate your billing." },
]

export default function PricingPage() {
  const router = useRouter()
  const { isAuthenticated, token, user } = useSession()
  const [isUpgrading, setIsUpgrading] = useState(false)

  const handlePlanClick = async (planName: string) => {
    if (planName === "Free") {
      router.push("/dashboard")
      return
    }

    if (!isAuthenticated || !token) {
      router.push("/auth")
      return
    }

    const tierMap: Record<string, string> = {
      "Pro": "pro",
      "Enterprise": "enterprise",
    }

    const tier = tierMap[planName]
    if (!tier) return

    setIsUpgrading(true)
    try {
      console.log("Creating checkout for tier:", tier)
      const response = await fetch(`${API_BASE_URL}/auth/upgrade`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ tier }),
      })

      console.log("Response status:", response.status)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error("Upgrade error:", errorData)
        alert(`Error: ${errorData.detail || "Failed to create checkout"}`)
        return
      }

      const data = await response.json()
      console.log("Checkout URL:", data.checkout_url)
      
      if (data.checkout_url) {
        window.location.href = data.checkout_url
      } else {
        console.error("No checkout URL in response:", data)
        alert("Failed to get checkout URL")
      }
    } catch (error) {
      console.error("Upgrade error:", error)
      alert("An error occurred. Please try again.")
    } finally {
      setIsUpgrading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Hero Section */}
        <section className="relative overflow-hidden py-20">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(255,255,255,0.05)_0%,_transparent_70%)]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/5 rounded-full blur-[100px]" />
          
          <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <span className="inline-block rounded-full border border-white/20 bg-white/5 px-4 py-1.5 text-sm text-white/80">Simple, transparent pricing</span>
              <h1 className="mt-6 text-5xl font-bold text-white font-quicktext">
                Choose Your <span className="text-white/80">Power</span>
              </h1>
              <p className="mt-4 text-xl text-gray-400 max-w-2xl mx-auto">
                From casual users to enterprise teams — find the perfect plan to unlock blockchain intelligence.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Pricing Cards */}
        <section className="relative z-10 px-6 pb-20">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-6 md:grid-cols-3">
              {plans.map((plan, index) => (
                <motion.div
                  key={plan.name}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={cn(
                    "relative rounded-2xl border border-white/10 bg-[#0A0A0A] p-6 transition-all hover:border-white/20",
                    plan.popular && "ring-2 ring-white/30 scale-105"
                  )}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="rounded-full bg-white px-4 py-1 text-xs font-semibold text-black">Most Popular</span>
                    </div>
                  )}
                  
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                    <div className="mt-3 flex items-baseline justify-center gap-1">
                      <span className="text-4xl font-bold text-white">{plan.price}</span>
                      <span className="text-gray-500">{plan.period}</span>
                    </div>
                    <p className="mt-2 text-sm text-gray-400">{plan.description}</p>
                  </div>

                  <ul className="mt-6 space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature.name} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-white" />
                        <span className="text-gray-300">{feature.name}</span>
                      </li>
                    ))}
                    {plan.notIncluded?.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm opacity-40">
                        <X className="h-4 w-4" />
                        <span className="text-gray-500">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button 
                    onClick={() => handlePlanClick(plan.name)}
                    className={cn(
                      "mt-6 w-full rounded-lg py-3 text-sm font-medium transition-all",
                      plan.ctaVariant === "solid" 
                        ? "bg-white text-black hover:bg-gray-200" 
                        : "border border-white/20 text-white hover:bg-white/10",
                      isUpgrading && "opacity-50 cursor-not-allowed"
                    )}
                    disabled={isUpgrading}
                  >
                    {isUpgrading ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Processing...
                      </span>
                    ) : (
                      plan.cta
                    )}
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* API Plans */}
        <section className="border-t border-white/5 py-20">
          <div className="mx-auto max-w-4xl px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-white font-quicktext">API Access</h2>
              <p className="mt-2 text-gray-400">Build Kryptos into your products</p>
            </div>
            
            <div className="grid gap-4 md:grid-cols-3">
              {apiPlans.map((plan) => (
                <div key={plan.name} className="rounded-xl border border-white/10 bg-[#0A0A0A] p-5">
                  <h3 className="text-white font-semibold">{plan.name}</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-white">{plan.price}</span>
                    <span className="text-gray-500 text-sm">{plan.period}</span>
                  </div>
                  <p className="mt-1 text-xs text-white/60">{plan.rateLimit}</p>
                  <p className="mt-3 text-sm text-gray-400">{plan.description}</p>
                  <ul className="mt-4 space-y-2">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-xs text-gray-400">
                        <Check className="h-3 w-3" /> {f}
                      </li>
                    ))}
                  </ul>
                  <button className="mt-4 w-full rounded-lg border border-white/20 py-2 text-sm text-white hover:bg-white/5">
                    Get API Key
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Chrome Extension */}
        <section className="border-t border-white/5 py-20">
          <div className="mx-auto max-w-3xl px-6">
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0A0A0A] to-[#111] p-8 text-center">
              <div className="inline-flex items-center justify-center rounded-xl bg-white/10 p-3 mb-4">
                <Users className="h-6 w-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white">Kryptos Guard</h2>
              <p className="mt-2 text-gray-400">Chrome extension for instant risk analysis</p>
              
              <div className="mt-6 flex items-center justify-center gap-8">
                <div>
                  <p className="text-3xl font-bold text-white">Free</p>
                  <p className="text-xs text-gray-500">Basic features</p>
                </div>
                <div className="h-12 w-px bg-white/10" />
                <div>
                  <p className="text-3xl font-bold text-white">$4.99<span className="text-sm font-normal text-gray-400">/mo</span></p>
                  <p className="text-xs text-gray-500">Premium</p>
                </div>
              </div>
              
              <button className="mt-6 rounded-lg bg-white px-6 py-2.5 text-sm font-medium text-black hover:bg-gray-200">
                Coming Soon
              </button>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t border-white/5 py-20">
          <div className="mx-auto max-w-2xl px-6">
            <h2 className="text-center text-2xl font-bold text-white mb-12">Frequently Asked Questions</h2>
            <div className="space-y-4">
              {faqs.map((faq, i) => (
                <div key={i} className="rounded-xl border border-white/10 bg-[#0A0A0A] p-4">
                  <h3 className="text-white font-medium">{faq.q}</h3>
                  <p className="mt-2 text-sm text-gray-400">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-white/5 py-20">
          <div className="mx-auto max-w-2xl px-6 text-center">
            <h2 className="text-3xl font-bold text-white">Ready to get started?</h2>
            <p className="mt-2 text-gray-400">Join thousands of users trusting Kryptos for blockchain intelligence</p>
            <div className="mt-8 flex justify-center gap-4">
              <button className="rounded-lg bg-white px-6 py-3 font-medium text-black hover:bg-gray-200 flex items-center gap-2">
                Start Free <ArrowRight className="h-4 w-4" />
              </button>
              <button className="rounded-lg border border-white/20 px-6 py-3 font-medium text-white hover:bg-white/5">
                Talk to Sales
              </button>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-[#1A1A1A] py-8 px-6">
          <div className="mx-auto max-w-6xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-white">
                <span className="text-xs font-bold text-black">K</span>
              </div>
              <span className="text-sm font-medium text-gray-400">KRYPTOS</span>
            </div>
            <p className="text-xs text-gray-600">© 2026 KRYPTOS. Blockchain Intelligence Platform.</p>
          </div>
        </footer>
      </div>
    )
}
