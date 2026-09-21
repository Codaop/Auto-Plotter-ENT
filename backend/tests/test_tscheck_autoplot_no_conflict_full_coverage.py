"""Criterion: Solver wajib delapan divisi tanpa assignment parsial.

Uses the sample_members fixture (8 members, one per RP/FG/VG/CW/IL/WM/PK/DG, angkatan
21, no class slots) and exercises POST /api/roster/plot with the default config
(Senin-Jumat, 07:00-18:00, 2h shift). Asserts: 40 assignments (5 days x 8 divisions per
briefing seed fact), full 8-division coverage on every plotted day, assignments carry
generation, and a batch missing a division still plots (200) but with empty assignments
and a missing_divisions/validation entry instead of a partial assignment.
"""

REQUIRED_DIVISIONS = ["RP", "FG", "VG", "CW", "IL", "WM", "PK", "DG"]
DEFAULT_CONFIG = {
    "shift_duration_hours": 2,
    "operating_start": "07:00",
    "operating_end": "18:00",
    "active_days": ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"],
}


def test_plot_full_batch_no_conflict_and_full_coverage(client, sample_members):
    resp = client.post(
        "/roster/plot",
        json={"batch_id": "tscheck-full-batch", "schedules": sample_members, "config": DEFAULT_CONFIG},
    )
    assert resp.status_code == 200, resp.text
    plot = resp.json()

    assert len(plot["assignments"]) == 40
    assert not plot["missing_divisions"]
    assert plot["export_ready"] is True
    assert len(plot["complete_days"]) == 5

    for assignment in plot["assignments"]:
        assert assignment["generation"] == "21"

    for day in DEFAULT_CONFIG["active_days"]:
        coverage = plot["coverage_by_day"].get(day, [])
        assert set(coverage) == set(REQUIRED_DIVISIONS), f"{day} missing full coverage: {coverage}"


def test_plot_missing_division_yields_no_partial_assignment(client, sample_members):
    # Drop the CW member: batch is incomplete, so the criterion requires the solver to
    # still respond 200 (so the UI can show the problem) but with zero assignments and
    # a validation/missing_divisions entry -- never a partial per-division assignment.
    incomplete = [member for member in sample_members if member["division"] != "CW"]
    resp = client.post(
        "/roster/plot",
        json={"batch_id": "tscheck-incomplete-batch", "schedules": incomplete, "config": DEFAULT_CONFIG},
    )
    assert resp.status_code == 200, resp.text
    plot = resp.json()

    assert plot["missing_divisions"] == ["CW"]
    assert plot["assignments"] == []
    assert plot["complete_days"] == []
    assert plot["export_ready"] is False
    assert any(item["level"] == "error" for item in plot["validations"])


def test_plot_restricted_active_days_and_short_window_changes_result(client, sample_members):
    config = {
        "shift_duration_hours": 1,
        "operating_start": "16:00",
        "operating_end": "18:00",
        "active_days": ["Sabtu"],
    }
    resp = client.post(
        "/roster/plot",
        json={"batch_id": "tscheck-restricted-days", "schedules": sample_members, "config": config},
    )
    assert resp.status_code == 200, resp.text
    plot = resp.json()

    assert set(plot["coverage_by_day"].keys()) == {"Sabtu"}
    assert len(plot["assignments"]) == 8
    for assignment in plot["assignments"]:
        assert assignment["day"] == "Sabtu"
        assert assignment["start_time"] >= "16:00"
        assert assignment["end_time"] <= "18:00"
