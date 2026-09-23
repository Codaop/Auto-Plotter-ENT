import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  FolderOpen,
  History,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { PlotMatrix } from "@/components/PlotMatrix";
import { ScheduleReview } from "@/components/ScheduleReview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ApiError, apiDownload, apiPost, apiUpload } from "@/lib/api";
import {
  formatBytes,
  hasInvalidScheduleTimes,
  parseScheduleFilename,
  REQUIRED_DIVISIONS,
} from "@/lib/files";
import {
  clearAllLocalData,
  deleteHistory,
  fileHash,
  getExtractionCache,
  listHistories,
  putExtractionCache,
  putHistory,
  storageUsage,
} from "@/lib/storage";
import type {
  BatchHistory,
  DayName,
  ExportRequest,
  MemberSchedule,
  PlotConfig,
  PlotRequest,
  PlotResponse,
  QueuedFile,
} from "@/types/roster";

const DAYS: DayName[] = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"];
const DEFAULT_CONFIG: PlotConfig = {
  shift_duration_hours: 2,
  operating_start: "07:00",
  operating_end: "18:00",
  active_days: DAYS,
};
const STEPS = [
  "Upload jadwal",
  "Koreksi hasil",
  "Atur plotting",
  "Periksa hasil",
  "Unduh XLSX",
];

function errorMessage(error: unknown): string {
  if (
    error instanceof ApiError &&
    error.body &&
    typeof error.body === "object" &&
    "detail" in error.body
  ) {
    const detail = (error.body as { detail?: unknown }).detail;
    return typeof detail === "string"
      ? detail
      : "Data belum valid. Periksa kembali input Anda.";
  }
  return error instanceof Error
    ? error.message
    : "Terjadi kesalahan yang tidak diketahui.";
}

function downloadBlob(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(href), 1000);
}

export default function Home() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cancelQueueRef = useRef(false);
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [schedules, setSchedules] = useState<MemberSchedule[]>([]);
  const [config, setConfig] = useState<PlotConfig>(DEFAULT_CONFIG);
  const [plot, setPlot] = useState<PlotResponse | null>(null);
  const [batchId, setBatchId] = useState(() =>
    crypto.randomUUID().slice(0, 8).toUpperCase(),
  );
  const [batchCreatedAt, setBatchCreatedAt] = useState(() =>
    new Date().toISOString(),
  );
  const [revision, setRevision] = useState(0);
  const [savedRevision, setSavedRevision] = useState(0);
  const [plotRevision, setPlotRevision] = useState<number | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [currentXlsx, setCurrentXlsx] = useState<Blob | undefined>();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const historiesQuery = useQuery({
    queryKey: ["batch-histories"],
    queryFn: listHistories,
  });
  const quotaQuery = useQuery({
    queryKey: ["storage-usage"],
    queryFn: storageUsage,
  });
  const histories = historiesQuery.data ?? [];

  const invalidateOutput = (needsReview = false) => {
    setRevision((value) => value + 1);
    setPlotRevision(null);
    setCurrentXlsx(undefined);
    if (needsReview) setReviewed(false);
  };

  const updateQueueItem = (id: string, patch: Partial<QueuedFile>) => {
    setQueue((items) =>
      items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  };

  const addFiles = async (selected: File[]) => {
    if (selected.length > 20)
      toast.error("Maksimal 20 file dalam satu kali pemilihan");
    const next = [...queue];
    for (const file of selected.slice(0, 20)) {
      const parsed = parseScheduleFilename(file.name);
      const hash = await fileHash(file);
      const existing = next.find(
        (item) => item.file.name === file.name || item.hash === hash,
      );
      const cached =
        parsed.valid && parsed.supported
          ? await getExtractionCache(hash)
          : undefined;
      const tooLarge = file.size > 12 * 1024 * 1024;
      const unsupported = parsed.valid && !parsed.supported;
      const item: QueuedFile = {
        id: crypto.randomUUID(),
        file,
        hash,
        parsed,
        status:
          tooLarge || !parsed.valid
            ? "invalid"
            : unsupported
              ? "unsupported"
              : existing
                ? "duplicate"
                : cached
                  ? "cached"
                  : "valid",
        error: tooLarge ? "Ukuran file melebihi 12 MB" : parsed.error,
        duplicateOf: existing?.id,
        cachedMembers: cached?.members,
      };
      next.push(item);
    }
    setQueue(next);
    invalidateOutput();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const extractionMutation = useMutation({
    mutationFn: async (items: QueuedFile[]) => {
      cancelQueueRef.current = false;
      const extracted: { item: QueuedFile; members: MemberSchedule[] }[] = [];
      for (const item of items) {
        if (cancelQueueRef.current) break;
        updateQueueItem(item.id, { status: "processing", error: undefined });
        try {
          const formData = new FormData();
          formData.append("files", item.file);
          const response = await apiUpload<{
            members: MemberSchedule[];
            warnings: string[];
          }>("/roster/extract", formData);
          const members = response.members;
          if (!members.length) throw new Error("AI tidak menemukan jadwal");
          await putExtractionCache({
            hash: item.hash,
            members,
            updated_at: new Date().toISOString(),
          });
          updateQueueItem(item.id, { status: "done" });
          extracted.push({ item, members });
          response.warnings.forEach((warning) => toast.warning(warning));
        } catch (error) {
          updateQueueItem(item.id, {
            status: "error",
            error: errorMessage(error),
          });
        }
      }
      return extracted;
    },
    onSuccess: (results) => {
      if (results.length) {
        setSchedules((current) => {
          const sources = new Set(current.map((member) => member.source_file));
          return [
            ...current,
            ...results
              .flatMap((result) => result.members)
              .filter(
                (member) =>
                  !sources.has(`${member.source_file}:${member.code}`),
              ),
          ];
        });
        invalidateOutput(true);
        toast.success(
          `${results.reduce((total, result) => total + result.members.length, 0)} jadwal anggota selesai dibaca`,
        );
        document.getElementById("review")?.scrollIntoView({ block: "start" });
      } else if (cancelQueueRef.current) toast.info("Sisa antrian dibatalkan");
      else toast.error("Tidak ada file yang berhasil diekstrak");
    },
  });

  const useCachedResult = (item: QueuedFile) => {
    if (!item.cachedMembers?.length) return;
    setSchedules((current) => {
      const existing = new Set(
        current.map((member) => `${member.source_file}:${member.code}`),
      );
      return [
        ...current,
        ...(item.cachedMembers ?? []).filter(
          (member) => !existing.has(`${member.source_file}:${member.code}`),
        ),
      ];
    });
    updateQueueItem(item.id, { status: "done" });
    invalidateOutput(true);
  };

  const persistCurrent = async (
    xlsx = currentXlsx,
    markReviewed = reviewed,
  ) => {
    if (!schedules.length)
      throw new Error("Belum ada hasil jadwal untuk disimpan");
    const existing = histories.find((history) => history.id === batchId);
    if (!existing && histories.length >= 20) {
      const oldest = histories.at(-1);
      const replace = window.confirm(
        `Riwayat sudah berisi 20 batch. Ganti batch tertua “${oldest?.name ?? "-"}”?`,
      );
      if (!replace || !oldest)
        throw new Error("Pilih satu riwayat untuk dihapus sebelum menyimpan");
      await deleteHistory(oldest.id);
    }
    const now = new Date().toISOString();
    const history: BatchHistory = {
      id: batchId,
      name: `Batch ${batchId}`,
      created_at: existing?.created_at ?? batchCreatedAt,
      updated_at: now,
      members: schedules,
      config,
      plot,
      source_hashes: queue
        .filter((item) => item.status === "done")
        .map((item) => item.hash),
      reviewed: markReviewed,
      xlsx,
    };
    await putHistory(history);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["batch-histories"] }),
      queryClient.invalidateQueries({ queryKey: ["storage-usage"] }),
    ]);
    setSavedRevision(revision);
  };

  const saveMutation = useMutation({
    mutationFn: () => persistCurrent(currentXlsx, true),
    onSuccess: () => {
      setReviewed(true);
      toast.success("Koreksi tersimpan di riwayat browser");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const plotMutation = useMutation({
    mutationFn: (payload: PlotRequest) =>
      apiPost<PlotResponse>("/roster/plot", payload),
    onSuccess: (data) => {
      setPlot(data);
      setPlotRevision(revision);
      setCurrentXlsx(undefined);
      toast.success(
        data.complete_days.length
          ? `${data.complete_days.length} hari berhasil diplot`
          : "Plot selesai dengan masalah yang perlu diperiksa",
      );
      document.getElementById("preview")?.scrollIntoView({ block: "start" });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const exportMutation = useMutation({
    mutationFn: (payload: ExportRequest) =>
      apiDownload("/roster/export", payload),
    onSuccess: async (blob) => {
      setCurrentXlsx(blob);
      downloadBlob(blob, `plot-absensi-${batchId}.xlsx`);
      await persistCurrent(blob, true);
      toast.success(
        "Spreadsheet dibuat, diunduh, dan disimpan di riwayat lokal",
      );
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const requiredPresent = REQUIRED_DIVISIONS.filter((division) =>
    schedules.some((member) => member.division === division),
  );
  const invalidTimes = hasInvalidScheduleTimes(schedules);
  const plotCurrent = Boolean(plot && plotRevision === revision);
  const exportReasons = [
    requiredPresent.length < 8 &&
      `Kurang ${8 - requiredPresent.length} divisi wajib`,
    !reviewed && "Hasil OCR belum disimpan sebagai koreksi final",
    invalidTimes && "Ada rentang jam jadwal yang tidak valid",
    (!plot || !plot.complete_days.length) &&
      "Belum ada hari dengan coverage delapan divisi",
    plot && !plotCurrent && "Hasil plotting sudah tidak sesuai batch aktif",
  ].filter(Boolean) as string[];
  const exportAllowed =
    exportReasons.length === 0 && Boolean(plot?.export_ready);
  const dirty = schedules.length > 0 && revision !== savedRevision;

  const runPlot = () => {
    if (invalidTimes)
      return toast.error(
        "Perbaiki jadwal dengan jam selesai yang tidak lebih besar dari jam mulai",
      );
    plotMutation.mutate({ batch_id: batchId, schedules, config });
  };

  const runExport = () => {
    if (!plot || !exportAllowed)
      return toast.error(exportReasons[0] ?? "Plot belum siap diekspor");
    if (currentXlsx) {
      downloadBlob(currentXlsx, `plot-absensi-${batchId}.xlsx`);
      toast.success("Spreadsheet diunduh ulang dari cache browser");
      return;
    }
    exportMutation.mutate({ batch_id: batchId, plot });
  };

  const clearActive = () => {
    setQueue([]);
    setSchedules([]);
    setConfig(DEFAULT_CONFIG);
    setPlot(null);
    setReviewed(false);
    setCurrentXlsx(undefined);
    setBatchId(crypto.randomUUID().slice(0, 8).toUpperCase());
    setBatchCreatedAt(new Date().toISOString());
    setRevision(0);
    setSavedRevision(0);
    setPlotRevision(null);
    setClearOpen(false);
    setConfirmClearAll(false);
    toast.success("Batch aktif dibersihkan; riwayat tetap tersimpan");
  };

  const clearEverything = async () => {
    await clearAllLocalData();
    clearActive();
    await queryClient.invalidateQueries({ queryKey: ["batch-histories"] });
    toast.success("Batch aktif dan seluruh riwayat telah dihapus");
  };

  const openHistory = async (history: BatchHistory) => {
    if (dirty) {
      const saveFirst = window.confirm(
        "Batch aktif belum tersimpan. Simpan sebelum membuka riwayat?",
      );
      if (!saveFirst) return;
      try {
        await persistCurrent();
      } catch (error) {
        toast.error(errorMessage(error));
        return;
      }
    }
    setBatchId(history.id);
    setBatchCreatedAt(history.created_at);
    setSchedules(history.members);
    setConfig(history.config);
    setPlot(history.plot);
    setReviewed(history.reviewed);
    setCurrentXlsx(history.xlsx);
    setQueue([]);
    setRevision(0);
    setSavedRevision(0);
    setPlotRevision(history.plot ? 0 : null);
    setHistoryOpen(false);
    toast.success(`${history.name} dibuka`);
  };

  const submitFiles = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const ready = queue.filter((item) => item.status === "valid");
    if (!ready.length)
      return toast.error("Tidak ada file baru yang siap diekstrak");
    extractionMutation.mutate(ready);
  };

  return (
    <div
      data-testid="autoplot-app"
      className="min-h-screen bg-[#f3f6f9] text-slate-800"
    >
      <header
        data-testid="app-header"
        className="border-b border-[#0d365f] bg-[#134679] text-white"
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div data-testid="brand-lockup" className="min-w-0">
            <div
              data-testid="brand-name"
              className="truncate text-lg font-bold tracking-tight"
            >
              AutoPlot Lab
            </div>
          </div>
          <Button
            data-testid="history-button"
            type="button"
            variant="outline"
            onClick={() => setHistoryOpen(true)}
            className="shrink-0 border-white/30 bg-transparent px-3 text-white hover:bg-white/10 hover:text-white"
          >
            <History className="size-4" />
            Riwayat ({histories.length})
          </Button>
        </div>
      </header>

      <main
        data-testid="main-workspace"
        className="mx-auto max-w-6xl px-4 pb-20 sm:px-6"
      >
        <section data-testid="hero-section" className="py-9">
          <h1
            data-testid="hero-title"
            className="max-w-3xl text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl"
          >
            Plot absensi otomatis dari jadwal kuliah.
          </h1>
          <p
            data-testid="hero-description"
            className="mt-3 max-w-3xl text-sm leading-6 text-slate-600"
          >
            Upload jadwal anggota, koreksi hasil pembacaan, lalu buat plotting
            delapan divisi tanpa bentrok kuliah.
          </p>
        </section>

        <nav
          data-testid="workflow-steps"
          className="mb-8 grid grid-cols-2 border border-slate-200 bg-white sm:grid-cols-5"
        >
          {STEPS.map((step, index) => (
            <div
              key={step}
              data-testid={`workflow-step-${index}`}
              className="flex items-center gap-2 border-b border-r border-slate-200 px-3 py-3 text-xs text-slate-600 last:border-r-0 sm:border-b-0"
            >
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[#134679] font-mono text-[10px] text-white">
                {index + 1}
              </span>
              {step}
            </div>
          ))}
        </nav>

        <section
          id="upload"
          data-testid="upload-section"
          className="section-block"
        >
          <SectionHeading
            number="01"
            title="Upload jadwal"
            description="Unggah file teks berisi satu atau banyak jadwal; identitas anggota dibaca dari isi file."
          />
          <form
            data-testid="upload-form"
            onSubmit={submitFiles}
            className="rounded-sm border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div
                  data-testid="upload-summary"
                  className="text-sm font-semibold text-slate-900"
                >
                  Antrian file ({queue.length})
                </div>
                <div
                  data-testid="upload-limits"
                  className="mt-1 text-xs text-slate-500"
                >
                  File apa pun dapat dipilih; TXT, MD, CSV, dan JSON akan
                  diproses · maksimal 20 file/pemilihan
                </div>
              </div>
              <div
                data-testid="upload-batch-actions"
                className="grid grid-cols-2 gap-2 sm:flex"
              >
                <Button
                  data-testid="new-batch-button"
                  type="button"
                  variant="outline"
                  onClick={() => setClearOpen(true)}
                  className="h-10 border-slate-300 px-4 text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                >
                  <RotateCcw className="size-4" />
                  Batch Baru / Clear
                </Button>
                <label
                  data-testid="upload-file-label"
                  className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-sm border border-[#134679] px-4 text-sm font-medium text-[#134679] hover:bg-blue-50"
                >
                  <Plus className="size-4" />
                  Tambah file
                  <input
                    ref={fileInputRef}
                    data-testid="upload-file-input"
                    className="sr-only"
                    type="file"
                    multiple
                    onChange={(event) =>
                      void addFiles(Array.from(event.target.files ?? []))
                    }
                  />
                </label>
              </div>
            </div>
            <div
              data-testid="selected-files-list"
              className="divide-y divide-slate-200"
            >
              {!queue.length && (
                <div
                  data-testid="selected-files-empty"
                  className="py-10 text-center text-sm text-slate-500"
                >
                  Belum ada file dalam batch aktif.
                </div>
              )}
              {queue.map((item, index) => (
                <QueueRow
                  key={item.id}
                  item={item}
                  index={index}
                  onRemove={() =>
                    setQueue((items) =>
                      items.filter((entry) => entry.id !== item.id),
                    )
                  }
                  onKeep={() =>
                    setQueue((items) =>
                      items.filter((entry) => entry.id !== item.id),
                    )
                  }
                  onReplace={() =>
                    setQueue((items) =>
                      items
                        .filter((entry) => entry.id !== item.duplicateOf)
                        .map((entry) =>
                          entry.id === item.id
                            ? {
                                ...entry,
                                duplicateOf: undefined,
                                status: entry.cachedMembers?.length
                                  ? "cached"
                                  : "valid",
                              }
                            : entry,
                        ),
                    )
                  }
                  onCache={() => useCachedResult(item)}
                  onFresh={() => updateQueueItem(item.id, { status: "valid" })}
                />
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 pt-4">
              <div
                data-testid="upload-process-status"
                className="text-xs text-slate-500"
              >
                {extractionMutation.isPending
                  ? "Memproses satu file pada satu waktu…"
                  : "File valid diproses berurutan agar kegagalan dapat dilanjutkan."}
              </div>
              {extractionMutation.isPending ? (
                <Button
                  data-testid="cancel-queue-button"
                  type="button"
                  variant="outline"
                  onClick={() => {
                    cancelQueueRef.current = true;
                  }}
                  className="border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                >
                  Batalkan sisa
                </Button>
              ) : (
                <Button
                  data-testid="extract-schedule-button"
                  type="submit"
                  disabled={!queue.some((item) => item.status === "valid")}
                  className="bg-[#134679] text-white hover:bg-[#0e385f] hover:text-white"
                >
                  <Upload className="size-4" />
                  Ekstrak jadwal
                </Button>
              )}
            </div>
          </form>
        </section>

        <section
          id="review"
          data-testid="review-section"
          className="section-block"
        >
          <SectionHeading
            number="02"
            title="Review jadwal"
            description="Periksa hari, rentang jam, dan mata kuliah sebelum menyimpan koreksi."
            trailing={
              schedules.length ? `${schedules.length} anggota` : undefined
            }
          />
          <ScheduleReview
            schedules={schedules}
            onChange={(next) => {
              setSchedules(next);
              invalidateOutput(true);
            }}
            onSave={() => saveMutation.mutate()}
            saving={saveMutation.isPending}
          />
        </section>

        <section
          id="rules"
          data-testid="rules-section"
          className="section-block"
        >
          <SectionHeading
            number="03"
            title="Aturan plotting"
            description="Shift tidak boleh bentrok kuliah dan setiap hari hasil wajib memuat kedelapan divisi."
          />
          <div
            data-testid="division-readiness"
            className="mb-4 rounded-sm border border-slate-200 bg-white p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-900">
                Kelengkapan divisi
              </span>
              <span
                data-testid="division-count"
                className="font-mono text-xs text-slate-600"
              >
                {requiredPresent.length}/8 tersedia
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {REQUIRED_DIVISIONS.map((division, index) => {
                const ready = requiredPresent.includes(division);
                return (
                  <Badge
                    key={division}
                    data-testid={`required-division-${index}`}
                    variant="outline"
                    className={
                      ready
                        ? "border-teal-200 bg-teal-50 font-mono text-teal-800"
                        : "border-slate-200 bg-slate-50 font-mono text-slate-400"
                    }
                  >
                    {division}
                    {ready ? " ✓" : ""}
                  </Badge>
                );
              })}
            </div>
          </div>
          <div
            data-testid="rules-panel"
            className="grid gap-5 rounded-sm border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-3"
          >
            <label
              data-testid="duration-label"
              className="space-y-2 text-xs font-medium text-slate-600"
            >
              Durasi shift
              <select
                data-testid="duration-select"
                value={config.shift_duration_hours}
                onChange={(event) => {
                  setConfig({
                    ...config,
                    shift_duration_hours: Number(event.target.value),
                  });
                  invalidateOutput();
                }}
                className="h-10 w-full rounded-sm border border-slate-300 bg-white px-3 font-mono text-sm text-slate-800 outline-none focus:border-[#226DB8]"
              >
                <option value={1}>1 jam</option>
                <option value={2}>2 jam</option>
                <option value={3}>3 jam</option>
                <option value={4}>4 jam</option>
              </select>
            </label>
            <label
              data-testid="operating-start-label"
              className="space-y-2 text-xs font-medium text-slate-600"
            >
              Jam mulai
              <Input
                data-testid="operating-start-input"
                type="time"
                value={config.operating_start}
                onChange={(event) => {
                  setConfig({ ...config, operating_start: event.target.value });
                  invalidateOutput();
                }}
                className="border-slate-300 bg-white font-mono text-slate-800"
              />
            </label>
            <label
              data-testid="operating-end-label"
              className="space-y-2 text-xs font-medium text-slate-600"
            >
              Jam selesai
              <Input
                data-testid="operating-end-input"
                type="time"
                value={config.operating_end}
                onChange={(event) => {
                  setConfig({ ...config, operating_end: event.target.value });
                  invalidateOutput();
                }}
                className="border-slate-300 bg-white font-mono text-slate-800"
              />
            </label>
            <div data-testid="active-days-control" className="lg:col-span-2">
              <div className="mb-2 text-xs font-medium text-slate-600">
                Hari aktif
              </div>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((day, index) => (
                  <button
                    key={day}
                    data-testid={`active-day-button-${index}`}
                    type="button"
                    onClick={() => {
                      setConfig((current) => ({
                        ...current,
                        active_days: current.active_days.includes(day)
                          ? current.active_days.filter((item) => item !== day)
                          : [...current.active_days, day],
                      }));
                      invalidateOutput();
                    }}
                    className={`rounded-sm border px-3 py-2 font-mono text-xs ${config.active_days.includes(day) ? "border-[#134679] bg-blue-50 text-[#134679]" : "border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
            <Button
              data-testid="run-autoplot-button"
              type="button"
              onClick={runPlot}
              disabled={!schedules.length || plotMutation.isPending}
              className="self-end bg-[#134679] text-white hover:bg-[#0e385f] hover:text-white"
            >
              {plotMutation.isPending ? "Menghitung…" : "Jalankan AutoPlot"}
            </Button>
          </div>
        </section>

        <section
          id="preview"
          data-testid="preview-section"
          className="section-block"
        >
          <SectionHeading
            number="04"
            title="Hasil plotting"
            description="Coverage lengkap ditampilkan ringkas; detail hanya muncul bila perlu tindakan."
            trailing={plot ? `${plot.assignments.length} shift` : undefined}
          />
          <PlotMatrix plot={plot} />
        </section>

        <section
          id="export"
          data-testid="export-section"
          className="section-block"
        >
          <SectionHeading
            number="05"
            title="Unduh spreadsheet"
            description="Spreadsheet dibuat saat diminta dan salinan terakhir disimpan di riwayat browser."
          />
          <div
            data-testid="export-panel"
            className="rounded-sm border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <Summary
                label="Jumlah shift"
                value={String(plot?.assignments.length ?? 0)}
              />
              <Summary
                label="Divisi tersedia"
                value={`${requiredPresent.length}/8`}
              />
              <Summary
                label="Status validasi"
                value={exportAllowed ? "Siap diekspor" : "Belum siap"}
                success={exportAllowed}
              />
            </div>
            {!!exportReasons.length && (
              <div
                data-testid="export-blockers"
                className="mt-4 rounded-sm border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900"
              >
                {exportReasons.join(" · ")}
              </div>
            )}
            <div className="mt-5 flex justify-end">
              <Button
                data-testid="export-excel-button"
                type="button"
                onClick={runExport}
                disabled={!exportAllowed || exportMutation.isPending}
                className="bg-[#134679] text-white hover:bg-[#0e385f] hover:text-white"
              >
                <Download className="size-4" />
                {currentXlsx
                  ? "Unduh ulang XLSX"
                  : exportMutation.isPending
                    ? "Membuat…"
                    : "Unduh Spreadsheet"}
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent
          data-testid="history-sheet"
          className="w-full border-slate-200 bg-white text-slate-800 sm:max-w-lg"
        >
          <SheetHeader>
            <SheetTitle>Riwayat batch lokal</SheetTitle>
            <SheetDescription>
              Maksimal 20 batch pada browser ini. Data hilang jika data situs
              dibersihkan.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            <div
              data-testid="storage-usage"
              className={`mb-4 rounded-sm border p-3 text-xs ${quotaQuery.data && quotaQuery.data.ratio > 0.8 ? "border-amber-200 bg-amber-50 text-amber-900" : "border-slate-200 bg-slate-50 text-slate-600"}`}
            >
              Penggunaan penyimpanan: {formatBytes(quotaQuery.data?.usage ?? 0)}
              {quotaQuery.data?.quota
                ? ` dari ${formatBytes(quotaQuery.data.quota)}`
                : ""}
            </div>
            <div className="space-y-3">
              {histories.map((history, index) => (
                <div
                  key={history.id}
                  data-testid={`history-item-${index}`}
                  className="rounded-sm border border-slate-200 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">
                        {history.name}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {history.members.length} anggota ·{" "}
                        {new Date(history.updated_at).toLocaleString("id-ID")}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        history.plot?.export_ready
                          ? "border-teal-200 bg-teal-50 text-teal-800"
                          : "border-amber-200 bg-amber-50 text-amber-800"
                      }
                    >
                      {history.plot?.export_ready ? "Lengkap" : "Belum lengkap"}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      data-testid={`open-history-button-${index}`}
                      size="sm"
                      variant="outline"
                      onClick={() => void openHistory(history)}
                      className="border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                    >
                      <FolderOpen className="size-4" />
                      Buka
                    </Button>
                    {history.xlsx && (
                      <Button
                        data-testid={`download-history-button-${index}`}
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          downloadBlob(
                            history.xlsx!,
                            `plot-absensi-${history.id}.xlsx`,
                          )
                        }
                        className="border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                      >
                        <Download className="size-4" />
                        XLSX
                      </Button>
                    )}
                    <Button
                      data-testid={`delete-history-button-${index}`}
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await deleteHistory(history.id);
                        await queryClient.invalidateQueries({
                          queryKey: ["batch-histories"],
                        });
                      }}
                      className="text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                    >
                      <Trash2 className="size-4" />
                      Hapus
                    </Button>
                  </div>
                </div>
              ))}
              {!histories.length && (
                <div
                  data-testid="history-empty"
                  className="py-10 text-center text-sm text-slate-500"
                >
                  Belum ada batch tersimpan.
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog
        open={clearOpen}
        onOpenChange={(open) => {
          setClearOpen(open);
          if (!open) setConfirmClearAll(false);
        }}
      >
        <DialogContent
          data-testid="clear-batch-dialog"
          className="border-slate-200 bg-white text-slate-800"
        >
          <DialogHeader>
            <DialogTitle>
              {confirmClearAll
                ? "Konfirmasi hapus semua riwayat"
                : "Batch Baru / Clear"}
            </DialogTitle>
            <DialogDescription>
              {confirmClearAll
                ? `${histories.length} batch dan ${histories.filter((item) => item.xlsx).length} file XLSX akan hilang permanen dari browser ini.`
                : "Pilih data yang ingin dibersihkan. Daftar kode divisi dan preferensi tidak ikut dihapus."}
            </DialogDescription>
          </DialogHeader>
          {confirmClearAll ? (
            <DialogFooter>
              <Button
                data-testid="cancel-clear-all-button"
                variant="outline"
                onClick={() => setConfirmClearAll(false)}
                className="border-slate-300 hover:bg-slate-50 hover:text-slate-900"
              >
                Kembali
              </Button>
              <Button
                data-testid="confirm-clear-all-button"
                variant="destructive"
                onClick={() => void clearEverything()}
              >
                Ya, hapus semuanya
              </Button>
            </DialogFooter>
          ) : (
            <div className="grid gap-3">
              <Button
                data-testid="clear-active-button"
                variant="outline"
                onClick={clearActive}
                className="justify-start border-slate-300 hover:bg-slate-50 hover:text-slate-900"
              >
                Bersihkan batch aktif
              </Button>
              <Button
                data-testid="clear-active-history-button"
                variant="destructive"
                onClick={() => setConfirmClearAll(true)}
                className="justify-start"
              >
                Bersihkan batch aktif dan semua riwayat
              </Button>
              <Button
                data-testid="cancel-clear-button"
                variant="ghost"
                onClick={() => setClearOpen(false)}
                className="hover:bg-slate-50 hover:text-slate-900"
              >
                Batal
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function QueueRow({
  item,
  index,
  onRemove,
  onKeep,
  onReplace,
  onCache,
  onFresh,
}: {
  item: QueuedFile;
  index: number;
  onRemove: () => void;
  onKeep: () => void;
  onReplace: () => void;
  onCache: () => void;
  onFresh: () => void;
}) {
  const valid =
    item.parsed.valid &&
    item.parsed.supported &&
    item.status !== "invalid" &&
    item.status !== "unsupported" &&
    item.status !== "error";
  return (
    <div data-testid={`selected-file-${index}`} className="min-h-23 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <span
          className={`grid size-8 shrink-0 place-items-center rounded-sm ${valid ? "bg-blue-50 text-[#134679]" : "bg-rose-50 text-rose-700"}`}
        >
          <FileText className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div
            data-testid={`selected-file-name-${index}`}
            className="truncate font-mono text-xs font-medium text-slate-900"
          >
            {item.file.name}
          </div>
          <div
            data-testid={`selected-file-meta-${index}`}
            className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500"
          >
            <span>{formatBytes(item.file.size)}</span>
            {item.parsed.valid && item.parsed.supported && (
              <>
                <span>Identitas dibaca dari isi file</span>
              </>
            )}
            <span className={valid ? "text-teal-700" : "text-rose-700"}>
              {item.status === "processing"
                ? "Memproses teks dengan AI…"
                : item.status === "done"
                  ? "Selesai"
                  : item.status === "cached"
                    ? "Tersedia di cache"
                    : item.status === "unsupported"
                      ? "Format dipisahkan"
                      : (item.error ?? item.status)}
            </span>
          </div>
        </div>
        <Button
          data-testid={`remove-file-button-${index}`}
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          disabled={item.status === "processing"}
          className="text-slate-400 hover:bg-rose-50 hover:text-rose-700"
          aria-label={`Hapus ${item.file.name}`}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
      {item.status === "duplicate" && (
        <div
          data-testid={`duplicate-actions-${index}`}
          className="mt-2 flex items-center justify-end gap-2 text-xs"
        >
          <span className="mr-auto text-amber-700">
            Nama atau isi file sudah ada.
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onKeep}
            data-testid={`keep-old-file-button-${index}`}
            className="border-slate-300 hover:bg-slate-50 hover:text-slate-900"
          >
            Pertahankan lama
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onReplace}
            data-testid={`replace-file-button-${index}`}
            className="bg-[#134679] text-white hover:bg-[#0e385f] hover:text-white"
          >
            Ganti
          </Button>
        </div>
      )}
      {item.status === "cached" && (
        <div
          data-testid={`cache-actions-${index}`}
          className="mt-2 flex items-center justify-end gap-2 text-xs"
        >
          <span className="mr-auto text-[#134679]">
            Hasil ekstraksi identik ditemukan di browser.
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onFresh}
            data-testid={`fresh-ocr-button-${index}`}
            className="border-slate-300 hover:bg-slate-50 hover:text-slate-900"
          >
            OCR ulang
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onCache}
            data-testid={`use-cache-button-${index}`}
            className="bg-[#134679] text-white hover:bg-[#0e385f] hover:text-white"
          >
            Gunakan cache
          </Button>
        </div>
      )}
    </div>
  );
}

function SectionHeading({
  number,
  title,
  description,
  trailing,
}: {
  number: string;
  title: string;
  description: string;
  trailing?: string;
}) {
  return (
    <div
      data-testid={`section-heading-${number}`}
      className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"
    >
      <div>
        <div
          data-testid={`section-number-${number}`}
          className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#226DB8]"
        >
          Langkah {number}
        </div>
        <h2
          data-testid={`section-title-${number}`}
          className="text-xl font-bold tracking-tight text-slate-950"
        >
          {title}
        </h2>
        <p
          data-testid={`section-description-${number}`}
          className="mt-1 max-w-3xl text-sm text-slate-600"
        >
          {description}
        </p>
      </div>
      {trailing && (
        <Badge
          data-testid={`section-trailing-${number}`}
          variant="outline"
          className="w-fit border-slate-200 bg-white font-mono text-slate-600"
        >
          {trailing}
        </Badge>
      )}
    </div>
  );
}

function Summary({
  label,
  value,
  success = false,
}: {
  label: string;
  value: string;
  success?: boolean;
}) {
  return (
    <div className="rounded-sm border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div
        className={`mt-1 font-mono text-sm font-semibold ${success ? "text-teal-700" : "text-slate-900"}`}
      >
        {value}
      </div>
    </div>
  );
}
