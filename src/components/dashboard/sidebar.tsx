"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Wallet,
  Search,
  FileWarning,
  CreditCard,
  Zap,
  Settings,
  ChevronLeft,
  ChevronRight,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SIDEBAR_ITEMS } from "@/lib/constants";
import { useSession } from "@/lib/session";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Wallet,
  Search,
  FileWarning,
  CreditCard,
  Zap,
  Settings,
  User,
};

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { user, isAuthenticated } = useSession();

  const getPageId = (path: string) => {
    if (path === "/") return "dashboard";
    if (path.startsWith("/portfolio")) return "portfolio";
    if (path.startsWith("/dashboard")) return "dashboard";
    return path.slice(1) || "dashboard";
  };

  const activeItem = getPageId(pathname);

  const userTier = user?.premium_tier || "free";
  const isPro = userTier === "pro" || userTier === "enterprise";

  return (
    <motion.aside
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={cn(
        "fixed left-0 top-0 z-40 h-screen border-r border-[#1A1A1A] bg-[#000000] transition-all duration-300",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center justify-between border-b border-[#1A1A1A] px-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-white hover:text-white/90"
          >
            {collapsed ? (
              <span className="font-quicktext text-xl font-bold">K</span>
            ) : (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="font-quicktext text-lg font-bold"
              >
                KRYPTOS
              </motion.span>
            )}
          </Link>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="rounded-lg p-1.5 text-[#888888] hover:bg-[#1A1A1A] hover:text-white"
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-2">
            {SIDEBAR_ITEMS.map((item) => {
              const Icon = iconMap[item.icon];
              const isActive = activeItem === item.id;

              return (
                <li key={item.id}>
                  <Link
                    href={
                      item.id === "dashboard"
                        ? "/dashboard"
                        : item.id === "portfolio"
                          ? "/portfolio"
                          : `/${item.id}`
                    }
                    className={cn(
                      "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-white/10 text-white"
                        : "text-[#888888] hover:bg-[#1A1A1A] hover:text-white",
                    )}
                  >
                    {Icon && (
                      <span
                        className={cn(
                          "relative flex-shrink-0",
                          isActive &&
                            "drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]",
                        )}
                      >
                        <Icon
                          className={cn("h-5 w-5", isActive && "text-white")}
                        />
                        {isActive && (
                          <motion.span
                            layoutId="sidebar-glow"
                            className="absolute -inset-1 rounded-lg bg-white/20 blur-sm"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.3 }}
                          />
                        )}
                      </span>
                    )}
                    {!collapsed && (
                      <motion.span
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-[#1A1A1A] p-4">
          <div
            className={cn(
              "rounded-lg border border-[#1A1A1A] bg-[#0A0A0A] p-3",
              collapsed && "p-2",
            )}
          >
            {!collapsed && (
              <p className="text-xs font-medium text-white">
                {isPro ? "Pro Plan" : "Free Plan"}
              </p>
            )}
            {!collapsed && (
              <p className="mt-1 text-xs text-[#888888]">
                {isPro ? "Unlimited access" : "5 scans/day"}
              </p>
            )}
            {collapsed && (
              <CreditCard
                className={cn(
                  "h-5 w-5",
                  isPro ? "text-[#00FF94]" : "text-white",
                )}
              />
            )}
          </div>
        </div>
      </div>
    </motion.aside>
  );
}
