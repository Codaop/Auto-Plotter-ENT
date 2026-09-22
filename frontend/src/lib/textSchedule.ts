import type { ClassSlot, MemberSchedule, ParsedFilename } from "@/types/roster";

const DAY_ALIASES: Record<string, ClassSlot["day"]> = {
  senin: "Senin",
  selasa: "Selasa",
  rabu: "Rabu",
  kamis: "Kamis",
  jumat: "Jumat",
  sabtu: "Sabtu",
  monday: "Senin",
  tuesday: "Selasa",
  wednesday: "Rabu",
  thursday: "Kamis",
  friday: "Jumat",
  saturday: "Sabtu",
};
const TIME_PATTERN = /\b([01]?\d|2[0-3])\s*[:.]\s*([0-5]\d)\b/g;

function parseLine(line: string, index: number): ClassSlot | null {
  const normalized = line.replace(/[#|]/g, " ").replace(/\s+/g, " ").trim();
  const dayMatch = normalized.match(/\b(Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\b/i);
  const times = [...normalized.matchAll(TIME_PATTERN)];
  if (!dayMatch || times.length < 2) return null;

  const startTime = `${times[0][1].padStart(2, "0")}:${times[0][2]}`;
  const endTime = `${times[1][1].padStart(2, "0")}:${times[1][2]}`;
  if (startTime >= endTime) return null;

  let course = normalized;
  for (const token of [dayMatch[0], times[0][0], times[1][0]]) course = course.replace(token, "");
  course = course.replace(/[\-–—]/g, " ").replace(/\s+/g, " ").trim();

  return {
    id: `text-${index}-${crypto.randomUUID()}`,
    day: DAY_ALIASES[dayMatch[1].toLowerCase()],
    start_time: startTime,
    end_time: endTime,
    course: course || "Mata kuliah dari file teks",
  };
}

export async function parseTextSchedule(file: File, parsed: ParsedFilename): Promise<MemberSchedule> {
  const text = await file.text();
  const classes = text
    .split(/\r?\n/)
    .map(parseLine)
    .filter((slot): slot is ClassSlot => slot !== null);
  const uniqueClasses = classes.filter((slot, index, all) => all.findIndex((candidate) =>
    candidate.day === slot.day && candidate.start_time === slot.start_time && candidate.end_time === slot.end_time && candidate.course === slot.course
  ) === index);

  if (!uniqueClasses.length) {
    throw new Error("Format jadwal tidak dikenali. Gunakan: Senin | 08:00 | 10:00 | Nama Mata Kuliah");
  }

  return {
    id: `member-${crypto.randomUUID()}`,
    code: parsed.code,
    division: parsed.division,
    generation: parsed.generation,
    source_file: file.name,
    confidence: 1,
    notes: ["Dibaca dari file teks lokal; tidak menggunakan layanan AI."],
    classes: uniqueClasses,
  };
}
