"use client";

import { useMemo } from "react";
import { ArrowUpRight, ArrowDownLeft, TrendingUp } from "lucide-react";

type TimelineEntry = {
  date: string;
  tx_count: number;
  volume: number;
  in_count: number;
  out_count: number;
};

type TimelineProps = {
  data: TimelineEntry[];
  native: string;
};

export default function Timeline({ data, native }: TimelineProps) {
  const maxTx = useMemo(() => Math.max(...data.map((d) => d.tx_count), 1), [data]);
  const maxVol = useMemo(() => Math.max(...data.map((d) => d.volume), 0.001), [data]);
  const totalVolume = useMemo(() => data.reduce((s, d) => s + d.volume, 0), [data]);
  const totalTx = useMemo(() => data.reduce((s, d) => s + d.tx_count, 0), [data]);
  const peakDay = useMemo(() => data.reduce((a, b) => (b.tx_count > a.tx_count ? b : a), data[0]), [data]);

  if (!data || data.length === 0) {
    return (
      <div className="border-2 border-black rounded-xl p-8 text-center text-gray-400 text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white">
        No timeline data available
      </div>
    );
  }

  return (
    <div className="border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white overflow-hidden">
      {/* Summary Stats */}
      <div className="flex gap-6 px-5 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-1.5 text-xs">
          <TrendingUp size={12} className="text-gray-400" />
          <span className="text-gray-500">Period:</span>
          <span className="font-mono font-bold text-black">{data.length} days</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <ArrowUpRight size={12} className="text-gray-400" />
          <span className="text-gray-500">Total Txns:</span>
          <span className="font-mono font-bold text-black">{totalTx}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <ArrowDownLeft size={12} className="text-gray-400" />
          <span className="text-gray-500">Volume:</span>
          <span className="font-mono font-bold text-black">{totalVolume.toFixed(4)} {native}</span>
        </div>
        {peakDay && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-gray-500">Peak:</span>
            <span className="font-mono font-bold text-black">{peakDay.date} ({peakDay.tx_count} txns)</span>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="px-5 py-4">
        {/* Activity bar chart */}
        <div className="flex items-end gap-[2px] h-32">
          {data.map((entry, i) => {
            const barHeight = (entry.tx_count / maxTx) * 100;
            const outPct = entry.tx_count > 0 ? (entry.out_count / entry.tx_count) * 100 : 0;
            return (
              <div
                key={i}
                className="flex-1 flex flex-col justify-end group relative min-w-[3px]"
                title={`${entry.date}\n${entry.tx_count} txns (${entry.in_count} in / ${entry.out_count} out)\n${entry.volume.toFixed(4)} ${native}`}
              >
                {/* Tooltip */}
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 pointer-events-none">
                  <div className="bg-black text-white text-[10px] px-2 py-1.5 rounded-md whitespace-nowrap shadow-lg">
                    <p className="font-bold">{entry.date}</p>
                    <p>{entry.tx_count} txns · {entry.volume.toFixed(4)} {native}</p>
                    <p className="text-gray-300">{entry.in_count} in / {entry.out_count} out</p>
                  </div>
                </div>
                {/* Bar — gradient shows in/out ratio */}
                <div
                  className="w-full rounded-t-sm transition-all duration-300 hover:opacity-80 cursor-pointer"
                  style={{
                    height: `${Math.max(barHeight, 2)}%`,
                    background: `linear-gradient(to top, #000 ${outPct}%, #9ca3af ${outPct}%)`,
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* X-axis labels (first, mid, last) */}
        <div className="flex justify-between mt-2">
          <span className="text-[10px] text-gray-400 font-mono">{data[0]?.date}</span>
          {data.length > 2 && (
            <span className="text-[10px] text-gray-400 font-mono">{data[Math.floor(data.length / 2)]?.date}</span>
          )}
          <span className="text-[10px] text-gray-400 font-mono">{data[data.length - 1]?.date}</span>
        </div>

        {/* Legend */}
        <div className="flex gap-4 mt-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-black rounded-sm" />
            <span className="text-[10px] text-gray-500">Outgoing</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-gray-400 rounded-sm" />
            <span className="text-[10px] text-gray-500">Incoming</span>
          </div>
        </div>

        {/* Volume sparkline */}
        <div className="mt-4">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1">
            Volume ({native})
          </p>
          <div className="flex items-end gap-[2px] h-12">
            {data.map((entry, i) => {
              const h = (entry.volume / maxVol) * 100;
              return (
                <div
                  key={i}
                  className="flex-1 bg-gray-200 hover:bg-gray-400 rounded-t-sm transition-colors min-w-[3px] cursor-pointer"
                  style={{ height: `${Math.max(h, 2)}%` }}
                  title={`${entry.date}: ${entry.volume.toFixed(4)} ${native}`}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
