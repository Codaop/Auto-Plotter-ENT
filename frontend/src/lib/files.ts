import type { ParsedFilename } from "@/types/roster";

export const REQUIRED_DIVISIONS = ["RP", "FG", "VG", "CW", "IL", "WM", "PK", "DG"] as const;
const FILE_PATTERN = /^([A-Z0-9]+)_([A-Z0-9]+)_([0-9]{2})\.txt$/;

export function parseScheduleFilename(filename: string): ParsedFilename {
  const match = FILE_PATTERN.exec(filename);
  if (!match) {
    return {
      code: "-",
      division: "-",
      generation: "-",
      valid: false,
      error: "Gunakan pola KODENAMA_DIVISI_ANGKATAN, contoh VAL_CW_21.txt",
    };
  }
  const [, code, division, generation] = match;
  if (!REQUIRED_DIVISIONS.includes(division as (typeof REQUIRED_DIVISIONS)[number])) {
    return { code, division, generation, valid: false, error: `Divisi harus salah satu: ${REQUIRED_DIVISIONS.join(", ")}` };
  }
  return { code, division, generation, valid: true };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function hasInvalidScheduleTimes(schedules: { classes: { start_time: string; end_time: string }[] }[]): boolean {
  return schedules.some((member) => member.classes.some((slot) => !/^\d{2}:\d{2}$/.test(slot.start_time) || !/^\d{2}:\d{2}$/.test(slot.end_time) || slot.start_time >= slot.end_time));
}