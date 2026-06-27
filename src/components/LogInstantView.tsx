import React, { useState } from "react";
import { DataPoint, MetricHeader } from "../types";

interface LogInstantViewProps {
  point: DataPoint;
  headers: MetricHeader[];
}

export default function LogInstantView({ point, headers }: LogInstantViewProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Group headers to mimic HWiNFO layout
  const grouped = headers.reduce((acc, h) => {
    const category = h.fullName.split(" ")[0]; // Very simple grouping
    if (!acc[category]) acc[category] = [];
    acc[category].push({ header: h, value: point.values[h.index] });
    return acc;
  }, {} as Record<string, { header: MetricHeader; value: number }[]>);

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 mt-2 h-64 overflow-y-auto font-mono text-xs">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-slate-400 font-semibold">Log Snapshot at {point.time}</h3>
        <input
          type="text"
          placeholder="Search metrics..."
          className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white text-[10px] w-40"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {Object.entries(grouped).map(([category, metrics]) => {
          const filteredMetrics = metrics.filter(m => 
            m.header.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            category.toLowerCase().includes(searchQuery.toLowerCase())
          );
          if (filteredMetrics.length === 0) return null;
          return (
            <div key={category} className="border border-slate-800 rounded p-1.5 flex flex-col gap-0.5">
              <h4 className="text-cyan-500 font-bold text-xs mb-0.5 border-b border-slate-800 pb-0.5">{category}</h4>
              {filteredMetrics.map(({ header, value }) => (
                <div key={header.index} className="flex justify-between gap-4 text-[10px]">
                  <span className="text-slate-300">{header.name}</span>
                  <span className="text-white font-mono whitespace-nowrap">{value.toFixed(2)} {header.unit}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
