"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Copy,
  ChevronDown,
  ChevronRight,
  Shield,
  AlertTriangle,
  Globe,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/session";

interface Wallet {
  address: string;
  label: string;
  category: string;
  trust_score: number;
}

interface Country {
  code: string;
  name: string;
  lat: number;
  lng: number;
  wallets: Wallet[];
}

const COUNTRIES_DATA: Country[] = [
  {
    code: "US",
    name: "United States",
    lat: 37.0902,
    lng: -95.7129,
    wallets: [
      {
        address: "0x503828976d22510aad0201ac7ec88293211d23da",
        label: "Coinbase",
        category: "exchange",
        trust_score: 95,
      },
      {
        address: "0xeb2629a2734e272bcc07bda959863f316f4bd4cf",
        label: "Coinbase 6",
        category: "exchange",
        trust_score: 95,
      },
      {
        address: "0x2910543af39aba0cd09dbb2d50200b3e800a63d2",
        label: "Kraken",
        category: "exchange",
        trust_score: 93,
      },
      {
        address: "0x53d284357ec70ce289d6d64134dfac8e511c8a3d",
        label: "Kraken 4",
        category: "exchange",
        trust_score: 93,
      },
      {
        address: "0x1ab4973a48dc892cd9971ece8e01dcc7688f8f23",
        label: "Gemini",
        category: "exchange",
        trust_score: 92,
      },
      {
        address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        label: "USDC (Circle)",
        category: "stablecoin",
        trust_score: 97,
      },
      {
        address: "0x7a250d5630b4cf539739df2c5dacb4c659f2488d",
        label: "Uniswap V2 Router",
        category: "dex",
        trust_score: 96,
      },
      {
        address: "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45",
        label: "Uniswap V3 Router",
        category: "dex",
        trust_score: 96,
      },
      {
        address: "0xc3d688b66703497daa19211eedff47f25384cdc3",
        label: "Compound V3",
        category: "defi",
        trust_score: 94,
      },
      {
        address: "0xdef1c0ded9bec7f1a1670819833240f027b25eff",
        label: "0x Exchange Proxy",
        category: "dex",
        trust_score: 91,
      },
    ],
  },
  {
    code: "KY",
    name: "Cayman Islands (Binance)",
    lat: 19.3133,
    lng: -81.2546,
    wallets: [
      {
        address: "0x28c6c06298d514db089934071355e5743bf21d60",
        label: "Binance 14",
        category: "exchange",
        trust_score: 90,
      },
      {
        address: "0xbe0eb53f46cd790cd13851d5eff43d12404d33e8",
        label: "Binance 7",
        category: "exchange",
        trust_score: 90,
      },
      {
        address: "0xf977814e90da44bfa03b6295a0616a897441acec",
        label: "Binance 8",
        category: "exchange",
        trust_score: 90,
      },
      {
        address: "0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be",
        label: "Binance 1",
        category: "exchange",
        trust_score: 90,
      },
      {
        address: "0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503",
        label: "Binance Peg Tokens",
        category: "exchange",
        trust_score: 89,
      },
      {
        address: "0x4fabb145d64652a948d72533023f6e7a623c7c53",
        label: "BUSD (Binance USD)",
        category: "stablecoin",
        trust_score: 85,
      },
    ],
  },
  {
    code: "GB",
    name: "United Kingdom",
    lat: 55.3781,
    lng: -3.436,
    wallets: [
      {
        address: "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9",
        label: "Aave V2 Lending Pool",
        category: "defi",
        trust_score: 95,
      },
      {
        address: "0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2",
        label: "Aave V3 Pool",
        category: "defi",
        trust_score: 95,
      },
      {
        address: "0x1151314c646ce4e0efd76d1af4760ae66a9fe30f",
        label: "Bitfinex",
        category: "exchange",
        trust_score: 82,
      },
      {
        address: "0xba12222222228d8ba445958a75a0704d566bf2c8",
        label: "Balancer Vault",
        category: "defi",
        trust_score: 93,
      },
    ],
  },
  {
    code: "SG",
    name: "Singapore",
    lat: 1.3521,
    lng: 103.8198,
    wallets: [
      {
        address: "0x2b5634c42055806a59e9107ed44d43c426e58258",
        label: "KuCoin 1",
        category: "exchange",
        trust_score: 84,
      },
      {
        address: "0x689c56aef474df92d44a1b70850f808488f9769c",
        label: "KuCoin 2",
        category: "exchange",
        trust_score: 84,
      },
      {
        address: "0x1111111254eeb25477b68fb85ed929f73a960582",
        label: "1inch v5 Router",
        category: "dex",
        trust_score: 92,
      },
    ],
  },
  {
    code: "SC",
    name: "Seychelles (OKX)",
    lat: -4.6796,
    lng: 55.492,
    wallets: [
      {
        address: "0xa7efae728d2936e78bda97dc267687568dd593f3",
        label: "OKX 3",
        category: "exchange",
        trust_score: 88,
      },
      {
        address: "0x6cc5f688a315f3dc28a7781717a9a798a59fda7b",
        label: "OKX 4",
        category: "exchange",
        trust_score: 88,
      },
      {
        address: "0x236f9f97e0e62388479bf9e5ba4889e46b0273c3",
        label: "OKX 2",
        category: "exchange",
        trust_score: 88,
      },
    ],
  },
  {
    code: "AE",
    name: "United Arab Emirates",
    lat: 23.4241,
    lng: 53.8478,
    wallets: [
      {
        address: "0xdc76cd25977e0a5ae17155770273ad58648900d3",
        label: "Bybit",
        category: "exchange",
        trust_score: 86,
      },
      {
        address: "0xf89d7b9c864f589bbf53a82105107622b35eaa40",
        label: "Bybit 2",
        category: "exchange",
        trust_score: 86,
      },
      {
        address: "0x75e89d5979e4f6fba9f97c104c2f0afb3f1dcb88",
        label: "MEXC",
        category: "exchange",
        trust_score: 80,
      },
    ],
  },
  {
    code: "KR",
    name: "South Korea",
    lat: 35.9078,
    lng: 127.7669,
    wallets: [
      {
        address: "0x4b5e60cb1cd6c5e67af5b6cf3a01ad3a2a2d7d93",
        label: "Upbit Hot Wallet",
        category: "exchange",
        trust_score: 90,
      },
      {
        address: "0x5c985e89dde482efe97ea9f1950ad149eb73829b",
        label: "Bithumb Hot Wallet",
        category: "exchange",
        trust_score: 85,
      },
      {
        address: "0x3fbe1f8fc5ddb27d428aa60f661eaaab0d2000ce",
        label: "Korbit",
        category: "exchange",
        trust_score: 82,
      },
    ],
  },
  {
    code: "JP",
    name: "Japan",
    lat: 36.2048,
    lng: 138.2529,
    wallets: [
      {
        address: "0x32be343b94f860124dc4fee278fdcbd38c102d88",
        label: "bitFlyer Hot Wallet",
        category: "exchange",
        trust_score: 91,
      },
      {
        address: "0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f",
        label: "SushiSwap Router",
        category: "dex",
        trust_score: 90,
      },
      {
        address: "0x2796317b0ff8538f253012862c06787adfb8ceb6",
        label: "Synapse Bridge",
        category: "bridge",
        trust_score: 85,
      },
    ],
  },
  {
    code: "IN",
    name: "India",
    lat: 20.5937,
    lng: 78.9629,
    wallets: [
      {
        address: "0xb613e78e2068d7489bb66419fb1cfa11275d14da",
        label: "WazirX Hot Wallet",
        category: "exchange",
        trust_score: 75,
      },
      {
        address: "0x6dcb8492b5de636fd9795b2168a262f3ef68e37f",
        label: "CoinDCX",
        category: "exchange",
        trust_score: 78,
      },
      {
        address: "0x40ec5b33f54e0e8a33a975908c5ba1c14e5bbbdf",
        label: "Polygon ERC20 Bridge",
        category: "bridge",
        trust_score: 94,
      },
      {
        address: "0xa0c68c638235ee32657e8f720a23cec1bfc77c77",
        label: "Polygon Bridge",
        category: "bridge",
        trust_score: 94,
      },
    ],
  },
  {
    code: "CN",
    name: "China",
    lat: 35.8617,
    lng: 104.1954,
    wallets: [
      {
        address: "0x0d0707963952f2fba59dd06f2b425ace40b492fe",
        label: "Gate.io 1",
        category: "exchange",
        trust_score: 80,
      },
      {
        address: "0x7793cd85c11a924478d358d49b7f846492535b80",
        label: "Gate.io 2",
        category: "exchange",
        trust_score: 80,
      },
      {
        address: "0xbebc44782c7db0a1a60cb6fe97d0b483032ff1c7",
        label: "Curve 3pool",
        category: "defi",
        trust_score: 93,
      },
    ],
  },
  {
    code: "CH",
    name: "Switzerland",
    lat: 46.8182,
    lng: 8.2275,
    wallets: [
      {
        address: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
        label: "Vitalik Buterin",
        category: "notable",
        trust_score: 99,
      },
      {
        address: "0x00000000219ab540356cbb839cbe05303d7705fa",
        label: "ETH2 Deposit Contract",
        category: "protocol",
        trust_score: 99,
      },
      {
        address: "0xae7ab96520de3a18e5e111b5eaab095312d7fe84",
        label: "Lido stETH",
        category: "defi",
        trust_score: 96,
      },
      {
        address: "0xdc24316b9ae028f1497c275eb9192a3ea0f67022",
        label: "Lido stETH Curve Pool",
        category: "defi",
        trust_score: 95,
      },
    ],
  },
  {
    code: "VG",
    name: "British Virgin Islands",
    lat: 18.4207,
    lng: -64.6399,
    wallets: [
      {
        address: "0xc098b2a3aa256d2140208c3de6543aaef5cd3a94",
        label: "FTX Exchange (Defunct)",
        category: "exchange",
        trust_score: 10,
      },
      {
        address: "0x2faf487a4414fe77e2327f0bf4ae2a264a776ad2",
        label: "FTX 1 (Defunct)",
        category: "exchange",
        trust_score: 10,
      },
    ],
  },
  {
    code: "CA",
    name: "Canada",
    lat: 56.1304,
    lng: -106.3468,
    wallets: [
      {
        address: "0x3ee18b2214aff97000d974cf647e7c347e8fa585",
        label: "Wormhole Portal",
        category: "bridge",
        trust_score: 88,
      },
      {
        address: "0xd19d4b5d358258f05d7b411e21a1460d11b0876f",
        label: "Hop Protocol",
        category: "bridge",
        trust_score: 87,
      },
    ],
  },
  {
    code: "DE",
    name: "Germany",
    lat: 51.1657,
    lng: 10.4515,
    wallets: [
      {
        address: "0x6b175474e89094c44da98b954eedeac495271d0f",
        label: "DAI (MakerDAO)",
        category: "stablecoin",
        trust_score: 96,
      },
      {
        address: "0x83f20f44975d03b1b09e64809b757c47f942beea",
        label: "Spark sDAI",
        category: "defi",
        trust_score: 92,
      },
    ],
  },
  {
    code: "AU",
    name: "Australia",
    lat: -25.2744,
    lng: 133.7751,
    wallets: [
      {
        address: "0x881d40237659c251811cec9c364ef91dc08d300c",
        label: "MetaMask Swap Router",
        category: "dex",
        trust_score: 91,
      },
      {
        address: "0xc36442b4a4522e871399cd717abdd847ab11fe88",
        label: "Uniswap V3 Positions NFT",
        category: "defi",
        trust_score: 94,
      },
    ],
  },
  {
    code: "BR",
    name: "Brazil",
    lat: -14.235,
    lng: -51.9253,
    wallets: [
      {
        address: "0xdac17f958d2ee523a2206206994597c13d831ec7",
        label: "USDT (Tether)",
        category: "stablecoin",
        trust_score: 90,
      },
      {
        address: "0x99c9fc46f92e8a1c0dec1b1747d010903e884be1",
        label: "Optimism Gateway",
        category: "bridge",
        trust_score: 93,
      },
    ],
  },
  {
    code: "NG",
    name: "Nigeria",
    lat: 9.082,
    lng: 8.6753,
    wallets: [
      {
        address: "0x3154cf16ccdb4c6d922629664174b904d80f2c35",
        label: "Base Bridge",
        category: "bridge",
        trust_score: 93,
      },
      {
        address: "0x49048044d57e1c92a77f79988d21fa8faf74e97e",
        label: "Base Portal",
        category: "bridge",
        trust_score: 93,
      },
    ],
  },
  {
    code: "HK",
    name: "Hong Kong",
    lat: 22.3193,
    lng: 114.1694,
    wallets: [
      {
        address: "0x4dbd4fc535ac27206064b68ffcf827b0a60bab3f",
        label: "Arbitrum Delayed Inbox",
        category: "bridge",
        trust_score: 94,
      },
      {
        address: "0x8315177ab297ba92a06054ce80a67ed4dbd7ed3a",
        label: "Arbitrum Bridge",
        category: "bridge",
        trust_score: 94,
      },
    ],
  },
];

interface CountryWalletsProps {
  filter?: "all" | "safe" | "risky";
  showCountry?: boolean;
}

function formatAddress(addr: string): string {
  if (!addr) return "";
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function getTrustColor(score: number): string {
  if (score >= 80) return "text-[#00FF94]";
  if (score >= 60) return "text-[#FFB800]";
  return "text-[#FF3B3B]";
}

function getTrustBg(score: number): string {
  if (score >= 80) return "bg-[#00FF94]/10 border-[#00FF94]/30";
  if (score >= 60) return "bg-[#FFB800]/10 border-[#FFB800]/30";
  return "bg-[#FF3B3B]/10 border-[#FF3B3B]/30";
}

function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    exchange: "🏦",
    dex: "🔄",
    defi: "📈",
    stablecoin: "💵",
    bridge: "🌉",
    protocol: "⚙️",
    notable: "⭐",
  };
  return icons[category] || "📌";
}

export default function CountryWallets({
  filter = "all",
  showCountry = true,
}: CountryWalletsProps) {
  const { user } = useSession();
  const [expandedCountries, setExpandedCountries] = useState<string[]>([]);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const isFreeUser = !user || user.premium_tier === "free";

  let filteredCountries = COUNTRIES_DATA;

  if (filter === "safe") {
    filteredCountries = COUNTRIES_DATA.map((country) => ({
      ...country,
      wallets: country.wallets.filter((w) => w.trust_score >= 80),
    })).filter((country) => country.wallets.length > 0);
  } else if (filter === "risky") {
    filteredCountries = COUNTRIES_DATA.map((country) => ({
      ...country,
      wallets: country.wallets.filter((w) => w.trust_score < 80),
    })).filter((country) => country.wallets.length > 0);
  }

  const toggleCountry = (code: string) => {
    setExpandedCountries((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  };

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  return (
    <div className="space-y-2">
      {filteredCountries.map((country) => (
        <div
          key={country.code}
          className="rounded-lg border border-[#1A1A1A] bg-[#0A0A0A] overflow-hidden"
        >
          <button
            onClick={() => toggleCountry(country.code)}
            className="flex w-full items-center justify-between p-4 hover:bg-[#111] transition-colors"
          >
            <div className="flex items-center gap-3">
              <Globe className="h-5 w-5 text-gray-500" />
              <span className="text-white font-medium">{country.name}</span>
              <span className="text-gray-500 text-sm">
                ({country.wallets.length} wallets)
              </span>
            </div>
            <div className="flex items-center gap-2">
              {country.wallets.some((w) => w.trust_score >= 80) && (
                <span className="flex items-center gap-1 text-xs text-[#00FF94]">
                  <Shield className="h-3 w-3" />
                  {
                    country.wallets.filter((w) => w.trust_score >= 80).length
                  }{" "}
                  safe
                </span>
              )}
              {country.wallets.some((w) => w.trust_score < 60) && (
                <span className="flex items-center gap-1 text-xs text-[#FF3B3B]">
                  <AlertTriangle className="h-3 w-3" />
                  {
                    country.wallets.filter((w) => w.trust_score < 60).length
                  }{" "}
                  risky
                </span>
              )}
              {expandedCountries.includes(country.code) ? (
                <ChevronDown className="h-4 w-4 text-gray-500" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-500" />
              )}
            </div>
          </button>

          <AnimatePresence>
            {expandedCountries.includes(country.code) && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: "auto" }}
                exit={{ height: 0 }}
                className="overflow-hidden"
              >
                <div className="border-t border-[#1A1A1A] p-4 grid gap-2">
                  {country.wallets.map((wallet, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-lg bg-[#111] hover:bg-[#1A1A1A] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">
                          {getCategoryIcon(wallet.category)}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium">
                              {wallet.label}
                            </span>
                            <span className="text-gray-500 text-xs capitalize">
                              ({wallet.category})
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <button
                              onClick={() => copyAddress(wallet.address)}
                              className="text-gray-500 hover:text-white text-xs font-mono flex items-center gap-1"
                            >
                              {formatAddress(wallet.address)}
                              {copiedAddress === wallet.address ? (
                                <span className="text-[#00FF94]">✓</span>
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                      <div
                        className={cn(
                          "flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium",
                          getTrustBg(wallet.trust_score),
                          getTrustColor(wallet.trust_score),
                        )}
                      >
                        <Shield className="h-3 w-3" />
                        {wallet.trust_score}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}
