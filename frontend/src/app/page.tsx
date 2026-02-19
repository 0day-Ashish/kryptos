"use client";

import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Developers from '@/components/Developers';

export default function Home() {
  return (
    <main className="min-h-screen text-white overflow-hidden relative font-[family-name:var(--font-nuqun)]">
      {/* Navbar */}
      {/* Navbar */}
      <Navbar />

      {/* Hero Section */}
      <section className="h-screen flex flex-col justify-center px-8 md:px-24 pt-20 relative">
        <div className="max-w-7xl mx-auto w-full">
          <h1 className="text-6xl md:text-8xl font-medium mb-2 leading-[0.9]">
            Live Production Leaders
          </h1>
          <h2 className="text-6xl md:text-8xl font-[family-name:var(--font-caveat)] text-zinc-400 mb-12 -rotate-2 transform origin-left">
            setting global standards
          </h2>

          <p className="max-w-2xl text-lg md:text-xl text-zinc-300 font-light mb-12 leading-relaxed font-[family-name:var(--font-spacemono)]">
            With over 30 years of experience, we bring ideas to life in ways that inspire and connect. Our team is perfectly positioned to deliver productions of any scale, in any venue, at any time.
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
      </section>

      {/* Developers Section */}
      <Developers />

      
    </main>
  );
}