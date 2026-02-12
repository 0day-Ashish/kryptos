# backend/main.py
from fastapi import FastAPI
import requests

app = FastAPI()

# ⚠️ REPLACE THIS WITH YOUR ETHERSCAN KEY
ETHERSCAN_API_KEY = "PTTZA4C2JB9VYZU4PJRRSMEGV82MXAYS59"

def get_transactions(address):
    url = f"https://api.etherscan.io/api?module=account&action=txlist&address={address}&startblock=0&endblock=99999999&sort=desc&apikey={ETHERSCAN_API_KEY}"
    response = requests.get(url)
    data = response.json()
    
    if data["message"] == "OK":
        # Return only the last 10 transactions for speed
        return data["result"][:10]
    return []

@app.get("/")
def home():
    return {"message": "TraceZero Backend is Running!"}

@app.get("/analyze/{address}")
def analyze_wallet(address: str):
    # 1. Fetch Data
    txs = get_transactions(address)
    
    # 2. Build Simple Graph Structure (Nodes & Links)
    nodes = [{"id": address, "group": "suspect"}]
    links = []
    
    for tx in txs:
        other_party = tx["to"] if tx["from"].lower() == address.lower() else tx["from"]
        
        # Add the neighbor node
        nodes.append({"id": other_party, "group": "neighbor"})
        
        # Add the connection (link)
        links.append({
            "source": tx["from"],
            "target": tx["to"],
            "value": int(tx["value"]) / 10**18  # Convert Wei to ETH
        })
    
    # 3. Return Data to Frontend
    return {
        "risk_score": 0.0, # Placeholder for your ML model later
        "graph": {
            "nodes": nodes,
            "links": links
        }
    }

# Run with: uvicorn main:app --reload