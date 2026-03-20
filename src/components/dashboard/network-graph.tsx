"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import dynamic from "next/dynamic";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

export interface NetworkNode {
  id: string | number;
  group: string;
  val: number;
  label?: string | null;
}

export interface NetworkLink {
  source: string | number | NetworkNode;
  target: string | number | NetworkNode;
  value: number;
  type: string;
}

export interface TimelineEntry {
  date: string;
  timestamp?: number;
  tx_count: number;
  volume: number;
  in_count: number;
  out_count: number;
}

interface NetworkGraphProps {
  nodes: NetworkNode[];
  links: NetworkLink[];
  timeline?: TimelineEntry[];
  width?: number;
  height?: number;
  mode?: "2d";
}

const getGroupColor = (group: string): string => {
  const colors: Record<string, string> = {
    suspect: "#FF3B3B",
    scam: "#FF3B3B",
    high_risk: "#FF6B6B",
    medium_risk: "#FFB800",
    low_risk: "#00FF94",
    safe: "#00FF94",
    exchange: "#00BFFF",
    defi: "#9B59B6",
    nft: "#E91E63",
    bridge: "#FF9800",
    mixer: "#FF5722",
    notable: "#00FF94",
    neighbor: "#C9D1D9",
    unknown: "#AAB3BC",
  };
  return colors[group?.toLowerCase() || ""] || "#AAB3BC";
};

const toNodeId = (id: string | number | undefined | null): string =>
  id == null ? "" : String(id);

const toLinkEndpoint = (endpoint: string | number | NetworkNode): string => {
  if (typeof endpoint === "string" || typeof endpoint === "number") {
    return String(endpoint);
  }
  return toNodeId(endpoint.id);
};

export default function NetworkGraph({
  nodes,
  links,
  timeline,
  width: propWidth,
  height: propHeight,
  mode = "2d",
}: NetworkGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({
    width: propWidth || 800,
    height: propHeight || 420,
  });
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width: containerWidth, height: containerHeight } =
          containerRef.current.getBoundingClientRect();
        if (containerWidth > 0 && containerHeight > 0) {
          setDimensions({ width: containerWidth, height: containerHeight });
        }
      }
    };
    // Small delay so the container has been painted and has real dimensions
    const raf = requestAnimationFrame(updateDimensions);
    const resizeObserver = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
    };
  }, [propWidth, propHeight]);

  const width = dimensions.width;
  const height = dimensions.height;

  const handleNodeClick = useCallback((node: any) => {
    setSelectedNode(node);
  }, []);

  const hasNodes = nodes && nodes.length > 0;

  if (!hasNodes) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-lg bg-[#0A0A0A]">
        <p className="text-sm text-gray-500">No graph data available</p>
      </div>
    );
  }

  const graphNodes = nodes.map((n) => ({
    ...n,
    id: toNodeId(n.id),
    group: n.group || "unknown",
    val: n.val || 5,
  }));

  const graphLinks = links.map((l) => ({
    ...l,
    source: toLinkEndpoint(l.source),
    target: toLinkEndpoint(l.target),
  }));

  const centerNode = graphNodes.find((n) => n.val >= 15) || graphNodes[0];
  const centerIndex = graphNodes.findIndex((n) => n.id === centerNode?.id);

  // Use the resolved dimensions for centring so nodes always appear in the
  // middle of the visible canvas even on the very first paint.
  const cx = width / 2;
  const cy = height / 2;

  const positionedNodes = graphNodes.map((n, i) => {
    if (i === centerIndex || (centerIndex === -1 && i === 0)) {
      return { ...n, fx: cx, fy: cy };
    }
    const nodeIndex = i < centerIndex ? i : i - 1;
    const layer = Math.floor(nodeIndex / 6);
    const angleInLayer = ((nodeIndex % 6) / 6) * Math.PI * 2;
    const radius = 60 + layer * 50;
    const angle = angleInLayer + layer * 0.5;
    return {
      ...n,
      fx: cx + Math.cos(angle) * radius,
      fy: cy + Math.sin(angle) * radius,
    };
  });

  return (
    <div
      ref={containerRef}
      className="h-full w-full rounded-lg bg-[#0A0A0A] overflow-hidden"
    >
      <ForceGraph2D
        graphData={{ nodes: positionedNodes, links: graphLinks }}
        width={width}
        height={height}
        backgroundColor="#0A0A0A"
        nodeColor={(node: any) => getGroupColor(node.group)}
        nodeRelSize={6}
        nodeVal={(node: any) => Math.max(4, Number(node.val) || 4)}
        nodeLabel={(node: any) => {
          const idText = String(node.id ?? "");
          return String(node.label || `${idText.slice(0, 8)}...`);
        }}
        linkColor={() => "#64748B"}
        linkWidth={1.8}
        linkOpacity={0.6}
        linkDirectionalArrowLength={3}
        linkDirectionalArrowRelPos={1}
        onNodeClick={handleNodeClick}
        cooldownTicks={150}
        d3AlphaDecay={0.03}
        d3VelocityDecay={0.2}
      />
    </div>
  );
}
