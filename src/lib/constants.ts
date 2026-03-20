export const COLORS = {
  bg: {
    primary: "#000000",
    card: "#0A0A0A",
    secondary: "#111111",
  },
  accent: {
    primary: "#00FF94",
    secondary: "#00CC76",
    glow: "#00FF94",
  },
  status: {
    positive: "#00FF94",
    warning: "#FFB800",
    danger: "#FF3B3B",
  },
  text: {
    primary: "#FFFFFF",
    secondary: "#888888",
    muted: "#555555",
  },
  border: {
    default: "#1A1A1A",
    hover: "#2A2A2A",
  },
} as const;

export const SIDEBAR_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { id: "portfolio", label: "Portfolio", icon: "Wallet" },
  { id: "wallet-scanner", label: "Wallet Scanner", icon: "Search" },
  { id: "batch-analysis", label: "Batch Analysis", icon: "Zap" },
  { id: "risk-reports", label: "Risk Reports", icon: "FileWarning" },
  { id: "pricing", label: "Pricing", icon: "CreditCard" },
  { id: "profile", label: "Profile", icon: "User" },
  { id: "settings", label: "Settings", icon: "Settings" },
] as const;

export interface ChainInfo {
  id: number;
  name: string;
  short: string;
  explorer: string;
  native: string;
  color: string;
}

export const CHAINS: ChainInfo[] = [
  {
    id: 1,
    name: "Ethereum Mainnet",
    short: "ETH",
    explorer: "https://etherscan.io",
    native: "ETH",
    color: "#627EEA",
  },
  {
    id: 8453,
    name: "Base",
    short: "BASE",
    explorer: "https://basescan.org",
    native: "ETH",
    color: "#0052FF",
  },
  {
    id: 84532,
    name: "Base Sepolia",
    short: "BASE_SEP",
    explorer: "https://sepolia.basescan.org",
    native: "ETH",
    color: "#4A5AD4",
  },
  {
    id: 137,
    name: "Polygon",
    short: "MATIC",
    explorer: "https://polygonscan.com",
    native: "MATIC",
    color: "#8247E5",
  },
  {
    id: 42161,
    name: "Arbitrum One",
    short: "ARB",
    explorer: "https://arbiscan.io",
    native: "ETH",
    color: "#28A0F0",
  },
  {
    id: 10,
    name: "Optimism",
    short: "OP",
    explorer: "https://optimistic.etherscan.io",
    native: "ETH",
    color: "#FF0420",
  },
  {
    id: 56,
    name: "BNB Smart Chain",
    short: "BSC",
    explorer: "https://bscscan.com",
    native: "BNB",
    color: "#F3BA2F",
  },
  {
    id: 43114,
    name: "Avalanche C-Chain",
    short: "AVAX",
    explorer: "https://snowtrace.io",
    native: "AVAX",
    color: "#E84142",
  },
  {
    id: 250,
    name: "Fantom",
    short: "FTM",
    explorer: "https://ftmscan.com",
    native: "FTM",
    color: "#1969FF",
  },
  {
    id: 59144,
    name: "Linea",
    short: "LINEA",
    explorer: "https://lineascan.build",
    native: "ETH",
    color: "#121212",
  },
  {
    id: 324,
    name: "zkSync Era",
    short: "ZKSYNC",
    explorer: "https://explorer.zksync.io",
    native: "ETH",
    color: "#8B5CF6",
  },
  {
    id: 5000,
    name: "Mantle",
    short: "MNT",
    explorer: "https://explorer.mantle.xyz",
    native: "MNT",
    color: "#00AAB5",
  },
  {
    id: 534352,
    name: "Scroll",
    short: "SCROLL",
    explorer: "https://scrollscan.com",
    native: "ETH",
    color: "#CDAF9F",
  },
  {
    id: 11155111,
    name: "Sepolia (Testnet)",
    short: "SEP",
    explorer: "https://sepolia.etherscan.io",
    native: "ETH",
    color: "#627EEA",
  },
];

export const CHAIN_MAP = Object.fromEntries(CHAINS.map((c) => [c.id, c]));

export const MAINNET_CHAINS = CHAINS.filter(
  (c) => c.id !== 84532 && c.id !== 11155111,
);

export const TESTNET_CHAINS = CHAINS.filter(
  (c) => c.id === 84532 || c.id === 11155111,
);

export const NETWORKS = CHAINS.map((c) => c.short);

export type Network = string;
