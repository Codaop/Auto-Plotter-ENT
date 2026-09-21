import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowDownToLine, BrainCircuit, FileSpreadsheet, FlaskConical, Play, ScanLine, ShieldCheck, Sparkles, UploadCloud } from "lucide-react";
import { toast } from "sonner";

import { PlotMatrix } from "@/components/PlotMatrix";
import { ScheduleReview } from "@/components/ScheduleReview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiDownload, apiGet, apiPost, apiUpload, ApiError } from "@/lib/api";
import type { DayName, ExportRequest, ExtractionResponse, MemberSchedule, PlotConfig, PlotRequest, PlotResponse } from "@/types/roster";

const DAYS: DayName[] = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"];
const DEFAULT_CONFIG: PlotConfig = { shift_duration_hours: 2, operating_start: "07:00", operating_end: "18:00", active_days: DAYS };

function errorMessage(error: unknown): string {
  if (error instanceof ApiError && error.body && typeof error.body === "object" && "detail" in error.body) {
    const detail = (error.body as { detail?: unknown }).detail;
    return typeof detail === "string" ? detail : "Data belum valid. Periksa kembali input Anda.";
  }
  return error instanceof Error ? error.message : "Terjadi kesalahan yang tidak diketahui.";
}

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [schedules, setSchedules] = useState<MemberSchedule[]>([]);
  const [config, setConfig] = useState<PlotConfig>(DEFAULT_CONFIG);
  const [plot, setPlot] = useState<PlotResponse | null>(null);

  const sampleMutation = useMutation({
    mutationFn: () => apiGet<ExtractionResponse>("/roster/sample"),
    onSuccess: (data) => {
      setSchedules(data.members);
      setPlot(null);
      toast.success("Data contoh siap direview");
      document.getElementById("review")?.scrollIntoView({ block: "start" });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const extractMutation = useMutation({
    mutationFn: (selectedFiles: File[]) => {
      const formData = new FormData();
      selectedFiles.forEach((file) => formData.append("files", file));
      return apiUpload<ExtractionResponse>("/roster/extract", formData);
    },
    onSuccess: (data) => {
      setSchedules(data.members);
      setPlot(null);
      data.warnings.forEach((warning) => toast.warning(warning));
      toast.success(`${data.members.length} jadwal berhasil diekstrak`);
      document.getElementById("review")?.scrollIntoView({ block: "start" });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const plotMutation = useMutation({
    mutationFn: (payload: PlotRequest) => apiPost<PlotResponse>("/roster/plot", payload),
    onSuccess: (data) => {
      setPlot(data);
      toast.success(`${data.assignments.length} shift berhasil diplot`);
      document.getElementById("preview")?.scrollIntoView({ block: "start" });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const exportMutation = useMutation({
    mutationFn: (payload: ExportRequest) => apiDownload("/roster/export", payload),
    onSuccess: (blob) => {
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = "plot-absensi-lab.xlsx";
      link.click();
      URL.revokeObjectURL(href);
      toast.success("Spreadsheet berhasil dibuat");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const submitFiles = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!files.length) return toast.error("Pilih minimal satu PDF atau screenshot");
    extractMutation.mutate(files);
  };

  const toggleDay = (day: DayName) => {
    setConfig((current) => ({
      ...current,
      active_days: current.active_days.includes(day) ? current.active_days.filter((item) => item !== day) : [...current.active_days, day],
    }));
  };

  return (
    <div data-testid="autoplot-app" className="min-h-screen bg-[#090d16] text-slate-100">
      <header data-testid="app-header" className="sticky top-0 z-40 border-b border-white/10 bg-[#090d16]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div data-testid="brand-lockup" className="flex items-center gap-3">
            <span data-testid="brand-icon" className="grid size-9 place-items-center border border-blue-400/30 bg-blue-400/10 text-blue-300"><FlaskConical className="size-5" /></span>
            <div>
              <div data-testid="brand-name" className="font-heading text-sm font-bold tracking-tight text-white">AutoPlot Lab</div>
              <div data-testid="brand-subtitle" className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-500">Roster intelligence system</div>
            </div>
          </div>
          <Badge data-testid="engine-status" variant="outline" className="border-emerald-400/25 bg-emerald-400/10 font-mono text-[10px] text-emerald-300"><span className="mr-2 size-1.5 animate-pulse rounded-full bg-emerald-400" />Gemini OCR aktif</Badge>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside data-testid="workflow-sidebar" className="hidden min-h-[calc(100vh-65px)] border-r border-white/10 bg-[#0b101b] p-5 lg:block">
          <div data-testid="workflow-title" className="mb-4 font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">Workflow / 05 tahap</div>
          <nav data-testid="workflow-navigation" className="space-y-1">
            {[['upload', '01', 'Upload & OCR'], ['review', '02', 'Review jadwal'], ['rules', '03', 'Aturan plot'], ['preview', '04', 'Matrix hasil'], ['export', '05', 'Spreadsheet']].map(([id, number, label], index) => (
              <button key={id} data-testid={`workflow-nav-button-${index}`} type="button" onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })} className="group flex w-full items-center gap-3 border-l border-white/10 px-3 py-3 text-left text-sm text-slate-400 transition-[background-color,color,border-color] duration-200 hover:border-blue-400 hover:bg-blue-400/5 hover:text-white">
                <span data-testid={`workflow-nav-number-${index}`} className="font-mono text-[10px] text-blue-400">{number}</span>{label}
              </button>
            ))}
          </nav>
          <div data-testid="stack-summary" className="mt-10 border border-white/10 bg-[#101726] p-4">
            <div data-testid="stack-title" className="mb-3 flex items-center gap-2 text-xs font-semibold text-white"><BrainCircuit className="size-4 text-blue-400" />Tech stack</div>
            <div data-testid="stack-list" className="space-y-2 font-mono text-[10px] leading-relaxed text-slate-500">
              <div>FastAPI + Pydantic</div><div>Gemini 3 Flash Vision</div><div>React 19 + TanStack Query</div><div>OpenPyXL dual-sheet</div>
            </div>
          </div>
        </aside>

        <main data-testid="main-workspace" className="min-w-0 px-4 pb-24 sm:px-6 lg:px-10">
          <section data-testid="hero-section" className="relative overflow-hidden border-b border-white/10 py-14 sm:py-20">
            <div className="scan-grid absolute inset-0 opacity-30" />
            <div className="relative max-w-4xl">
              <div data-testid="hero-kicker" className="mb-5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-blue-300"><Sparkles className="size-3.5" />Plot roster tanpa bentrok</div>
              <h1 data-testid="hero-title" className="font-heading max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl">Dari screenshot jadwal menjadi plot absensi yang siap pakai.</h1>
              <p data-testid="hero-description" className="mt-5 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">Ekstrak jadwal kuliah, koreksi hasil OCR, lalu alokasikan shift kosong dengan jaminan seluruh divisi terwakili pada hari yang sama.</p>
              <div data-testid="hero-metrics" className="mt-8 flex flex-wrap gap-6 border-l-2 border-blue-500 pl-5">
                <div><div className="font-mono text-lg font-bold text-white">PDF · PNG · JPG</div><div className="text-xs text-slate-500">Format masukan</div></div>
                <div><div className="font-mono text-lg font-bold text-white">2 sheets</div><div className="text-xs text-slate-500">Plot + validasi</div></div>
                <div><div className="font-mono text-lg font-bold text-emerald-300">0 collision</div><div className="text-xs text-slate-500">Target solver</div></div>
              </div>
            </div>
          </section>

          <section id="upload" data-testid="upload-section" className="scroll-mt-24 py-12">
            <SectionHeading number="01" title="Upload & ekstraksi OCR" description="Gunakan pola nama KODENAMA_DIVISI agar identitas anggota terbaca otomatis." />
            <form data-testid="upload-form" onSubmit={submitFiles} className="grid gap-4 xl:grid-cols-[1fr_320px]">
              <label data-testid="upload-dropzone" className="group relative grid min-h-56 cursor-pointer place-items-center overflow-hidden border border-dashed border-blue-400/35 bg-blue-400/[0.035] p-8 text-center transition-[background-color,border-color] duration-200 hover:border-blue-300 hover:bg-blue-400/[0.07]">
                <input data-testid="upload-file-input" className="sr-only" type="file" accept=".pdf,.png,.jpg,.jpeg" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []))} />
                <div data-testid="upload-dropzone-content">
                  <span className="mx-auto mb-4 grid size-12 place-items-center border border-blue-400/25 bg-blue-400/10 text-blue-300"><UploadCloud className="size-6" /></span>
                  <div data-testid="upload-prompt" className="font-heading text-lg font-semibold text-white">Pilih PDF atau screenshot jadwal</div>
                  <div data-testid="upload-hint" className="mt-2 text-xs text-slate-500">Maks. 20 file · 12 MB/file · contoh AHL_FRONTEND.pdf</div>
                </div>
              </label>
              <div data-testid="selected-files-panel" className="flex flex-col border border-white/10 bg-[#111827] p-5">
                <div data-testid="selected-files-title" className="mb-3 text-sm font-semibold text-white">Antrian dokumen <span className="font-mono text-blue-300">({files.length})</span></div>
                <div data-testid="selected-files-list" className="min-h-24 flex-1 space-y-2">
                  {files.length ? files.map((file, index) => <div key={`${file.name}-${index}`} data-testid={`selected-file-${index}`} className="truncate border-l border-blue-400 bg-[#0b111d] px-3 py-2 font-mono text-[10px] text-slate-300">{file.name}</div>) : <div data-testid="selected-files-empty" className="text-xs leading-5 text-slate-500">Belum ada file. Nama yang tidak sesuai pola akan ditolak sebelum OCR.</div>}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button data-testid="load-sample-button" type="button" variant="outline" onClick={() => sampleMutation.mutate()} disabled={sampleMutation.isPending} className="border-white/10 bg-transparent text-slate-300 hover:bg-white/5 hover:text-white"><FlaskConical className="size-4" />Data contoh</Button>
                  <Button data-testid="extract-schedule-button" type="submit" disabled={extractMutation.isPending || !files.length} className="bg-blue-500 text-white hover:bg-blue-400 hover:text-white"><ScanLine className="size-4" />{extractMutation.isPending ? "Membaca…" : "Ekstrak"}</Button>
                </div>
              </div>
            </form>
          </section>

          <section id="review" data-testid="review-section" className="scroll-mt-24 border-t border-white/10 py-12">
            <SectionHeading number="02" title="Review & koreksi jadwal" description="Periksa hasil OCR. Edit hari, jam, atau mata kuliah sebelum solver dijalankan." trailing={schedules.length ? `${schedules.length} anggota` : undefined} />
            <ScheduleReview schedules={schedules} onChange={(next) => { setSchedules(next); setPlot(null); }} />
          </section>

          <section id="rules" data-testid="rules-section" className="scroll-mt-24 border-t border-white/10 py-12">
            <SectionHeading number="03" title="Aturan AutoPlot" description="Solver hanya memilih slot bebas dan membatalkan satu hari bila ada divisi yang tidak terwakili." />
            <div data-testid="rules-panel" className="grid gap-5 border border-white/10 bg-[#111827] p-5 lg:grid-cols-3">
              <label data-testid="duration-label" className="space-y-2 text-xs text-slate-400">Durasi shift
                <select data-testid="duration-select" value={config.shift_duration_hours} onChange={(event) => setConfig({ ...config, shift_duration_hours: Number(event.target.value) })} className="h-10 w-full border border-white/10 bg-[#0a0f19] px-3 font-mono text-sm text-white outline-none focus:border-blue-400"><option value={1}>1 jam</option><option value={2}>2 jam</option><option value={3}>3 jam</option><option value={4}>4 jam</option></select>
              </label>
              <label data-testid="operating-start-label" className="space-y-2 text-xs text-slate-400">Jam operasional mulai<Input data-testid="operating-start-input" type="time" value={config.operating_start} onChange={(event) => setConfig({ ...config, operating_start: event.target.value })} className="border-white/10 bg-[#0a0f19] font-mono text-white" /></label>
              <label data-testid="operating-end-label" className="space-y-2 text-xs text-slate-400">Jam operasional selesai<Input data-testid="operating-end-input" type="time" value={config.operating_end} onChange={(event) => setConfig({ ...config, operating_end: event.target.value })} className="border-white/10 bg-[#0a0f19] font-mono text-white" /></label>
              <div data-testid="active-days-control" className="lg:col-span-2">
                <div data-testid="active-days-label" className="mb-2 text-xs text-slate-400">Hari aktif</div>
                <div className="flex flex-wrap gap-2">{DAYS.map((day, index) => <button key={day} data-testid={`active-day-button-${index}`} type="button" onClick={() => toggleDay(day)} className={`border px-3 py-2 font-mono text-xs transition-[background-color,color,border-color] ${config.active_days.includes(day) ? "border-blue-400/50 bg-blue-400/15 text-blue-200" : "border-white/10 bg-transparent text-slate-500 hover:bg-white/5 hover:text-white"}`}>{day}</button>)}</div>
              </div>
              <Button data-testid="run-autoplot-button" type="button" onClick={() => plotMutation.mutate({ schedules, config })} disabled={!schedules.length || plotMutation.isPending} className="self-end bg-emerald-500 text-[#04130e] hover:bg-emerald-400 hover:text-[#04130e]"><Play className="size-4 fill-current" />{plotMutation.isPending ? "Menghitung…" : "Jalankan AutoPlot"}</Button>
            </div>
          </section>

          <section id="preview" data-testid="preview-section" className="scroll-mt-24 border-t border-white/10 py-12">
            <SectionHeading number="04" title="Matrix hasil plotting" description="Setiap kartu hari menampilkan kelengkapan coverage divisi dan shift bebas bentrok." trailing={plot ? `${plot.assignments.length} shift` : undefined} />
            <PlotMatrix plot={plot} />
          </section>

          <section id="export" data-testid="export-section" className="scroll-mt-24 border-t border-white/10 py-12">
            <div data-testid="export-panel" className="relative overflow-hidden border border-emerald-400/20 bg-emerald-400/[0.05] p-6 sm:p-8">
              <div className="absolute right-0 top-0 p-5 text-emerald-400/10"><FileSpreadsheet className="size-28" /></div>
              <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                <div><div data-testid="export-kicker" className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-300"><ShieldCheck className="size-4" />Validasi terlampir</div><h2 data-testid="export-title" className="font-heading text-2xl font-semibold text-white">Ekspor spreadsheet final</h2><p data-testid="export-description" className="mt-2 max-w-xl text-sm leading-6 text-slate-400">File XLSX berisi sheet “Plotting Utama” dan “Validasi & Error” untuk audit aturan coverage.</p></div>
                <Button data-testid="export-excel-button" type="button" size="lg" onClick={() => plot && exportMutation.mutate({ plot })} disabled={!plot || exportMutation.isPending} className="bg-emerald-500 text-[#04130e] hover:bg-emerald-400 hover:text-[#04130e]"><ArrowDownToLine className="size-4" />{exportMutation.isPending ? "Menyiapkan…" : "Unduh .XLSX"}</Button>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function SectionHeading({ number, title, description, trailing }: { number: string; title: string; description: string; trailing?: string }) {
  return <div data-testid={`section-heading-${number}`} className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><div data-testid={`section-number-${number}`} className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-blue-400">Tahap {number}</div><h2 data-testid={`section-title-${number}`} className="font-heading text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h2><p data-testid={`section-description-${number}`} className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{description}</p></div>{trailing && <Badge data-testid={`section-trailing-${number}`} variant="outline" className="w-fit border-white/10 bg-white/5 font-mono text-slate-300">{trailing}</Badge>}</div>;
}
