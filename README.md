<p align="center">
  <img src="https://img.shields.io/badge/Kryptos-Blockchain%20Scam%20Detector-black?style=for-the-badge" alt="Kryptos Badge" />
</p>

<h1 align="center">🔍 Kryptos</h1>

<p align="center">
  <strong>AI-powered multi-chain wallet risk analysis &amp; scam detection tool</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/FastAPI-Python-009688?logo=fastapi" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Solidity-0.8.24-363636?logo=solidity" alt="Solidity" />
  <img src="https://img.shields.io/badge/Chains-14%20Supported-blue" alt="Chains" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License" />
</p>

---

## 📖 What is Kryptos?

**Kryptos** is a full-stack blockchain intelligence tool that analyzes any wallet address across 14 EVM chains and produces a **risk score from 0–100** using machine learning. It helps users, researchers, and protocols identify suspicious wallets — potential scammers, money launderers, or mixer users — before interacting with them.

Risk reports are stored **on-chain** via a Solidity smart contract on Base Sepolia, creating a permanent, verifiable record of wallet assessments.

---

## 🧠 How It Works

```
Wallet Address
      │
      ▼
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Etherscan   │────▶│  Feature     │────▶│  ML Scoring     │
│  V2 API      │     │  Extraction  │     │  (IsolationForest│
│  (14 chains) │     │  (32+ feats) │     │  + Heuristics)  │
└─────────────┘     └──────────────┘     └────────┬────────┘
                                                   │
                                                   ▼
                                          ┌────────────────┐
                                          │  Risk Score    │
                                          │  0–100         │
                                          │  + Flags       │
                                          │  + Graph       │
                                          │  + Timeline    │
                                          └────────────────┘
```

1. **Fetch** — Pulls normal transactions, internal transactions, and token transfers from the Etherscan V2 API  
2. **Extract** — Computes 32+ behavioral features (transaction frequency, value patterns, gas anomalies, time clustering, counterparty diversity, etc.)  
3. **Score** — Runs an Isolation Forest ML model (70%) combined with a heuristic rule engine (30%) to produce the final risk score  
4. **Visualize** — Renders an interactive transaction graph, daily activity timeline, and counterparty table  
5. **Store** — Writes the report on-chain to the RiskRegistry smart contract on Base Sepolia  

---

## ✨ Features

### 🔬 Analysis Engine
- **32+ behavioral features** extracted per wallet (value entropy, gas anomalies, time clustering, round-number patterns, etc.)
- **Isolation Forest ML model** with automatic anomaly detection
- **Heuristic boost system** that flags common scam patterns
- **Risk flags** — human-readable explanations of why a wallet is suspicious

### 🌐 Multi-Chain Support
Analyze wallets across **14 EVM chains**:

| Chain | Chain | Chain |
|-------|-------|-------|
| Ethereum | Base | Polygon |
| Arbitrum One | Optimism | BNB Smart Chain |
| Avalanche C-Chain | Fantom | Linea |
| zkSync Era | Mantle | Scroll |
| Sepolia (Testnet) | Base Sepolia | |

### 🏷️ Known Address Labels
- **100+ labeled addresses** — exchanges (Binance, Coinbase, Kraken), DEXs (Uniswap, SushiSwap), bridges, DeFi protocols, stablecoin contracts, NFT marketplaces
- **Mixer detection** — flags interactions with Tornado Cash contracts
- Labels displayed in the graph and counterparty table

### 📊 Dashboard
- **Interactive force-directed graph** — nodes color-coded by category (exchange = blue, DEX = purple, mixer = red, bridge = orange, DeFi = green)
- **Transaction timeline** — daily activity bar chart with volume sparkline
- **Top counterparties table** — sorted by volume, with known labels
- **Animated risk progress bar** — color transitions from green → yellow → red
- **Search history** — last 8 searches saved locally
- **Export report** — download full analysis as JSON
- **Copy to clipboard** — one-click address copying

### ⛓️ On-Chain Reports
- Risk scores stored on **Base Sepolia** via the `RiskRegistry` smart contract
- Reports include risk score, IPFS hash, and timestamp
- Permanent, verifiable, and queryable on-chain

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| **Backend** | FastAPI (Python), Uvicorn |
| **ML** | scikit-learn (Isolation Forest), pandas, NumPy |
| **Blockchain Data** | Etherscan V2 API (multi-chain) |
| **Smart Contract** | Solidity 0.8.24, Hardhat, Base Sepolia |
| **On-Chain** | Web3.py, Base Sepolia RPC |
| **Visualization** | react-force-graph-2d, Custom SVG/CSS charts |

---

## 📜 Deployed Smart Contract

| Detail | Value |
|--------|-------|
| **Contract** | `RiskRegistry` |
| **Network** | Base Sepolia (Chain ID: 84532) |
| **Address** | [`0x015ffC4Bb2E5238A1646EC8860030bfb86650Ad2`](https://sepolia.basescan.org/address/0x015ffC4Bb2E5238A1646EC8860030bfb86650Ad2) |

---

## 🚀 Getting Started

### Prerequisites

- **Python 3.10+**  
- **Node.js 18+**  
- **npm** or **yarn**

### 1. Clone the repo

```bash
git clone https://github.com/your-username/kryptos.git
cd kryptos
```

### 2. Start the backend

```bash
# Install Python dependencies
pip install fastapi uvicorn requests python-dotenv web3 networkx scikit-learn pandas numpy

# Run the server
cd kryptos
python3 -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

The API will be available at `http://127.0.0.1:8000`.

### 3. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

### 4. (Optional) Deploy the smart contract

```bash
cd contracts
npm install
npx hardhat compile
npx ts-node deploy.ts
```

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Health check — returns version and chain count |
| `GET` | `/chains` | List all 14 supported chains |
| `GET` | `/analyze/{address}` | Full wallet analysis (score, graph, timeline, counterparties) |
| `GET` | `/balance/{address}` | Fetch native token balance for a wallet |
| `GET` | `/report/{address}` | Write risk report on-chain and return tx hash |

**Query parameter:** `?chain_id=1` (default: Ethereum Mainnet)

### Example

```bash
curl http://127.0.0.1:8000/analyze/0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045?chain_id=1
```

---

## 📁 Project Structure

```
kryptos/
├── backend/
│   ├── main.py                 # FastAPI app — all API endpoints
│   ├── on_chain.py             # Write/read reports on Base Sepolia
│   └── ml/
│       ├── config.py           # Chain configs & API settings
│       ├── fetcher.py          # Multi-chain tx fetcher with caching
│       ├── scorer.py           # ML scoring engine (IsolationForest)
│       ├── features.py         # 32+ behavioral feature extraction
│       ├── known_labels.py     # 100+ labeled addresses & mixer detection
│       ├── graph_builder.py    # Transaction graph construction
│       └── ...
├── frontend/
│   └── src/app/
│       ├── page.tsx            # Main dashboard UI
│       └── components/
│           ├── Graph.tsx       # Force-directed graph with category colors
│           └── Timeline.tsx    # Daily activity bar chart + sparkline
├── contracts/
│   ├── contracts/
│   │   └── RiskRegistry.sol    # On-chain risk report registry
│   ├── deploy.ts               # Deployment script
│   └── hardhat.config.ts       # Hardhat configuration
└── README.md
```

---

## 🎯 Risk Score Breakdown

| Score Range | Label | Meaning |
|-------------|-------|---------|
| 0–30 | 🟢 Low Risk | Normal wallet activity |
| 31–60 | 🟡 Medium Risk | Some unusual patterns detected |
| 61–80 | 🟠 High Risk | Multiple suspicious indicators |
| 81–100 | 🔴 Critical Risk | Strong scam/fraud signals |

The score combines:
- **70% ML score** — Isolation Forest anomaly detection on 32+ features
- **30% Heuristic score** — Rule-based checks (empty wallets, single counterparty, low gas, high-value concentration, etc.)

---

## 🤝 Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

1. Fork the repository  
2. Create your feature branch (`git checkout -b feature/your-feature`)  
3. Commit your changes (`git commit -m 'Add your feature'`)  
4. Push to the branch (`git push origin feature/your-feature`)  
5. Open a Pull Request  

---

## 📝 License

This project is licensed under the MIT License.

---

<p align="center">
  Built with ⚡ by the Kryptos team
</p>
