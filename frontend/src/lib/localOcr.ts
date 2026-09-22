import { createWorker } from "tesseract.js";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import type { ClassSlot, MemberSchedule, ParsedFilename } from "@/types/roster";

const DAY_NAMES = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"] as const;
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

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

function normalizeTime(hour: string, minute: string): string {
  return `${hour.padStart(2, "0")}:${minute}`;
}

function parseLine(line: string, index: number): ClassSlot | null {
  const normalized = line.replace(/[|]/g, " ").replace(/\s+/g, " ").trim();
  const dayMatch = normalized.match(/\b(Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\b/i);
  const times = [...normalized.matchAll(TIME_PATTERN)];
  if (!dayMatch || times.length < 2) return null;

  const day = DAY_ALIASES[dayMatch[1].toLowerCase()];
  const startTime = normalizeTime(times[0][1], times[0][2]);
  const endTime = normalizeTime(times[1][1], times[1][2]);
  if (startTime >= endTime) return null;

  const course = normalized
    .replace(dayMatch[0], "")
    .replace(times[0][0], "")
    .replace(times[1][0], "")
    .replace(/[\-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    id: `ocr-${index}-${crypto.randomUUID()}`,
    day,
    start_time: startTime,
    end_time: endTime,
    course: course || "Mata kuliah dari OCR",
  };
}

function parseText(text: string): ClassSlot[] {
  const slots = text
    .split(/\r?\n/)
    .map((line, index) => parseLine(line, index))
    .filter((slot): slot is ClassSlot => slot !== null);
  return slots.filter((slot, index, all) => all.findIndex((candidate) =>
    candidate.day === slot.day && candidate.start_time === slot.start_time && candidate.end_time === slot.end_time && candidate.course === slot.course
  ) === index);
}

export async function extractScheduleLocally(file: File, parsed: ParsedFilename): Promise<MemberSchedule> {
  const worker = await createWorker("eng");
  try {
    let text = "";
    let confidenceTotal = 0;
    let confidenceCount = 0;
    if (/^image\/(png|jpeg|jpg)$/.test(file.type)) {
      const result = await worker.recognize(file);
      text = result.data.text;
      confidenceTotal = result.data.confidence;
      confidenceCount = 1;
    } else if (file.type === "application/pdf") {
      const pdfDocument = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
      const pageCount = Math.min(pdfDocument.numPages, 10);
      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
        const page = await pdfDocument.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport }).promise;
        const result = await worker.recognize(canvas);
        text += `\n${result.data.text}`;
        confidenceTotal += result.data.confidence;
        confidenceCount += 1;
      }
    } else {
      throw new Error("OCR lokal mendukung PNG, JPG, dan PDF.");
    }

    const classes = parseText(text);
    if (!classes.length) {
      throw new Error(`OCR selesai, tetapi jadwal tidak terbaca. Pastikan baris memuat hari dan dua waktu, contoh: Senin 08:00-10:00.`);
    }
    const confidence = Math.max(0, Math.min(1, confidenceTotal / Math.max(1, confidenceCount) / 100));
    const notes = confidence < 0.7 ? ["Confidence OCR rendah; periksa hasil jadwal sebelum plotting."] : [];
    return {
      id: `member-${crypto.randomUUID()}`,
      code: parsed.code,
      division: parsed.division,
      generation: parsed.generation,
      source_file: file.name,
      confidence,
      notes: [...notes, `Hari yang dikenali: ${DAY_NAMES.filter((day) => classes.some((slot) => slot.day === day)).join(", ")}.`],
      classes,
    };
  } finally {
    await worker.terminate();
  }
}
