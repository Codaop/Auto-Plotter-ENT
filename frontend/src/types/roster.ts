export type DayName = "Senin" | "Selasa" | "Rabu" | "Kamis" | "Jumat" | "Sabtu";
export type ValidationLevel = "ok" | "warning" | "error";

export interface ClassSlot {
  id: string;
  day: DayName;
  start_time: string;
  end_time: string;
  course: string;
}

export interface MemberSchedule {
  id: string;
  code: string;
  division: string;
  generation: string;
  source_file: string;
  confidence: number;
  notes: string[];
  classes: ClassSlot[];
}

export interface ExtractionResponse {
  members: MemberSchedule[];
  warnings: string[];
}

export interface PlotConfig {
  shift_duration_hours: number;
  operating_start: string;
  operating_end: string;
  active_days: DayName[];
}

export interface PlotRequest {
  batch_id: string;
  schedules: MemberSchedule[];
  config: PlotConfig;
}

export interface PlotAssignment {
  id: string;
  day: DayName;
  start_time: string;
  end_time: string;
  member_code: string;
  division: string;
  generation: string;
}

export interface ValidationItem {
  level: ValidationLevel;
  day: DayName | null;
  message: string;
}

export interface PlotResponse {
  assignments: PlotAssignment[];
  validations: ValidationItem[];
  divisions: string[];
  required_divisions: string[];
  missing_divisions: string[];
  coverage_by_day: Record<string, string[]>;
  complete_days: DayName[];
  export_ready: boolean;
  generated_at: string;
}

export interface ExportRequest {
  batch_id: string;
  plot: PlotResponse;
}

export type QueueStatus = "valid" | "invalid" | "unsupported" | "duplicate" | "processing" | "done" | "error" | "cached";

export interface ParsedFilename {
  code: string;
  division: string;
  generation: string;
  extension?: string;
  supported: boolean;
  valid: boolean;
  error?: string;
}

export interface QueuedFile {
  id: string;
  file: File;
  hash: string;
  parsed: ParsedFilename;
  status: QueueStatus;
  error?: string;
  duplicateOf?: string;
  cachedMembers?: MemberSchedule[];
}

export interface BatchHistory {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  members: MemberSchedule[];
  config: PlotConfig;
  plot: PlotResponse | null;
  source_hashes: string[];
  reviewed: boolean;
  xlsx?: Blob;
}

export interface ExtractionCacheEntry {
  hash: string;
  members: MemberSchedule[];
  updated_at: string;
}