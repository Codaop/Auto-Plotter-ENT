"""Criteria:
- AutoPlot hanya memakai slot kosong tanpa bentrok jadwal kuliah.
- Semua divisi terwakili pada hari plotting yang sama.
- Konfigurasi durasi, jam operasional, dan hari aktif mempengaruhi hasil plotting.

Uses GET /api/roster/sample (8 members, 4 divisions) as fixture data, then exercises
POST /api/roster/plot with the default config from the briefing (Senin-Jumat,
07:00-18:00, 2h shift) and asserts: 20 assignments, 4-division coverage per plotted
day, and zero overlap between any assignment and the member's own class slots.
"""

from datetime import datetime


def _minutes(value: str) -> int:
    dt = datetime.strptime(value, "%H:%M")
    return dt.hour * 60 + dt.minute


def test_plot_default_config_no_conflict_and_full_coverage(client):
    sample = client.get("/roster/sample")
    assert sample.status_code == 200, sample.text
    members = sample.json()["members"]
    assert len(members) == 8

    config = {
        "shift_duration_hours": 2,
        "operating_start": "07:00",
        "operating_end": "18:00",
        "active_days": ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"],
    }
    resp = client.post("/roster/plot", json={"schedules": members, "config": config})
    assert resp.status_code == 200, resp.text
    plot = resp.json()

    assert len(plot["assignments"]) == 20
    divisions = set(plot["divisions"])
    assert divisions == {"FRONTEND", "BACKEND", "UIUX", "HARDWARE"}

    members_by_code = {m["code"]: m for m in members}
    for assignment in plot["assignments"]:
        member = members_by_code[assignment["member_code"]]
        start = _minutes(assignment["start_time"])
        end = _minutes(assignment["end_time"])
        for slot in member["classes"]:
            if slot["day"] != assignment["day"]:
                continue
            slot_start = _minutes(slot["start_time"])
            slot_end = _minutes(slot["end_time"])
            overlap = start < slot_end and end > slot_start
            assert not overlap, (
                f"assignment for {member['code']} on {assignment['day']} "
                f"{assignment['start_time']}-{assignment['end_time']} overlaps class "
                f"{slot['start_time']}-{slot['end_time']}"
            )

    for day in config["active_days"]:
        coverage = plot["coverage_by_day"].get(day, [])
        if coverage:
            assert set(coverage) == divisions, f"{day} coverage missing a division: {coverage}"


def test_plot_restricted_active_days_and_short_window_changes_result(client):
    sample = client.get("/roster/sample")
    members = sample.json()["members"]

    # Config restricted to a single active day with a narrow operating window: only
    # that one day may appear as plotted, proving active_days/operating window are honoured.
    config = {
        "shift_duration_hours": 1,
        "operating_start": "16:00",
        "operating_end": "18:00",
        "active_days": ["Sabtu"],
    }
    resp = client.post("/roster/plot", json={"schedules": members, "config": config})
    assert resp.status_code == 200, resp.text
    plot = resp.json()

    assert set(plot["coverage_by_day"].keys()) == {"Sabtu"}
    for assignment in plot["assignments"]:
        assert assignment["day"] == "Sabtu"
        start = _minutes(assignment["start_time"])
        end = _minutes(assignment["end_time"])
        assert start >= _minutes("16:00")
        assert end <= _minutes("18:00")
        assert end - start == 60
