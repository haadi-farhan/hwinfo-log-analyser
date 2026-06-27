import React, { useState, useMemo } from "react";
import { 
  AlertTriangle, 
  ArrowLeft, 
  Calendar, 
  Clock, 
  Database, 
  Activity, 
  X, 
  HelpCircle,
  BarChart2,
  Cpu,
  Plus
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ParsedLog, MetricHeader } from "./types";
import { getTopSuggestions, calculateStats } from "./utils/parser";
import UploadZone from "./components/UploadZone";
import MetricSuggestions from "./components/MetricSuggestions";
import MetricSearch from "./components/MetricSearch";
import SummaryCards from "./components/SummaryCards";
import LogChart from "./components/LogChart";
import AboutProject from "./components/AboutProject";

export default function App() {
  const [parsedLog, setParsedLog] = useState<ParsedLog | null>(null);
  const [activeMetrics, setActiveMetrics] = useState<MetricHeader[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showAbout, setShowAbout] = useState(false);

  // Auto-extract recommendations based on heuristics
  const suggestedMetrics = useMemo(() => {
    if (!parsedLog) return [];
    return getTopSuggestions(parsedLog.headers);
  }, [parsedLog]);

  // Handle successful CSV parsing
  const handleLogParsed = async (log: ParsedLog) => {
    setParsedLog(log);
    setError(null);
    
    // Default selection is the first suggested metric, or first overall header
    const suggestions = getTopSuggestions(log.headers);
    if (suggestions.length > 0) {
      setActiveMetrics([suggestions[0]]);
    } else if (log.headers.length > 0) {
      setActiveMetrics([log.headers[0]]);
    }
  };

  // Clean application state to load a new file
  const handleReset = () => {
    setParsedLog(null);
    setActiveMetrics([]);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-slate-900">
      {/* Background radial highlight glow */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-950/20 via-slate-950 to-slate-950 pointer-events-none z-0" />

      {/* Main Container */}
      <main className="flex-1 relative z-10 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col">
        {/* Error Alert Bar */}
        <AnimatePresence mode="wait">
          {showAbout ? (
            <AboutProject key="about" onBack={() => setShowAbout(false)} />
          ) : !parsedLog ? (
            /* Landing Screen with drag-and-drop zone */
            <motion.div 
              key="landing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex items-center justify-center"
            >
              <UploadZone onLogParsed={handleLogParsed} onShowAbout={() => setShowAbout(true)} onError={setError} />
            </motion.div>
          ) : (
            /* Dashboard Analysis Screen */
            <motion.div
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="flex-1 flex flex-col space-y-5"
              id="dashboard-main-view"
            >
            {/* Navigation / Header bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/40 border border-slate-800/80 p-4 rounded-2xl shadow-md">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleReset}
                  className="flex items-center justify-center p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-all active:scale-95 group"
                  title="Upload another HWiNFO log file"
                  id="back-to-upload-btn"
                >
                  <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <Cpu className="w-6 h-6 text-cyan-400 animate-pulse" />
                    <h1 className="text-2xl font-extrabold tracking-tight text-white">
                      HWiNFO Log Analyser
                    </h1>
                  </div>
                </div>
              </div>

              {/* Log Session Metadata Block */}
              <div className="flex flex-wrap items-center gap-4 bg-slate-950/55 px-4 py-2.5 rounded-xl border border-slate-800/80 text-[11px] font-mono text-slate-400">
                <span className="flex items-center gap-1.5" title="Recording Date">
                  <Calendar className="w-3.5 h-3.5 text-cyan-500" />
                  <span className="font-semibold text-slate-300">{parsedLog.dateRangeText}</span>
                </span>
                <span className="hidden md:inline text-slate-700">•</span>
                <span className="flex items-center gap-1.5" title="Log Duration">
                  <Clock className="w-3.5 h-3.5 text-cyan-500" />
                  <span className="font-semibold text-slate-300">{parsedLog.durationText}</span>
                </span>
                <span className="hidden md:inline text-slate-700">•</span>
                <span className="flex items-center gap-1.5" title="Total Samples Loaded">
                  <Database className="w-3.5 h-3.5 text-cyan-500" />
                  <span className="font-semibold text-slate-300">{parsedLog.sampleCount.toLocaleString()} samples</span>
                </span>
              </div>
            </div>

            {/* Dashboard Content Grid */}
            <div className="flex flex-col space-y-8">
              {activeMetrics.map((metric, index) => {
                const stats = calculateStats(parsedLog.dataPoints, metric.index);
                return (
                  <div key={`${metric.index}-${index}`} className="flex flex-col space-y-5">
                    {/* 1. Large prominent Interactive Chart */}
                    <LogChart 
                      rawPoints={parsedLog.dataPoints} 
                      metric={metric} 
                      stats={stats} 
                      headers={parsedLog.headers}
                      onSelectMetric={(newMetric) => {
                        const newMetrics = [...activeMetrics];
                        newMetrics[index] = newMetric;
                        setActiveMetrics(newMetrics);
                      }}
                      onRemove={activeMetrics.length > 1 ? () => {
                        const newMetrics = [...activeMetrics];
                        newMetrics.splice(index, 1);
                        setActiveMetrics(newMetrics);
                      } : undefined}
                    />

                    {/* 2. Visual summary statistic cards */}
                    <SummaryCards stats={stats} metric={metric} />
                  </div>
                );
              })}
              
              {activeMetrics.length > 0 && activeMetrics.length < 5 && (
                <div className="flex justify-end">
                  <button 
                    onClick={() => setActiveMetrics([...activeMetrics, activeMetrics[activeMetrics.length - 1]])}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white hover:border-slate-700 transition-colors text-xs font-mono font-bold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Graph
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
        </AnimatePresence>
      </main>

      {/* Humble aesthetic footer */}
      <footer className="py-6 border-t border-slate-900 bg-slate-950/80 relative z-10">
        <div className="max-w-7xl mx-auto px-4 text-center flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] font-mono text-slate-600">
          <span className="flex items-center gap-1.5 justify-center">
            <BarChart2 className="w-3.5 h-3.5 text-slate-700" />
            <span>HWiNFO Log Analyser v1.0.0 • Built by Haadi Farhan using Google AI Studio</span>
          </span>
          <span>Data Processed Offline</span>
        </div>
      </footer>
    </div>
  );
}

