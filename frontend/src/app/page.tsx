"use client";
import { useState } from "react";
import Graph from "./components/Graph";
import { ShieldAlert, Search, Share2, Activity, CheckCircle } from "lucide-react";

export default function Home() {
  const [address, setAddress] = useState("");
  const [target, setTarget] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAnalyze = () => {
    if (!address) return;
    setLoading(true);
    // Simulate a brief scan effect
    setTimeout(() => {
      setTarget(address);
      setLoading(false);
    }, 1500);
  };

  return (
    <main className="flex flex-col items-center min-h-screen bg-black text-white p-10 font-sans selection:bg-blue-500/30">
      
      {/* HEADER */}
      <div className="text-center mb-12">
        <h1 className="text-6xl font-extrabold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-purple-500 to-white mb-4 animate-in fade-in slide-in-from-top-4 duration-700">
          TraceZero
        </h1>
        <p className="text-gray-400 text-lg flex items-center justify-center gap-2">
          <Activity size={18} className="text-blue-500" />
          Graph-Based Scam Detection & Fund Tracking
        </p>
      </div>

      {/* INPUT SECTION */}
      <div className="flex gap-3 mb-10 w-full max-w-2xl relative z-10">
        <div className="relative flex-grow">
          <Search className="absolute left-4 top-4 text-gray-500" size={20} />
          <input
            type="text"
            placeholder="Enter Suspicious Wallet Address (0x...)"
            className="w-full pl-12 p-4 rounded-xl bg-gray-900 border border-gray-700 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-lg placeholder:text-gray-600"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
          />
        </div>
        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900/50 disabled:cursor-not-allowed px-8 py-4 rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20 flex items-center gap-2 whitespace-nowrap"
        >
          {loading ? (
            <span className="animate-pulse">Scanning...</span>
          ) : (
            "Analyze Network"
          )}
        </button>
      </div>

      {/* RESULTS SECTION */}
      {target && !loading && (
        <div className="w-full max-w-5xl animate-in fade-in slide-in-from-bottom-8 duration-700">
          
          {/* Dashboard Header */}
          <div className="flex justify-between items-end mb-4 px-2">
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                Transaction Graph
                <span className="text-xs font-mono bg-red-500/10 text-red-400 px-2 py-1 rounded border border-red-500/20 flex items-center gap-1">
                  <ShieldAlert size={12} />
                  THREAT DETECTED
                </span>
              </h2>
            </div>
            
            {/* 🛑 MIDNIGHT BUTTON (Ready for Phase 5) */}
            <button className="group flex items-center gap-2 text-sm bg-gray-900 hover:bg-gray-800 border border-gray-700 hover:border-blue-500/50 px-4 py-2 rounded-lg transition-all text-gray-300 hover:text-white">
              <Share2 size={16} className="group-hover:text-blue-400 transition-colors" />
              Verify on Midnight
            </button>
          </div>
          
          {/* The Graph Visualizer */}
          <Graph address={target} />
          
          {/* Analysis & Stats Panel */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            
            {/* Risk Score Card */}
            <div className="p-6 bg-gray-900/50 rounded-xl border border-red-500/30 backdrop-blur-sm">
              <div className="flex items-center gap-3 mb-2">
                <ShieldAlert className="text-red-500" size={24} />
                <h3 className="text-red-400 font-bold text-lg">High Risk</h3>
              </div>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
                Anomaly Score
              </p>
              <p className="text-5xl font-mono mt-2 font-bold text-white tracking-tighter">
                85<span className="text-xl text-gray-600">/100</span>
              </p>
            </div>

            {/* AI Analysis Card */}
            <div className="p-6 bg-gray-900/50 rounded-xl border border-gray-800 col-span-2 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="text-blue-500" size={20} />
                <h3 className="text-gray-200 font-bold text-lg">AI Pattern Analysis</h3>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">
                Wallet <span className="text-blue-400 font-mono bg-blue-400/10 px-1 rounded">{target.slice(0, 8)}...</span> exhibits 
                suspicious "burst" behavior. <strong className="text-white">82%</strong> of incoming funds were dispersed to fresh wallets 
                within 10 minutes. This topology matches known <span className="text-white border-b border-red-500/50">Mixer / Laundering</span> profiles.
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}