from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import requests
from backend.ml.config import CHAIN_ID, ETHERSCAN_API_KEY

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_transactions(address):
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

@app.get("/analyze/{address}")
def analyze_wallet(address: str):
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
            
    risk_score = 85

    # Store report on Base
    on_chain = {}
    try:
        on_chain = store_report_on_chain(target_address, risk_score)
        print(f"📝 On-chain report: {on_chain}")
    except Exception as e:
        print(f"⚠️ On-chain write failed (non-fatal): {e}")
        on_chain = {"error": str(e)}

    return {
        "risk_score": risk_score,
        "graph": {
            "nodes": nodes,
            "links": links
        },
        "on_chain": on_chain,
    }


@app.get("/report/{address}")
def get_on_chain_report(address: str):
    """Read an existing on-chain risk report for a wallet."""
    try:
        report = get_report_from_chain(address.lower())
        return report
    except Exception as e:
        return {"error": str(e), "on_chain": False}