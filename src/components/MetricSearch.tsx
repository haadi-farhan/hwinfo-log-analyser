import React, { useState, useEffect, useRef } from "react";
import { Search, ChevronDown, X, Layers, Thermometer, Zap, Activity, Cpu, Gauge } from "lucide-react";
import { MetricHeader } from "../types";

interface MetricSearchProps {
  headers: MetricHeader[];
  activeMetric: MetricHeader | null;
  onSelect: (metric: MetricHeader) => void;
}

export default function MetricSearch({
  headers,
  activeMetric,
  onSelect,
  isCompact = false,
}: MetricSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSelect = (metric: MetricHeader) => {
    onSelect(metric);
    setSearchQuery("");
    setIsOpen(false);
  };

  // Filter headers based on search query
  const filteredHeaders = headers.filter((h) => {
    const q = searchQuery.toLowerCase();
    return (
      h.fullName.toLowerCase().includes(q) ||
      (h.unit && h.unit.toLowerCase().includes(q))
    );
  });

  // Category classification helper
  const getCategory = (h: MetricHeader): string => {
    const unit = h.unit.toLowerCase();
    const name = h.fullName.toLowerCase();

    if (unit === "°c" || unit === "°f" || name.includes("temp") || name.includes("thermal")) {
      return "Temperatures";
    }
    if (unit === "w" || name.includes("power") || name.includes("package")) {
      return "Power Draw";
    }
    if (unit === "v" || name.includes("volt") || name.includes("vid")) {
      return "Voltages";
    }
    if (unit === "%" || name.includes("load") || name.includes("usage") || name.includes("utility")) {
      return "Utilisation & Load";
    }
    if (unit === "mhz" || unit === "ghz" || name.includes("clock") || name.includes("frequency")) {
      return "Clock Frequencies";
    }
    if (unit === "mb" || unit === "gb" || name.includes("memory") || name.includes("ram")) {
      return "Memory (RAM/VRAM)";
    }
    if (unit === "rpm" || name.includes("fan") || name.includes("speed")) {
      return "Fans & Coolers";
    }
    return "Other Metrics";
  };

  // Group metrics by category
  const categories: { [key: string]: MetricHeader[] } = {};
  filteredHeaders.forEach((h) => {
    const cat = getCategory(h);
    if (!categories[cat]) {
      categories[cat] = [];
    }
    categories[cat].push(h);
  });

  // Order categories logically
  const categoryOrder = [
    "Temperatures",
    "Utilisation & Load",
    "Power Draw",
    "Voltages",
    "Clock Frequencies",
    "Memory (RAM/VRAM)",
    "Fans & Coolers",
    "Other Metrics",
  ];

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case "Temperatures": return <Thermometer className="w-3.5 h-3.5 text-red-400" />;
      case "Power Draw": return <Zap className="w-3.5 h-3.5 text-amber-400" />;
      case "Voltages": return <Cpu className="w-3.5 h-3.5 text-purple-400" />;
      case "Utilisation & Load": return <Activity className="w-3.5 h-3.5 text-cyan-400" />;
      case "Clock Frequencies": return <Gauge className="w-3.5 h-3.5 text-emerald-400" />;
      default: return <Layers className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <div className={`flex flex-col relative ${isCompact ? 'w-40' : 'space-y-2'}`} ref={containerRef} id="metric-search-wrapper">
      {!isCompact && (
        <label className="text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider block">
          Search or Select Any Logged Metric
        </label>
      )}

      <div className="relative">
        <div className={`flex items-center bg-slate-950 border border-slate-800 focus-within:border-cyan-500/50 transition-all duration-300 ${isCompact ? 'rounded-lg h-8' : 'rounded-xl'}`}>
          <div className="pl-2.5 text-slate-500 shrink-0">
            <Search className="w-3.5 h-3.5" />
          </div>

          <input
            type="text"
            placeholder={activeMetric ? (isCompact ? activeMetric.name : `Selected: ${activeMetric.fullName}`) : "Search metrics..."}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            className={`w-full h-full bg-transparent text-slate-200 px-2 text-xs placeholder-slate-500 font-medium focus:outline-none truncate ${isCompact ? 'py-0' : 'py-3'}`}
            id="metric-search-input"
          />

          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="p-1 hover:bg-slate-900 rounded text-slate-400 hover:text-white mr-1"
            >
              <X className="w-3 h-3" />
            </button>
          )}

          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`border-l h-full border-slate-900 text-slate-400 flex items-center justify-center hover:text-white transition-colors shrink-0 ${isCompact ? 'px-2' : 'p-3'}`}
            id="toggle-metric-dropdown-btn"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
          </button>
        </div>

        {/* Dropdown Container */}
        {isOpen && (
          <div
            className="absolute top-full left-0 right-0 mt-1.5 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-72"
            id="metric-dropdown-menu"
          >
            {/* Scrollable list */}
            <div className="overflow-y-auto py-1.5 custom-scrollbar">
              {filteredHeaders.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500 font-mono">
                  No matching metrics found.
                </div>
              ) : (
                categoryOrder.map((cat) => {
                  const items = categories[cat];
                  if (!items || items.length === 0) return null;

                  return (
                    <div key={cat} className="mb-2">
                      {/* Group Header */}
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-900/30">
                        {getCategoryIcon(cat)}
                        <span className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-wider">
                          {cat} ({items.length})
                        </span>
                      </div>

                      {/* Group Items */}
                      <div className="mt-1 space-y-px">
                        {items.map((item) => {
                          const isActive = activeMetric?.index === item.index;
                          return (
                            <button
                              key={item.index}
                              onClick={() => handleSelect(item)}
                              className={`w-full flex items-center justify-between px-4 py-2 text-left text-xs transition-colors ${
                                isActive
                                  ? "bg-cyan-500/10 text-cyan-400 font-semibold"
                                  : "text-slate-300 hover:bg-slate-900 hover:text-white"
                              }`}
                              id={`dropdown-item-${item.index}`}
                            >
                              <span className="truncate pr-4">{item.name}</span>
                              {item.unit && (
                                <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border leading-none ${
                                  isActive
                                    ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                                    : "bg-slate-900 text-slate-400 border-slate-800"
                                }`}>
                                  {item.unit}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Dropdown Footer */}
            <div className="border-t border-slate-900 bg-slate-950/80 px-3 py-1.5 flex items-center justify-between text-[10px] font-mono text-slate-600">
              <span>Showing {filteredHeaders.length} of {headers.length} channels</span>
              <span>ESC to close</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
