"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useRef } from "react";

// Import ForceGraph dynamically to avoid Server-Side Rendering (SSR) issues
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

export default function Graph({ address }: { address: string }) {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const graphRef = useRef<any>(null);

  useEffect(() => {
    if (!address) return;

    // Fetch data from Python Backend
    fetch(`http://127.0.0.1:8000/analyze/${address}`)
      .then((res) => res.json())
      .then((data) => {
        setGraphData(data.graph);
      })
      .catch((err) => console.error("Failed to fetch graph:", err));
  }, [address]);

  return (
    <div className="border border-gray-800 rounded-xl overflow-hidden shadow-2xl shadow-blue-900/20 bg-black">
      <ForceGraph2D
        ref={graphRef}
        graphData={graphData}
        nodeLabel="id"
        
        // 🎨 COLOR LOGIC: Red for Suspect, Blue for others
        nodeColor={(node: any) => (node.group === "suspect" ? "#ef4444" : "#3b82f6")}
        
        // 📏 SIZE LOGIC: Reduce sizes so they don't blob
        nodeVal={(node: any) => (node.group === "suspect" ? 20 : 5)}
        
        // Arrows
        linkDirectionalArrowLength={3.5}
        linkDirectionalArrowRelPos={1}
        linkWidth={1}
        linkColor={() => "#4b5563"}
        
        backgroundColor="#050505"
        width={800}
        height={500}
        
        // 🚀 PHYSICS ENGINE: This spreads them out!
        d3VelocityDecay={0.1} // Lower friction = more movement
        cooldownTicks={100}   // Let it settle
        onEngineStop={() => graphRef.current?.zoomToFit(400)}
      />
    </div>
  );
}