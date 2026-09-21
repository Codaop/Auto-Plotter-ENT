import { Check, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ClassSlot, DayName, MemberSchedule } from "@/types/roster";

const DAYS: DayName[] = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

interface ScheduleReviewProps {
  schedules: MemberSchedule[];
  onChange: (schedules: MemberSchedule[]) => void;
  onSave: () => void;
  saving: boolean;
}

export function ScheduleReview({ schedules, onChange, onSave, saving }: ScheduleReviewProps) {
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
      <div data-testid="review-empty-state" className="rounded-sm border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">
        Upload dan ekstrak dokumen untuk membuka editor jadwal.
      </div>
    );
  }

  return (
    <div data-testid="schedule-review-list" className="space-y-4">
      {schedules.map((member, memberIndex) => (
        <article key={member.id} data-testid={`member-review-card-${memberIndex}`} className="overflow-hidden rounded-sm border border-slate-200 bg-white shadow-sm">
          <header data-testid={`member-review-header-${memberIndex}`} className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div data-testid={`member-identity-${memberIndex}`} className="flex flex-wrap items-center gap-3">
              <span data-testid={`member-code-${memberIndex}`} className="font-mono text-sm font-bold text-slate-900">{member.code}</span>
              <Badge data-testid={`member-division-${memberIndex}`} variant="outline" className="border-[#226DB8]/25 bg-[#226DB8]/5 font-mono text-[#134679]">{member.division}</Badge>
              <Badge data-testid={`member-generation-${memberIndex}`} variant="outline" className="border-slate-200 bg-white font-mono text-slate-600">Angkatan {member.generation}</Badge>
              <span data-testid={`member-source-${memberIndex}`} className="text-xs text-slate-500">{member.source_file}</span>
            </div>
            <div data-testid={`member-confidence-${memberIndex}`} className="font-mono text-xs text-teal-700">Keyakinan OCR {Math.round(member.confidence * 100)}%</div>
          </header>
          <div data-testid={`member-editor-${memberIndex}`} className="p-4">
            <div data-testid={`class-list-${memberIndex}`} className="space-y-2">
              {member.classes.map((slot, slotIndex) => (
                <div key={slot.id} data-testid={`class-row-${memberIndex}-${slotIndex}`} className="grid gap-2 border-l-2 border-[#226DB8] bg-slate-50 p-3 sm:grid-cols-[130px_110px_110px_1fr_auto]">
                  <select data-testid={`class-day-select-${memberIndex}-${slotIndex}`} value={slot.day} onChange={(event) => updateClass(member.id, slot.id, { day: event.target.value as DayName })} className="h-9 rounded-sm border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-[#226DB8]">
                    {DAYS.map((day) => <option key={day} value={day}>{day}</option>)}
                  </select>
                  <Input data-testid={`class-start-input-${memberIndex}-${slotIndex}`} type="time" value={slot.start_time} onChange={(event) => updateClass(member.id, slot.id, { start_time: event.target.value })} className="border-slate-300 bg-white font-mono text-slate-800" />
                  <Input data-testid={`class-end-input-${memberIndex}-${slotIndex}`} type="time" value={slot.end_time} onChange={(event) => updateClass(member.id, slot.id, { end_time: event.target.value })} className="border-slate-300 bg-white font-mono text-slate-800" />
                  <Input data-testid={`class-course-input-${memberIndex}-${slotIndex}`} value={slot.course} onChange={(event) => updateClass(member.id, slot.id, { course: event.target.value })} className="border-slate-300 bg-white text-slate-800" />
                  <Button data-testid={`remove-class-button-${memberIndex}-${slotIndex}`} type="button" variant="ghost" size="icon-sm" onClick={() => removeClass(member.id, slot.id)} className="text-slate-400 hover:bg-rose-50 hover:text-rose-700" aria-label={`Hapus jadwal ${slot.course}`}><Trash2 className="size-4" /></Button>
                </div>
              ))}
            </div>
            <Button data-testid={`add-class-button-${memberIndex}`} type="button" variant="ghost" size="sm" onClick={() => addClass(member)} className="mt-3 text-[#226DB8] hover:bg-blue-50 hover:text-[#134679]"><Plus className="size-4" />Tambah jadwal kuliah</Button>
          </div>
        </article>
      ))}
      <div className="flex justify-end pt-2"><Button data-testid="save-review-button" type="button" onClick={onSave} disabled={saving} className="bg-[#134679] text-white hover:bg-[#0e385f] hover:text-white"><Check className="size-4" />{saving ? "Menyimpan…" : "Simpan Koreksi"}</Button></div>
    </div>
  );
}