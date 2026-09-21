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
    return <div data-testid="plot-empty-state" className="rounded-sm border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">Jalankan AutoPlot setelah jadwal selesai direview.</div>;
  }

  return (
    <div data-testid="plot-result" className="space-y-5">
      <div data-testid="plot-summary" className={`rounded-sm border px-4 py-3 text-sm ${plot.complete_days.length ? "border-teal-200 bg-teal-50 text-teal-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
        {plot.complete_days.length ? `${plot.complete_days.length} hari memenuhi seluruh delapan divisi tanpa bentrok.` : "Belum ada hari yang memenuhi seluruh delapan divisi."}
      </div>
      <div data-testid="coverage-grid" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {DAYS.slice(0, 5).map((day, index) => {
          const coverage = plot.coverage_by_day[day] ?? [];
          const complete = coverage.length === plot.required_divisions.length;
          return (
            <div key={day} data-testid={`coverage-card-${index}`} className={`rounded-sm border p-4 ${complete ? "border-teal-200 bg-teal-50" : "border-slate-200 bg-white"}`}>
              <div data-testid={`coverage-day-${index}`} className="mb-3 flex items-center justify-between text-sm font-semibold text-slate-900">
                {day}
                {complete ? <CheckCircle2 className="size-4 text-teal-600" /> : <AlertTriangle className="size-4 text-amber-600" />}
              </div>
              <div data-testid={`coverage-badges-${index}`} className="flex flex-wrap gap-1.5">
                {coverage.length ? coverage.map((division) => <Badge key={division} variant="outline" className="border-slate-200 bg-white font-mono text-[10px] text-[#134679]">{division}</Badge>) : <span className="text-xs text-slate-500">Belum memenuhi aturan</span>}
              </div>
            </div>
          );
        })}
      </div>

      <div data-testid="assignment-table-wrapper" className="rounded-sm border border-slate-200 bg-white">
        <Table data-testid="assignment-table">
          <TableHeader>
            <TableRow className="border-slate-200 bg-slate-50 hover:bg-slate-50">
              <TableHead className="text-slate-600">Hari</TableHead><TableHead className="text-slate-600">Shift</TableHead><TableHead className="text-slate-600">Anggota</TableHead><TableHead className="text-slate-600">Divisi</TableHead><TableHead className="text-slate-600">Angkatan</TableHead><TableHead className="text-right text-slate-600">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plot.assignments.map((assignment, index) => (
              <TableRow key={assignment.id} data-testid={`assignment-row-${index}`} className="border-slate-200 hover:bg-slate-50">
                <TableCell data-testid={`assignment-day-${index}`} className="font-medium text-slate-900">{assignment.day}</TableCell>
                <TableCell data-testid={`assignment-time-${index}`} className="font-mono text-xs text-slate-700">{assignment.start_time}—{assignment.end_time}</TableCell>
                <TableCell data-testid={`assignment-member-${index}`} className="font-mono text-slate-800">{assignment.member_code}</TableCell>
                <TableCell data-testid={`assignment-division-${index}`}><Badge variant="outline" className="border-blue-200 bg-blue-50 font-mono text-[#134679]">{assignment.division}</Badge></TableCell>
                <TableCell data-testid={`assignment-generation-${index}`} className="font-mono text-slate-600">{assignment.generation}</TableCell>
                <TableCell data-testid={`assignment-status-${index}`} className="text-right text-xs text-teal-700">Bebas bentrok</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div data-testid="validation-list" className="space-y-2">
        {plot.validations.filter((item) => item.level !== "ok").map((item, index) => (
          <div key={`${item.day}-${index}`} data-testid={`validation-item-${index}`} className="flex gap-3 rounded-sm border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>{item.day ? `${item.day}: ` : ""}{item.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}