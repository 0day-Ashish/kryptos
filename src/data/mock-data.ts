import { Wallet, Transaction, Counterparty, GlobeData, RiskFlag, WalletSummary } from "@/types"

export const MOCK_WALLETS: Wallet[] = [
  {
    id: "1",
    address: "0x742d35Cc6634C0532925a3b844Bc9e7595f2a3b1",
    ensName: "vitalik.eth",
    network: "ETH",
    balance: 124.56,
    balanceUsd: 312456.78,
    riskScore: 12,
    riskLabel: "LOW",
    label: "Core Dev",
    firstSeen: 1609459200000,
    lastSeen: Date.now(),
  },
  {
    id: "2",
    address: "0x8ba1f109551bD432803012645Hac136E76b5b3d",
    network: "ETH",
    balance: 45.23,
    balanceUsd: 89234.56,
    riskScore: 45,
    riskLabel: "MEDIUM",
    label: "DeFi Protocol",
    firstSeen: 1627785600000,
    lastSeen: Date.now() - 86400000,
  },
  {
    id: "3",
    address: "0x1Cb123F20A07F5E95F76F2F0bBf77aC4F0D32a2",
    network: "BTC",
    balance: 2.45,
    balanceUsd: 156789.12,
    riskScore: 78,
    riskLabel: "HIGH",
    label: "Exchange",
    firstSeen: 1593561600000,
    lastSeen: Date.now() - 172800000,
  },
  {
    id: "4",
    address: "0x3A5d6D8f3E4a2bF9C7d8E9F0a1B2C3D4E5F6a7b",
    network: "ETH",
    balance: 0.89,
    balanceUsd: 1765.43,
    riskScore: 92,
    riskLabel: "CRITICAL",
    label: "Sanctioned",
    firstSeen: 1577836800000,
    lastSeen: Date.now() - 259200000,
  },
  {
    id: "5",
    address: "0x7f9b4C5D6E8F1a2B3c4D5e6F7a8b9C0d1E2f3A4B",
    network: "SOL",
    balance: 523.67,
    balanceUsd: 45678.90,
    riskScore: 23,
    riskLabel: "LOW",
    label: "Bridge",
    firstSeen: 1630454400000,
    lastSeen: Date.now() - 43200000,
  },
]

export function generateMockTransactions(page: number, limit: number): { data: Transaction[]; pagination: { page: number; limit: number; total: number; totalPages: number } } {
  const statuses: ("success" | "failed")[] = ["success", "success", "success", "success", "failed"]
  const tokens = ["ETH", "USDC", "USDT", "WBTC", "DAI"]
  const networks: ("ETH" | "BTC" | "SOL")[] = ["ETH", "ETH", "ETH", "BTC", "SOL"]

  const allTransactions: Transaction[] = Array.from({ length: 87 }, (_, i) => ({
    id: `tx-${i + 1}`,
    hash: `0x${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`,
    timestamp: Date.now() - i * 3600000 * Math.random() * 24,
    from: `0x${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`,
    to: `0x${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`,
    value: Math.random() * 100,
    valueUsd: Math.random() * 50000,
    token: tokens[Math.floor(Math.random() * tokens.length)],
    status: statuses[Math.floor(Math.random() * statuses.length)],
    gasUsed: Math.floor(Math.random() * 21000) + 21000,
    network: networks[Math.floor(Math.random() * networks.length)],
  }))

  allTransactions.sort((a, b) => b.timestamp - a.timestamp)

  const start = (page - 1) * limit
  const end = start + limit
  const paginatedData = allTransactions.slice(start, end)

  return {
    data: paginatedData,
    pagination: {
      page,
      limit,
      total: allTransactions.length,
      totalPages: Math.ceil(allTransactions.length / limit),
    },
  }
}

export const MOCK_COUNTERPARTIES: Counterparty[] = [
  { address: "0x742d35Cc6634C0532925a3b844Bc9e7595f2a3b1", transactionCount: 156, totalValue: 2345678, riskLabel: "LOW", riskScore: 12 },
  { address: "0x8ba1f109551bD432803012645Hac136E76b5b3d", transactionCount: 89, totalValue: 1234567, riskLabel: "MEDIUM", riskScore: 45 },
  { address: "0x1Cb123F20A07F5E95F76F2F0bBf77aC4F0D32a2", transactionCount: 67, totalValue: 890123, riskLabel: "HIGH", riskScore: 78 },
  { address: "0x3A5d6D8f3E4a2bF9C7d8E9F0a1B2C3D4E5F6a7b", transactionCount: 45, totalValue: 567890, riskLabel: "CRITICAL", riskScore: 92 },
  { address: "0x7f9b4C5D6E8F1a2B3c4D5e6F7a8b9C0d1E2f3A4B", transactionCount: 34, totalValue: 345678, riskLabel: "LOW", riskScore: 23 },
  { address: "0x9abc1234def5678901234567890abcdef123456", transactionCount: 28, totalValue: 234567, riskLabel: "MEDIUM", riskScore: 56 },
  { address: "0xdef1234567890abcdef1234567890abcdef12", transactionCount: 21, totalValue: 189234, riskLabel: "LOW", riskScore: 18 },
  { address: "0x567890abcdef1234567890abcdef123456789", transactionCount: 19, totalValue: 156789, riskLabel: "HIGH", riskScore: 82 },
]

export const MOCK_GLOBE_DATA: GlobeData[] = [
  { from: { lat: 40.7128, lng: -74.006, country: "USA" }, to: { lat: 51.5074, lng: -0.1278, country: "UK" }, value: 45 },
  { from: { lat: 1.3521, lng: 103.8198, country: "Singapore" }, to: { lat: 25.2048, lng: 55.2708, country: "Dubai" }, value: 32 },
  { from: { lat: 19.076, lng: 72.8777, country: "India" }, to: { lat: 19.4326, lng: -81.2149, country: "Cayman Islands" }, value: 28 },
  { from: { lat: 35.6762, lng: 139.6503, country: "Japan" }, to: { lat: 37.7749, lng: -122.4194, country: "USA" }, value: 24 },
  { from: { lat: 52.52, lng: 13.405, country: "Germany" }, to: { lat: 48.8566, lng: 2.3522, country: "France" }, value: 21 },
  { from: { lat: 55.7558, lng: 37.6173, country: "Russia" }, to: { lat: 39.9042, lng: 116.4074, country: "China" }, value: 18 },
  { from: { lat: -33.8688, lng: 151.2093, country: "Australia" }, to: { lat: 36.7783, lng: -119.4179, country: "USA" }, value: 15 },
  { from: { lat: 19.4326, lng: -99.1332, country: "Mexico" }, to: { lat: 25.2048, lng: 55.2708, country: "Dubai" }, value: 12 },
]

export const MOCK_RISK_FLAGS: RiskFlag[] = [
  { id: "1", type: "OFAC", severity: "critical", description: "Wallet associated with OFAC sanctioned entity" },
  { id: "2", type: "Rapid Fire Transactions", severity: "high", description: "High frequency of transactions detected in short timeframe" },
  { id: "3", type: "Sanctioned Counterparty", severity: "critical", description: "Direct interaction with sanctioned wallet address" },
  { id: "4", type: "High Risk Destination", severity: "high", description: "Frequent transfers to known high-risk jurisdictions" },
  { id: "5", type: "Mixer Usage", severity: "medium", description: "History of using cryptocurrency mixers" },
]

export const MOCK_WALLET_SUMMARY: WalletSummary = {
  address: "0x742d35Cc6634C0532925a3b844Bc9e7595f2a3b1",
  ensName: "vitalik.eth",
  balance: 124.56,
  balanceUsd: 312456.78,
  riskScore: 12,
  riskLabel: "LOW",
  flags: MOCK_RISK_FLAGS.slice(0, 2),
  tags: ["Core Dev", "Ethereum Foundation", "Early Adopter"],
}

export const METRICS_DATA = {
  totalScans: { value: 12847, change: 12.5 },
  riskAlerts: { value: 342, change: -8.2 },
  safeWallets: { value: 8945, change: 15.3 },
  avgRiskScore: { value: 34, change: -5.1 },
}

export const SPARKLINE_DATA = {
  totalScans: [45, 52, 48, 61, 55, 67, 72, 68, 75, 82, 78, 85],
  riskAlerts: [28, 32, 25, 30, 35, 28, 22, 26, 24, 20, 18, 15],
  safeWallets: [120, 135, 142, 158, 165, 172, 185, 190, 205, 215, 220, 228],
  avgRiskScore: [42, 40, 38, 41, 39, 36, 35, 34, 33, 35, 34, 32],
}

export const TRANSACTION_VOLUME_DATA = {
  labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  values: [2.4, 3.1, 2.8, 4.2, 3.9, 5.1, 4.8, 6.2, 5.5, 7.1, 6.8, 8.2],
}
