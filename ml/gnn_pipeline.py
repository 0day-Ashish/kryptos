import pandas as pd
import torch
import torch.nn.functional as F
from torch_geometric.data import Data
from torch_geometric.nn import SAGEConv
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split

print("Loading data...")

# =========================
# LOAD DATA
# =========================
df = pd.read_csv("../data/wallet_features_graph_hard.csv")
edges = pd.read_csv("../data/wallet_edges.csv")

print("DF:", df.shape)
print("Edges:", edges.shape)

# =========================
# CLEAN + PREP
# =========================
print("Cleaning data...")

feature_cols = [col for col in df.columns if col not in ["address", "label"]]

df = df.dropna(subset=["address", "label"]).copy()
df = df.drop_duplicates(subset=["address"]).reset_index(drop=True)

# Ensure numeric + finite
for col in feature_cols:
    df[col] = pd.to_numeric(df[col], errors="coerce")

df[feature_cols] = df[feature_cols].replace([float("inf"), float("-inf")], float("nan"))
df[feature_cols] = df[feature_cols].fillna(0.0)

# =========================
# NODE MAPPING
# =========================
print("Creating node mapping...")

address_to_idx = {addr: i for i, addr in enumerate(df["address"].values)}

print("Total nodes:", len(address_to_idx))

# =========================
# BUILD EDGE INDEX
# =========================
print("Building edge index...")

edge_src = edges["from_address"].map(address_to_idx)
edge_dst = edges["to_address"].map(address_to_idx)

edge_mask = edge_src.notna() & edge_dst.notna()

edge_index_df = pd.DataFrame({
    "src": edge_src[edge_mask].astype("int64"),
    "dst": edge_dst[edge_mask].astype("int64"),
}).drop_duplicates()

if edge_index_df.empty:
    edge_index = torch.empty((2, 0), dtype=torch.long)
else:
    edge_index = torch.tensor(
        edge_index_df[["src", "dst"]].values,
        dtype=torch.long
    ).t().contiguous()

print("Edge index shape:", edge_index.shape)

# =========================
# FEATURES (X)
# =========================
print("Preparing node features...")

scaler = StandardScaler()
df[feature_cols] = scaler.fit_transform(df[feature_cols])

X = torch.tensor(df[feature_cols].values, dtype=torch.float)

# =========================
# LABELS (y)
# =========================
label_values = df["label"].values
unique_labels = sorted(pd.unique(label_values))
label_to_idx = {label: idx for idx, label in enumerate(unique_labels)}

y = torch.tensor([label_to_idx[label] for label in label_values], dtype=torch.long)

print("Feature matrix:", X.shape)
print("Labels:", y.shape)
print("Label mapping:", label_to_idx)

# =========================
# CREATE GRAPH
# =========================
data = Data(x=X, edge_index=edge_index, y=y)

print(data)

# =========================
# TRAIN / TEST MASK
# =========================
print("Creating train/test split...")

num_nodes = X.shape[0]
indices = list(range(num_nodes))

train_idx, test_idx = train_test_split(
    indices,
    test_size=0.2,
    stratify=y.numpy(),
    random_state=42
)

train_mask = torch.zeros(num_nodes, dtype=torch.bool)
test_mask = torch.zeros(num_nodes, dtype=torch.bool)

train_mask[train_idx] = True
test_mask[test_idx] = True

data.train_mask = train_mask
data.test_mask = test_mask

print("Train nodes:", train_mask.sum().item())
print("Test nodes:", test_mask.sum().item())

# =========================
# DEFINE MODEL (GraphSAGE)
# =========================
class GraphSAGE(torch.nn.Module):
    def __init__(self, in_channels, hidden_channels):
        super().__init__()
        self.conv1 = SAGEConv(in_channels, hidden_channels)
        self.conv2 = SAGEConv(hidden_channels, hidden_channels)
        self.lin = torch.nn.Linear(hidden_channels, 2)

    def forward(self, x, edge_index):
        x = self.conv1(x, edge_index)
        x = F.relu(x)

        x = self.conv2(x, edge_index)
        x = F.relu(x)

        x = self.lin(x)

        return x

# =========================
# INIT MODEL
# =========================
model = GraphSAGE(in_channels=X.shape[1], hidden_channels=64)

optimizer = torch.optim.Adam(
    model.parameters(),
    lr=0.001,
    weight_decay=1e-4
)

# =========================
# TRAIN
# =========================
print("Training GraphSAGE...")

model.train()

for epoch in range(50):
    optimizer.zero_grad()

    out = model(data.x, data.edge_index)

    loss = F.cross_entropy(
        out[data.train_mask],
        data.y[data.train_mask]
    )

    loss.backward()

    torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)

    optimizer.step()

    if epoch % 10 == 0:
        print(f"Epoch {epoch}, Loss: {loss.item():.4f}")

# =========================
# EVALUATE
# =========================
print("Evaluating...")

model.eval()

with torch.no_grad():
    out = model(data.x, data.edge_index)
    pred = out.argmax(dim=1)

# Test accuracy
test_correct = (pred[data.test_mask] == data.y[data.test_mask]).sum()
test_total = data.test_mask.sum()

test_acc = int(test_correct) / int(test_total)

# Train accuracy
train_correct = (pred[data.train_mask] == data.y[data.train_mask]).sum()
train_total = data.train_mask.sum()

train_acc = int(train_correct) / int(train_total)

print("Train Accuracy:", train_acc)
print("Test Accuracy :", test_acc)

# =========================
# SAVE MODEL
# =========================
torch.save(model.state_dict(), "../models/gnn_model.pt")

print("✅ Done!")
print("Saving GNN predictions...")

model.eval()

with torch.no_grad():
    out = model(data.x, data.edge_index)
    probs = torch.softmax(out, dim=1)[:, 1]  # scam probability

gnn_df = pd.DataFrame({
    "address": df["address"].values,
    "gnn_score": probs.numpy()
})

gnn_df.to_csv("../data/gnn_predictions.csv", index=False)

print("✅ GNN predictions saved!")