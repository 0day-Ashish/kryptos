// ── Kryptos Chrome Extension — Popup Logic ──────────────────────────────────

const DEFAULT_API = "http://localhost:8000";

// DOM refs
const addressInput = document.getElementById("addressInput");
const scanBtn = document.getElementById("scanBtn");
const resultArea = document.getElementById("resultArea");
const apiUrlInput = document.getElementById("apiUrl");
const autoScanCheckbox = document.getElementById("autoScan");
const toggleSettings = document.getElementById("toggleSettings");
const settingsPanel = document.getElementById("settingsPanel");

// ── Settings toggle ─────────────────────────────────────────────────────────
toggleSettings.addEventListener("click", (e) => {
  e.preventDefault();
  settingsPanel.style.display =
    settingsPanel.style.display === "none" ? "block" : "none";
});

// ── Load saved settings ─────────────────────────────────────────────────────
chrome.storage.local.get(["apiUrl", "autoScan"], (data) => {
  if (data.apiUrl) apiUrlInput.value = data.apiUrl;
  if (data.autoScan !== undefined) autoScanCheckbox.checked = data.autoScan;
});

// Save settings on change
apiUrlInput.addEventListener("change", () => {
  chrome.storage.local.set({ apiUrl: apiUrlInput.value });
});
autoScanCheckbox.addEventListener("change", () => {
  chrome.storage.local.set({ autoScan: autoScanCheckbox.checked });
});

// ── Scan button ─────────────────────────────────────────────────────────────
scanBtn.addEventListener("click", () => {
  const addr = addressInput.value.trim();
  if (!addr) return;
  scanAddress(addr);
});

addressInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") scanBtn.click();
});

// ── Check if current tab is an address page ─────────────────────────────────
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const url = tabs[0]?.url || "";
  const match = url.match(/\/address\/(0x[a-fA-F0-9]{40})/);
  if (match) {
    addressInput.value = match[1];
    scanAddress(match[1]);
  }
});

// ── Core scan function ──────────────────────────────────────────────────────
async function scanAddress(address) {
  const api = apiUrlInput.value || DEFAULT_API;

  resultArea.innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      <div>Analyzing ${address.slice(0, 8)}...${address.slice(-4)}</div>
    </div>`;

  scanBtn.disabled = true;

  try {
    const res = await fetch(`${api}/analyze/${address}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    renderResult(data);
  } catch (err) {
    resultArea.innerHTML = `
      <div class="error">
        ⚠️ Could not reach Kryptos API.<br />
        <small>${err.message}</small><br /><br />
        Make sure the backend is running at <strong>${api}</strong>
      </div>`;
  } finally {
    scanBtn.disabled = false;
  }
}

// ── Render helpers ──────────────────────────────────────────────────────────
function riskClass(score) {
  if (score >= 75) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function renderResult(data) {
  const score = data.risk_score ?? 0;
  const label = data.risk_label ?? "Unknown";
  const cls = riskClass(score);
  const flags = data.flags || [];
  const sanctioned = data.is_sanctioned;
  const address = data.address || "";

  let html = `<div class="result">`;

  // Address
  html += `<div class="address">${address}</div>`;

  // Sanctions banner
  if (sanctioned) {
    html += `<div class="sanctioned-banner">🚫 SANCTIONED ADDRESS — On OFAC SDN List</div>`;
  }

  // Score
  html += `
    <div class="score-row">
      <div class="score-badge ${cls}">${score}</div>
      <div class="score-meta">
        <div class="label">${label}</div>
        <div class="sub">ML: ${data.ml_raw_score ?? "—"} | Heuristic: ${data.heuristic_score ?? "—"}</div>
      </div>
    </div>`;

  // Risk bar
  html += `
    <div class="risk-bar">
      <div class="fill ${cls}" style="width:${score}%"></div>
    </div>`;

  // Flags
  if (flags.length) {
    html += `<div class="flags">`;
    for (const f of flags) {
      const fClass = score >= 75 ? "high" : "";
      html += `<div class="flag ${fClass}">${f}</div>`;
    }
    html += `</div>`;
  }

  // Quick stats
  const fs = data.feature_summary || {};
  if (fs.tx_count) {
    html += `
      <div style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px;color:#a3a3a3;">
        <div>Transactions: <strong style="color:#e5e5e5">${fs.tx_count}</strong></div>
        <div>Counterparties: <strong style="color:#e5e5e5">${fs.unique_counterparties ?? "—"}</strong></div>
        <div>Sent: <strong style="color:#e5e5e5">${(fs.total_value_sent_eth ?? 0).toFixed(3)} ETH</strong></div>
        <div>Received: <strong style="color:#e5e5e5">${(fs.total_value_received_eth ?? 0).toFixed(3)} ETH</strong></div>
      </div>`;
  }

  html += `</div>`;
  resultArea.innerHTML = html;
}
