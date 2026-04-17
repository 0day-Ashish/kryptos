# Kryptos Backend

FastAPI service for wallet risk analysis, token/contract scanning, community reports, optional SIWE auth, watchlists, and ML training orchestration. Pre-trained models are loaded from the repo **root** `models/` directory (see [Layout](#layout)).

**Python:** 3.11.x recommended (Render: set `PYTHON_VERSION=3.11.9`).

---

## Quick start

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS/Linux

pip install -r requirements.txt
```

Run from the **repository root** so `ml/` and `models/` resolve correctly:

```bash
# repo root
set PYTHONPATH=.
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

If your tooling expects the app under `main` only:

```bash
cd backend
set PYTHONPATH=..
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Health check: `GET http://localhost:8000/health`

Interactive docs: `http://localhost:8000/docs` (Swagger UI).

---

## Environment variables

| Variable | Purpose |
|----------|---------|
| `ETHERSCAN_API_KEY` | Transaction & contract fetches (Etherscan V2 multi-chain) |
| `DATABASE_URL` | SQLAlchemy DB (Postgres recommended; SQLite fallback) |
| `JWT_SECRET` | Sign SIWE session tokens |
| `GEMINI_API_KEY` | Gemini NLP for audit PDF / contract-audit NLP (`google-genai`) |
| `PINATA_JWT` | Optional IPFS pinning for reports |
| `PYTHON_VERSION` | e.g. `3.11.9` on Render |

Copy a `.env` file at repo root or export vars in your shell; `python-dotenv` loads them when the app starts.

---

## Layout

```
backend/
  main.py              # FastAPI app, routes, rate limits
  requirements.txt
  auth/                # SIWE JWT, plans, Discord link helpers
  db/                  # SQLAlchemy models (users, watchlist, shared reports)
  ml/                  # Scoring, fetchers, sanctions, GNN bridge, etc.
  report_pdf.py
  ipfs.py, on_chain.py
../models/             # isolation_forest.pkl, random_forest.pkl, GNN artifacts (not inside backend/)
../ml/                 # Training scripts invoked by POST /ml/train
```

---

## Machine learning

The backend loads **pre-trained artifacts** from the repo **`models/`** directory. Training is done **offline** under **`ml/`**; the API **does not** retrain on each request (except optional **`POST /ml/train`** for full pipeline jobs).

### Live scoring (`/analyze`, watchlist quick-score)

1. **Fetch** transactions (and neighbors) via Etherscan-style APIs.
2. **`backend/ml/features.py`** — extract rich behavioral features for the target wallet.
3. **`backend/ml/trained_model_bridge.py`** — two-stage inference:
   - **Global Isolation Forest** + scaler → `anomaly_score` / `anomaly_flag`.
   - **Random Forest** (`random_forest.pkl`) — `predict_proba` → scam probability → `trained_risk_score` (0–100).
   - If `random_forest_meta.json` marks an **enriched** model, extra columns (graph/GNN from training) may be **zeroed** at runtime when not recomputed live — the RF still runs on the available feature vector.
4. **`backend/ml/scorer.py` (`WalletScorer`)** — fits a **local** Isolation Forest on the target + neighborhood for context; computes **heuristic** boosts (e.g. burst activity, round-number patterns).
5. **Blend** (when the global models load):  
   `0.6 × trained_risk + 0.1 × local_IF + 0.3 × heuristics` (else heavier weight on local IF).
6. **`main.py`** — sanctions checks, community modifiers, labels, optional IPFS/on-chain hooks.

Separate **`GET /gnn/{address}`** runs **graph neural network** scoring via `gnn_scorer` for deeper graph-based risk (not identical to every field inside the enriched RF at inference).

### Offline training & batch fusion (`../ml/`)

Training scripts (run from **`ml/`** with repo root on `PYTHONPATH`) include:

| Script / flow | Role |
|----------------|------|
| `train_iforest.py` | Global Isolation Forest + scaler artifacts |
| `train_rf_enriched.py` | Leakage-safe **enriched Random Forest**: base features + IF outputs + **graph** features + **GNN** score; saves `random_forest.pkl` + `random_forest_meta.json` |
| `gnn_pipeline.py` (invoked from enriched training) | GraphSAGE-style GNN training and wallet scores |
| `combine_models.py` | Merges RF + GNN CSV outputs, adds **contract-interaction risk**, normalizes, **fuses** with dynamic weights, labels, and human-readable **risk reasons** → e.g. `data/final_predictions.csv` |

**`POST /ml/train`** (backend) runs a **background** sequence: `train_iforest.py` → `train_rf_enriched.py` → `combine_models.py` (see `TRAINING_STEPS` in `main.py`). Poll **`GET /ml/train/status`**.

### Artifacts (expected under `models/`)

| File | Purpose |
|------|---------|
| `isolation_forest.pkl` | Global IF |
| `iforest_scaler.pkl` | Feature scaler for IF |
| `random_forest.pkl` | Supervised classifier (possibly enriched) |
| `random_forest_meta.json` | Feature column list, metrics, `model_type` |
| `gnn_model.pt`, `gnn_scaler.pkl` | GNN inference / training pipeline |

### Practical note

Offline **batch** fusion in `combine_models.py` can differ slightly from a single **live** `/analyze` call: live scoring optimizes **latency** and uses the **scorer + bridge** blend; offline fusion includes **normalized RF+GNN+contract** over full CSV cohorts. Both are consistent in **intent** (ML + heuristics + risk layers).

---

## NLP (Google Gemini)

Smart-contract **audit text** and investigation summaries are analyzed with **Google Gemini** via the **`google-genai`** SDK (not OpenAI).

| Piece | Location | Role |
|-------|----------|------|
| Core client | `backend/ml/audit_nlp_analyzer.py` | `analyze_audit_report()` — structured severity, summary, recommendations from text |
| PDF reports | `main.py` → `GET /report/{address}/pdf` | Builds audit text from analysis + flags, calls Gemini, passes result to `report_pdf.py` |
| Contract NLP API | `POST /contract-audit-analyze` | Body with audit text / contract context → Gemini JSON-style response |

**Environment:** set **`GEMINI_API_KEY`**. Default model name used in code is typically **`gemini-2.0-flash`** (check `audit_nlp_analyzer.py` / route for the exact default).

If the key is missing, PDF generation **still returns a PDF**; NLP-enriched sections may be skipped or degraded depending on error handling.

---

## Authentication & plans

- **SIWE (Sign-In With Ethereum):** `POST /auth/nonce` → sign message → `POST /auth/verify` → `Authorization: Bearer <JWT>` for protected routes.
- **Plans:** `GET /auth/plans`, `GET /auth/plan` (JWT), `PUT /auth/plan` (JWT) — plan tiers for future product gating.
- **Public (no JWT):** Core analysis endpoints listed below are intentionally open for demos and browser access; rate limits still apply.
- **JWT required:** `GET /trace/{address}` (fund-flow tracing), and all **`/watchlist/*`** CRUD routes except `GET /watchlist/quick-score/{address}`.

---

## Rate limits (SlowAPI)

Per-IP limits (examples): `/analyze` 10/min, `/batch*` 3/min, `/ml/train` 2/hour, etc. Adjust in `main.py` if needed.

---

## API overview

### Core

| Method | Path | Notes |
|--------|------|--------|
| GET | `/` | Status |
| GET | `/health` | Health check |
| GET | `/chains` | Supported EVM chains |
| GET | `/analyze/{address}` | Full wallet score (ML + heuristics + sanctions modifiers) |
| GET | `/balance/{address}` | Native balance |
| GET | `/resolve/{name}` | ENS / resolution |
| GET | `/sanctions/{address}` | Sanctions / blocklist signals |
| GET | `/tokens/{address}` | Token portfolio |
| GET | `/similar/{address}` | Similar wallets |
| GET | `/cross-chain/{address}` | Multi-chain snapshot |
| GET | `/report/{address}` | On-chain report reader |
| GET | `/report/{address}/pdf` | PDF report (optional Gemini sections) |

### Advanced (mostly public)

| Method | Path | Notes |
|--------|------|--------|
| GET | `/trace/{address}` | **JWT required** — fund flow |
| GET | `/gnn/{address}` | GNN scoring |
| GET | `/temporal/{address}` | Temporal anomalies |
| GET | `/mev/{address}` | MEV-style activity |
| GET | `/bridges/{address}` | Bridge usage |

### Batch

| Method | Path | Notes |
|--------|------|--------|
| POST | `/batch` | JSON body: `addresses`, `chain_id`, `quick` — max **50** addresses |
| POST | `/batch/csv` | Same limit, CSV string in JSON |
| POST | `/batch/upload` | `multipart/form-data`: `file`, `chain_id`, `quick` |

### Token & contract

| Method | Path | Notes |
|--------|------|--------|
| GET | `/token-scan/{address}` | ERC-20 token risk scan |
| GET | `/contract-audit/{address}` | Static contract audit |
| POST | `/contract-audit-analyze` | NLP on audit text (Gemini) |

### Community & sharing

| Method | Path |
|--------|------|
| POST | `/community/report` |
| GET | `/community/reports/{address}` |
| POST | `/community/vote` |
| GET | `/community/recent` |
| GET | `/community/flagged` |
| POST | `/share` |
| GET | `/shared/{report_id}` |
| GET | `/shared/{report_id}/meta` |

### Watchlist

| Method | Path | Auth |
|--------|------|------|
| GET | `/watchlist/quick-score/{address}` | Public |
| GET/POST/PUT/DELETE | `/watchlist/items`, ... | **JWT** |

### Auth & users

| Method | Path |
|--------|------|
| POST | `/auth/nonce` |
| POST | `/auth/verify` |
| GET | `/auth/me` |
| GET | `/auth/plans` |
| GET | `/auth/plan` |
| PUT | `/auth/plan` |
| POST | `/auth/discord-link-request` |
| POST | `/auth/discord-verify` |
| GET | `/auth/discord-user/{discord_id}` |
| GET | `/users/{discord_id}/premium` |

### ML training (orchestration)

| Method | Path | Notes |
|--------|------|--------|
| POST | `/ml/train` | **202** — runs `ml/` scripts in background thread |
| GET | `/ml/train/status` | Poll training status |

Requires `../ml` relative to repo root on the server.

---

## Deployment notes

- **Render:** Root directory can be repo root; start command should run uvicorn with `PYTHONPATH` including the repo root so `backend` and `models` resolve. Pin `PYTHON_VERSION=3.11.9`.
- **CORS:** Configured in `main.py` for browser frontends.
- **File uploads:** `python-multipart` is required for `/batch/upload`.

---

## License

Same as the parent Kryptos repository.
