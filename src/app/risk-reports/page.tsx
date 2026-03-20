"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Shield,
  AlertTriangle,
  FileText,
  ExternalLink,
  Loader2,
  Calendar,
  TrendingUp,
  Users,
  MessageSquare,
  ChevronRight,
} from "lucide-react";
import Sidebar from "@/components/dashboard/sidebar";
import Header from "@/components/dashboard/header";
import CountryWallets from "@/components/dashboard/country-wallets";
import FreePlanGuard from "@/components/dashboard/free-plan-guard";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import type { CommunityReport } from "@/types";

/* ─── helpers ─── */
function formatAddress(addr: string): string {
  if (!addr) return "";
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  } catch {
    return dateStr;
  }
}

function getRiskColor(score: number) {
  if (score >= 70) return "text-[#00FF94]";
  if (score >= 40) return "text-[#FFB800]";
  return "text-[#FF3B3B]";
}

function getRiskBg(score: number) {
  if (score >= 70) return "bg-[#00FF94]/10 border-[#00FF94]/20";
  if (score >= 40) return "bg-[#FFB800]/10 border-[#FFB800]/20";
  return "bg-[#FF3B3B]/10 border-[#FF3B3B]/20";
}

function getRiskLevel(score: number) {
  if (score >= 70) return "Low Risk";
  if (score >= 40) return "Medium Risk";
  return "High Risk";
}

interface FlaggedReport {
  id: string;
  address: string;
  label: string;
  category: string;
  riskScore: number;
  riskLevel: string;
  reportCount: string;
  flags: string[];
}

/* ─── sub-components ─── */
function SectionHeader({
  dot,
  title,
  subtitle,
}: {
  dot: "green" | "red";
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span
        className={`h-2 w-2 flex-shrink-0 rounded-full ${
          dot === "green" ? "bg-[#00FF94]" : "bg-[#FF3B3B]"
        }`}
      />
      <span className="text-sm font-medium text-gray-300">
        {title}
        {subtitle && <span className="ml-1 text-gray-500">{subtitle}</span>}
      </span>
    </div>
  );
}

function FlaggedCard({
  report,
  index,
}: {
  report: FlaggedReport;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
      className="group rounded-xl border border-[#1A1A1A] bg-[#0A0A0A] p-5 transition-colors hover:border-[#2A2A2A]"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Left */}
        <div className="flex items-center gap-4">
          <div
            className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border ${getRiskBg(
              report.riskScore,
            )}`}
          >
            <Shield className={`h-5 w-5 ${getRiskColor(report.riskScore)}`} />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-white">{report.label}</span>
              <span
                className={`rounded-full border px-2 py-0.5 text-xs font-medium ${getRiskBg(
                  report.riskScore,
                )} ${getRiskColor(report.riskScore)}`}
              >
                {report.riskLevel}
              </span>
            </div>

            <p className="mt-0.5 font-mono text-xs text-gray-500">
              {formatAddress(report.address)}
            </p>

            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-gray-600">
              <span className="capitalize">{report.category}</span>
              <span>·</span>
              <span>{report.reportCount}</span>
            </div>
          </div>
        </div>

        {/* Right */}
        <div className="flex flex-shrink-0 items-center gap-2">
          {report.flags.length > 0 && (
            <div className="hidden flex-wrap gap-1.5 sm:flex">
              {report.flags.slice(0, 3).map((flag, i) => (
                <span
                  key={i}
                  className="rounded-full bg-[#FF3B3B]/10 px-2 py-0.5 text-xs text-[#FF3B3B]"
                >
                  {flag}
                </span>
              ))}
            </div>
          )}

          <div
            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border ${getRiskBg(
              report.riskScore,
            )}`}
          >
            <span
              className={`text-sm font-bold ${getRiskColor(report.riskScore)}`}
            >
              {report.riskScore}
            </span>
          </div>

          <button className="rounded-lg border border-[#1A1A1A] bg-[#111] p-2 text-gray-500 transition-colors hover:border-[#333] hover:text-white">
            <FileText className="h-4 w-4" />
          </button>
          <button className="rounded-lg border border-[#1A1A1A] bg-[#111] p-2 text-gray-500 transition-colors hover:border-[#333] hover:text-white">
            <ExternalLink className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function CommunityCard({
  report,
  index,
}: {
  report: CommunityReport;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
      className="rounded-xl border border-[#1A1A1A] bg-[#0A0A0A] p-5 transition-colors hover:border-[#2A2A2A]"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 text-[#FFB800]" />
            <span className="rounded-full bg-[#FFB800]/10 px-2 py-0.5 text-xs font-medium text-[#FFB800]">
              {report.category}
            </span>
            <span className="font-mono text-sm text-white">
              {formatAddress(report.address)}
            </span>
          </div>

          {report.description && (
            <p className="mt-2 text-sm leading-relaxed text-gray-400">
              {report.description}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-gray-600">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(report.created_at)}
            </span>
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              {report.votes} votes
            </span>
            {report.reporter_id && report.reporter_id !== "anonymous" && (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {report.reporter_id}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          <button className="rounded-lg border border-[#00FF94]/30 bg-[#00FF94]/10 px-3 py-1.5 text-sm font-medium text-[#00FF94] transition-colors hover:bg-[#00FF94]/20">
            +{report.votes}
          </button>
          <button className="rounded-lg border border-[#FF3B3B]/30 bg-[#FF3B3B]/10 px-3 py-1.5 text-sm font-medium text-[#FF3B3B] transition-colors hover:bg-[#FF3B3B]/20">
            Flag
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function LoadingSpinner({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20">
      <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
      <p className="text-sm text-gray-600">{label}</p>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center gap-3 py-20"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#1A1A1A] bg-[#0A0A0A]">
        <Icon className="h-6 w-6 text-gray-600" />
      </div>
      <p className="text-base font-medium text-gray-400">{title}</p>
      <p className="text-sm text-gray-600">{subtitle}</p>
    </motion.div>
  );
}

/* ─── page ─── */
export default function RiskReportsPage() {
  const { user } = useSession();

  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"known" | "community">("known");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedRisk, setSelectedRisk] = useState("all");

  const [loadingCommunity, setLoadingCommunity] = useState(false);
  const [loadingFlagged, setLoadingFlagged] = useState(false);

  const [communityReports, setCommunityReports] = useState<CommunityReport[]>(
    [],
  );
  const [flaggedAddresses, setFlaggedAddresses] = useState<
    Array<{ address: string; report_count: number; categories: string[] }>
  >([]);

  const isPro =
    user && (user.premium_tier === "pro" || user.premium_tier === "enterprise");

  /* ─── data fetching ─── */
  const fetchCommunityReports = useCallback(async () => {
    setLoadingCommunity(true);
    try {
      const res = await api.communityRecent(20);
      setCommunityReports(res.reports ?? []);
    } catch (err) {
      console.error("community reports:", err);
    } finally {
      setLoadingCommunity(false);
    }
  }, []);

  const fetchFlaggedAddresses = useCallback(async () => {
    setLoadingFlagged(true);
    try {
      const res = await api.communityFlagged(2);
      setFlaggedAddresses(res.addresses ?? []);
    } catch (err) {
      console.error("flagged addresses:", err);
    } finally {
      setLoadingFlagged(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    fetchCommunityReports();
    fetchFlaggedAddresses();
  }, [fetchCommunityReports, fetchFlaggedAddresses]);

  /* ─── derived data ─── */
  const flaggedReports: FlaggedReport[] = flaggedAddresses
    .map((addr, i) => ({
      id: `flagged-${i}`,
      address: addr.address,
      label: addr.categories[0] ?? "Flagged",
      category: "flagged",
      riskScore: Math.max(10, 70 - addr.report_count * 10),
      riskLevel: addr.report_count > 5 ? "Critical" : "High Risk",
      reportCount: `${addr.report_count} report${addr.report_count !== 1 ? "s" : ""}`,
      flags: addr.categories,
    }))
    .filter((r) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        r.address.toLowerCase().includes(q) ||
        r.label.toLowerCase().includes(q);
      const matchCat =
        selectedCategory === "all" || r.category === selectedCategory;
      const matchRisk =
        selectedRisk === "all" ||
        (selectedRisk === "high" && r.riskScore < 40) ||
        (selectedRisk === "medium" && r.riskScore >= 40 && r.riskScore < 70) ||
        (selectedRisk === "low" && r.riskScore >= 70);
      return matchSearch && matchCat && matchRisk;
    });

  /* ─── render guard ─── */
  if (!mounted) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-white border-t-transparent" />
      </div>
    );
  }

  /* ─── main render ─── */
  return (
    <div className="min-h-screen bg-black">
      <Sidebar />
      <Header />

      <main
        className="pt-16 transition-all duration-300"
        style={{ marginLeft: "16rem" }}
      >
        <div className="p-6 pb-12">
          {/* ── page title ── */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-7"
          >
            <h1 className="text-2xl font-bold text-white">Risk Reports</h1>
            <p className="mt-1 text-sm text-gray-500">
              View and analyze risk assessments for tracked wallets
            </p>
          </motion.div>

          {/* ── tabs ── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
            className="mb-6 flex gap-2"
          >
            {(
              [
                { id: "known", label: "Known Wallets", icon: FileText },
                { id: "community", label: "Community Reports", icon: Users },
              ] as const
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all duration-200 ${
                  activeTab === id
                    ? "border-white bg-white text-black"
                    : "border-[#1A1A1A] bg-transparent text-gray-400 hover:border-[#2A2A2A] hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </motion.div>

          {/* ── search / filters ── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="mb-8 flex flex-col gap-3 sm:flex-row"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by address or label…"
                className="w-full rounded-lg border border-[#1A1A1A] bg-[#0A0A0A] py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-600 outline-none transition-colors focus:border-[#2A2A2A]"
              />
            </div>

            <div className="flex gap-2">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="cursor-pointer rounded-lg border border-[#1A1A1A] bg-[#0A0A0A] px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-[#2A2A2A]"
              >
                <option value="all">All Categories</option>
                <option value="exchange">Exchange</option>
                <option value="defi">DeFi</option>
                <option value="stablecoin">Stablecoin</option>
                <option value="bridge">Bridge</option>
                <option value="notable">Notable</option>
                <option value="flagged">Flagged</option>
              </select>

              <select
                value={selectedRisk}
                onChange={(e) => setSelectedRisk(e.target.value)}
                className="cursor-pointer rounded-lg border border-[#1A1A1A] bg-[#0A0A0A] px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-[#2A2A2A]"
              >
                <option value="all">All Risk Levels</option>
                <option value="low">Low Risk (70+)</option>
                <option value="medium">Medium Risk (40–69)</option>
                <option value="high">High Risk (&lt;40)</option>
              </select>
            </div>
          </motion.div>

          {/* ══════════════════════════════════════════
              TAB: KNOWN WALLETS
          ══════════════════════════════════════════ */}
          <AnimatePresence mode="wait">
            {activeTab === "known" && (
              <motion.div
                key="known"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {/* ── trusted entity wallets ── */}
                <div className="mb-10">
                  <div className="mb-5">
                    <h2 className="text-base font-semibold text-white">
                      Trusted Entity Wallets
                    </h2>
                    <p className="mt-0.5 text-xs text-gray-600">
                      Known exchanges, DeFi protocols, bridges, and notable
                      addresses
                    </p>
                  </div>

                  <div className="space-y-6">
                    {/* safe wallets */}
                    <div>
                      <SectionHeader
                        dot="green"
                        title="Safe Wallets"
                        subtitle="(80+ Trust Score)"
                      />
                      {isPro ? (
                        <CountryWallets filter="safe" />
                      ) : (
                        <FreePlanGuard feature="Safe trusted wallets (80+ trust score)">
                          <CountryWallets filter="safe" />
                        </FreePlanGuard>
                      )}
                    </div>

                    {/* risky wallets */}
                    <div>
                      <SectionHeader
                        dot="red"
                        title="High Risk / Unknown Wallets"
                      />
                      <CountryWallets filter="risky" />
                    </div>
                  </div>
                </div>

                {/* ── community flagged addresses ── */}
                <div>
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-semibold text-white">
                        Community Flagged Addresses
                      </h2>
                      <p className="mt-0.5 text-xs text-gray-600">
                        Addresses reported as suspicious by the community
                      </p>
                    </div>
                    {flaggedReports.length > 0 && !loadingFlagged && (
                      <span className="rounded-full border border-[#FF3B3B]/30 bg-[#FF3B3B]/10 px-2.5 py-0.5 text-xs font-medium text-[#FF3B3B]">
                        {flaggedReports.length} flagged
                      </span>
                    )}
                  </div>

                  {loadingFlagged ? (
                    <LoadingSpinner label="Loading flagged addresses…" />
                  ) : flaggedReports.length === 0 ? (
                    <EmptyState
                      icon={Shield}
                      title="No flagged addresses"
                      subtitle="No addresses have been flagged yet"
                    />
                  ) : (
                    <div className="grid gap-3">
                      <AnimatePresence>
                        {flaggedReports.map((r, i) => (
                          <FlaggedCard key={r.id} report={r} index={i} />
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ══════════════════════════════════════════
                TAB: COMMUNITY REPORTS
            ══════════════════════════════════════════ */}
            {activeTab === "community" && (
              <motion.div
                key="community"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-white">
                      Community Reports
                    </h2>
                    <p className="mt-0.5 text-xs text-gray-600">
                      User-submitted risk reports and flagged activity
                    </p>
                  </div>
                  {communityReports.length > 0 && !loadingCommunity && (
                    <span className="rounded-full border border-[#1A1A1A] bg-[#0A0A0A] px-2.5 py-0.5 text-xs text-gray-400">
                      {communityReports.length} reports
                    </span>
                  )}
                </div>

                {loadingCommunity ? (
                  <LoadingSpinner label="Loading community reports…" />
                ) : communityReports.length === 0 ? (
                  <EmptyState
                    icon={MessageSquare}
                    title="No community reports yet"
                    subtitle="Be the first to submit a flagged address"
                  />
                ) : (
                  <div className="grid gap-3">
                    <AnimatePresence>
                      {communityReports.map((r, i) => (
                        <CommunityCard key={r.id} report={r} index={i} />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
