"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useWallet, formatAddress } from "@/lib/wallet";
import { useSession } from "@/lib/session";
import { Loader2, LayoutDashboard } from "lucide-react";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const { isAuthenticated, user } = useSession();
  const { address, isConnected, isConnecting, connect, disconnect } =
    useWallet();

  const isProfileConnected = isAuthenticated || isConnected;

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleConnect = async () => {
    try {
      await connect();
    } catch {
      // Error handled in context
    }
  };

  return (
    <nav
      className="font-array sticky top-0 z-50 w-full px-6 py-3 text-lg transition-all duration-500"
      style={{
        backgroundColor: scrolled
          ? "rgba(0, 0, 0, 0.95)"
          : "rgba(0, 0, 0, 0.3)",
        backdropFilter: `blur(${scrolled ? 24 : 16}px) saturate(180%)`,
        WebkitBackdropFilter: `blur(${scrolled ? 24 : 16}px) saturate(180%)`,
      }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6">
        <div className="hidden min-w-0 flex-1 items-center gap-10 lg:flex">
          <Link
            href="/"
            className="tracking-tight transition-all hover:opacity-50"
            style={{ color: "#E5E7EB" }}
          >
            Home
          </Link>
          <Link
            href="/team"
            className="tracking-tight transition-all hover:opacity-50"
            style={{ color: "#E5E7EB" }}
          >
            Team
          </Link>
        </div>

        <Link
          href="/"
          className="font-quicktext flex items-center justify-center px-2 py-1 text-[1.5rem] leading-none"
          style={{ color: "#E5E7EB" }}
          aria-label="Kryptos home"
        >
          Kryptos
        </Link>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-5 lg:gap-8">
          <Link
            href="/pricing"
            className="tracking-tight transition-all hover:opacity-50"
            style={{ color: "#E5E7EB" }}
          >
            Pricing
          </Link>
          <Link
            href="/docs"
            className="tracking-tight transition-all hover:opacity-50"
            style={{ color: "#E5E7EB" }}
          >
            Docs
          </Link>

          {isConnected || isProfileConnected ? (
            <Link
              href="/dashboard"
              className="flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10 transition-all"
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Link>
          ) : (
            <Link
              href="/auth"
              className="rounded-full px-5 py-2 text-sm tracking-tight transition-all duration-300 hover:opacity-80"
              style={{
                backgroundColor: "#E5E7EB",
                color: "#000000",
                border: "1px solid #333333",
              }}
            >
              Get Started
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
