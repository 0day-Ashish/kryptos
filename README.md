<p align="center">
  <img src="https://img.shields.io/badge/Kryptos-Blockchain%20Intelligence-black?style=for-the-badge" alt="Kryptos Badge" />
</p>

<h1 align="center">🔍 Kryptos</h1>

<p align="center">
  <strong>AI-powered multi-chain blockchain intelligence platform — wallet risk analysis, token scanning, contract auditing &amp; more</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19-61dafb?logo=react" alt="React" />
  <img src="https://img.shields.io/badge/FastAPI-Python-009688?logo=fastapi" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Solidity-0.8.24-363636?logo=solidity" alt="Solidity" />
  <img src="https://img.shields.io/badge/Chains-14%20EVM-blue" alt="Chains" />
  <img src="https://img.shields.io/badge/Endpoints-26+-purple" alt="Endpoints" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License" />
</p>

---

## 📖 What is Kryptos?

**Kryptos** is a full-stack blockchain intelligence platform that combines machine learning, on-chain data analysis, and community reporting to help users identify risky wallets, tokens, and smart contracts across **14 EVM chains**.

Core capabilities:
- **Wallet Risk Analysis** — Score any address 0–100 using ML + heuristics
- **Token Scanner** — Deep-dive ERC-20 contract risk assessment
- **Contract Auditor** — Automated smart contract security audit with severity-classified findings
- **Bulk Screening** — Batch-analyze up to 50 wallets at once (paste or CSV upload)
- **Wallet Watchlist** — Persistent monitoring dashboard with alert thresholds
- **On-Chain Reports** — Risk scores stored permanently on Base Sepolia via a Solidity smart contract
- **Chrome Extension** — Hover-to-scan on block explorers (Etherscan, BscScan, etc.)
- **Discord Bot** — Slash commands for wallet scanning in Discord servers

---

## 🧠 How It Works

```
Wallet Address
      │
      ▼
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐
│  Etherscan   │────▶│  Feature     │────▶│  Hybrid Scoring   │
│  V2 API      │     │  Extraction  │     │  ML (Isolation     │
│  (14 chains) │     │  (32+ feats) │     │  Forest) + GNN +   │
└─────────────┘     └──────────────┘     │  Heuristics        │
                                          └────────┬───────────┘
                                                   │
                    ┌──────────────────────────────┼──────────────────────────────┐
                    ▼                              ▼                              ▼
          ┌────────────────┐            ┌────────────────┐            ┌────────────────┐
          │  Risk Score    │            │  Advanced      │            │  On-Chain       │
          │  0–100 + Flags │            │  Analytics     │            │  Storage        │
          │  + Graph       │            │  MEV / Bridge  │            │  RiskRegistry   │
          │  + Timeline    │            │  Temporal /    │            │  Base Sepolia   │
          │  + Reports     │            │  Cross-chain   │            │                 │
          └────────────────┘            └────────────────┘            └────────────────┘
```

1. **Fetch** — Pulls normal, internal, and token transfer transactions from the Etherscan V2 API
2. **Extract** — Computes 32+ behavioral features (value entropy, gas anomalies, time clustering, round-number patterns, counterparty diversity, etc.)
3. **Score** — Hybrid scoring: Isolation Forest ML model (70%) + heuristic rule engine (30%), with optional GNN-based graph scoring
4. **Analyze** — Runs advanced detectors: MEV activity, bridge usage, temporal anomalies, cross-chain patterns, fund flow tracing
5. **Visualize** — Interactive force-directed graph, daily activity timeline, counterparty table, and risk breakdowns
6. **Store** — Writes the report on-chain to the `RiskRegistry` smart contract on Base Sepolia

---

## ✨ Features

### 🔬 Wallet Analysis Engine
- **32+ behavioral features** extracted per wallet
- **Isolation Forest ML model** with automatic anomaly detection
- **GNN-based graph scoring** for network-level risk assessment
- **Heuristic boost system** that flags common scam patterns
- **Risk flags** — human-readable explanations of suspicious behavior
- **Fund flow tracing** — trace the path of funds through intermediaries
- **Cross-chain activity detection** — identify multi-chain behavior
- **Temporal anomaly detection** — spot unusual time-based patterns
- **MEV detection** — flag sandwich attacks and front-running patterns
- **Bridge usage tracking** — identify cross-chain bridge interactions
- **ENS resolution** — resolve `.eth` names to addresses
- **Similar wallet discovery** — find wallets with matching behavioral patterns

### 🪙 Token Scanner
- **Contract verification status** — verified, proxy, upgradeable
- **Dangerous function detection** — mint, pause, blacklist, ownership
- **Holder distribution analysis** — top-10/top-20 concentration, unique holders
- **Source code inspection** + ABI viewer
- **Risk score with category breakdown**

### 📋 Contract Auditor
- **Automated security findings** classified by severity (Critical / High / Medium / Low / Info)
- **Per-function risk tagging** with inputs, outputs, and mutability
- **Security score with letter grade** (A+ through F)
- **Source code snippets** for each finding
- **Gas optimization suggestions**

### 📦 Bulk Screening
- **Batch analyze up to 50 wallets** in a single request
- **Two input modes** — paste addresses or upload CSV
- **Summary dashboard** — avg risk score, risk distribution bar, sanctioned count
- **Filterable & sortable results table** with per-wallet scores
- **CSV export** of results
- **Quick mode / Deep scan** toggle

### 👁️ Wallet Watchlist
- **Persistent monitoring** with custom labels and alert thresholds
- **Risk score trends** — previous vs. current score with delta tracking
- **Balance, ENS, and transaction count** display
- **Sort, filter, refresh, and export** capabilities
- **Requires wallet authentication** (SIWE)

### 🌐 Multi-Chain Support

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
- **Sanctions list checking** — OFAC and known sanctioned addresses

### 📊 Dashboard & Visualization
- **Interactive force-directed graph** — nodes color-coded by category (exchange = blue, DEX = purple, mixer = red, bridge = orange, DeFi = green)
- **Transaction timeline** — daily activity bar chart with volume sparkline
- **Top counterparties table** — sorted by volume, with known labels
- **Animated risk progress bar** — color transitions from green → yellow → red
- **12 analysis tabs** — Overview, Graph, Timeline, Features, Community, ENS, Cross-chain, Temporal, MEV, Bridges, Trace, Similar
- **PDF report export** — downloadable risk assessment reports

### 🔐 Authentication
- **Sign-In with Ethereum (SIWE)** — wallet-based authentication
- **JWT sessions** — 72-hour token expiry
- **MetaMask & Coinbase Wallet** support
- **SQLite user database** with SQLAlchemy ORM

### ⛓️ On-Chain Reports
- Risk scores stored on **Base Sepolia** via the `RiskRegistry` smart contract
- Reports include risk score, IPFS hash, and timestamp
- Permanent, verifiable, and queryable on-chain

### 🧩 Chrome Extension
- **Hover-to-scan** — hover over any wallet address on block explorers to see its risk score
- **Supported sites** — Etherscan, BscScan, PolygonScan, Arbiscan, Basescan, Optimistic Etherscan
- **Manifest V3** — modern extension architecture

### 🤖 Discord Bot
- `/scan <address>` — scan a wallet and display its risk score
- `/sanctions <address>` — check if an address is sanctioned
- `/batch <addr1,addr2,...>` — quick batch scan
- `/help` — command reference

### 👥 Community Reports
- **Submit reports** — flag suspicious wallets with categories and descriptions
- **Voting system** — upvote/downvote community reports
- **Recent & flagged feeds** — browse community-flagged addresses

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS 4, Framer Motion |
| **Backend** | FastAPI (Python 3.10+), Uvicorn, SQLAlchemy |
| **Auth** | SIWE (Sign-In with Ethereum), PyJWT, eth-account |
| **ML / AI** | scikit-learn (Isolation Forest), pandas, NumPy, NetworkX |
| **Blockchain Data** | Etherscan V2 API (14 chains) |
| **Smart Contract** | Solidity 0.8.24, Hardhat, Base Sepolia |
| **On-Chain** | Web3.py, Base Sepolia RPC |
| **Visualization** | react-force-graph-2d, Custom SVG/CSS charts |
| **Database** | SQLite (via SQLAlchemy) |
| **Extension** | Chrome Extension (Manifest V3) |
| **Bots** | discord.py, aiohttp |

---

## 📜 Deployed Smart Contract

| Detail | Value |
|--------|-------|
| **Contract** | `RiskRegistryV2` (UUPS Proxy) |
| **Network** | Base Sepolia (Chain ID: 84532) |
| **Address** | [`0xFc3528536bfA705Ae0E40946Fe26A1F86fBAAF74`](https://sepolia.basescan.org/address/0xFc3528536bfA705Ae0E40946Fe26A1F86fBAAF74) |

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
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r ml/requirements.txt
pip install PyJWT eth-account sqlalchemy

# Set environment variables (optional)
export ETHERSCAN_API_KEY=your_key_here
export JWT_SECRET=your_secret_here

# Run the server
uvicorn main:app --reload --host 127.0.0.1 --port 8000
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

### 5. (Optional) Run the Discord bot

```bash
pip install discord.py aiohttp
export KRYPTOS_DISCORD_TOKEN=your_bot_token
export KRYPTOS_API_URL=http://127.0.0.1:8000
python bots/discord_bot.py
```

### 6. (Optional) Load the Chrome extension

1. Open `chrome://extensions/` in your browser
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `chrome-extension/` directory
4. Navigate to any supported block explorer and hover over wallet addresses

---

## 📡 API Endpoints

### Core Analysis

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Health check — returns version and chain count |
| `GET` | `/chains` | List all 14 supported chains |
| `GET` | `/analyze/{address}` | Full wallet risk analysis (score, graph, timeline, counterparties) |
| `GET` | `/balance/{address}` | Fetch native token balance |
| `GET` | `/report/{address}` | JSON risk report |
| `GET` | `/report/{address}/pdf` | Download PDF risk report |

### Advanced Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/resolve/{name}` | ENS name resolution |
| `GET` | `/trace/{address}` | Fund flow tracing |
| `GET` | `/cross-chain/{address}` | Cross-chain activity scan |
| `GET` | `/sanctions/{address}` | Sanctions list check |
| `GET` | `/tokens/{address}` | Token portfolio |
| `GET` | `/similar/{address}` | Find similar wallets |
| `GET` | `/gnn/{address}` | GNN-based risk scoring |
| `GET` | `/temporal/{address}` | Temporal anomaly detection |
| `GET` | `/mev/{address}` | MEV activity detection |
| `GET` | `/bridges/{address}` | Bridge usage detection |

### Token & Contract

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/token-scan/{address}` | ERC-20 token risk scan |
| `GET` | `/contract-audit/{address}` | Smart contract security audit |

### Batch Analysis

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/batch` | Batch address analysis (up to 50) |
| `POST` | `/batch/csv` | CSV batch upload |

### Community

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/community/report` | Submit a community report |
| `GET` | `/community/reports/{address}` | Get reports for an address |
| `POST` | `/community/vote` | Vote on a report |
| `GET` | `/community/recent` | Recent community reports |
| `GET` | `/community/flagged` | Community-flagged addresses |

### Auth & Watchlist

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/nonce` | Request SIWE nonce |
| `POST` | `/auth/verify` | Verify signature & get JWT |
| `GET` | `/auth/me` | Get current user info |
| — | `/watchlist/*` | CRUD operations for watched wallets (auth required) |

**Query parameter:** `?chain_id=1` (default: Ethereum Mainnet)

### Example

```bash
# Analyze a wallet
curl http://127.0.0.1:8000/analyze/0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045?chain_id=1

# Scan a token
curl http://127.0.0.1:8000/token-scan/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48?chain_id=1

# Batch analyze
curl -X POST http://127.0.0.1:8000/batch \
  -H "Content-Type: application/json" \
  -d '{"addresses": ["0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"], "chain_id": 1, "quick": true}'
```

---

## 📁 Project Structure

```
kryptos/
├── backend/
│   ├── main.py                 # FastAPI app — 26+ API endpoints
│   ├── on_chain.py             # Write/read reports on Base Sepolia
│   ├── report_pdf.py           # PDF report generation
│   ├── auth/
│   │   ├── auth.py             # JWT + SIWE authentication helpers
│   │   ├── routes.py           # Auth endpoints (nonce, verify, me)
│   │   └── watchlist_routes.py # Watchlist CRUD endpoints
│   ├── db/
│   │   └── models.py           # SQLAlchemy user & watchlist models
│   └── ml/
│       ├── config.py           # Chain configs & API settings
│       ├── fetcher.py          # Multi-chain tx fetcher with caching
│       ├── scorer.py           # ML scoring (Isolation Forest)
│       ├── hybrid_scorer.py    # Combined ML + heuristic scoring
│       ├── gnn_scorer.py       # Graph neural network scoring
│       ├── features.py         # 32+ behavioral feature extraction
│       ├── known_labels.py     # 100+ labeled addresses
│       ├── sanctions.py        # Sanctions list checking
│       ├── graph_builder.py    # Transaction graph construction
│       ├── batch_analyzer.py   # Bulk wallet analysis (up to 50)
│       ├── cross_chain.py      # Cross-chain activity detection
│       ├── temporal_anomaly.py # Time-based anomaly detection
│       ├── mev_detector.py     # MEV activity detection
│       ├── bridge_tracker.py   # Bridge usage tracking
│       ├── tracer.py           # Fund flow tracing
│       ├── similarity.py       # Similar wallet discovery
│       ├── ens_resolver.py     # ENS name resolution
│       ├── token_portfolio.py  # Token holdings analysis
│       ├── community_reports.py# Community reporting system
│       ├── explainability.py   # Risk score explanations
│       └── requirements.txt    # Python dependencies
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── page.tsx            # Landing page with hero & workflow
│       │   ├── layout.tsx          # Root layout with auth provider
│       │   ├── analyze/page.tsx    # Wallet analysis dashboard (12 tabs)
│       │   ├── bulk/page.tsx       # Bulk screening (paste/CSV)
│       │   ├── token-scan/page.tsx # Token scanner
│       │   ├── contract-audit/page.tsx # Contract auditor
│       │   ├── watchlist/page.tsx  # Wallet watchlist (auth-gated)
│       │   ├── contact/page.tsx    # Contact page
│       │   └── components/
│       │       ├── Graph.tsx       # Force-directed transaction graph
│       │       └── Timeline.tsx    # Daily activity chart + sparkline
│       ├── components/
│       │   ├── Navbar.tsx          # Navigation with services dropdown
│       │   ├── HeroAnimation.tsx   # Animated hero visual
│       │   ├── Workflow.tsx        # "How It Works" section
│       │   ├── SupportedChains.tsx # Chain logos carousel
│       │   ├── Developers.tsx      # Developer info section
│       │   └── Footer.tsx          # Site footer
│       └── context/
│           └── AuthContext.tsx      # SIWE auth context provider
├── contracts/
│   ├── contracts/
│   │   └── RiskRegistry.sol    # On-chain risk report registry
│   ├── deploy.ts               # Deployment script
│   └── hardhat.config.ts       # Hardhat configuration
├── chrome-extension/
│   ├── manifest.json           # Manifest V3 config
│   ├── background.js           # Service worker
│   ├── content.js              # Injected on block explorers
│   ├── popup.html/js           # Extension popup UI
│   └── icons/                  # Extension icons
├── bots/
│   └── discord_bot.py          # Discord bot with slash commands
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
- **70% ML score** — Isolation Forest anomaly detection on 32+ behavioral features
- **30% Heuristic score** — Rule-based checks (empty wallets, single counterparty, low gas, high-value concentration, mixer interaction, etc.)
- **Optional GNN score** — Graph neural network analysis of transaction network topology

---

## 🛡️ Security & Auth

Kryptos uses **Sign-In with Ethereum (SIWE)** for wallet-based authentication:

1. Client requests a nonce from `/auth/nonce`
2. User signs the SIWE message with their wallet (MetaMask or Coinbase Wallet)
3. Backend verifies the Ethereum signature and issues a JWT (72h expiry)
4. Protected routes (watchlist) require the JWT in the `Authorization` header

User data and watchlists are stored in a local SQLite database via SQLAlchemy.

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

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Built with ⚡ by the Kryptos team
</p>
