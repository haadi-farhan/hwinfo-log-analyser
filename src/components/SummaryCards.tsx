import React from "react";
import { ArrowUp, ArrowDown, Activity, ArrowUpDown } from "lucide-react";
import { MetricStats, MetricHeader } from "../types";

export interface SummaryCardsProps {
  stats: MetricStats;
  metric: MetricHeader;
}

export default function SummaryCards({ stats, metric }: SummaryCardsProps) {
  const getStyle = (fullName: string, unit: string) => {
    const nameLower = fullName.toLowerCase();
    const unitLower = unit.toLowerCase();

    if (unitLower === "°c" || unitLower === "°f" || nameLower.includes("temperature") || nameLower.includes("temp")) {
      return {
        accentClass: "text-red-400",
        bgClass: "bg-red-500/5 border-red-500/10",
        label: "Peak Heat"
      };
    }
    
    if (unitLower === "w" || nameLower.includes("power")) {
      return {
        accentClass: "text-amber-400",
        bgClass: "bg-amber-500/5 border-amber-500/10",
        label: "Max Draw"
      };
    }

    if (unitLower === "%" || nameLower.includes("load") || nameLower.includes("utility")) {
      return {
        accentClass: "text-cyan-400",
        bgClass: "bg-cyan-500/5 border-cyan-500/10",
        label: "Max Load"
      };
    }

    if (unitLower === "v" || nameLower.includes("volt") || nameLower.includes("vid")) {
      return {
        accentClass: "text-purple-400",
        bgClass: "bg-purple-500/5 border-purple-500/10",
        label: "Max Volts"
      };
    }

    return {
      accentClass: "text-slate-400",
      bgClass: "bg-slate-500/5 border-slate-500/10",
      label: "Maximum"
    };
  };

  const style = getStyle(metric.fullName, metric.unit);
  const unitStr = metric.unit ? ` ${metric.unit}` : "";

  // Helper to format values
  const formatVal = (v: number) => {
    if (v === undefined || isNaN(v)) return "N/A";
    // Check if it's likely a whole number or float
    if (v % 1 === 0) return v.toLocaleString();
    
    // For small decimals (voltages), give 3 decimal places
    if (Math.abs(v) < 2 && Math.abs(v) > 0) {
      return v.toFixed(3);
    }
    return v.toFixed(1);
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" id="summary-cards-container">
      {/* Maximum Card */}
      <div className={`p-4 rounded-xl border bg-slate-950/40 border-slate-800/80 flex flex-col justify-between hover:border-slate-700/80 transition-all ${style.bgClass}`}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
            {style.label}
          </span>
          <div className="p-1 rounded-md bg-slate-900 border border-slate-800">
            <ArrowUp className={`w-3.5 h-3.5 ${style.accentClass}`} />
          </div>
        </div>
        <div className="mt-2.5">
          <span className="text-2xl font-black font-mono text-slate-100 tracking-tight">
            {formatVal(stats.max)}
          </span>
          <span className="text-xs font-mono font-bold text-slate-500 ml-1">
            {unitStr}
          </span>
        </div>
        <span className="text-[10px] text-slate-500 font-mono mt-1">
          Highest recorded value
        </span>
      </div>

      {/* Minimum Card */}
      <div className="p-4 rounded-xl border bg-slate-950/40 border-slate-800/80 flex flex-col justify-between hover:border-slate-700/80 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
            Minimum Reading
          </span>
          <div className="p-1 rounded-md bg-slate-900 border border-slate-800">
            <ArrowDown className="w-3.5 h-3.5 text-cyan-500" />
          </div>
        </div>
        <div className="mt-2.5">
          <span className="text-2xl font-black font-mono text-slate-100 tracking-tight">
            {formatVal(stats.min)}
          </span>
          <span className="text-xs font-mono font-bold text-slate-500 ml-1">
            {unitStr}
          </span>
        </div>
        <span className="text-[10px] text-slate-500 font-mono mt-1">
          Lowest recorded value
        </span>
      </div>

      {/* Average Card */}
      <div className="p-4 rounded-xl border bg-slate-950/40 border-slate-800/80 flex flex-col justify-between hover:border-slate-700/80 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
            Session Average
          </span>
          <div className="p-1 rounded-md bg-slate-900 border border-slate-800">
            <Activity className="w-3.5 h-3.5 text-slate-400" />
          </div>
        </div>
        <div className="mt-2.5">
          <span className="text-2xl font-black font-mono text-slate-100 tracking-tight">
            {formatVal(stats.avg)}
          </span>
          <span className="text-xs font-mono font-bold text-slate-500 ml-1">
            {unitStr}
          </span>
        </div>
        <span className="text-[10px] text-slate-500 font-mono mt-1">
          Mean value over time
        </span>
      </div>

      {/* Median Card */}
      <div className="p-4 rounded-xl border bg-slate-950/40 border-slate-800/80 flex flex-col justify-between hover:border-slate-700/80 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
            Median
          </span>
          <div className="p-1 rounded-md bg-slate-900 border border-slate-800">
            <Activity className="w-3.5 h-3.5 text-emerald-500" />
          </div>
        </div>
        <div className="mt-2.5">
          <span className="text-2xl font-black font-mono text-slate-100 tracking-tight">
            {formatVal(stats.median)}
          </span>
          <span className="text-xs font-mono font-bold text-slate-500 ml-1">
            {unitStr}
          </span>
        </div>
        <span className="text-[10px] text-slate-500 font-mono mt-1">
          Median value
        </span>
      </div>
    </div>
  );
}
