"use client";

import dynamic from "next/dynamic";
import { useState, useRef, useEffect, useCallback } from "react";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

/* Category → color map */
const CATEGORY_COLORS: Record<string, string> = {
  suspect: "#000000",
  exchange: "#2563eb",
  dex: "#7c3aed",
  bridge: "#ea580c",
  defi: "#16a34a",
  mixer: "#dc2626",
  stablecoin: "#0891b2",
  nft: "#d946ef",
  other: "#6b7280",
  neighbor: "#d1d5db",
};

type GraphProps = {
  address: string;
  graphData?: { nodes: any[]; links: any[] };
};

export default function Graph({ address, graphData: externalData }: GraphProps) {
  const [graphData, setGraphData] = useState<{ nodes: any[]; links: any[] }>({ nodes: [], links: [] });
  const graphRef = useRef<any>(null);

  useEffect(() => {
    if (externalData && externalData.nodes.length > 0) {
      setGraphData(externalData);
      return;
    }
    if (!address) return;
    fetch(`http://127.0.0.1:8000/analyze/${address}`)
      .then((res) => res.json())
      .then((data) => setGraphData(data.graph))
      .catch((err) => console.error("Failed to fetch graph:", err));
  }, [address, externalData]);

  /* Custom node renderer with labels */
  const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const label = node.label || "";
    const group = node.group || "neighbor";
    const color = CATEGORY_COLORS[group] || CATEGORY_COLORS.neighbor;
    const isSuspect = group === "suspect";
    const radius = isSuspect ? 6 : label ? 4 : 3;

    // Node circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    if (isSuspect || group === "mixer") {
      ctx.strokeStyle = isSuspect ? "#000" : "#dc2626";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Draw label for labeled nodes when zoomed in enough
    if (label && globalScale > 1.2) {
      const fontSize = Math.min(12 / globalScale, 4);
      ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = color === "#d1d5db" ? "#6b7280" : color;
      ctx.fillText(label, node.x, node.y + radius + 1);
    }
  }, []);

  /* Tooltip */
  const nodeTooltip = useCallback((node: any) => {
    const addr = node.id || "";
    const short = addr.length > 12 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr;
    const label = node.label ? `<strong>${node.label}</strong><br/>` : "";
    const cat = node.group && node.group !== "neighbor" ? `<em style="color:${CATEGORY_COLORS[node.group] || "#999"}">${node.group}</em><br/>` : "";
    return `<div style="background:#000;color:#fff;padding:6px 10px;border-radius:6px;font-size:11px;max-width:220px">${label}${cat}<code>${short}</code></div>`;
  }, []);

  const [bgColor, setBgColor] = useState("#ffffff");

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setBgColor(isDark ? "#09090b" : "#ffffff");
    const observer = new MutationObserver(() => {
      setBgColor(document.documentElement.classList.contains("dark") ? "#09090b" : "#ffffff");
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="border-2 border-[var(--card-border)] rounded-xl overflow-hidden shadow-[4px_4px_0px_0px_var(--shadow)] bg-[var(--card-bg)]">
      <ForceGraph2D
        ref={graphRef}
        graphData={graphData}
        nodeLabel={nodeTooltip}
        nodeCanvasObject={paintNode}
        nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
          const r = node.group === "suspect" ? 8 : 5;
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
        }}
        linkDirectionalArrowLength={3.5}
        linkDirectionalArrowRelPos={1}
        linkWidth={1}
        linkColor={() => bgColor === "#09090b" ? "#71717a" : "#4b5563"}
        backgroundColor={bgColor}
        width={800}
        height={500}
        d3VelocityDecay={0.1}
        cooldownTicks={100}
        onEngineStop={() => graphRef.current?.zoomToFit(400)}
      />
      {/* Legend */}
      <div className="flex flex-wrap gap-3 px-4 py-2 border-t border-[var(--muted)] bg-[var(--muted)]">
        {Object.entries(CATEGORY_COLORS)
          .filter(([k]) => k !== "neighbor")
          .map(([cat, color]) => (
            <div key={cat} className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[10px] text-[var(--muted-fg)] capitalize">{cat}</span>
            </div>
          ))}
      </div>
    </div>
  );
}