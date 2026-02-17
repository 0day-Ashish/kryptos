// ── Kryptos Chrome Extension — Background Service Worker ─────────────────────

// Handle messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SCAN_ADDRESS") {
    scanAddress(message.address)
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // async response
  }
});

// Handle extension install
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    // Set default settings
    chrome.storage.local.set({
      apiUrl: "http://localhost:8000",
      autoScan: true,
    });
    console.log("Kryptos extension installed!");
  }
});

async function scanAddress(address) {
  const { apiUrl } = await chrome.storage.local.get("apiUrl");
  const api = apiUrl || "http://localhost:8000";
  const res = await fetch(`${api}/analyze/${address}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
