export interface ChainInfo {
  id: number;
  name: string;
  short: string;
  explorer: string;
  native: string;
}

export interface SanctionsResult {
  is_sanctioned: boolean;
  is_mixer: boolean;
  risk_modifier: number;
  sanctions_list?: string;
  mixer_type?: string;
}

export interface CounterpartyInfo {
  address: string;
  label: string | null;
  category: string | null;
  total_value: number;
  tx_count: number;
  sent: number;
  received: number;
}

export interface TimelineEntry {
  date: string;
  timestamp?: number;
  tx_count: number;
  volume: number;
  in_count: number;
  out_count: number;
}

export interface GraphNode {
  id: string;
  group: string;
  val: number;
  label: string | null;
}

export interface GraphLink {
  source: string;
  target: string;
  value: number;
  type: string;
}

export interface FeatureSummary {
  [key: string]: number | string | boolean;
}

export interface TrainedModelResult {
  trained_scam_probability: number;
  trained_risk_score: number;
  model_type: string;
}

export interface GNNResult {
  gnn_score: number;
  embedding: number[];
  risk_factors: string[];
}

export interface TemporalResult {
  temporal_risk_score: number;
  anomaly_score: number;
  burst_pattern: boolean;
  regime_shift: boolean;
  details: string[];
}

export interface MEVResult {
  mev_risk_score: number;
  is_mev_bot: boolean;
  sandwich_count: number;
  front_run_count: number;
  arbitrage_count: number;
  details: string[];
}

export interface BridgeResult {
  bridge_risk_score: number;
  bridge_flags: string[];
  bridges_used: string[];
  cross_chain_interactions: number;
}

export interface OnChainReport {
  transaction_hash?: string;
  ipfs_cid?: string;
  ipfs_url?: string;
  block_number?: number;
  timestamp?: number;
  error?: string;
}

export interface WalletAnalysis {
  address: string;
  ens_name: string | null;
  risk_score: number;
  risk_label: string;
  ml_raw_score: number;
  heuristic_score: number;
  trained_model: TrainedModelResult | null;
  flags: string[];
  feature_summary: FeatureSummary;
  neighbors_analyzed: number;
  tx_count: number;
  internal_tx_count: number;
  token_transfers: number;
  balance: number;
  top_counterparties: CounterpartyInfo[];
  timeline: TimelineEntry[];
  mixer_interactions: string[];
  sanctions: SanctionsResult;
  counterparty_sanctions: {
    sanctioned_count: number;
    sanctioned_addresses: Array<{
      address: string;
      label: string;
      list: string;
    }>;
  };
  chain: ChainInfo;
  graph: {
    nodes: GraphNode[];
    links: GraphLink[];
  };
  gnn: GNNResult | null;
  temporal: TemporalResult | null;
  mev: MEVResult | null;
  bridges: BridgeResult | null;
  community_risk_modifier: number;
  on_chain: OnChainReport | null;
}

export interface TokenInfo {
  symbol: string;
  name: string;
  balance: string;
  value: number;
  contract_address: string;
  decimals?: number;
  price?: number;
  change_24h?: number;
}

export interface TokenPortfolio {
  address: string;
  tokens: TokenInfo[];
  total_value: number;
  token_count: number;
}

export interface CrossChainBalance {
  chain_id: number;
  chain_name: string;
  balance: string;
  tx_count: number;
}

export interface CrossChainResult {
  address: string;
  chains: CrossChainBalance[];
  total_chains: number;
}

export interface FundTraceNode {
  address: string;
  label?: string;
  value: number;
  depth: number;
  tx_hash?: string;
}

export interface FundTracePath {
  nodes: FundTraceNode[];
  total_value: number;
  hop_count: number;
}

export interface TraceResult {
  address: string;
  direction: string;
  paths: FundTracePath[];
  total_value: number;
  unique_addresses: number;
}

export interface ResolveResult {
  resolved: boolean;
  address: string | null;
  ens_name: string | null;
}

export interface SimilarWallet {
  address: string;
  label: string | null;
  similarity_score: number;
  shared_counterparties: number;
}

export interface SimilarResult {
  target: {
    address: string;
    label?: string;
  };
  similar: SimilarWallet[];
  candidates_checked: number;
}

export interface GNNAnalysis {
  address: string;
  gnn_score: number;
  embedding: number[];
  risk_factors: string[];
  details: Record<string, unknown>;
}

export interface TemporalAnalysis {
  address: string;
  temporal_risk_score: number;
  anomaly_score: number;
  burst_pattern: boolean;
  regime_shift: boolean;
  details: Record<string, unknown>;
  error?: string;
}

export interface MEVAnalysis {
  address: string;
  mev_risk_score: number;
  is_mev_bot: boolean;
  sandwich_count: number;
  front_run_count: number;
  arbitrage_count: number;
  details: Record<string, unknown>;
  error?: string;
}

export interface BridgeAnalysis {
  address: string;
  bridge_risk_score: number;
  bridge_flags: string[];
  bridges_used: string[];
  cross_chain_interactions: number;
  details: Record<string, unknown>;
  error?: string;
}

export interface CommunityReport {
  id: string;
  address: string;
  category: string;
  description: string;
  reporter_id: string;
  evidence_urls: string[];
  votes: number;
  created_at: string;
  chain_id: number;
}

export interface ReportRequest {
  address: string;
  category: string;
  description?: string;
  reporter_id?: string;
  evidence_urls?: string[];
  chain_id?: number;
}

export interface VoteRequest {
  report_id: string;
  vote: "up" | "down";
  voter_id?: string;
}

export interface CommunityReportsResult {
  reports: CommunityReport[];
  total: number;
}

export interface FlaggedAddress {
  address: string;
  report_count: number;
  categories: string[];
  avg_risk_modifier: number;
}

export interface BatchResult {
  results: Array<{
    address: string;
    risk_score: number;
    risk_label: string;
    flags: string[];
    error?: string;
  }>;
  total_analyzed: number;
  high_risk_count: number;
  medium_risk_count: number;
  low_risk_count: number;
}

export interface TokenScanResult {
  contract_address: string;
  risk_score: number;
  risk_factors: string[];
  is_honeypot: boolean;
  is_paused: boolean;
  owner_address: string;
  total_supply: string;
  holder_count: number;
  transfer_count: number;
  suspicious_patterns: string[];
  audit_flags: string[];
}

export interface ContractAuditResult {
  contract_address: string;
  audit_score: number;
  vulnerabilities: Array<{
    severity: "critical" | "high" | "medium" | "low" | "informational";
    name: string;
    description: string;
    line?: number;
  }>;
  risk_flags: string[];
  contract_verified: boolean;
  owner_controls: string[];
  proxy_implementation?: string;
}

export interface WatchlistQuickScore {
  address: string;
  risk_score: number;
  risk_label: string;
  flags: string[];
  balance: string;
  tx_count: number;
  last_activity: string;
}

export interface SharedReport {
  report_id: string;
  address: string;
  chain_id: number;
  chain_name: string;
  risk_score: number;
  risk_label: string;
  created_at: string;
  views: number;
  data: WalletAnalysis;
}

export interface SharedReportMeta {
  report_id: string;
  address: string;
  chain_name: string;
  risk_score: number;
  risk_label: string;
  created_at: string;
  views: number;
}

export interface BalanceResult {
  address: string;
  balance: number;
  native: string;
  chain: string;
}

export interface OnChainReportResult {
  address: string;
  risk_score?: number;
  ipfs_cid?: string;
  timestamp?: number;
  block_number?: number;
  transaction_hash?: string;
  error?: string;
  on_chain: boolean;
}

export interface HealthCheck {
  status: string;
  version: string;
}

export interface ChainsResponse {
  chains: ChainInfo[];
  default: number;
}

export interface BatchRequest {
  addresses: string[];
  chain_id?: number;
  quick?: boolean;
}

export interface BatchCsvRequest {
  csv_content: string;
  chain_id?: number;
  quick?: boolean;
}

export interface ShareRequest {
  data: WalletAnalysis;
}

export type RiskLabel =
  | "Low Risk"
  | "Medium Risk"
  | "High Risk"
  | "Critical Risk"
  | "Unknown"
  | "No Data";

export interface Wallet {
  id: string;
  address: string;
  ensName?: string;
  network: "ETH" | "BTC" | "SOL";
  balance: number;
  balanceUsd: number;
  riskScore: number;
  riskLabel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  label: string;
  firstSeen: number;
  lastSeen: number;
}

export interface Transaction {
  id: string;
  hash: string;
  timestamp: number;
  from: string;
  to: string;
  value: number;
  valueUsd: number;
  token: string;
  status: "success" | "failed";
  gasUsed: number;
  network: "ETH" | "BTC" | "SOL";
}

export interface Counterparty {
  address: string;
  transactionCount: number;
  totalValue: number;
  riskLabel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  riskScore: number;
}

export interface RiskFlag {
  id: string;
  type:
    | "OFAC"
    | "Rapid Fire"
    | "Sanctioned Counterparty"
    | "High Risk Destination"
    | "Mixer Usage"
    | "Rapid Fire Transactions";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
}

export interface WalletSummary {
  address: string;
  ensName?: string;
  balance: number;
  balanceUsd: number;
  riskScore: number;
  riskLabel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  flags: RiskFlag[];
  tags: string[];
}

export interface GlobeData {
  from: { lat: number; lng: number; country: string };
  to: { lat: number; lng: number; country: string };
  value: number;
}

export interface MetricData {
  label: string;
  value: number;
  change: number;
  icon: string;
  sparklineData: number[];
}

export interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function mapBackendRiskLabel(
  label: string,
): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  const lowerLabel = label.toLowerCase();
  if (lowerLabel.includes("critical") || lowerLabel.includes("high"))
    return "HIGH";
  if (lowerLabel.includes("medium") || lowerLabel.includes("medium risk"))
    return "MEDIUM";
  if (lowerLabel.includes("low") || lowerLabel.includes("safe")) return "LOW";
  if (lowerLabel.includes("no data")) return "MEDIUM";
  return "MEDIUM";
}

export function mapBackendRiskScoreToLabel(score: number): RiskLabel {
  if (score >= 70) return "Low Risk";
  if (score >= 40) return "Medium Risk";
  if (score >= 20) return "High Risk";
  if (score > 0) return "Critical Risk";
  return "Unknown";
}
