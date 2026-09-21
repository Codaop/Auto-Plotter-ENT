"""Criterion: Batas ekspor dan spreadsheet.

Uses the sample_members fixture through a full plot, then exercises POST
/api/roster/export and asserts the two required sheets (Plotting Utama & Validasi &
Error) exist with the ID Batch and Angkatan columns, plus a 409 when export is
attempted against a plot whose divisions are incomplete (export_ready is false).
"""

import io

from openpyxl import load_workbook

DEFAULT_CONFIG = {
    "shift_duration_hours": 2,
    "operating_start": "07:00",
    "operating_end": "18:00",
    "active_days": ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"],
}


def test_export_xlsx_has_two_sheets_with_batch_and_generation_columns(client, sample_members):
    batch_id = "tscheck-export-batch"
    plot_resp = client.post(
        "/roster/plot",
        json={"batch_id": batch_id, "schedules": sample_members, "config": DEFAULT_CONFIG},
    )
    assert plot_resp.status_code == 200, plot_resp.text
    plot = plot_resp.json()
    assert plot["export_ready"] is True

    export_resp = client.post("/roster/export", json={"batch_id": batch_id, "plot": plot})
    assert export_resp.status_code == 200, export_resp.text
    assert "spreadsheetml" in export_resp.headers.get("content-type", "")

    workbook = load_workbook(io.BytesIO(export_resp.content))
    assert workbook.sheetnames == ["Plotting Utama", "Validasi & Error"]

    main_sheet = workbook["Plotting Utama"]
    header = [cell.value for cell in main_sheet[1]]
    assert "ID Batch" in header
    assert "Angkatan" in header
    assert main_sheet.max_row - 1 == len(plot["assignments"])
    assert main_sheet.cell(row=2, column=header.index("ID Batch") + 1).value == batch_id
    assert main_sheet.cell(row=2, column=header.index("Angkatan") + 1).value == "21"

    validation_sheet = workbook["Validasi & Error"]
    validation_header = [cell.value for cell in validation_sheet[1]]
    assert "ID Batch" in validation_header
    assert validation_sheet.max_row - 1 == len(plot["validations"])


def test_export_blocked_when_divisions_incomplete(client, sample_members):
    incomplete = [member for member in sample_members if member["division"] != "PK"]
    plot_resp = client.post(
        "/roster/plot",
        json={"batch_id": "tscheck-export-blocked", "schedules": incomplete, "config": DEFAULT_CONFIG},
    )
    assert plot_resp.status_code == 200, plot_resp.text
    plot = plot_resp.json()
    assert plot["export_ready"] is False

    export_resp = client.post("/roster/export", json={"batch_id": "tscheck-export-blocked", "plot": plot})
    assert export_resp.status_code == 409, export_resp.text
