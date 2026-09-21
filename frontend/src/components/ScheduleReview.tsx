import { Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ClassSlot, DayName, MemberSchedule } from "@/types/roster";

const DAYS: DayName[] = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

interface ScheduleReviewProps {
  schedules: MemberSchedule[];
  onChange: (schedules: MemberSchedule[]) => void;
}

export function ScheduleReview({ schedules, onChange }: ScheduleReviewProps) {
  const updateMember = (id: string, patch: Partial<MemberSchedule>) => {
    onChange(schedules.map((member) => (member.id === id ? { ...member, ...patch } : member)));
  };

  const updateClass = (memberId: string, classId: string, patch: Partial<ClassSlot>) => {
    const member = schedules.find((item) => item.id === memberId);
    if (!member) return;
    updateMember(memberId, {
      classes: member.classes.map((slot) => (slot.id === classId ? { ...slot, ...patch } : slot)),
    });
  };

  const addClass = (member: MemberSchedule) => {
    updateMember(member.id, {
      classes: [
        ...member.classes,
        { id: crypto.randomUUID(), day: "Senin", start_time: "08:00", end_time: "10:00", course: "Mata kuliah" },
      ],
    });
  };

  const removeClass = (memberId: string, classId: string) => {
    const member = schedules.find((item) => item.id === memberId);
    if (!member) return;
    updateMember(memberId, { classes: member.classes.filter((slot) => slot.id !== classId) });
  };

  if (!schedules.length) {
    return (
      <div data-testid="review-empty-state" className="border border-dashed border-white/15 bg-[#0d1320] px-6 py-10 text-center text-sm text-slate-400">
        Upload dokumen atau muat data contoh untuk membuka editor jadwal.
      </div>
    );
  }

  return (
    <div data-testid="schedule-review-list" className="space-y-4">
      {schedules.map((member, memberIndex) => (
        <article key={member.id} data-testid={`member-review-card-${memberIndex}`} className="overflow-hidden border border-white/10 bg-[#111827] shadow-2xl shadow-black/10">
          <header data-testid={`member-review-header-${memberIndex}`} className="flex flex-col gap-4 border-b border-white/10 bg-[#151d2c] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div data-testid={`member-identity-${memberIndex}`} className="flex flex-wrap items-center gap-3">
              <span data-testid={`member-code-${memberIndex}`} className="font-mono text-base font-bold text-white">{member.code}</span>
              <Badge data-testid={`member-division-${memberIndex}`} variant="outline" className="border-blue-400/40 bg-blue-400/10 font-mono text-blue-300">{member.division}</Badge>
              <span data-testid={`member-source-${memberIndex}`} className="text-xs text-slate-500">{member.source_file}</span>
            </div>
            <div data-testid={`member-confidence-${memberIndex}`} className="font-mono text-xs text-emerald-300">OCR {Math.round(member.confidence * 100)}%</div>
          </header>
          <div data-testid={`member-editor-${memberIndex}`} className="p-4">
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <label data-testid={`member-code-label-${memberIndex}`} className="space-y-1 text-xs text-slate-400">
                Kode nama
                <Input data-testid={`member-code-input-${memberIndex}`} value={member.code} onChange={(event) => updateMember(member.id, { code: event.target.value.toUpperCase() })} className="border-white/10 bg-[#0a0f19] font-mono text-white" />
              </label>
              <label data-testid={`member-division-label-${memberIndex}`} className="space-y-1 text-xs text-slate-400">
                Divisi
                <Input data-testid={`member-division-input-${memberIndex}`} value={member.division} onChange={(event) => updateMember(member.id, { division: event.target.value.toUpperCase() })} className="border-white/10 bg-[#0a0f19] font-mono text-white" />
              </label>
            </div>
            <div data-testid={`class-list-${memberIndex}`} className="space-y-2">
              {member.classes.map((slot, slotIndex) => (
                <div key={slot.id} data-testid={`class-row-${memberIndex}-${slotIndex}`} className="grid gap-2 border-l-2 border-amber-400/60 bg-[#0b111d] p-3 sm:grid-cols-[130px_110px_110px_1fr_auto]">
                  <select data-testid={`class-day-select-${memberIndex}-${slotIndex}`} value={slot.day} onChange={(event) => updateClass(member.id, slot.id, { day: event.target.value as DayName })} className="h-9 border border-white/10 bg-[#111827] px-3 text-sm text-white outline-none focus:border-blue-400">
                    {DAYS.map((day) => <option key={day} value={day}>{day}</option>)}
                  </select>
                  <Input data-testid={`class-start-input-${memberIndex}-${slotIndex}`} type="time" value={slot.start_time} onChange={(event) => updateClass(member.id, slot.id, { start_time: event.target.value })} className="border-white/10 bg-[#111827] font-mono text-white" />
                  <Input data-testid={`class-end-input-${memberIndex}-${slotIndex}`} type="time" value={slot.end_time} onChange={(event) => updateClass(member.id, slot.id, { end_time: event.target.value })} className="border-white/10 bg-[#111827] font-mono text-white" />
                  <Input data-testid={`class-course-input-${memberIndex}-${slotIndex}`} value={slot.course} onChange={(event) => updateClass(member.id, slot.id, { course: event.target.value })} className="border-white/10 bg-[#111827] text-white" />
                  <Button data-testid={`remove-class-button-${memberIndex}-${slotIndex}`} type="button" variant="ghost" size="icon-sm" onClick={() => removeClass(member.id, slot.id)} className="text-slate-400 hover:bg-rose-500/15 hover:text-rose-300" aria-label={`Hapus jadwal ${slot.course}`}><Trash2 className="size-4" /></Button>
                </div>
              ))}
            </div>
            <Button data-testid={`add-class-button-${memberIndex}`} type="button" variant="ghost" size="sm" onClick={() => addClass(member)} className="mt-3 text-blue-300 hover:bg-blue-500/10 hover:text-blue-200"><Plus className="size-4" />Tambah jadwal kuliah</Button>
          </div>
        </article>
      ))}
    </div>
  );
}