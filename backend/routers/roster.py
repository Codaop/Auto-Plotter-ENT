import json
import os
import re
import tempfile
from datetime import datetime, timedelta
from io import BytesIO
from pathlib import Path

from emergentintegrations.llm.chat import (
    FileContentWithMimeType,
    LlmChat,
    StreamDone,
    TextDelta,
    UserMessage,
)
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill

from lib.dates import today_iso
from models.roster import (
    ClassSlot,
    ExportRequest,
    ExtractionResponse,
    MemberSchedule,
    PlotAssignment,
    PlotRequest,
    PlotResponse,
    ValidationItem,
)


router = APIRouter(prefix="/roster", tags=["roster"])
FILE_PATTERN = re.compile(
    r"^(?P<code>[A-Z0-9]{2,12})_(?P<division>[A-Z0-9][A-Z0-9_-]{1,31})\.(?P<ext>pdf|png|jpe?g)$",
    re.IGNORECASE,
)
ALLOWED_MIME = {"application/pdf", "image/png", "image/jpeg"}
MAX_FILE_BYTES = 12 * 1024 * 1024


def _minutes(value: str) -> int:
    parsed = datetime.strptime(value, "%H:%M")
    return parsed.hour * 60 + parsed.minute


def _clock(total_minutes: int) -> str:
    return f"{total_minutes // 60:02d}:{total_minutes % 60:02d}"


def _overlaps(start: int, end: int, class_slot: ClassSlot) -> bool:
    return start < _minutes(class_slot.end_time) and end > _minutes(class_slot.start_time)


def _extract_json(raw: str) -> dict:
    start = raw.find("{")
    end = raw.rfind("}")
    if start < 0 or end < start:
        raise ValueError("respons OCR tidak berisi JSON")
    return json.loads(raw[start : end + 1])


async def _extract_schedule(path: str, mime_type: str, code: str, division: str, filename: str) -> MemberSchedule:
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="Kunci layanan OCR belum dikonfigurasi")

    chat = LlmChat(
        api_key=api_key,
        session_id=f"schedule-{code}-{Path(path).stem}",
        system_message=(
            "Anda adalah mesin ekstraksi jadwal kuliah. Baca tabel pada file dan keluarkan JSON valid saja. "
            "Hari yang diizinkan: Senin, Selasa, Rabu, Kamis, Jumat, Sabtu. Normalisasikan waktu ke HH:MM. "
            "Jangan membuat jadwal yang tidak tampak. Jika ragu, tambahkan penjelasan pada notes."
        ),
    ).with_model("gemini", "gemini-3-flash-preview")
    prompt = (
        "Ekstrak semua jadwal kuliah dari lampiran. Kembalikan persis struktur: "
        '{"confidence":0.0,"notes":["..."],"classes":[{"day":"Senin","start_time":"08:00",'
        '"end_time":"10:00","course":"Nama Mata Kuliah"}]}. '
        f"Identitas dari nama file adalah code={code}, division={division}; jangan ubah identitas tersebut."
    )
    attachment = FileContentWithMimeType(mime_type=mime_type, file_path=path)
    pieces: list[str] = []
    try:
        async for event in chat.stream_message(UserMessage(text=prompt, file_contents=[attachment])):
            if isinstance(event, TextDelta):
                pieces.append(event.content)
            elif isinstance(event, StreamDone) and event.content:
                if not pieces:
                    pieces.append(event.content)
        parsed = _extract_json("".join(pieces))
        classes = [ClassSlot(**item) for item in parsed.get("classes", [])]
        return MemberSchedule(
            code=code,
            division=division,
            source_file=filename,
            confidence=float(parsed.get("confidence", 0)),
            notes=[str(note) for note in parsed.get("notes", [])],
            classes=classes,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"OCR gagal untuk {filename}: {exc}") from exc


@router.post("/extract", response_model=ExtractionResponse)
async def extract_documents(files: list[UploadFile] = File(...)):
    if not files:
        raise HTTPException(status_code=400, detail="Pilih minimal satu file")
    if len(files) > 20:
        raise HTTPException(status_code=400, detail="Maksimal 20 file per proses")

    members: list[MemberSchedule] = []
    warnings: list[str] = []
    for upload in files:
        filename = upload.filename or ""
        match = FILE_PATTERN.fullmatch(filename)
        if not match:
            raise HTTPException(
                status_code=422,
                detail=f"Nama file {filename or '(tanpa nama)'} harus mengikuti KODENAMA_DIVISI.pdf/png/jpg",
            )
        if upload.content_type not in ALLOWED_MIME:
            raise HTTPException(status_code=415, detail=f"Format {filename} tidak didukung")
        content = await upload.read()
        if len(content) > MAX_FILE_BYTES:
            raise HTTPException(status_code=413, detail=f"{filename} melebihi batas 12 MB")

        suffix = f".{match.group('ext').lower()}"
        temp_path = ""
        try:
            with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temp_file:
                temp_file.write(content)
                temp_path = temp_file.name
            member = await _extract_schedule(
                temp_path,
                upload.content_type,
                match.group("code").upper(),
                match.group("division").upper(),
                filename,
            )
            members.append(member)
            if member.confidence < 0.7:
                warnings.append(f"Periksa ulang {filename}: confidence OCR rendah ({member.confidence:.0%})")
        finally:
            if temp_path:
                Path(temp_path).unlink(missing_ok=True)
    return ExtractionResponse(members=members, warnings=warnings)


@router.get("/sample", response_model=ExtractionResponse)
async def sample_schedules():
    sample = [
        ("AHL", "FRONTEND", [("Senin", "08:00", "10:00", "Algoritma"), ("Rabu", "13:00", "15:00", "Basis Data")]),
        ("NDA", "FRONTEND", [("Selasa", "09:00", "11:00", "Pemrograman Web"), ("Kamis", "14:00", "16:00", "Jaringan")]),
        ("NFN", "BACKEND", [("Senin", "10:00", "12:00", "Sistem Operasi"), ("Jumat", "08:00", "10:00", "Statistika")]),
        ("RKA", "BACKEND", [("Selasa", "13:00", "15:00", "Komputasi Awan"), ("Kamis", "08:00", "10:00", "Keamanan")]),
        ("RZK", "UIUX", [("Rabu", "08:00", "10:00", "Interaksi Manusia Komputer"), ("Jumat", "13:00", "15:00", "Desain Produk")]),
        ("DNI", "UIUX", [("Senin", "13:00", "15:00", "Riset Pengguna"), ("Kamis", "10:00", "12:00", "Prototyping")]),
        ("KVN", "HARDWARE", [("Selasa", "08:00", "10:00", "Mikrokontroler"), ("Jumat", "10:00", "12:00", "Robotika")]),
        ("BLK", "HARDWARE", [("Rabu", "10:00", "12:00", "Elektronika"), ("Kamis", "13:00", "15:00", "IoT")]),
    ]
    members = [
        MemberSchedule(
            code=code,
            division=division,
            source_file=f"{code}_{division}.pdf",
            confidence=0.96,
            notes=["Data contoh untuk demonstrasi alur review."],
            classes=[ClassSlot(day=day, start_time=start, end_time=end, course=course) for day, start, end, course in classes],
        )
        for code, division, classes in sample
    ]
    return ExtractionResponse(members=members, warnings=[])


@router.post("/plot", response_model=PlotResponse)
async def generate_plot(payload: PlotRequest):
    divisions = sorted({schedule.division for schedule in payload.schedules})
    usage = {schedule.id: 0 for schedule in payload.schedules}
    assignments: list[PlotAssignment] = []
    validations: list[ValidationItem] = []
    coverage_by_day: dict[str, list[str]] = {}
    duration = payload.config.shift_duration_hours * 60
    opening = _minutes(payload.config.operating_start)
    closing = _minutes(payload.config.operating_end)

    for day in payload.config.active_days:
        proposed: list[tuple[MemberSchedule, int]] = []
        for division in divisions:
            candidates = sorted(
                [member for member in payload.schedules if member.division == division],
                key=lambda member: (usage[member.id], member.code),
            )
            selected: tuple[MemberSchedule, int] | None = None
            for member in candidates:
                day_classes = [slot for slot in member.classes if slot.day == day]
                for start in range(opening, closing - duration + 1, 60):
                    end = start + duration
                    if not any(_overlaps(start, end, slot) for slot in day_classes):
                        selected = (member, start)
                        break
                if selected:
                    break
            if not selected:
                validations.append(
                    ValidationItem(level="error", day=day, message=f"Tidak ada slot bebas untuk divisi {division}; hari tidak diplot.")
                )
                proposed = []
                break
            proposed.append(selected)

        if not proposed:
            coverage_by_day[day] = []
            continue
        for member, start in proposed:
            assignments.append(
                PlotAssignment(
                    day=day,
                    start_time=_clock(start),
                    end_time=_clock(start + duration),
                    member_code=member.code,
                    division=member.division,
                )
            )
            usage[member.id] += 1
        coverage_by_day[day] = sorted(member.division for member, _ in proposed)
        validations.append(
            ValidationItem(level="ok", day=day, message=f"Semua {len(divisions)} divisi terwakili tanpa bentrok jadwal kuliah.")
        )

    if not assignments:
        validations.append(ValidationItem(level="error", message="Tidak ada hari yang memenuhi seluruh aturan plotting."))
    return PlotResponse(
        assignments=assignments,
        validations=validations,
        divisions=divisions,
        coverage_by_day=coverage_by_day,
    )


@router.post("/export")
async def export_plot(payload: ExportRequest):
    workbook = Workbook()
    main = workbook.active
    main.title = "Plotting Utama"
    main.append(["Hari", "Mulai", "Selesai", "Kode Anggota", "Divisi"])
    for assignment in payload.plot.assignments:
        main.append([assignment.day, assignment.start_time, assignment.end_time, assignment.member_code, assignment.division])

    validation = workbook.create_sheet("Validasi & Error")
    validation.append(["Status", "Hari", "Pesan"])
    for item in payload.plot.validations:
        validation.append([item.level.upper(), item.day or "-", item.message])

    header_fill = PatternFill("solid", fgColor="111827")
    header_font = Font(color="FFFFFF", bold=True)
    for sheet in (main, validation):
        sheet.freeze_panes = "A2"
        sheet.auto_filter.ref = sheet.dimensions
        for cell in sheet[1]:
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center")
        for column in sheet.columns:
            width = min(max(len(str(cell.value or "")) for cell in column) + 3, 72)
            sheet.column_dimensions[column[0].column_letter].width = width

    output = BytesIO()
    workbook.save(output)
    output.seek(0)
    filename = f"plot-absensi-{today_iso()}.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )