import { MetricHeader, DataPoint, ParsedLog, MetricStats } from "../types";

/**
 * Normalizes unit strings by removing special encoding symbols (e.g. °)
 * so we can safely match units regardless of regional encoding bugs.
 */
export function sanitizeUnit(unit: string): string {
  return unit.trim()
    .toLowerCase()
    .replace(/[^\d\w%]/g, ""); // Keep only alphanumeric characters and '%'
}

/**
 * Parses HWiNFO CSV file contents with high resilience.
 */
export function parseHWiNFOCSV(csvText: string): ParsedLog {
  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) {
    throw new Error("The file is empty or does not contain enough data.");
  }

  // Detect delimiter (usually comma or semicolon)
  const firstLine = lines[0];
  let delimiter = ",";
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  if (semiCount > commaCount) {
    delimiter = ";";
  }

  // Parse raw headers from first row
  const rawHeaders = splitCSVLine(firstLine, delimiter);
  
  // Identify key indices
  let dateIndex = -1;
  let timeIndex = -1;

  const parsedHeaders: MetricHeader[] = [];

  rawHeaders.forEach((header, index) => {
    const lower = header.toLowerCase();
    if (lower === "date") {
      dateIndex = index;
    } else if (lower === "time") {
      timeIndex = index;
    } else {
      let name = header.trim();
      let unit = "";

      // Extract name and unit, e.g. "CPU [°C]" -> name: "CPU", unit: "°C"
      const bracketMatch = header.match(/^([\s\S]+?)\s*\[([\s\S]+?)\]$/);
      if (bracketMatch) {
        name = bracketMatch[1].trim();
        unit = bracketMatch[2].trim();
        // Sanitize broken encoding characters commonly seen in ANSI logs
        const cleanUnit = unit.toLowerCase().trim();
        const hasTempKeywords = name.toLowerCase().includes("temp") || 
                             name.toLowerCase().includes("hot spot") || 
                             name.toLowerCase().includes("prochot") || 
                             name.toLowerCase().includes("junction") || 
                             name.toLowerCase().includes("cpu core") || 
                             name.toLowerCase().includes("gpu core");

        const hasPowerKeywords = name.toLowerCase().includes("power") || 
                              name.toLowerCase().includes("watt");

        const hasVoltKeywords = name.toLowerCase().includes("volt") || 
                             name.toLowerCase().includes("vid") || 
                             name.toLowerCase().includes("vcc");

        const hasLoadKeywords = name.toLowerCase().includes("load") || 
                             name.toLowerCase().includes("usage") || 
                             name.toLowerCase().includes("utility") ||
                             name.toLowerCase().includes("residency") ||
                             name.toLowerCase().includes("activity");

        if (
          cleanUnit === "c" ||
          cleanUnit === "°c" ||
          cleanUnit === "ºc" ||
          cleanUnit.includes("°") ||
          cleanUnit.includes("º") ||
          cleanUnit.includes("\ufffd") ||
          (hasTempKeywords && (cleanUnit === "" || cleanUnit.includes("c")))
        ) {
          unit = "°C";
        } else if (cleanUnit === "w" || (cleanUnit.includes("w") && hasPowerKeywords) || (hasPowerKeywords && cleanUnit === "")) {
          unit = "W";
        } else if (cleanUnit === "v" || (cleanUnit.includes("v") && hasVoltKeywords) || (hasVoltKeywords && cleanUnit === "")) {
          unit = "V";
        } else if (cleanUnit.includes("%") || (hasLoadKeywords && (cleanUnit === "" || cleanUnit === "%"))) {
          unit = "%";
        } else if (cleanUnit === "mhz" || cleanUnit.includes("mhz")) {
          unit = "MHz";
        } else if (cleanUnit === "ghz" || cleanUnit.includes("ghz")) {
          unit = "GHz";
        } else if (cleanUnit === "mb" || cleanUnit.includes("mb")) {
          unit = "MB";
        } else if (cleanUnit === "gb" || cleanUnit.includes("gb")) {
          unit = "GB";
        } else if (cleanUnit === "fps" || cleanUnit.includes("fps")) {
          unit = "FPS";
        } else if (cleanUnit === "ms" || cleanUnit.includes("ms")) {
          unit = "ms";
        }
      }

      parsedHeaders.push({
        index,
        fullName: header,
        name,
        unit,
      });
    }
  });

  // Parse data rows
  const dataPoints: DataPoint[] = [];
  let baseTimestamp: number | null = null;

  for (let i = 1; i < lines.length; i++) {
    const rowCells = splitCSVLine(lines[i], delimiter);
    if (rowCells.length < 2) continue;

    // Check if we have a valid time value in the Time column
    const timeVal = timeIndex !== -1 ? rowCells[timeIndex] : "";
    
    // A valid HWiNFO data row must have a formatted timestamp like HH:MM:SS
    // Descriptor rows (Row 2), metadata rows, and footers have empty or non-time values
    if (!timeVal || !/^\d+:\d+:\d+/.test(timeVal.trim())) {
      continue; // Skip non-data line
    }

    const dateVal = dateIndex !== -1 ? rowCells[dateIndex] : "";

    // Clean display time format by stripping fractional milliseconds
    let displayTime = timeVal.trim();
    const dotIdx = displayTime.indexOf(".");
    if (dotIdx !== -1) {
      displayTime = displayTime.substring(0, dotIdx);
    }

    // Parse values for headers
    // Aligned to h.index to prevent scrambled metrics indices
    const values: number[] = new Array(rowCells.length).fill(NaN);
    parsedHeaders.forEach((h) => {
      const rawVal = rowCells[h.index];
      if (rawVal !== undefined && rawVal !== "") {
        const cleanedRaw = rawVal.trim().toLowerCase();
        // Support YES/NO columns seamlessly as binary 1/0
        if (cleanedRaw === "yes") {
          values[h.index] = 1;
        } else if (cleanedRaw === "no") {
          values[h.index] = 0;
        } else {
          let cleanedVal = cleanedRaw
            .replace(/[^\d\.,\-+eE]/g, "") // Keep only standard float characters
            .replace(",", "."); // Standardize decimal point
          const num = parseFloat(cleanedVal);
          values[h.index] = isNaN(num) ? NaN : num;
        }
      }
    });

    // Approximate elapsed seconds as a timestamp if we can parse timeVal
    let elapsedSeconds = 0;
    const tMatch = timeVal.match(/(\d+):(\d+):(\d+)/);
    if (tMatch) {
      const hours = parseInt(tMatch[1], 10);
      const mins = parseInt(tMatch[2], 10);
      const secs = parseInt(tMatch[3], 10);
      const totalSeconds = hours * 3600 + mins * 60 + secs;

      if (baseTimestamp === null) {
        baseTimestamp = totalSeconds;
      }
      
      // Handle wrapping around midnight
      if (totalSeconds < baseTimestamp) {
        elapsedSeconds = (totalSeconds + 86400) - baseTimestamp;
      } else {
        elapsedSeconds = totalSeconds - baseTimestamp;
      }
    } else {
      if (baseTimestamp === null) baseTimestamp = 0;
      elapsedSeconds = i - 1;
    }

    dataPoints.push({
      time: displayTime,
      date: dateVal,
      timestamp: elapsedSeconds,
      values,
    });
  }

  // Calculate recording statistics
  let durationText = "Unknown duration";
  let dateRangeText = "Unknown date";

  if (dataPoints.length > 0) {
    const startPoint = dataPoints[0];
    const endPoint = dataPoints[dataPoints.length - 1];
    
    // Calculate duration
    const totalSeconds = endPoint.timestamp - startPoint.timestamp;
    if (totalSeconds > 0) {
      const hrs = Math.floor(totalSeconds / 3600);
      const mins = Math.floor((totalSeconds % 3600) / 60);
      const secs = totalSeconds % 60;
      
      const parts = [];
      if (hrs > 0) parts.push(`${hrs} hr${hrs > 1 ? "s" : ""}`);
      if (mins > 0) parts.push(`${mins} min${mins > 1 ? "s" : ""}`);
      if (secs > 0 || parts.length === 0) parts.push(`${secs} sec${secs > 1 ? "s" : ""}`);
      durationText = parts.join(" ");
    } else {
      durationText = `${dataPoints.length} samples`;
    }

    // Calculate dates
    const startDate = startPoint.date;
    const endDate = endPoint.date;
    if (startDate && endDate) {
      dateRangeText = startDate === endDate ? startDate : `${startDate} - ${endDate}`;
    } else if (startDate) {
      dateRangeText = startDate;
    }
  }

  return {
    headers: parsedHeaders,
    dataPoints,
    durationText,
    sampleCount: dataPoints.length,
    dateRangeText,
  };
}

/**
 * Splits a CSV line, respecting quotes.
 */
function splitCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Heuristically finds the top suggested metrics from parsed headers.
 */
export function getTopSuggestions(headers: MetricHeader[]): MetricHeader[] {
  const suggestions: MetricHeader[] = [];

  // Helper to find a matching header with encoding protection
  const findBestMatch = (keywords: string[], unitFilter?: string, excludeKeywords: string[] = []): MetricHeader | null => {
    let bestHeader: MetricHeader | null = null;
    let highestScore = -1;

    headers.forEach(h => {
      const lowerFullName = h.fullName.toLowerCase();
      
      // Check exclusion keywords
      if (excludeKeywords.some(kw => lowerFullName.includes(kw.toLowerCase()))) {
        return;
      }

      // Check unit using normalized encoding-safe comparison
      if (unitFilter) {
        const sanHUnit = sanitizeUnit(h.unit);
        const sanFilter = sanitizeUnit(unitFilter);
        if (sanHUnit !== sanFilter) {
          return;
        }
      }

      // Score based on keyword sequence
      let score = 0;
      keywords.forEach((kw, index) => {
        if (lowerFullName.includes(kw.toLowerCase())) {
          score += (keywords.length - index) * 10;
        }
      });

      // Boost for specific exact-sounding metrics, exclude limit indicators
      if (lowerFullName.includes("core max") || lowerFullName.includes("package")) score += 5;
      if (lowerFullName.includes("hot spot") || lowerFullName.includes("thermal")) score += 2;
      if (lowerFullName.includes("limit exceeded") || lowerFullName.includes("throttle reasons") || lowerFullName.includes("reasons")) {
        score -= 20; // penalize status lines
      }

      if (score > highestScore && score > 0) {
        highestScore = score;
        bestHeader = h;
      }
    });

    return bestHeader;
  };

  // 1. Find CPU Temperature
  const cpuTemp = findBestMatch(
    ["cpu package", "cpu (tctl/tdie)", "tctl/tdie", "tctl", "cpu temperature", "cpu core temperature", "cpu core max", "core max", "cpu", "temperature"],
    "°C",
    ["gpu", "motherboard", "drive", "ssd", "nvme", "limit reasons"]
  );
  if (cpuTemp) suggestions.push(cpuTemp);

  // 2. Find GPU Temperature
  const gpuTemp = findBestMatch(
    ["gpu temperature", "gpu core temperature", "gpu d3d", "gpu thermal", "gpu", "temperature"],
    "°C",
    ["cpu", "motherboard", "drive", "ssd", "nvme"]
  );
  if (gpuTemp) suggestions.push(gpuTemp);

  // 3. Find Power (Ideal: CPU Package Power or GPU Power)
  const powerOrLoad = findBestMatch(
    ["cpu package power", "gpu power", "cpu power", "gpu core load", "total system power", "cpu load", "cpu utility", "memory load"],
    undefined,
    ["temperature", "°C", "limit exceeded", "yes/no"]
  );
  if (powerOrLoad && !suggestions.some(s => s.index === powerOrLoad.index)) {
    suggestions.push(powerOrLoad);
  }

  // Fallbacks to reach exactly 3 distinct suggestions if we missed some
  const fallbackTargets = [
    { keywords: ["power", "package", "w"], unit: "w" },
    { keywords: ["gpu", "load", "utility", "%"], unit: "%" },
    { keywords: ["cpu", "load", "utility", "%"], unit: "%" },
    { keywords: ["temperature", "°c"], unit: "°c" },
  ];

  let fallbackIdx = 0;
  while (suggestions.length < 3 && fallbackIdx < fallbackTargets.length) {
    const target = fallbackTargets[fallbackIdx];
    const match = findBestMatch(target.keywords, target.unit, ["limit", "reasons", "yes/no"]);
    if (match && !suggestions.some(s => s.index === match.index)) {
      suggestions.push(match);
    }
    fallbackIdx++;
  }

  // Ultimate fallback: first 3 headers in list
  let i = 0;
  while (suggestions.length < 3 && i < headers.length) {
    const h = headers[i];
    if (!suggestions.some(s => s.index === h.index)) {
      suggestions.push(h);
    }
    i++;
  }

  return suggestions.slice(0, 3);
}

/**
 * Calculates accurate statistics for a given metric across the dataset.
 */
export function calculateStats(dataPoints: DataPoint[], metricIndexInHeaders: number): MetricStats {
  if (dataPoints.length === 0) {
    return { min: 0, max: 0, avg: 0, last: 0, median: 0 };
  }

  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  const values: number[] = [];
  let last = 0;

  dataPoints.forEach(dp => {
    const val = dp.values[metricIndexInHeaders];
    if (val !== undefined && !isNaN(val)) {
      if (val < min) min = val;
      if (val > max) max = val;
      sum += val;
      values.push(val);
      last = val;
    }
  });

  if (values.length === 0) {
    return { min: 0, max: 0, avg: 0, last: 0, median: 0 };
  }

  // Calculate Median
  values.sort((a, b) => a - b);
  const mid = Math.floor(values.length / 2);
  const median = values.length % 2 !== 0 ? values[mid] : (values[mid - 1] + values[mid]) / 2;

  return {
    min,
    max,
    avg: sum / values.length,
    last,
    median,
  };
}

/**
 * Downsamples data points using a grid-based averaging to prevent UI lockup for large datasets.
 */
export function downsampleData(
  dataPoints: DataPoint[],
  metricIndexInHeaders: number,
  targetCount: number = 600
): { x: number; y: number; time: string; originalIndex: number }[] {
  if (dataPoints.length === 0) return [];
  if (dataPoints.length <= targetCount) {
    return dataPoints.map((dp, idx) => ({
      x: dp.timestamp,
      y: dp.values[metricIndexInHeaders],
      time: dp.time,
      originalIndex: idx,
    })).filter(pt => !isNaN(pt.y));
  }

  const result: { x: number; y: number; time: string; originalIndex: number }[] = [];
  const binSize = dataPoints.length / targetCount;

  for (let i = 0; i < targetCount; i++) {
    const startIdx = Math.floor(i * binSize);
    const endIdx = Math.min(Math.floor((i + 1) * binSize), dataPoints.length);
    
    if (startIdx >= endIdx) continue;

    let sumX = 0;
    let sumY = 0;
    let validCount = 0;

    for (let j = startIdx; j < endIdx; j++) {
      const dp = dataPoints[j];
      const val = dp.values[metricIndexInHeaders];
      if (val !== undefined && !isNaN(val)) {
        sumX += dp.timestamp;
        sumY += val;
        validCount++;
      }
    }

    if (validCount > 0) {
      const avgY = sumY / validCount;
      const avgX = sumX / validCount;
      const middleIdx = Math.floor((startIdx + endIdx) / 2);

      result.push({
        x: avgX,
        y: avgY,
        time: dataPoints[middleIdx].time,
        originalIndex: middleIdx,
      });
    }
  }

  return result;
}
