"use client";

import Link from 'next/link';
import { ArrowUp } from 'lucide-react';

export default function Footer() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="text-white px-6 py-12 md:px-12 md:py-16 font-sans relative overflow-hidden">
      {/* Top Header */}
      <div className="flex justify-between items-start mb-16 md:mb-24 relative z-10">
        <h2 className="text-4xl md:text-6xl lg:text-7xl tracking-wider leading-[0.9] uppercase max-w-2xl font-[family-name:var(--font-nuqun)] font-bold">
          0DAY
          <br />
          <span className='italic'>Tech</span> Community
        </h2>

        <button
          onClick={scrollToTop}
          className="group flex items-center justify-center w-12 h-12 md:w-16 md:h-16 border rounded-full hover:bg-white hover:text-black transition-all duration-300"
          aria-label="Scroll to top"
        >
          <ArrowUp className="w-6 h-6 md:w-8 md:h-8 group-hover:-translate-y-1 transition-transform" />
        </button>
      </div>

      {/* Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 relative z-10 text-sm md:text-base tracking-wide mb-8">

        {/* Address Column */}
        <div className="lg:col-span-3">
          <h3 className="font-bold text-zinc-500 uppercase tracking-widest text-lg font-[family-name:var(--font-nuqun)] mb-2">KRYPTOS</h3>
          <div className="text-zinc-300 font-medium leading-relaxed ">
            <p className="uppercase font-[family-name:var(--font-spacemono)]">Via Cimabue, 20</p>
            <p className="uppercase font-[family-name:var(--font-spacemono)]">â†³ 42014, Castellarano</p>
            <p className="uppercase font-[family-name:var(--font-spacemono)]">Reggio Emilia — Italy</p>
          </div>
        </div>

        {/* Navigation Column */}
        <div className="lg:col-span-6">
          <h3 className="font-bold text-zinc-500 uppercase tracking-widest text-xs mb-5 font-[family-name:var(--font-spacemono)]">Navigation</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-4 text-zinc-300 font-bold uppercase text-sm">
            <div className="flex flex-col gap-3 font-[family-name:var(--font-spacemono)]">
              <Link href="/" className="hover:text-white transition-colors">Home</Link>
              <Link href="#" className="hover:text-white transition-colors">Collections</Link>
              <Link href="#" className="hover:text-white transition-colors">Projects</Link>
            </div>
            <div className="flex flex-col gap-3 font-[family-name:var(--font-spacemono)]">
              <Link href="#" className="hover:text-white transition-colors">Innovations</Link>
              <Link href="#" className="hover:text-white transition-colors">Applications</Link>
              <Link href="#" className="hover:text-white transition-colors">Showroom</Link>
            </div>
            <div className="flex flex-col gap-3 font-[family-name:var(--font-spacemono)]">
              <Link href="#" className="hover:text-white transition-colors">Contact</Link>
              <Link href="#" className="hover:text-white transition-colors">News</Link>
              <Link href="#" className="hover:text-white transition-colors">FAQ</Link>
            </div>
          </div>
        </div>

        {/* Follow Column */}
        <div className="lg:col-span-3">
          <h3 className="font-bold text-zinc-500 uppercase tracking-widest text-xs mb-5 font-[family-name:var(--font-spacemono)]">Follow</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-zinc-300 font-bold uppercase text-sm font-[family-name:var(--font-spacemono)]">
            <Link href="#" className="hover:text-white transition-colors">Facebook</Link>
            <Link href="#" className="hover:text-white transition-colors">Pinterest</Link>
            <Link href="#" className="hover:text-white transition-colors">Instagram</Link>
            <Link href="#" className="hover:text-white transition-colors">Linkedin</Link>
            <Link href="#" className="hover:text-white transition-colors">Youtube</Link>
          </div>
        </div>
      </div>

      {/* Massive Brand Name */}
      <div className="relative w-full overflow-hidden select-none">
        <h1 className="text-[14.5vw] leading-[0.75] font-black tracking-wider text-start uppercase text-white font-[family-name:var(--font-nuqun)]">
          Kryptos
        </h1>
      </div>


      {/* Bottom Bar */}
      <div className="border border-zinc-800 rounded-lg px-4 py-4 md:px-6 flex flex-col md:flex-row justify-between items-center text-[10px] md:text-xs uppercase tracking-widest text-zinc-500 hover:border-zinc-700 transition-colors bg-zinc-950/50">
        <div className="mb-2 md:mb-0 text-center md:text-left flex items-center gap-2">
          <span className="font-[family-name:var(--font-nuqun)] text-lg">&copy; 2026 <span className="font-[family-name:var(--font-nuqun)] text-lg mr-5">KRYPTOS</span></span>
          <span className="hidden md:inline mx-2 text-zinc-700">|</span>
          <span>P IVA 01411010356 – CAP SOC € 27.253.397,00 I.V.</span>
        </div>
        <div className="flex gap-6 font-medium font-[family-name:var(--font-spacemono)]">
          <Link href="#" className="hover:text-white transition-colors">Legal</Link>
          <span className="text-zinc-700">–</span>
          <Link href="#" className="hover:text-white transition-colors">Privacy</Link>
          <span className="text-zinc-700">–</span>
          <Link href="#" className="hover:text-white transition-colors">Cookies</Link>
        </div>
      </div>

    </footer>
  );
}
