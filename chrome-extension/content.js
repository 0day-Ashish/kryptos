// ── Kryptos Chrome Extension — Content Script ───────────────────────────────
// Injects risk badges next to Ethereum addresses on block explorer pages.

(function () {
  "use strict";

  const KRYPTOS_CLASS = "kryptos-badge";
  const API_URL_KEY = "apiUrl";
  const DEFAULT_API = "http://localhost:8000";
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  const scoreCache = new Map();

  // Regex to match Ethereum addresses
  const ETH_ADDR_RE = /0x[a-fA-F0-9]{40}/g;

  let apiUrl = DEFAULT_API;

  // Load API URL from storage
  chrome.storage.local.get([API_URL_KEY, "autoScan"], (data) => {
    if (data.apiUrl) apiUrl = data.apiUrl;
    if (data.autoScan !== false) {
      scanPage();
    }
  });

  // ── Scan the page for addresses ─────────────────────────────────────────
  function scanPage() {
    // Find all links to /address/0x... pages
    const links = document.querySelectorAll('a[href*="/address/0x"]');
    const processed = new Set();

    links.forEach((link) => {
      const match = link.href.match(/(0x[a-fA-F0-9]{40})/);
      if (!match) return;

      const address = match[1].toLowerCase();
      if (processed.has(address)) return;
      if (link.querySelector(`.${KRYPTOS_CLASS}`)) return;

      processed.add(address);
      injectBadge(link, address);
    });
  }

  // ── Inject a risk badge next to an address link ─────────────────────────
  async function injectBadge(element, address) {
    // Create placeholder badge
    const badge = document.createElement("span");
    badge.className = KRYPTOS_CLASS;
    badge.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 3px;
      margin-left: 4px;
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      vertical-align: middle;
      cursor: pointer;
      transition: opacity 0.2s;
    `;
    badge.textContent = "⏳";
    badge.style.background = "#262626";
    badge.style.color = "#737373";
    badge.title = "Kryptos: Loading...";

    element.parentNode.insertBefore(badge, element.nextSibling);

    try {
      const data = await fetchScore(address);
      const score = data.risk_score ?? 0;
      const label = data.risk_label ?? "Unknown";

      let bg, fg, icon;
      if (score >= 75) {
        bg = "#7f1d1d"; fg = "#fca5a5"; icon = "🚨";
      } else if (score >= 40) {
        bg = "#78350f"; fg = "#fde68a"; icon = "⚠️";
      } else {
        bg = "#14532d"; fg = "#bbf7d0"; icon = "✅";
      }

      badge.style.background = bg;
      badge.style.color = fg;
      badge.textContent = `${icon} ${score}`;
      badge.title = `Kryptos Risk Score: ${score}/100 (${label})`;

      // Click to open Kryptos dashboard
      badge.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.open(`http://localhost:3000?address=${address}`, "_blank");
      });

    } catch (err) {
      badge.textContent = "❓";
      badge.title = `Kryptos: ${err.message}`;
      badge.style.background = "#1c1917";
      badge.style.color = "#78716c";
    }
  }

  // ── Fetch score with caching ────────────────────────────────────────────
  async function fetchScore(address) {
    const cached = scoreCache.get(address);
    if (cached && Date.now() - cached.time < CACHE_TTL) {
      return cached.data;
    }

    const res = await fetch(`${apiUrl}/analyze/${address}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    scoreCache.set(address, { data, time: Date.now() });
    return data;
  }

  // ── Observe DOM changes (for SPAs / lazy-loaded content) ────────────────
  const observer = new MutationObserver(() => {
    scanPage();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Initial scan after short delay
  setTimeout(scanPage, 1500);
})();
