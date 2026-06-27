import React from "react";
import { Thermometer, Zap, Activity, Cpu, Percent } from "lucide-react";
import { MetricHeader } from "../types";

interface MetricSuggestionsProps {
  suggestions: MetricHeader[];
  activeMetric: MetricHeader | null;
  onSelect: (metric: MetricHeader) => void;
}

export default function MetricSuggestions({
  suggestions,
  activeMetric,
  onSelect,
}: MetricSuggestionsProps) {
  
  // Helper to determine icon & styles based on unit and name
  const getMetricStyle = (fullName: string, unit: string) => {
    const nameLower = fullName.toLowerCase();
    const unitLower = unit.toLowerCase();

    if (unitLower === "°c" || unitLower === "°f" || nameLower.includes("temperature") || nameLower.includes("temp")) {
      return {
        icon: Thermometer,
        badgeClass: "bg-red-500/10 text-red-400 border-red-500/20",
        activeClass: "bg-red-500/10 border-red-500/50 text-red-100 ring-2 ring-red-500/20",
        hoverClass: "hover:border-red-500/30 hover:bg-red-500/5 text-slate-300",
        indicatorColor: "bg-red-500",
        label: "Temperature"
      };
    }
    
    if (unitLower === "w" || nameLower.includes("power") || nameLower.includes("package power")) {
      return {
        icon: Zap,
        badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        activeClass: "bg-amber-500/10 border-amber-500/50 text-amber-100 ring-2 ring-amber-500/20",
        hoverClass: "hover:border-amber-500/30 hover:bg-amber-500/5 text-slate-300",
        indicatorColor: "bg-amber-500",
        label: "Power Draw"
      };
    }

    if (unitLower === "%" || nameLower.includes("load") || nameLower.includes("utility") || nameLower.includes("usage")) {
      return {
        icon: Activity,
        badgeClass: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
        activeClass: "bg-cyan-500/10 border-cyan-500/50 text-cyan-100 ring-2 ring-cyan-500/20",
        hoverClass: "hover:border-cyan-500/30 hover:bg-cyan-500/5 text-slate-300",
        indicatorColor: "bg-cyan-500",
        label: "Utilization"
      };
    }

    if (unitLower === "v" || nameLower.includes("volt") || nameLower.includes("vid")) {
      return {
        icon: Cpu,
        badgeClass: "bg-purple-500/10 text-purple-400 border-purple-500/20",
        activeClass: "bg-purple-500/10 border-purple-500/50 text-purple-100 ring-2 ring-purple-500/20",
        hoverClass: "hover:border-purple-500/30 hover:bg-purple-500/5 text-slate-300",
        indicatorColor: "bg-purple-500",
        label: "Voltage"
      };
    }

    return {
      icon: Percent,
      badgeClass: "bg-slate-500/10 text-slate-400 border-slate-500/20",
      activeClass: "bg-slate-500/15 border-slate-500/50 text-slate-100 ring-2 ring-slate-500/10",
      hoverClass: "hover:border-slate-500/30 hover:bg-slate-500/5 text-slate-300",
      indicatorColor: "bg-slate-500",
      label: "Metric"
    };
  };

  return (
    <div className="flex flex-col space-y-2" id="metric-suggestions-container">
      <div className="flex items-center justify-between gap-2 pb-1">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-cyan-400">
            Suggested Primary Metrics
          </span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {suggestions.map((metric) => {
          const style = getMetricStyle(metric.fullName, metric.unit);
          const IconComponent = style.icon;
          const isActive = activeMetric?.index === metric.index;

          return (
            <button
              key={metric.index}
              onClick={() => onSelect(metric)}
              className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition-all duration-300 text-xs ${
                isActive ? style.activeClass : `bg-slate-950/40 border-slate-800/80 ${style.hoverClass}`
              }`}
              id={`suggestion-chip-${metric.index}`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`p-2 rounded-lg border ${style.badgeClass} shrink-0`}>
                  <IconComponent className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="block text-[10px] font-mono text-slate-500 uppercase font-semibold">
                    {style.label}
                  </span>
                  <h3 className="font-semibold text-slate-200 truncate pr-1">
                    {metric.name}
                  </h3>
                </div>
              </div>

              {metric.unit && (
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ml-2 ${style.badgeClass}`}>
                  {metric.unit}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
