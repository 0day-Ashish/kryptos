from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import requests
from backend.ml.config import CHAIN_ID

app = FastAPI()

# ==========================================
# 🚨 CRITICAL: CORS MIDDLEWARE (Do Not Delete)
# This allows the Frontend (Port 3000) to talk to Backend (Port 8000)
# ==========================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins (frontend, curl, etc.)
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# ⚠️ YOUR API KEY HERE
ETHERSCAN_API_KEY = "PTTZA4C2JB9VYZU4PJRRSMEGV82MXAYS59"

def get_transactions(address):
    # V2 URL for Etherscan — using Base Sepolia via CHAIN_ID
    url = f"https://api.etherscan.io/v2/api?chainid={CHAIN_ID}&module=account&action=txlist&address={address}&startblock=0&endblock=99999999&sort=desc&apikey={ETHERSCAN_API_KEY}"
    
    try:
        print(f"📡 Fetching data for: {address}...") 
        response = requests.get(url)
        data = response.json()
        
        if data["message"] != "OK":
            print(f"❌ ETHERSCAN ERROR: {data['message']}") 
            return [] 
            
        print(f"✅ Success! Fetched {len(data['result'])} transactions.")
        return data["result"][:50]
        
    except Exception as e:
        print(f"🔥 CRITICAL ERROR: {e}")
        return []

@app.get("/")
def home():
    return {"status": "Kryptos Backend Running", "chain": "Base Sepolia"}

# In backend/main.py

@app.get("/analyze/{address}")
def analyze_wallet(address: str):
    # 1. Force the input address to lowercase immediately
    target_address = address.lower()
    
    txs = get_transactions(target_address)
    
    # Mock fallback
    if not txs:
        print("⚠️ Using MOCK DATA.")
        txs = [
            {"from": target_address, "to": "0xscamwallet1", "value": "5000000000000000000"},
            {"from": "0xvictim1", "to": target_address, "value": "10000000000000000000"},
        ]

    nodes = []
    links = []
    seen_nodes = set()
    
    # 2. Add Target Node (LOWERCASE)
    nodes.append({"id": target_address, "group": "suspect", "val": 20})
    seen_nodes.add(target_address)
    
    for tx in txs:
        # 3. Force transaction addresses to lowercase
        tx_from = tx["from"].lower()
        tx_to = tx["to"].lower()
        
        # Determine neighbor
        if tx_from == target_address:
            neighbor = tx_to
            direction = "out"
        else:
            neighbor = tx_from
            direction = "in"
            
        if neighbor and neighbor not in seen_nodes:
            # 4. Add Neighbor Node (LOWERCASE)
            nodes.append({"id": neighbor, "group": "neighbor", "val": 10})
            seen_nodes.add(neighbor)
            
            # 5. Add Link (LOWERCASE)
            links.append({
                "source": tx_from,
                "target": tx_to,
                "value": float(tx["value"]) / 10**18,
                "type": direction
            })
            
    return {
        "risk_score": 85, 
        "graph": {
            "nodes": nodes,
            "links": links
        }
    }