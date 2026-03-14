import requests
import os
import threading

DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1482258950391988274/NAZ0rVM_4ViJSnhFlVX8Oyfkjw6gZfS1lvsUAoaW6b4-pQaQ597a5eiTDi8OhuH2ANOm"

def send_scam_alert_webhook(analysis_data: dict):
    """
    Sends an asynchronous Discord webhook alert for Critical / High-Risk wallets.
    Runs in a background thread to prevent slowing down the API response.
    """
    if not DISCORD_WEBHOOK_URL:
        return
        
    def _send():
        try:
            address = analysis_data.get("address", "Unknown Address")
            score = analysis_data.get("risk_score", 0)
            label = analysis_data.get("risk_label", "Unknown")
            chain_id = analysis_data.get("chain", {}).get("id", 1)
            flags = analysis_data.get("flags", [])
            
            # Use basescan for base/base-sepolia, etherscan for eth
            explorer_url = f"https://etherscan.io/address/{address}"
            if chain_id in [8453, 84532]:
                explorer_url = f"https://basescan.org/address/{address}"
                
            color = 16711680 if label == "Critical Risk" else 16753920 # Red or Orange
            
            flags_text = "\n".join([f"• {flag}" for flag in flags[:5]])
            if not flags_text:
                flags_text = "No specific flags detected."
                
            payload = {
                "content": "🚨 **High Risk Wallet Detected by Kryptos**",
                "embeds": [
                    {
                        "title": f"Scam Alert: {label}",
                        "description": f"A wallet was just scanned and flagged as **{label}**.",
                        "url": explorer_url,
                        "color": color,
                        "fields": [
                            {
                                "name": "Wallet Address",
                                "value": f"`{address}`",
                                "inline": False
                            },
                            {
                                "name": "Risk Score",
                                "value": f"**{score}/100**",
                                "inline": True
                            },
                            {
                                "name": "Flags Encountered",
                                "value": flags_text,
                                "inline": False
                            }
                        ],
                        "footer": {
                            "text": "Kryptos Automated Scanner"
                        }
                    }
                ]
            }
            requests.post(DISCORD_WEBHOOK_URL, json=payload, timeout=5)
        except Exception as e:
            print(f"⚠️ Failed to send Discord webhook: {e}")

    threading.Thread(target=_send, daemon=True).start()
