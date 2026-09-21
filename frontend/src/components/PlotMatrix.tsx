import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { DayName, PlotResponse } from "@/types/roster";

const DAYS: DayName[] = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

interface PlotMatrixProps {
  plot: PlotResponse | null;
}

export function PlotMatrix({ plot }: PlotMatrixProps) {
  if (!plot) {
    return <div data-testid="plot-empty-state" className="border border-dashed border-white/15 bg-[#0d1320] px-6 py-10 text-center text-sm text-slate-400">Jalankan AutoPlot setelah jadwal selesai direview.</div>;
  }

  return (
    <div data-testid="plot-result" className="space-y-5">
      <div data-testid="coverage-grid" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {DAYS.slice(0, 5).map((day, index) => {
          const coverage = plot.coverage_by_day[day] ?? [];
          const complete = coverage.length === plot.divisions.length;
          return (
            <div key={day} data-testid={`coverage-card-${index}`} className={`border p-4 ${complete ? "border-emerald-400/25 bg-emerald-400/5" : "border-rose-400/25 bg-rose-400/5"}`}>
              <div data-testid={`coverage-day-${index}`} className="mb-3 flex items-center justify-between text-sm font-semibold text-white">
                {day}
                {complete ? <CheckCircle2 className="size-4 text-emerald-400" /> : <AlertTriangle className="size-4 text-rose-400" />}
              </div>
              <div data-testid={`coverage-badges-${index}`} className="flex flex-wrap gap-1.5">
                {coverage.length ? coverage.map((division) => <Badge key={division} variant="outline" className="border-white/10 bg-white/5 font-mono text-[10px] text-slate-300">{division}</Badge>) : <span className="text-xs text-rose-300">Belum memenuhi aturan</span>}
              </div>
            </div>
          );
        })}
      </div>

      <div data-testid="assignment-table-wrapper" className="border border-white/10 bg-[#111827]">
        <Table data-testid="assignment-table">
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-transparent">
              <TableHead className="text-slate-400">Hari</TableHead>
              <TableHead className="text-slate-400">Shift</TableHead>
              <TableHead className="text-slate-400">Anggota</TableHead>
              <TableHead className="text-slate-400">Divisi</TableHead>
              <TableHead className="text-right text-slate-400">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plot.assignments.map((assignment, index) => (
              <TableRow key={assignment.id} data-testid={`assignment-row-${index}`} className="border-white/10 hover:bg-white/[0.03]">
                <TableCell data-testid={`assignment-day-${index}`} className="font-medium text-white">{assignment.day}</TableCell>
                <TableCell data-testid={`assignment-time-${index}`} className="font-mono text-xs text-amber-300">{assignment.start_time}—{assignment.end_time}</TableCell>
                <TableCell data-testid={`assignment-member-${index}`} className="font-mono text-slate-200">{assignment.member_code}</TableCell>
                <TableCell data-testid={`assignment-division-${index}`}><Badge variant="outline" className="border-blue-400/30 bg-blue-400/10 font-mono text-blue-300">{assignment.division}</Badge></TableCell>
                <TableCell data-testid={`assignment-status-${index}`} className="text-right text-xs text-emerald-300">Bebas bentrok</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div data-testid="validation-list" className="space-y-2">
        {plot.validations.map((item, index) => (
          <div key={`${item.day}-${index}`} data-testid={`validation-item-${index}`} className={`flex gap-3 border px-4 py-3 text-sm ${item.level === "ok" ? "border-emerald-400/20 bg-emerald-400/5 text-emerald-200" : "border-rose-400/20 bg-rose-400/5 text-rose-200"}`}>
            {item.level === "ok" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0" />}
            <span>{item.day ? `${item.day}: ` : ""}{item.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}