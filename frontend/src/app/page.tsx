"use client";

import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Developers from '@/components/Developers';
import HeroAnimation from '@/components/HeroAnimation';
import Workflow from '@/components/Workflow';
import SupportedChains from '@/components/SupportedChains';

export default function Home() {
  return (
    <main className="min-h-screen text-white overflow-hidden relative font-[family-name:var(--font-nuqun)]">
      {/* Navbar */}
      <Navbar />

      {/* Hero Section */}
      <section className="h-screen flex items-center px-8 md:px-24 pt-20 relative">
        <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-[1.7fr_0.8fr] gap-12 items-center">
          {/* Text Content */}
          <div className="z-10">
            <h1 className="text-6xl md:text-8xl font-medium mb-2 leading-[0.9]">
              ML X Web3
            </h1>
            <h2 className="text-6xl md:text-7xl font-[family-name:var(--font-caveat)] text-zinc-400 mb-12 -rotate-2 transform origin-left">
              is that wallet safe to interact with?
            </h2>

            <p className="max-w-2xl text-lg md:text-xl text-zinc-300 font-light mb-12 leading-relaxed font-[family-name:var(--font-spacemono)]">
              Kryptos scans any wallet across 14 EVM chains and returns an AI-powered risk
  score in seconds. Detect scammers, mixer users, and suspicious patterns —
  before you send a single transaction.
            </p>

            <Link
              href="/analyze"
              className="group inline-flex items-center gap-4 bg-white text-black px-8 py-4 rounded-full font-bold hover:bg-zinc-200 transition-all font-[family-name:var(--font-spacemono)]"
            >
              analyze now
              <span className="bg-black text-white rounded-full p-1 group-hover:rotate-45 transition-transform">
                <ArrowRight size={16} />
              </span>
            </Link>
          </div>

          {/* Animation Content */}
          <div className="hidden lg:block w-full h-[600px] relative">
            <HeroAnimation />
          </div>
        </div>
      </section>

      {/* Supported Chains */}
      <SupportedChains />

      {/* Workflow Section */}
      <Workflow />

      {/* Developers Section */}
      <Developers />

    </main >
  );
}