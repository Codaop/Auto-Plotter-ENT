import base64
import json
import os
import re
import tempfile
from datetime import datetime
from io import BytesIO
from pathlib import Path

import httpx
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
    r"^(?P<code>[A-Z0-9]+)_(?P<division>[A-Z0-9]+)_(?P<generation>[0-9]{2})\.(?P<ext>pdf|png|jpg|jpeg)$",
)
REQUIRED_DIVISIONS = ["RP", "FG", "VG", "CW", "IL", "WM", "PK", "DG"]
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


async def _extract_schedule(
    path: str, mime_type: str, code: str, division: str, generation: str, filename: str
) -> MemberSchedule:
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="Kunci layanan OCR (Gemini API) belum dikonfigurasi")

    # Read file as base64
    with open(path, "rb") as f:
        file_data = base64.b64encode(f.read()).decode()

    system_message = (
        "Anda adalah mesin ekstraksi jadwal kuliah. Baca tabel pada file dan keluarkan JSON valid saja. "
        "Hari yang diizinkan: Senin, Selasa, Rabu, Kamis, Jumat, Sabtu. Normalisasikan waktu ke HH:MM. "
        "Jangan membuat jadwal yang tidak tampak. Jika ragu, tambahkan penjelasan pada notes."
    )
    prompt = (
        "Ekstrak semua jadwal kuliah dari lampiran. Kembalikan persis struktur: "
        '{"confidence":0.0,"notes":["..."],"classes":[{"day":"Senin","start_time":"08:00",'
        '"end_time":"10:00","course":"Nama Mata Kuliah"}]}. '
        f"Identitas dari nama file adalah code={code}, division={division}, angkatan={generation}; jangan ubah identitas tersebut."
    )

        # Use the lowest-cost Gemini model that supports image input.
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key={api_key}"
    payload = {
        "contents": [{
            "parts": [
                {"text": f"{system_message}\n\n{prompt}"},
                {"inline_data": {"mime_type": mime_type, "data": file_data}}
            ]
        }],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 4096,
        }
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()

        # Extract text from Gemini response
        candidates = data.get("candidates", [])
        if not candidates:
            raise HTTPException(status_code=502, detail="Tidak ada respons dari Gemini API")

        content = candidates[0].get("content", {})
        parts = content.get("parts", [])
        if not parts:
            raise HTTPException(status_code=502, detail="Respons Gemini kosong")

        text = parts[0].get("text", "")
        if not text:
            raise HTTPException(status_code=502, detail="Respons Gemini tidak berisi teks")

        parsed = _extract_json(text)
        classes = [ClassSlot(**item) for item in parsed.get("classes", [])]
        return MemberSchedule(
            code=code,
            division=division,
            generation=generation,
            source_file=filename,
            confidence=float(parsed.get("confidence", 0)),
            notes=[str(note) for note in parsed.get("notes", [])],
            classes=classes,
        )
    except HTTPException:
        raise
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f"Gemini API error: {exc.response.status_code} - {exc.response.text}") from exc
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
                detail=(
                    f"Nama file {filename or '(tanpa nama)'} tidak valid. Gunakan pola "
                    "KODENAMA_DIVISI_ANGKATAN, contoh VAL_CW_21.pdf"
                ),
            )
        division = match.group("division")
        if division not in REQUIRED_DIVISIONS:
            raise HTTPException(
                status_code=422,
                detail=f"Divisi {division} tidak valid. Pilih salah satu: {', '.join(REQUIRED_DIVISIONS)}",
            )
        if upload.content_type not in ALLOWED_MIME:
            raise HTTPException(status_code=415, detail=f"Format {filename} tidak didukung")
        suffix = f".{match.group('ext')}"
        with tempfile.TemporaryDirectory(prefix="autoplot-") as temp_dir:
            temp_path = str(Path(temp_dir) / f"source{suffix}")
            total_bytes = 0
            with open(temp_path, "wb") as temp_file:
                while chunk := await upload.read(1024 * 1024):
                    total_bytes += len(chunk)
                    if total_bytes > MAX_FILE_BYTES:
                        raise HTTPException(status_code=413, detail=f"{filename} melebihi batas 12 MB")
                    temp_file.write(chunk)
            member = await _extract_schedule(
                temp_path,
                upload.content_type,
                match.group("code"),
                division,
                match.group("generation"),
                filename,
            )
            members.append(member)
            if member.confidence < 0.7:
                warnings.append(f"Periksa ulang {filename}: confidence OCR rendah ({member.confidence:.0%})")
    return ExtractionResponse(members=members, warnings=warnings)


@router.post("/plot", response_model=PlotResponse)
async def generate_plot(payload: PlotRequest):
    divisions = sorted({schedule.division for schedule in payload.schedules})
    missing_divisions = [division for division in REQUIRED_DIVISIONS if division not in divisions]
    usage = {schedule.id: 0 for schedule in payload.schedules}
    assignments: list[PlotAssignment] = []
    validations: list[ValidationItem] = []
    coverage_by_day: dict[str, list[str]] = {}
    complete_days = []
    duration = payload.config.shift_duration_hours * 60
    opening = _minutes(payload.config.operating_start)
    closing = _minutes(payload.config.operating_end)

    if missing_divisions:
        validations.append(
            ValidationItem(
                level="error",
                message=f"Batch belum lengkap. Divisi yang belum tersedia: {', '.join(missing_divisions)}.",
            )
        )

    for day in payload.config.active_days:
        if missing_divisions:
            coverage_by_day[day] = []
            continue
        proposed: list[tuple[MemberSchedule, int]] = []
        for division in REQUIRED_DIVISIONS:
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
                    generation=member.generation,
                )
            )
            usage[member.id] += 1
        coverage_by_day[day] = sorted(member.division for member, _ in proposed)
        complete_days.append(day)

    if complete_days:
        validations.append(
            ValidationItem(level="ok", message=f"{len(complete_days)} hari memenuhi delapan divisi tanpa bentrok jadwal kuliah.")
        )
    else:
        validations.append(ValidationItem(level="error", message="Tidak ada hari yang memenuhi seluruh aturan plotting."))
    return PlotResponse(
        assignments=assignments,
        validations=validations,
        divisions=divisions,
        required_divisions=REQUIRED_DIVISIONS,
        missing_divisions=missing_divisions,
        coverage_by_day=coverage_by_day,
        complete_days=complete_days,
        export_ready=bool(complete_days) and not missing_divisions,
    )


@router.post("/export")
async def export_plot(payload: ExportRequest):
    if not payload.plot.export_ready or not payload.plot.complete_days:
        raise HTTPException(status_code=409, detail="Plot belum memenuhi syarat ekspor delapan divisi")
    workbook = Workbook()
    main = workbook.active
    main.title = "Plotting Utama"
    main.append(["ID Batch", "Hari", "Mulai", "Selesai", "Kode Anggota", "Divisi", "Angkatan"])
    for assignment in payload.plot.assignments:
        main.append([
            payload.batch_id,
            assignment.day,
            assignment.start_time,
            assignment.end_time,
            assignment.member_code,
            assignment.division,
            assignment.generation,
        ])

    validation = workbook.create_sheet("Validasi & Error")
    validation.append(["ID Batch", "Status", "Hari", "Pesan"])
    for item in payload.plot.validations:
        validation.append([payload.batch_id, item.level.upper(), item.day or "-", item.message])

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
    filename = f"plot-absensi-{payload.batch_id}-{today_iso()}.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )