import pandas as pd
import torch
from torch_geometric.data import Data

print("Loading data...")

df = pd.read_csv("../data/wallet_features_graph_hard.csv")
edges = pd.read_csv("../data/wallet_edges.csv")

print(df.shape, edges.shape)