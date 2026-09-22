import type { ParsedFilename } from "@/types/roster";

export const REQUIRED_DIVISIONS = ["RP", "FG", "VG", "CW", "IL", "WM", "PK", "DG"] as const;
export const SUPPORTED_TEXT_EXTENSIONS = ["txt", "md", "csv", "json"] as const;
const FILE_PATTERN = /^([A-Z0-9]+)_([A-Z0-9]+)_([0-9]{2})\.([^.]*)$/i;

export function parseScheduleFilename(filename: string): ParsedFilename {
  const match = FILE_PATTERN.exec(filename);
  if (!match) {
    return {
      code: "-",
      division: "-",
      generation: "-",
      supported: false,
      valid: false,
      error: "Gunakan pola KODENAMA_DIVISI_ANGKATAN.ext",
    };
  }
  const [, code, division, generation, extension] = match;
  const normalizedExtension = extension.toLowerCase();
  if (!REQUIRED_DIVISIONS.includes(division as (typeof REQUIRED_DIVISIONS)[number])) {
    return { code, division, generation, extension: normalizedExtension, supported: false, valid: false, error: `Divisi harus salah satu: ${REQUIRED_DIVISIONS.join(", ")}` };
  }
  const supported = SUPPORTED_TEXT_EXTENSIONS.includes(normalizedExtension as (typeof SUPPORTED_TEXT_EXTENSIONS)[number]);
  return {
    code,
    division,
    generation,
    extension: normalizedExtension,
    supported,
    valid: true,
    error: supported ? undefined : `Format .${normalizedExtension} belum didukung. Gunakan TXT, MD, CSV, atau JSON.`,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function hasInvalidScheduleTimes(schedules: { classes: { start_time: string; end_time: string }[] }[]): boolean {
  return schedules.some((member) => member.classes.some((slot) => !/^\d{2}:\d{2}$/.test(slot.start_time) || !/^\d{2}:\d{2}$/.test(slot.end_time) || slot.start_time >= slot.end_time));
}