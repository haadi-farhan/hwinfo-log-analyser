export interface MetricHeader {
  index: number;
  fullName: string;
  name: string;
  unit: string;
}

export interface DataPoint {
  time: string; // HH:MM:SS or similar
  date?: string; // DD.MM.YYYY
  timestamp: number; // Seconds or ms elapsed since start
  values: number[]; // Aligned with headers by index
}

export interface ParsedLog {
  headers: MetricHeader[];
  dataPoints: DataPoint[];
  durationText: string;
  sampleCount: number;
  dateRangeText: string;
}

export interface MetricStats {
  min: number;
  max: number;
  avg: number;
  last: number;
  median: number;
}
