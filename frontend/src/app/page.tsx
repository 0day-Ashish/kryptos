"use client";

import { useState } from 'react';
import { ArrowRight, ArrowUpRight, LogOut, Wallet } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Developers from '@/components/Developers';
import HeroAnimation from '@/components/HeroAnimation';
import Workflow from '@/components/Workflow';
import FAQ from '@/components/FAQ';
import SupportedChains from '@/components/SupportedChains';
import { useAuth } from '@/context/AuthContext';

export default function Home() {
  const { address, isAuthenticated, isConnecting, error: authError, signIn, signOut } = useAuth();
  const [showWalletPicker, setShowWalletPicker] = useState(false);

  const handleConnect = async (providerKey?: string) => {
    setShowWalletPicker(false);
    await signIn(providerKey);
  };

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

            {isAuthenticated && address ? (
              <div className="inline-flex items-center gap-4">
                <div className="inline-flex items-center gap-3 bg-white/5 border border-[#4ADE80]/30 px-6 py-4 rounded-full font-[family-name:var(--font-spacemono)]">
                  <Wallet className="w-5 h-5 text-[#4ADE80]" />
                  <span className="text-[#4ADE80] font-bold">{address.slice(0, 6)}...{address.slice(-4)}</span>
                </div>
                <button
                  onClick={signOut}
                  className="flex items-center gap-2 px-5 py-4 bg-white/5 border border-white/10 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-all font-[family-name:var(--font-spacemono)] text-sm"
                >
                  <LogOut className="w-4 h-4" />
                  Disconnect
                </button>
              </div>
            ) : (
              <div className="relative inline-block">
                <button
                  onClick={() => setShowWalletPicker(!showWalletPicker)}
                  disabled={isConnecting}
                  className="group inline-flex items-center gap-4 bg-white text-black px-8 py-4 rounded-full font-bold hover:bg-zinc-200 transition-all font-[family-name:var(--font-spacemono)] disabled:opacity-60"
                >
                  {isConnecting ? (
                    <>
                      <span className="animate-pulse">_connecting..._</span>
                    </>
                  ) : (
                    <>
                      _connect wallet_
                      <span className="bg-black text-white rounded-full p-1 group-hover:rotate-45 transition-transform">
                        <ArrowRight size={16} />
                      </span>
                    </>
                  )}
                </button>

                {/* Wallet picker dropdown */}
                {showWalletPicker && !isConnecting && (
                  <div className="absolute top-full mt-3 left-0 w-72 bg-zinc-900 border border-white/10 rounded-2xl p-3 z-50 shadow-2xl">
                    <button
                      onClick={() => handleConnect("metamask")}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-[#F6851B]/10 flex items-center justify-center">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                          <path d="M21.3 2L13.1 8.2L14.6 4.5L21.3 2Z" fill="#E2761B" stroke="#E2761B" strokeWidth="0.1" />
                          <path d="M2.7 2L10.8 8.3L9.4 4.5L2.7 2Z" fill="#E4761B" stroke="#E4761B" strokeWidth="0.1" />
                        </svg>
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium font-[family-name:var(--font-spacemono)]">MetaMask</p>
                      </div>
                    </button>
                    <button
                      onClick={() => handleConnect("coinbase")}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-[#0052FF]/10 flex items-center justify-center">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                          <rect x="3" y="3" width="18" height="18" rx="9" fill="#0052FF" />
                          <rect x="8" y="8" width="8" height="8" rx="2" fill="white" />
                        </svg>
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium font-[family-name:var(--font-spacemono)]">Coinbase Wallet</p>
                      </div>
                    </button>
                    <button
                      onClick={() => handleConnect()}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                        <Wallet className="w-4 h-4 text-zinc-400" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium font-[family-name:var(--font-spacemono)]">Browser Wallet</p>
                      </div>
                    </button>
                  </div>
                )}

                {authError && (
                  <p className="text-red-400 text-xs font-[family-name:var(--font-spacemono)] mt-3">{authError}</p>
                )}
              </div>
            )}
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

      {/* FAQ Section */}
      <FAQ />

      {/* Developers Section */}
      <Developers />

    </main >
  );
}