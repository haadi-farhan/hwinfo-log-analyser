import React, { useState, useEffect, useRef, useMemo } from "react";
import { MoveHorizontal, ZoomIn, ZoomOut, RotateCcw, Maximize2, Gauge, AlertCircle, Sparkles, ToggleLeft, ToggleRight, Thermometer, Zap, Minus } from "lucide-react";
import LogInstantView from "./LogInstantView";
import MetricSearch from "./MetricSearch";
import { DataPoint, MetricHeader, MetricStats } from "../types";
import { downsampleData, calculateStats } from "../utils/parser";

interface LogChartProps {
  rawPoints: DataPoint[];
  metric: MetricHeader;
  stats: MetricStats;
  headers?: MetricHeader[];
  onSelectMetric?: (metric: MetricHeader) => void;
  onRemove?: () => void;
}

export default function LogChart({ rawPoints, metric, stats, headers = [], onSelectMetric, onRemove }: LogChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Dimensions state
  const [dimensions, setDimensions] = useState({ width: 600, height: 350 });

  // Zoom / Range selection (0 to 100 representing percentage of the log)
  const [zoomRange, setZoomRange] = useState<[number, number]>([0, 100]);

  // Hover state
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    time: string;
    value: number;
    originalIndex: number;
    pixelX: number;
    pixelY: number;
  } | null>(null);

  const instantViewRef = useRef<HTMLDivElement>(null);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);

  // Toggle for dynamic scaling vs fixed limit
  const [forceShowLimit, setForceShowLimit] = useState(false);

  // Custom Slider Dragging State
  const sliderRef = useRef<HTMLDivElement>(null);
  const isDraggingLeft = useRef(false);
  const isDraggingRight = useRef(false);
  const isDraggingSegment = useRef(false);
  const dragStartPos = useRef(0);
  const dragStartRange = useRef<[number, number]>([0, 100]);

  useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent) => {
      if (!sliderRef.current) return;
      
      const rect = sliderRef.current.getBoundingClientRect();
      // Calculate percentage (0-100) based on pointer position relative to slider track
      let percent = ((e.clientX - rect.left) / rect.width) * 100;
      percent = Math.max(0, Math.min(100, percent));
      
      if (isDraggingLeft.current) {
        setZoomRange(prev => [Math.min(percent, prev[1] - 5), prev[1]]);
      } else if (isDraggingRight.current) {
        setZoomRange(prev => [prev[0], Math.max(percent, prev[0] + 5)]);
      } else if (isDraggingSegment.current) {
        const delta = percent - dragStartPos.current;
        let newStart = dragStartRange.current[0] + delta;
        let newEnd = dragStartRange.current[1] + delta;
        
        // Clamp to edges
        if (newStart < 0) {
          newEnd -= newStart; // push end by the negative overflow
          newStart = 0;
        }
        if (newEnd > 100) {
          newStart -= (newEnd - 100);
          newEnd = 100;
        }
        
        // Ensure newStart doesn't go below 0 after re-adjustment
        newStart = Math.max(0, newStart);
        newEnd = Math.min(100, newEnd);
        
        setZoomRange([newStart, newEnd]);
      }
    };

    const handleGlobalPointerUp = () => {
      isDraggingLeft.current = false;
      isDraggingRight.current = false;
      isDraggingSegment.current = false;
      document.body.style.userSelect = ""; // restore selection
    };

    window.addEventListener("pointermove", handleGlobalPointerMove);
    window.addEventListener("pointerup", handleGlobalPointerUp);

    return () => {
      window.removeEventListener("pointermove", handleGlobalPointerMove);
      window.removeEventListener("pointerup", handleGlobalPointerUp);
    };
  }, []);

  // 1. Observe container size change (ResizeObserver)
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      
      // Debounce or directly set size. Direct set is fine and feels very snappy!
      setDimensions({
        width: Math.max(width, 300),
        height: Math.max(height, 300)
      });
    });

    resizeObserver.observe(containerRef.current);
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // 2. Filter raw data based on zoom slider range
  const visibleDataRange = useMemo(() => {
    if (rawPoints.length === 0) return { points: [], stats: stats };

    const startIndex = Math.floor((zoomRange[0] / 100) * (rawPoints.length - 1));
    const endIndex = Math.floor((zoomRange[1] / 100) * (rawPoints.length - 1));
    
    // Ensure at least 2 points
    const clampedStart = Math.max(0, Math.min(startIndex, rawPoints.length - 2));
    const clampedEnd = Math.max(clampedStart + 1, Math.min(endIndex, rawPoints.length - 1));

    const slicedPoints = rawPoints.slice(clampedStart, clampedEnd + 1);
    
    // Calculate stats specifically for the visible slice!
    const sliceStats = calculateStats(slicedPoints, metric.index);

    return {
      points: slicedPoints,
      stats: sliceStats,
      startIndex: clampedStart,
      endIndex: clampedEnd
    };
  }, [rawPoints, zoomRange, metric.index, stats]);

  // 3. Downsample the visible points for smooth SVG rendering
  // We target 600 points on screen for smooth interactivity
  const chartPoints = useMemo(() => {
    return downsampleData(visibleDataRange.points, metric.index, 600);
  }, [visibleDataRange.points, metric.index]);

  // Reset zoom range if log file changes
  useEffect(() => {
    setZoomRange([0, 100]);
    setHoveredPoint(null);
    setSelectedPointIndex(null);
  }, [rawPoints]);

  // Handle click to select point
  const handleMouseClick = () => {
    if (hoveredPoint) {
      setSelectedPointIndex(hoveredPoint.originalIndex);
      setTimeout(() => {
        instantViewRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  // 4. Calculate rendering parameters
  const padding = { top: 60, right: 30, bottom: 50, left: 65 };
  const chartWidth = dimensions.width - padding.left - padding.right;
  const chartHeight = dimensions.height - padding.top - padding.bottom;

  // Global limit checks
  const hasAnyThermalLimits = useMemo(() => {
    return headers?.some(h => {
      const hName = h.fullName.toLowerCase();
      return (hName.includes("temp") || hName.includes("thermal") || hName.includes("tctl")) && (hName.includes("limit") || hName.includes("throttling") || hName.includes("tj.max"));
    });
  }, [headers]);

  const hasAnyPowerLimits = useMemo(() => {
      return headers?.some(h => {
          const hName = h.fullName.toLowerCase();
          return hName.includes("power") && (hName.includes("limit") || hName.includes("pl1") || hName.includes("pl2"));
      });
  }, [headers]);

  // Find thermal limit for temperature metrics
  const thermalLimitInfo = useMemo(() => {
    const isTemp = metric.unit === "°C" || metric.unit?.toLowerCase() === "°c" || metric.fullName.toLowerCase().includes("temp") || metric.fullName.toLowerCase().includes("temperature");
    if (!isTemp) return null;

    const nameLower = metric.fullName.toLowerCase();
    const isCpu = nameLower.includes("cpu") || nameLower.includes("tctl") || nameLower.includes("core") || nameLower.includes("package");
    const isGpu = nameLower.includes("gpu");

    let limitHeader: MetricHeader | undefined = undefined;

    // Try to find a valid limit header
    if (headers && headers.length > 0) {
      if (isCpu) {
        // Try to find CPU/Core specific thermal limits in headers
        limitHeader = headers.find(h => {
          const hName = h.fullName.toLowerCase();
          return !hName.includes("distance") && 
                 (hName.includes("cpu") || hName.includes("core") || hName.includes("package") || hName.includes("tctl")) &&
                 (hName.includes("tj.max") || hName.includes("tjmax") || hName.includes("tj max") || hName.includes("limit") || hName.includes("throttling")) &&
                 (h.unit === "°C" || h.unit === "C");
        });
        // Fallback to any Tj.Max column if specific CPU one isn't found
        if (!limitHeader) {
          limitHeader = headers.find(h => {
            const hName = h.fullName.toLowerCase();
            return !hName.includes("distance") && (hName.includes("tj.max") || hName.includes("tjmax") || hName.includes("tj max")) &&
                   (h.unit === "°C" || h.unit === "C");
          });
        }
      } else if (isGpu) {
        // Try to find GPU specific thermal limits in headers
        limitHeader = headers.find(h => {
          const hName = h.fullName.toLowerCase();
          return !hName.includes("distance") && 
                 (hName.includes("gpu") || hName.includes("nvidia") || hName.includes("ati") || hName.includes("amd")) && 
                 (hName.includes("limit") || hName.includes("throttling") || hName.includes("max temp") || hName.includes("target") || hName.includes("thermal")) &&
                 (h.unit === "°C" || h.unit === "C");
        });
      } else {
        // Generic temperature metric, search for any limit header
        limitHeader = headers.find(h => {
          const hName = h.fullName.toLowerCase();
          return !hName.includes("distance") && (hName.includes("limit") || hName.includes("tj.max") || hName.includes("tjmax") || hName.includes("tj max") || hName.includes("throttling")) &&
                 (h.unit === "°C" || h.unit === "C");
        });
      }
    }

    // If no limit header is found in the log, check if we can compute it using "distance to tjmax"
    if (!limitHeader && isCpu) {
      const distanceHeaders = headers.filter(h => {
        const hName = h.fullName.toLowerCase();
        return hName.includes("distance") && (hName.includes("tj.max") || hName.includes("tjmax") || hName.includes("tj max"));
      });

      if (distanceHeaders.length > 0) {
        let computedLimit = -1;

        // Try to find a perfectly matching pair of (Temp, Distance)
        // e.g. "Core 0" and "Core 0 Distance to TjMAX"
        for (const distHdr of distanceHeaders) {
          // Extract the prefix, e.g., "Core 0", "Core Max", "Core Temperatures"
          const prefixMatch = distHdr.name.match(/^(.*?)\s*(?:distance|\[distance)/i);
          const prefix = prefixMatch ? prefixMatch[1].trim().toLowerCase() : "";

          let matchingTempHdr = headers.find(h => {
            const hName = h.name.toLowerCase();
            return !hName.includes("distance") && (h.unit === "°C" || h.unit === "C") && hName === prefix;
          });

          // If strict prefix match fails, fallback to general core temp match
          if (!matchingTempHdr) {
            matchingTempHdr = headers.find(h => {
               const hName = h.fullName.toLowerCase();
               return hName.includes("core") && !hName.includes("distance") && (hName.includes("temp") || hName.includes("max")) && (h.unit === "°C" || h.unit === "C");
            });
          }

          if (!matchingTempHdr) {
            matchingTempHdr = headers.find(h => {
               const hName = h.fullName.toLowerCase();
               return hName.includes("core") && !hName.includes("distance") && (h.unit === "°C" || h.unit === "C");
            });
          }

          const headerToUse = matchingTempHdr || metric;

          for (const dp of rawPoints) {
            const tempVal = dp.values[headerToUse.index];
            const distVal = dp.values[distHdr.index];
            if (tempVal !== undefined && !isNaN(tempVal) && tempVal > 0 && distVal !== undefined && !isNaN(distVal)) {
              computedLimit = Math.round(tempVal + distVal);
              break; 
            }
          }

          if (computedLimit >= 50 && computedLimit <= 150) {
            return {
              limitValue: computedLimit,
              label: "Computed TjMax"
            };
          }
        }
      }
      return null;
    } else if (!limitHeader) {
      return null;
    }

    // Now, find the highest value in the log for this limit column, up to 150
    let highestLimit = -Infinity;
    rawPoints.forEach(dp => {
      const val = dp.values[limitHeader!.index];
      if (val !== undefined && !isNaN(val) && val > highestLimit) {
        highestLimit = val;
      }
    });

    // If we didn't find any valid limit values or they are unreasonable, don't show any line
    if (highestLimit < 50 || highestLimit > 150) {
      return null;
    }

    // Clean label for display
    let label = limitHeader.name || "Thermal Limit";
    if (isCpu && (label.toLowerCase().includes("tj.max") || label.toLowerCase().includes("tjmax") || label.toLowerCase().includes("tj max"))) {
      label = "CPU TjMax";
    } else if (isGpu && (label.toLowerCase().includes("target") || label.toLowerCase().includes("limit"))) {
      label = "GPU Temp Limit";
    }

    return {
      limitValue: highestLimit,
      label,
    };
  }, [metric, headers, rawPoints]);

  // Find power limit for power metrics
  const powerLimitInfo = useMemo(() => {
    const isPower = metric.unit === "W" || metric.unit?.toLowerCase() === "w" || metric.fullName.toLowerCase().includes("power");
    if (!isPower || !headers) return null;

    const nameLower = metric.fullName.toLowerCase();
    const isCpu = nameLower.includes("cpu") || nameLower.includes("package") || nameLower.includes("core");
    const isGpu = nameLower.includes("gpu");

    const powerLimitHeaders = headers.filter(h => {
      const hName = h.fullName.toLowerCase();
      if (h.unit?.toLowerCase() !== "w") return false;
      if (!hName.includes("limit") && !hName.includes("pl1") && !hName.includes("pl2")) return false;
      
      if (isCpu && (hName.includes("cpu") || hName.includes("package") || hName.includes("core") || hName.includes("pl1") || hName.includes("pl2"))) return true;
      if (isGpu && (hName.includes("gpu") || hName.includes("board"))) return true;
      if (!isCpu && !isGpu) return true; // generic power
      
      return false;
    });

    if (powerLimitHeaders.length === 0) return null;

    return powerLimitHeaders.map(h => {
      let min = Infinity;
      let max = -Infinity;
      rawPoints.forEach(dp => {
        const val = dp.values[h.index];
        if (val !== undefined && !isNaN(val)) {
          if (val < min) min = val;
          if (val > max) max = val;
        }
      });
      
      const isDynamic = (max - min) > 1.0;
      let label = h.name;
      if (label.toLowerCase().includes("pl1")) label = "PL1";
      if (label.toLowerCase().includes("pl2")) label = "PL2";
      if (label.toLowerCase().includes("limit") && label.toLowerCase().includes("gpu")) label = "GPU Power Limit";
      
      return {
        header: h,
        isDynamic,
        staticValue: isDynamic ? null : max,
        label,
        maxFound: max
      };
    });
  }, [metric, headers, rawPoints]);

  // X and Y scales
  const scales = useMemo(() => {
    if (chartPoints.length === 0) {
      return {
        xMin: 0, xMax: 100, yMin: 0, yMax: 100,
        getX: (x: number) => 0, getY: (y: number) => 0,
        getValFromY: (pixelY: number) => 0,
        shouldShowLimitLine: false
      };
    }

    const xValues = chartPoints.map(p => p.x);
    const yValues = chartPoints.map(p => p.y);

    const xMin = Math.min(...xValues);
    const xMax = Math.max(...xValues);

    // Give Y axis some breathing room (padded min and max)
    const yRawMin = visibleDataRange.stats.min;
    const yRawMax = visibleDataRange.stats.max;
    const isYesNo = metric.unit?.toLowerCase() === "yes/no";

    let yMin: number;
    let yMax: number;
    let yPadding = 0;
    
    if (isYesNo) {
      yMin = -0.1;
      yMax = 1.1;
    } else {
      const yDiff = yRawMax - yRawMin;
      // Add 8% padding to top and bottom to make the graph look beautifully centered
      yPadding = yDiff === 0 ? 10 : yDiff * 0.08;
      yMin = Math.max(0, yRawMin - yPadding); // Don't let power/utilization drop below 0 if not logical
      yMax = yRawMax + yPadding;
    }
    
    const calculatedYMax = yMax;
    
    let shouldShowLimitLine = false;
    let shouldShowPowerLimitLine = false;

    if (thermalLimitInfo) {
      const { limitValue } = thermalLimitInfo;
      // If forceShowLimit is true, or the maximum temperature is close to the limit (within 5C) or exceeds it
      if (forceShowLimit || yRawMax >= limitValue - 5) {
        shouldShowLimitLine = true;
        yMax = Math.max(calculatedYMax, limitValue + 5);
      }
    }

    if (powerLimitInfo && powerLimitInfo.length > 0) {
      const highestPowerLimit = Math.max(...powerLimitInfo.map(p => p.maxFound));
      if (forceShowLimit || yRawMax >= highestPowerLimit * 0.95) {
        shouldShowPowerLimitLine = true;
        yMax = Math.max(yMax, highestPowerLimit * 1.05);
      }
    }

    const getX = (x: number) => {
      if (xMax === xMin) return padding.left;
      return padding.left + ((x - xMin) / (xMax - xMin)) * chartWidth;
    };

    const getY = (y: number) => {
      if (yMax === yMin) return padding.top + chartHeight / 2;
      // Invert Y axis for SVG rendering
      return padding.top + chartHeight - ((y - yMin) / (yMax - yMin)) * chartHeight;
    };

    const getValFromY = (pixelY: number) => {
      const percentage = (padding.top + chartHeight - pixelY) / chartHeight;
      return yMin + percentage * (yMax - yMin);
    };

    return { xMin, xMax, yMin, yMax, getX, getY, getValFromY, shouldShowLimitLine, shouldShowPowerLimitLine };
  }, [chartPoints, visibleDataRange.stats, chartWidth, chartHeight, padding.left, padding.top, padding.bottom, padding.right, thermalLimitInfo, forceShowLimit, powerLimitInfo]);

  // 5. Build SVG Path line and area strings
  const { linePath, areaPath } = useMemo(() => {
    if (chartPoints.length === 0) return { linePath: "", areaPath: "" };

    const coords = chartPoints.map(p => ({
      px: scales.getX(p.x),
      py: scales.getY(p.y)
    }));

    // Create standard SVG line: M x0 y0 L x1 y1 ...
    const lineStr = coords.reduce((acc, c, idx) => {
      return acc + `${idx === 0 ? "M" : "L"} ${c.px.toFixed(1)} ${c.py.toFixed(1)} `;
    }, "");

    // Create closed path for the gradient area fill under the line
    const startX = coords[0].px;
    const endX = coords[coords.length - 1].px;
    const bottomY = padding.top + chartHeight;
    const areaStr = `${lineStr} L ${endX.toFixed(1)} ${bottomY} L ${startX.toFixed(1)} ${bottomY} Z`;

    return { linePath: lineStr, areaPath: areaStr };
  }, [chartPoints, scales, chartHeight, padding.top]);

  // 6. Handle Mouse Interactivity
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (!svgRef.current || chartPoints.length === 0) return;

    // Get mouse coordinates relative to SVG
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // We only care if mouse is inside the horizontal chart boundary
    if (mouseX < padding.left || mouseX > dimensions.width - padding.right) {
      setHoveredPoint(null);
      return;
    }

    // Binary search or simple search for the closest point on X scale
    let closestPt = chartPoints[0];
    let closestDist = Infinity;
    let closestIdx = 0;

    chartPoints.forEach((pt, idx) => {
      const px = scales.getX(pt.x);
      const dist = Math.abs(px - mouseX);
      if (dist < closestDist) {
        closestDist = dist;
        closestPt = pt;
        closestIdx = idx;
      }
    });

    const px = scales.getX(closestPt.x);
    const py = scales.getY(closestPt.y);

    setHoveredPoint({
      x: closestPt.x,
      y: closestPt.y,
      time: closestPt.time,
      value: closestPt.y,
      originalIndex: visibleDataRange.startIndex + closestPt.originalIndex,
      pixelX: px,
      pixelY: py,
    });
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
  };

  // Predefined quick-ranges helper


  // Generate ticks for axes
  const yTicks = useMemo(() => {
    if (metric.unit?.toLowerCase() === "yes/no") {
      return [0, 1];
    }
    const ticks = [];
    const min = scales.yMin;
    const max = scales.yMax;
    const diff = max - min;
    const steps = 4; // 5 lines total

    for (let i = 0; i <= steps; i++) {
      ticks.push(min + (diff / steps) * i);
    }
    return ticks;
  }, [scales.yMin, scales.yMax, metric.unit]);

  const xTicks = useMemo(() => {
    if (chartPoints.length < 2) return [];
    
    const ticks = [];
    const count = 5; // 5 intervals
    const len = chartPoints.length;

    for (let i = 0; i < count; i++) {
      const idx = Math.min(Math.floor((i / (count - 1)) * (len - 1)), len - 1);
      ticks.push(chartPoints[idx]);
    }
    return ticks;
  }, [chartPoints]);

  // Color scheme based on metric unit
  const themeColors = useMemo(() => {
    const nameLower = metric.fullName.toLowerCase();
    const unitLower = metric.unit.toLowerCase();

    if (unitLower === "°c" || unitLower === "°f" || nameLower.includes("temperature") || nameLower.includes("temp")) {
      return {
        stroke: "#f87171", // tailwind red-400
        gradientId: "redGrad",
        gradientStart: "rgba(248, 113, 113, 0.25)",
        glowColor: "rgba(248, 113, 113, 0.4)",
        iconColor: "text-red-400"
      };
    }
    if (unitLower === "w" || nameLower.includes("power")) {
      return {
        stroke: "#fbbf24", // tailwind amber-400
        gradientId: "amberGrad",
        gradientStart: "rgba(251, 191, 36, 0.25)",
        glowColor: "rgba(251, 191, 36, 0.4)",
        iconColor: "text-amber-400"
      };
    }
    if (unitLower === "%" || nameLower.includes("load") || nameLower.includes("usage") || nameLower.includes("utility")) {
      return {
        stroke: "#22d3ee", // tailwind cyan-400
        gradientId: "cyanGrad",
        gradientStart: "rgba(34, 211, 238, 0.25)",
        glowColor: "rgba(34, 211, 238, 0.4)",
        iconColor: "text-cyan-400"
      };
    }
    if (unitLower === "v" || nameLower.includes("volt") || nameLower.includes("vid")) {
      return {
        stroke: "#c084fc", // tailwind purple-400
        gradientId: "purpleGrad",
        gradientStart: "rgba(192, 132, 252, 0.25)",
        glowColor: "rgba(192, 132, 252, 0.4)",
        iconColor: "text-purple-400"
      };
    }

    return {
      stroke: "#38bdf8", // tailwind sky-400
      gradientId: "skyGrad",
      gradientStart: "rgba(56, 189, 248, 0.22)",
      glowColor: "rgba(56, 189, 248, 0.35)",
      iconColor: "text-sky-400"
    };
  }, [metric]);

  const handleZoomIn = () => {
    // Zoom in on the center of the current view
    const currentDiff = zoomRange[1] - zoomRange[0];
    if (currentDiff <= 10) return; // Prevent zooming in too close

    const center = zoomRange[0] + currentDiff / 2;
    const newHalf = (currentDiff * 0.7) / 2; // zoom in by 30%
    setZoomRange([Math.max(0, center - newHalf), Math.min(100, center + newHalf)]);
  };

  const handleZoomOut = () => {
    const currentDiff = zoomRange[1] - zoomRange[0];
    if (currentDiff >= 100) return;

    const center = zoomRange[0] + currentDiff / 2;
    const newHalf = (currentDiff * 1.3) / 2; // zoom out by 30%
    
    let left = center - newHalf;
    let right = center + newHalf;

    if (left < 0) {
      right += Math.abs(left);
      left = 0;
    }
    if (right > 100) {
      left -= (right - 100);
      right = 100;
    }

    setZoomRange([Math.max(0, left), Math.min(100, right)]);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col space-y-4" id="log-chart-box">
      {/* Chart Header */}
      <div className="flex flex-col lg:flex-row items-start justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div className="flex items-start gap-3 relative w-full lg:w-auto">
          <div className="p-1.5 rounded-lg bg-slate-950 border border-slate-800">
            <Gauge className={`w-5 h-5 ${themeColors.iconColor}`} />
          </div>
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight leading-none">{metric.name}</h2>
              {metric.unit && (
                <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded border bg-slate-950 text-slate-400 border-slate-800/80 leading-none">
                  {metric.unit}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 font-mono mt-1 leading-none">
              Displaying {visibleDataRange.points.length.toLocaleString()} of {rawPoints.length.toLocaleString()} samples
            </p>
          </div>
          
          {onRemove && (
            <button
              onClick={onRemove}
              className="absolute right-0 top-0 lg:hidden p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-red-400 hover:border-red-500/50 transition-colors"
              title="Remove graph"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Data Channel Controls / Search */}
        <div className="flex flex-col items-end gap-2 w-full lg:w-auto">
          <div className="flex flex-col sm:flex-row w-full lg:w-auto justify-between lg:justify-end gap-2">
            {onSelectMetric && headers.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 justify-end">
                {(() => {
                const cpuTemp = headers.find(h => /(cpu package|tctl\/tdie|cpu.*temp)/i.test(h.fullName) && /°c|c/i.test(h.unit)) || headers.find(h => /core max/i.test(h.fullName) && /°c|c/i.test(h.unit));
                const cpuPower = headers.find(h => /(cpu package.*power|cpu.*power)/i.test(h.fullName) && /w/i.test(h.unit));
                const gpuTemp = headers.find(h => /(gpu.*temp|gpu d3d)/i.test(h.fullName) && /°c|c/i.test(h.unit));
                const gpuPower = headers.find(h => /gpu.*power/i.test(h.fullName) && /w/i.test(h.unit));

                const quickMetrics = [
                  { label: "CPU Temp", metric: cpuTemp, icon: Thermometer, color: "text-red-400", activeBg: "bg-slate-800 text-red-400 border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.1)]", activeIcon: "text-red-400", hover: "hover:border-slate-700 hover:bg-slate-900" },
                  { label: "CPU Power", metric: cpuPower, icon: Zap, color: "text-amber-400", activeBg: "bg-slate-800 text-amber-400 border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.1)]", activeIcon: "text-amber-400", hover: "hover:border-slate-700 hover:bg-slate-900" },
                  { label: "GPU Temp", metric: gpuTemp, icon: Thermometer, color: "text-red-400", activeBg: "bg-slate-800 text-red-400 border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.1)]", activeIcon: "text-red-400", hover: "hover:border-slate-700 hover:bg-slate-900" },
                  { label: "GPU Power", metric: gpuPower, icon: Zap, color: "text-amber-400", activeBg: "bg-slate-800 text-amber-400 border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.1)]", activeIcon: "text-amber-400", hover: "hover:border-slate-700 hover:bg-slate-900" }
                ];

                return quickMetrics.map((qm, idx) => {
                  if (!qm.metric) return null;
                  const isActive = metric.index === qm.metric.index;
                  const Icon = qm.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => onSelectMetric(qm.metric!)}
                      className={`h-8 px-3 rounded-lg text-[10px] font-bold font-mono transition-all flex items-center justify-center gap-1.5 border ${
                        isActive 
                          ? `${qm.activeBg}` 
                          : `bg-slate-950 text-slate-400 border-slate-800 ${qm.hover} hover:text-slate-200`
                      }`}
                      title={qm.metric.fullName}
                    >
                      <Icon className={`w-3.5 h-3.5 ${isActive ? qm.activeIcon : 'text-slate-500'}`} />
                      {qm.label}
                    </button>
                  );
                });
              })()}

              <MetricSearch 
                headers={headers}
                activeMetric={metric}
                onSelect={onSelectMetric}
                isCompact={true}
              />
            </div>
          )}
          
          <div className="flex items-center gap-2 justify-end">
            {(hasAnyThermalLimits || hasAnyPowerLimits || metric.unit?.toLowerCase().includes("hz")) && (
              <button
                onClick={() => setForceShowLimit(!forceShowLimit)}
                className={`h-8 px-3 rounded-lg text-[10px] font-bold font-mono transition-all flex items-center justify-center gap-1.5 border ${
                  forceShowLimit 
                    ? "bg-slate-800 text-red-400 border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.1)]" 
                    : "bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700"
                }`}
                title="Force show limits and throttling info"
              >
                {forceShowLimit ? (
                  <ToggleRight className="w-3.5 h-3.5 text-red-400" />
                ) : (
                  <ToggleLeft className="w-3.5 h-3.5 text-slate-500" />
                )}
                Show Limits
              </button>
            )}

            {onRemove && (
              <button
                onClick={onRemove}
                className="hidden lg:flex h-8 w-8 items-center justify-center rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-red-400 hover:border-red-500/50 transition-colors shrink-0"
                title="Remove graph"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
      </div>

      {/* SVG Container Area */}
      <div
        ref={containerRef}
        className="w-full h-[320px] bg-slate-950/40 rounded-xl border border-slate-800 relative cursor-crosshair overflow-hidden"
        id="chart-canvas-container"
      >
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleMouseClick}
          className="absolute inset-0 select-none"
        >
          <defs>
            {/* Linear area gradient */}
            <linearGradient id={themeColors.gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={themeColors.stroke} stopOpacity={0.28} />
              <stop offset="100%" stopColor={themeColors.stroke} stopOpacity={0} />
            </linearGradient>

            {/* Glowing filter for hover crosshair/point */}
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Horizontal Grid lines and Y axis ticks */}
          {yTicks.map((val, idx) => {
            const py = scales.getY(val);
            if (isNaN(py)) return null;

            return (
              <g key={`y-grid-${idx}`}>
                {/* Grid Line */}
                <line
                  x1={padding.left}
                  y1={py}
                  x2={dimensions.width - padding.right}
                  y2={py}
                  stroke="#1e293b"
                  strokeWidth="1.2"
                  strokeDasharray="4 4"
                />
                {/* Axis Tick Label */}
                <text
                  x={padding.left - 10}
                  y={py + 3.5}
                  textAnchor="end"
                  fill="#64748b"
                  className="font-mono text-[10px] font-semibold"
                >
                  {metric.unit?.toLowerCase() === "yes/no" ? (val === 1 ? "Yes" : "No") : (val % 1 === 0 ? val : val.toFixed(1))}
                </text>
              </g>
            );
          })}

          {/* Vertical Grid lines and X axis ticks */}
          {xTicks.map((pt, idx) => {
            const px = scales.getX(pt.x);
            if (isNaN(px)) return null;

            return (
              <g key={`x-grid-${idx}`}>
                {/* Grid Line */}
                <line
                  x1={px}
                  y1={padding.top}
                  x2={px}
                  y2={dimensions.height - padding.bottom}
                  stroke="#1e293b"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                {/* Axis Tick Label */}
                <text
                  x={px}
                  y={dimensions.height - padding.bottom + 18}
                  textAnchor="middle"
                  fill="#64748b"
                  className="font-mono text-[9px]"
                >
                  {pt.time}
                </text>
              </g>
            );
          })}

          {/* Solid line representing Y=0 baseline if within bounds */}
          {scales.yMin <= 0 && scales.yMax >= 0 && (
            <line
              x1={padding.left}
              y1={scales.getY(0)}
              x2={dimensions.width - padding.right}
              y2={scales.getY(0)}
              stroke="#475569"
              strokeWidth="1.5"
            />
          )}

          {/* Dynamic TjMax / Thermal Limit Warning Line */}
          {forceShowLimit && scales.shouldShowLimitLine && thermalLimitInfo && (
            <g key="thermal-throttling-limit" className="opacity-95">
              <line
                x1={padding.left}
                y1={scales.getY(thermalLimitInfo.limitValue)}
                x2={dimensions.width - padding.right}
                y2={scales.getY(thermalLimitInfo.limitValue)}
                stroke="#ef4444"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
              <text
                x={dimensions.width - padding.right - 10}
                y={scales.getY(thermalLimitInfo.limitValue) - 6}
                textAnchor="end"
                fill="#f87171"
                className="font-mono text-[10px] font-bold tracking-wider"
              >
                ⚠️ {thermalLimitInfo.label} ({thermalLimitInfo.limitValue}°C)
              </text>
            </g>
          )}

          {/* Throttling Background Highlights */}
          {(() => {
            if (!forceShowLimit) return null;
            const metricName = metric.fullName.toLowerCase();
            const isCpu = metricName.includes("cpu") || metricName.includes("core") || metricName.includes("tctl");
            const isGpu = metricName.includes("gpu");
            
            // Extract core number if present: "p-core 0" -> "0"
            const coreMatch = metricName.match(/core\s+(\d+)/);
            const coreNum = coreMatch ? coreMatch[1] : null;

            const thermalHeader = headers.find(h => {
                const name = h.fullName.toLowerCase();
                if (isCpu) {
                    // Try to match core specifically, fallback to just core throttling
                    const isThermal = name.includes("thermal throttling");
                    const isCore = name.includes("core");
                    if (!isThermal || !isCore) return false;
                    
                    if (coreNum) {
                        return name.includes(`core ${coreNum}`) || name.includes(`core${coreNum}`);
                    }
                    return true;
                }
                if (isGpu) return name.includes("performance limit - thermal");
                return false;
            });

            const powerHeader = headers.find(h => {
                const name = h.fullName.toLowerCase();
                if (isCpu) {
                    const isPower = name.includes("power limit exceeded");
                    const isCore = name.includes("core");
                    if (!isPower || !isCore) return false;

                    if (coreNum) {
                        return name.includes(`core ${coreNum}`) || name.includes(`core${coreNum}`);
                    }
                    return true;
                }
                if (isGpu) return name.includes("performance limit - power");
                return false;
            });

            const renderHighlights = (header: MetricHeader, color: string) => {
              const rects = [];
              let startX = -1;
              for (let i = 0; i < visibleDataRange.points.length; i++) {
                const val = visibleDataRange.points[i].values[header.index];
                if (val > 0.5) {
                  if (startX === -1) startX = visibleDataRange.points[i].timestamp;
                } else if (startX !== -1) {
                  const endX = visibleDataRange.points[i-1].timestamp;
                  rects.push({ x1: scales.getX(startX), x2: scales.getX(endX) });
                  startX = -1;
                }
              }
              if (startX !== -1) {
                rects.push({ x1: scales.getX(startX), x2: scales.getX(visibleDataRange.points[visibleDataRange.points.length-1].timestamp) });
              }
              return rects.map((r, i) => (
                <rect key={`throttle-${header.index}-${i}`} x={r.x1} y={padding.top} width={Math.max(0, r.x2 - r.x1)} height={chartHeight} fill={color} fillOpacity={0.15} />
              ));
            };

            return (
              <>
                {thermalHeader && renderHighlights(thermalHeader, "#2dd4bf")}
                {powerHeader && renderHighlights(powerHeader, "#818cf8")}

                {/* Legend */}
                {(thermalHeader || powerHeader) && (
                    <g transform={`translate(${padding.left + 2}, ${padding.top - 40})`}>
                        <rect x="-4" y="-4" width="110" height={thermalHeader && powerHeader ? 36 : 22} rx="4" fill="#0f172a" fillOpacity={0.8} />
                        {thermalHeader && (
                            <>
                                <rect x="0" y="0" width="8" height="8" rx="1" fill="#2dd4bf" />
                                <text x="14" y="8" fill="#e2e8f0" className="font-mono text-[9px]">Thermal throttling</text>
                            </>
                        )}
                        {powerHeader && (
                            <>
                                <rect x="0" y={thermalHeader ? 15 : 0} width="8" height="8" rx="1" fill="#818cf8" />
                                <text x="14" y={thermalHeader ? 23 : 8} fill="#e2e8f0" className="font-mono text-[9px]">Power throttling</text>
                            </>
                        )}
                    </g>
                )}
              </>
            );
          })()}

          {/* Dynamic / Static Power Limit Warning Lines */}
          {scales.shouldShowPowerLimitLine && powerLimitInfo && powerLimitInfo.map((pInfo, index) => {
            const colors = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6"];
            const color = colors[index % colors.length];

            if (pInfo.isDynamic) {
              const limitCoords = chartPoints.map(p => {
                const dp = visibleDataRange.points[p.originalIndex];
                const val = dp?.values[pInfo.header.index];
                return { px: scales.getX(p.x), py: val !== undefined ? scales.getY(val) : 0 };
              });
              
              const limitLineStr = limitCoords.reduce((acc, c, idx) => {
                 return acc + `${idx === 0 ? "M" : "L"} ${c.px.toFixed(1)} ${c.py.toFixed(1)} `;
              }, "");

              return (
                <g key={`power-limit-${index}`} className="opacity-95">
                  <path
                    d={limitLineStr}
                    fill="none"
                    stroke={color}
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={dimensions.width - padding.right - 10}
                    y={scales.getY(pInfo.maxFound) - 6}
                    textAnchor="end"
                    fill={color}
                    className="font-mono text-[10px] font-bold tracking-wider"
                  >
                    ⚡ {pInfo.label} (Dynamic, max {pInfo.maxFound}W)
                  </text>
                </g>
              );
            } else {
              return (
                <g key={`power-limit-${index}`} className="opacity-95">
                  <line
                    x1={padding.left}
                    y1={scales.getY(pInfo.staticValue || 0)}
                    x2={dimensions.width - padding.right}
                    y2={scales.getY(pInfo.staticValue || 0)}
                    stroke={color}
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={dimensions.width - padding.right - 10}
                    y={scales.getY(pInfo.staticValue || 0) - 6}
                    textAnchor="end"
                    fill={color}
                    className="font-mono text-[10px] font-bold tracking-wider"
                  >
                    ⚡ {pInfo.label} ({pInfo.staticValue}W)
                  </text>
                </g>
              );
            }
          })}

          {/* Left Y Axis line */}
          <line
            x1={padding.left}
            y1={padding.top}
            x2={padding.left}
            y2={dimensions.height - padding.bottom}
            stroke="#334155"
            strokeWidth="1.5"
          />

          {/* Bottom X Axis line */}
          <line
            x1={padding.left}
            y1={dimensions.height - padding.bottom}
            x2={dimensions.width - padding.right}
            y2={dimensions.height - padding.bottom}
            stroke="#334155"
            strokeWidth="1.5"
          />

          {/* Core Paths (Area then Line to layering) */}
          {linePath && (
            <>
              {/* Gradient Area Fill */}
              <path d={areaPath} fill={`url(#${themeColors.gradientId})`} />

              {/* Dynamic Trendline */}
              <path
                d={linePath}
                fill="none"
                stroke={themeColors.stroke}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}

          {/* Hover Crosshairs & Point Highlight */}
          {hoveredPoint && (
            <g>
              {/* Vertical Crosshair Line */}
              <line
                x1={hoveredPoint.pixelX}
                y1={padding.top}
                x2={hoveredPoint.pixelX}
                y2={dimensions.height - padding.bottom}
                stroke={themeColors.stroke}
                strokeWidth="1.5"
                strokeDasharray="2 2"
                opacity="0.6"
              />

              {/* Horizontal Crosshair Line */}
              <line
                x1={padding.left}
                y1={hoveredPoint.pixelY}
                x2={dimensions.width - padding.right}
                y2={hoveredPoint.pixelY}
                stroke={themeColors.stroke}
                strokeWidth="1.5"
                strokeDasharray="2 2"
                opacity="0.4"
              />

              {/* Glowing Outer Highlight Ring */}
              <circle
                cx={hoveredPoint.pixelX}
                cy={hoveredPoint.pixelY}
                r="7"
                fill="none"
                stroke={themeColors.stroke}
                strokeWidth="2.5"
                opacity="0.5"
                filter="url(#glow)"
              />

              {/* Solid Center Point */}
              <circle
                cx={hoveredPoint.pixelX}
                cy={hoveredPoint.pixelY}
                r="4.5"
                fill="#ffffff"
                stroke={themeColors.stroke}
                strokeWidth="2.5"
              />
            </g>
          )}
        </svg>

        {/* Hover Tooltip - Positioned absolutely inside container based on coordinates */}
        {hoveredPoint && (
          <div
            className="absolute bg-slate-950/95 border border-slate-800 rounded-xl p-3.5 shadow-2xl pointer-events-none z-40 flex flex-col space-y-1 backdrop-blur-md text-[11px] font-mono min-w-[170px]"
            style={{
              left: hoveredPoint.pixelX + 15 > dimensions.width - 200
                ? hoveredPoint.pixelX - 195
                : hoveredPoint.pixelX + 15,
              top: Math.max(10, Math.min(hoveredPoint.pixelY - 45, dimensions.height - 120)),
              borderLeft: `3px solid ${themeColors.stroke}`
            }}
          >
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold uppercase">
              <span>Timestamp</span>
              <span>Sample #{hoveredPoint.originalIndex}</span>
            </div>
            <span className="text-white font-bold text-xs">{hoveredPoint.time}</span>
            
            <div className="mt-1 border-t border-slate-900 pt-1 flex flex-col">
              <span className="text-slate-400 text-[10px] truncate">{metric.name}</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-white font-black text-sm">
                  {metric.unit?.toLowerCase() === "yes/no" ? (hoveredPoint.value === 1 ? "Yes" : "No") : (hoveredPoint.value % 1 === 0 ? hoveredPoint.value : hoveredPoint.value.toFixed(2))}
                </span>
                {metric.unit && metric.unit?.toLowerCase() !== "yes/no" && (
                  <span className="text-slate-500 font-bold font-mono text-[10px]">{metric.unit}</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Floating Y Axis Unit Label (Vertical Rotation) */}
        <div
          className="absolute font-mono font-bold text-[10px] uppercase text-slate-500 tracking-widest pointer-events-none"
          style={{
            transform: "rotate(-90deg) translate(-50%, 0)",
            transformOrigin: "left center",
            left: "14px",
            top: `${(dimensions.height - padding.bottom + padding.top) / 2}px`
          }}
        >
          {metric.unit ? (metric.unit.toLowerCase() === "yes/no" ? "Status" : `Value in ${metric.unit}`) : "Metric Level"}
        </div>

        {/* Floating X Axis Time Label */}
        <div className="absolute bottom-1.5 left-0 right-0 text-center font-mono font-bold text-[10px] uppercase text-slate-500 tracking-wider pointer-events-none">
          Duration Timeline (Start time: {rawPoints[0]?.time || "00:00:00"})
        </div>
      </div>

      {/* Slider Zoom Controls */}
      <div className="flex flex-col space-y-2 pb-1 bg-slate-950/25 p-4 rounded-xl border border-slate-800/80">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
            <MoveHorizontal className="w-3.5 h-3.5 text-slate-400" /> Segment Zoom: {visibleDataRange.startIndex + 1} - {visibleDataRange.endIndex + 1}
          </span>

          <div className="flex items-center gap-1">
            <button
              onClick={handleZoomIn}
              disabled={zoomRange[1] - zoomRange[0] <= 10}
              className="p-1 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleZoomOut}
              disabled={zoomRange[0] === 0 && zoomRange[1] === 100}
              className="p-1 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoomRange([0, 100])}
              disabled={zoomRange[0] === 0 && zoomRange[1] === 100}
              className="p-1 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Reset Zoom"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Custom Interactive Range Slider */}
        <div 
          className="relative pt-4 pb-4 px-1"
          ref={sliderRef}
        >
          <div className="h-2.5 bg-slate-950 rounded-full border border-slate-800 relative">
            {/* Highlighted portion inside the track (Segment) */}
            <div
              className="absolute h-full rounded-full bg-gradient-to-r from-cyan-500/20 to-cyan-400/30 border-y border-cyan-400/10 cursor-grab active:cursor-grabbing"
              style={{
                left: `${zoomRange[0]}%`,
                right: `${100 - zoomRange[1]}%`
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                if (!sliderRef.current) return;
                isDraggingSegment.current = true;
                const rect = sliderRef.current.getBoundingClientRect();
                dragStartPos.current = ((e.clientX - rect.left) / rect.width) * 100;
                dragStartRange.current = [...zoomRange];
                document.body.style.userSelect = "none";
              }}
            />
          </div>

          {/* Left Handle */}
          <div
            className="absolute w-4 h-4 bg-white border-2 border-cyan-400 rounded-full shadow-lg cursor-ew-resize hover:scale-125 transition-transform"
            style={{ 
              left: `calc(${zoomRange[0]}% - 8px)`,
              top: '11px'
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              isDraggingLeft.current = true;
              document.body.style.userSelect = "none";
            }}
          />

          {/* Right Handle */}
          <div
            className="absolute w-4 h-4 bg-white border-2 border-cyan-400 rounded-full shadow-lg cursor-ew-resize hover:scale-125 transition-transform"
            style={{ 
              left: `calc(${zoomRange[1]}% - 8px)`,
              top: '11px'
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              isDraggingRight.current = true;
              document.body.style.userSelect = "none";
            }}
          />
        </div>

      {selectedPointIndex !== null && (
        <div ref={instantViewRef}>
          <LogInstantView 
            point={rawPoints[selectedPointIndex]} 
            headers={headers} 
          />
        </div>
      )}
      </div>
    </div>
  );
}
