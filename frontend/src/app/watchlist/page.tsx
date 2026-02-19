"use client";

import Navbar from "@/components/Navbar";
import { Radar } from "lucide-react";

export default function Watchlist() {
  return (
    <main className="min-h-screen text-white overflow-hidden relative font-[family-name:var(--font-nuqun)]">
      <Navbar />
      <section className="min-h-screen flex flex-col items-center justify-center px-8 md:px-24">
        <div className="bg-white/5 p-6 rounded-full mb-8">
          <Radar className="w-12 h-12 text-[#4ADE80]" />
        </div>
        <h1 className="text-5xl md:text-7xl font-medium tracking-wider mb-4 text-center">
          Wallet Watchlist
        </h1>
        <p className="text-xl text-zinc-400 font-[family-name:var(--font-spacemono)] mb-8 text-center max-w-xl">
          Monitor wallets in real-time and get alerts on suspicious activity.
        </p>
        <div className="bg-white/5 border border-white/10 rounded-2xl px-8 py-4">
          <p className="text-2xl text-zinc-300 font-[family-name:var(--font-spacemono)]">
            Coming Soon
          </p>
        </div>
      </section>
    </main>
  );
}
