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
  coverage_by_day: Record<string, string[]>;
  generated_at: string;
}

export interface ExportRequest {
  plot: PlotResponse;
}