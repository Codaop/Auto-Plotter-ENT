"""Criterion: Ekspor spreadsheet dua sheet (Plotting Utama & Validasi & Error)."""

import io

from openpyxl import load_workbook


def test_export_xlsx_has_two_named_sheets(client):
    sample = client.get("/roster/sample")
    members = sample.json()["members"]
    config = {
        "shift_duration_hours": 2,
        "operating_start": "07:00",
        "operating_end": "18:00",
        "active_days": ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"],
    }
    plot_resp = client.post("/roster/plot", json={"schedules": members, "config": config})
    assert plot_resp.status_code == 200, plot_resp.text
    plot = plot_resp.json()

    export_resp = client.post("/roster/export", json={"plot": plot})
    assert export_resp.status_code == 200, export_resp.text
    assert "spreadsheetml" in export_resp.headers.get("content-type", "")

    workbook = load_workbook(io.BytesIO(export_resp.content))
    assert workbook.sheetnames == ["Plotting Utama", "Validasi & Error"]

    main_sheet = workbook["Plotting Utama"]
    assert main_sheet.cell(row=1, column=1).value == "Hari"
    assert main_sheet.max_row - 1 == len(plot["assignments"])

    validation_sheet = workbook["Validasi & Error"]
    assert validation_sheet.cell(row=1, column=1).value == "Status"
    assert validation_sheet.max_row - 1 == len(plot["validations"])
