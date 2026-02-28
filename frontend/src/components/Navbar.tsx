"use client";

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const services = [
  { title: "Wallet Analyzer", href: "/analyze" },
  { title: "Token Risk Scanner", href: "/token-scan" },
  { title: "Contract Auditor", href: "/contract-audit" },
  { title: "Wallet Watchlist", href: "/watchlist" },
  { title: "Bulk Screening", href: "/bulk" },
];

const navLinks = [
  { label: "HOME", href: "/" },
  { label: "ANALYZE", href: "/analyze" },
  { label: "DOCS", href: "/docs" },
];

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isServicesHovered, setIsServicesHovered] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { address, isAuthenticated, signIn, signOut, isConnecting } = useAuth();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change (link click)
  const closeMobile = () => setMobileOpen(false);

  return (
    <>
      <nav className={`fixed z-50 flex justify-between items-center transition-all duration-500 ${isScrolled ? 'top-4 left-6 right-6 px-8 py-4 bg-white/[0.03] backdrop-blur-2xl border border-white/[0.06] rounded-2xl shadow-[0_4px_30px_rgba(0,0,0,0.3)]' : 'top-0 left-0 right-0 p-8 bg-transparent'}`}>

        {/* Logo */}
        <div className="text-4xl font-bold tracking-wider font-[family-name:var(--font-nuqun)]">KRYPTOS</div>

        {/* Desktop Nav Links */}
        <div className="hidden md:flex gap-12 items-center text-sm tracking-widest font-[family-name:var(--font-spacemono)] relative">
          <Link href="/" className="hover:opacity-70 transition-opacity">HOME</Link>

          <div
            className="relative"
            onMouseEnter={() => setIsServicesHovered(true)}
            onMouseLeave={() => setIsServicesHovered(false)}
          >
            <span className="hover:opacity-70 transition-opacity cursor-pointer tracking-wider">SERVICES</span>
          </div>

          <Link href="/analyze" className="hover:opacity-70 transition-opacity">ANALYZE</Link>
          <Link href="/docs" className="hover:opacity-70 transition-opacity">[ DOCS ]</Link>
        </div>

        {/* Desktop Auth */}
        <div className="hidden md:flex items-center gap-4">
          {isAuthenticated && address ? (
            <>
              <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-[#4ADE80]/30 rounded-full text-sm font-[family-name:var(--font-spacemono)]">
                <Wallet className="w-3.5 h-3.5 text-[#4ADE80]" />
                <span className="text-[#4ADE80]">{address.slice(0, 6)}...{address.slice(-4)}</span>
              </div>
              <button onClick={signOut} className="p-2 hover:bg-white/10 rounded-full transition-colors" title="Disconnect">
                <LogOut className="w-4 h-4 text-zinc-400 hover:text-white" />
              </button>
            </>
          ) : (
            <button
              onClick={() => signIn()}
              disabled={isConnecting}
              className="text-sm tracking-widest hover:opacity-70 transition-opacity font-[family-name:var(--font-spacemono)] disabled:opacity-50"
            >
              {isConnecting ? "CONNECTING..." : "CONNECT"}
            </button>
          )}
        </div>

        {/* Mobile Hamburger */}
        <button
          className="md:hidden p-2 rounded-xl hover:bg-white/10 transition-colors"
          onClick={() => setMobileOpen(prev => !prev)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="w-6 h-6 text-white" /> : <Menu className="w-6 h-6 text-white" />}
        </button>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="fixed top-0 left-0 right-0 bottom-0 z-40 bg-black/95 backdrop-blur-xl flex flex-col pt-28 px-8 pb-12 md:hidden"
          >
            {/* Nav links */}
            <div className="flex flex-col gap-6 font-[family-name:var(--font-spacemono)] text-lg tracking-widest mb-10">
              {navLinks.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={closeMobile}
                  className="text-zinc-300 hover:text-white transition-colors border-b border-white/5 pb-4"
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Services section */}
            <p className="text-xs text-zinc-500 tracking-[0.2em] font-[family-name:var(--font-spacemono)] mb-4">SERVICES</p>
            <div className="flex flex-col gap-4 mb-10">
              {services.map(service => (
                <Link
                  key={service.href}
                  href={service.href}
                  onClick={closeMobile}
                  className="group flex items-center justify-between text-zinc-400 hover:text-white transition-colors border-b border-white/5 pb-4"
                >
                  <span className="font-[family-name:var(--font-nuqun)] text-xl">{service.title}</span>
                  <span className="text-[#4ADE80] opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                </Link>
              ))}
            </div>

            {/* Auth */}
            <div className="mt-auto">
              {isAuthenticated && address ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-[#4ADE80]/30 rounded-full text-sm font-[family-name:var(--font-spacemono)]">
                    <Wallet className="w-3.5 h-3.5 text-[#4ADE80]" />
                    <span className="text-[#4ADE80]">{address.slice(0, 6)}...{address.slice(-4)}</span>
                  </div>
                  <button onClick={() => { signOut(); closeMobile(); }} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <LogOut className="w-5 h-5 text-zinc-400" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { signIn(); closeMobile(); }}
                  disabled={isConnecting}
                  className="w-full py-4 border border-white/10 rounded-xl text-sm tracking-widest font-[family-name:var(--font-spacemono)] hover:bg-white/5 transition-colors disabled:opacity-50"
                >
                  {isConnecting ? "CONNECTING..." : "CONNECT WALLET"}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop Services Mega Menu */}
      <AnimatePresence>
        {isServicesHovered && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="fixed top-0 left-0 w-full bg-black/95 backdrop-blur-xl z-40 border-b border-white/10 flex items-center justify-center pt-28 pb-12"
            onMouseEnter={() => setIsServicesHovered(true)}
            onMouseLeave={() => setIsServicesHovered(false)}
          >
            <div className="max-w-7xl mx-auto w-full px-8 md:px-24">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
                {services.map((service, index) => (
                  <Link
                    key={index}
                    href={service.href}
                    className="group block"
                    onClick={() => setIsServicesHovered(false)}
                  >
                    <h3 className="text-3xl font-[family-name:var(--font-nuqun)] text-zinc-400 group-hover:text-white group-hover:translate-x-4 transition-all duration-300">
                      {service.title}
                    </h3>
                    <div className="h-[1px] w-0 group-hover:w-full bg-[#4ADE80] mt-2 transition-all duration-500 ease-out" />
                  </Link>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
