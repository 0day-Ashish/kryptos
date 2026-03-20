import type {
  WalletAnalysis,
  BalanceResult,
  TokenPortfolio,
  CrossChainResult,
  TraceResult,
  ResolveResult,
  ChainsResponse,
  GNNAnalysis,
  TemporalAnalysis,
  MEVAnalysis,
  BridgeAnalysis,
  SimilarResult,
  CommunityReportsResult,
  ReportRequest,
  VoteRequest,
  BatchResult,
  TokenScanResult,
  ContractAuditResult,
  WatchlistQuickScore,
  SharedReport,
  SharedReportMeta,
  OnChainReportResult,
  HealthCheck,
  ChainInfo,
  BatchRequest,
  BatchCsvRequest,
  ShareRequest,
} from "@/types"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

let authToken: string | null = null

export function setAuthToken(token: string | null) {
  authToken = token
}

export function getAuthToken(): string | null {
  return authToken
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options?.headers as Record<string, string>,
  }
  
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`
  }
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.detail || `API request failed: ${response.statusText}`)
  }
  
  return response.json()
}

export const api = {
  health: () => fetchApi<HealthCheck>("/health"),
  
  chains: () => fetchApi<ChainsResponse>("/chains"),
  
  analyze: (address: string, chainId: number = 1) =>
    fetchApi<WalletAnalysis>(`/analyze/${address}?chain_id=${chainId}`),
  
  balance: (address: string, chainId: number = 1) =>
    fetchApi<BalanceResult>(`/balance/${address}?chain_id=${chainId}`),
  
  tokens: (address: string, chainId: number = 1) =>
    fetchApi<TokenPortfolio>(`/tokens/${address}?chain_id=${chainId}`),
  
  crossChain: (address: string) =>
    fetchApi<CrossChainResult>(`/cross-chain/${address}`),
  
  trace: (address: string, chainId: number = 1, depth: number = 3, minValue: number = 0.01, direction: "in" | "out" = "out") =>
    fetchApi<TraceResult>(`/trace/${address}?chain_id=${chainId}&depth=${depth}&min_value=${minValue}&direction=${direction}`),
  
  resolve: (name: string) =>
    fetchApi<ResolveResult>(`/resolve/${name}`),
  
  sanctions: (address: string) =>
    fetchApi<{ is_sanctioned: boolean; is_mixer: boolean; risk_modifier: number; sanctions_list?: string }>(`/sanctions/${address}`),
  
  similar: (address: string, chainId: number = 1, topK: number = 5) =>
    fetchApi<SimilarResult>(`/similar/${address}?chain_id=${chainId}&top_k=${topK}`),
  
  gnn: (address: string, chainId: number = 1) =>
    fetchApi<GNNAnalysis>(`/gnn/${address}?chain_id=${chainId}`),
  
  temporal: (address: string, chainId: number = 1) =>
    fetchApi<TemporalAnalysis>(`/temporal/${address}?chain_id=${chainId}`),
  
  mev: (address: string, chainId: number = 1) =>
    fetchApi<MEVAnalysis>(`/mev/${address}?chain_id=${chainId}`),
  
  bridges: (address: string, chainId: number = 1) =>
    fetchApi<BridgeAnalysis>(`/bridges/${address}?chain_id=${chainId}`),
  
  report: (address: string) =>
    fetchApi<OnChainReportResult>(`/report/${address}`),
  
  reportPdf: (address: string, chainId: number = 1): Promise<Blob> => {
    const headers: Record<string, string> = {}
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`
    }
    return fetch(`${API_BASE_URL}/report/${address}/pdf?chain_id=${chainId}`, { headers }).then(res => {
      if (!res.ok) throw new Error("Failed to generate PDF")
      return res.blob()
    })
  },
  
  communityReport: (req: ReportRequest) =>
    fetchApi<{ success: boolean; report_id: string }>("/community/report", {
      method: "POST",
      body: JSON.stringify(req),
    }),
  
  communityReports: (address: string, limit: number = 50) =>
    fetchApi<CommunityReportsResult>(`/community/reports/${address}?limit=${limit}`),
  
  communityVote: (req: VoteRequest) =>
    fetchApi<{ success: boolean; votes: number }>("/community/vote", {
      method: "POST",
      body: JSON.stringify(req),
    }),
  
  communityRecent: (limit: number = 20) =>
    fetchApi<CommunityReportsResult>(`/community/recent?limit=${limit}`),
  
  communityFlagged: (minReports: number = 2) =>
    fetchApi<{ addresses: Array<{ address: string; report_count: number; categories: string[] }> }>(`/community/flagged?min_reports=${minReports}`),
  
  batch: (req: BatchRequest) =>
    fetchApi<BatchResult>("/batch", {
      method: "POST",
      body: JSON.stringify(req),
    }),
  
  batchCsv: (req: BatchCsvRequest) =>
    fetchApi<BatchResult>("/batch/csv", {
      method: "POST",
      body: JSON.stringify(req),
    }),
  
  tokenScan: (address: string, chainId: number = 1) =>
    fetchApi<TokenScanResult>(`/token-scan/${address}?chain_id=${chainId}`),
  
  contractAudit: (address: string, chainId: number = 1) =>
    fetchApi<ContractAuditResult>(`/contract-audit/${address}?chain_id=${chainId}`),
  
  watchlistQuickScore: (address: string, chainId: number = 1) =>
    fetchApi<WatchlistQuickScore>(`/watchlist/quick-score/${address}?chain_id=${chainId}`),
  
  createShare: (req: ShareRequest) =>
    fetchApi<{ report_id: string; url: string; address: string; risk_score: number; risk_label: string }>("/share", {
      method: "POST",
      body: JSON.stringify(req),
    }),
  
  getSharedReport: (reportId: string) =>
    fetchApi<SharedReport>(`/shared/${reportId}`),
  
  getSharedReportMeta: (reportId: string) =>
    fetchApi<SharedReportMeta>(`/shared/${reportId}/meta`),
}

export type ApiClient = typeof api
