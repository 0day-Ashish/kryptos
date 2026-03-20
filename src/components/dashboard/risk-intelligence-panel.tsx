"use client"

import { motion } from "framer-motion"
import { AlertTriangle, Shield, ExternalLink, Copy, FileText, Download, Zap, Activity, GitBranch, Globe } from "lucide-react"
import { cn } from "@/lib/utils"
import type { WalletAnalysis } from "@/types"

interface RiskIntelligencePanelProps {
  analysis?: WalletAnalysis
}

export default function RiskIntelligencePanel({ analysis }: RiskIntelligencePanelProps) {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const hasAnalysis = !!analysis

  const flags = analysis?.flags?.map((f, i) => ({
    id: String(i),
    type: f.includes("OFAC") ? "OFAC" : f.includes("mixer") ? "Mixer Usage" : "Risk Flag",
    severity: f.includes("sanction") || f.includes("Critical") ? "critical" as const : 
              f.includes("High") ? "high" as const : "medium" as const,
    description: f,
  })) || []

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-[#FF3B3B]/10 border-[#FF3B3B]/30 text-[#FF3B3B]"
      case "high":
        return "bg-[#FFB800]/10 border-[#FFB800]/30 text-[#FFB800]"
      case "medium":
        return "bg-[#FFB800]/5 border-[#FFB800]/20 text-[#FFB800]"
      default:
        return "bg-white/5 border-white/20 text-gray-500"
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-[#1A1A1A] bg-[#0A0A0A]"
    >
      <div className="flex items-center justify-between border-b border-[#1A1A1A] p-4">
        <div>
          <h3 className="text-sm font-medium text-gray-400">Risk Intelligence Report</h3>
          <p className="mt-0.5 text-xs text-gray-600">
            {analysis ? `Analysis for ${analysis.address}` : "MCP scan report for selected wallet"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 rounded-lg border border-[#1A1A1A] px-3 py-1.5 text-xs text-gray-400 hover:bg-white/10 hover:text-white">
            <FileText className="h-3.5 w-3.5" />
            Export Report
          </button>
          <button className="flex items-center gap-1.5 rounded-lg border border-[#1A1A1A] px-3 py-1.5 text-xs text-gray-400 hover:bg-white/10 hover:text-white">
            <Download className="h-3.5 w-3.5" />
            PDF
          </button>
        </div>
      </div>

      <div className="p-4">
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h4 className="mb-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Risk Factors</h4>
            <div className="space-y-2">
              {flags.slice(0, 4).map((flag) => (
                <div
                  key={flag.id}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3",
                    getSeverityColor(flag.severity)
                  )}
                >
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{flag.type}</p>
                    <p className="text-xs opacity-80">{flag.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="mb-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Advanced Analysis</h4>
            <div className="grid gap-3">
              <div className="flex items-center justify-between rounded-lg bg-[#111111] p-3">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-[#00BFFF]" />
                  <span className="text-sm text-gray-400">ML Score</span>
                </div>
                <span className="font-mono text-sm text-white">
                  {analysis?.ml_raw_score?.toFixed(1) || "0.0"}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-[#111111] p-3">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-[#9B59B6]" />
                  <span className="text-sm text-gray-400">Temporal Risk</span>
                </div>
                <span className="font-mono text-sm text-white">
                  {analysis?.temporal?.temporal_risk_score?.toFixed(0) || "0"}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-[#111111] p-3">
                <div className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-[#FF9800]" />
                  <span className="text-sm text-gray-400">GNN Score</span>
                </div>
                <span className="font-mono text-sm text-white">
                  {analysis?.gnn?.gnn_score?.toFixed(0) || "0"}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-[#111111] p-3">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-[#E91E63]" />
                  <span className="text-sm text-gray-400">MEV Risk</span>
                </div>
                <span className="font-mono text-sm text-white">
                  {analysis?.mev?.mev_risk_score?.toFixed(0) || "0"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {analysis && (
          <div className="mt-6 border-t border-[#1A1A1A] pt-4">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Address: {analysis.address}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyToClipboard(analysis.address)}
                  className="flex items-center gap-1 hover:text-white"
                >
                  <Copy className="h-3 w-3" />
                  Copy
                </button>
                <a
                  href={`${analysis.chain?.explorer}/address/${analysis.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-white"
                >
                  <ExternalLink className="h-3 w-3" />
                  Explorer
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}
