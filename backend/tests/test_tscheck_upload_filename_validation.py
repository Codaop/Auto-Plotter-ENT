"""Criterion: Validasi nama file KODENAMA_DIVISI_ANGKATAN.

Covers the filename-contract half of the criterion (fast, deterministic): a filename
must match KODENAMA_DIVISI_ANGKATAN with a two-digit angkatan and one of the eight
required divisions before any OCR call is attempted. Real OCR extraction on a valid
filename (VAL_CW_21.png) was verified manually per briefing seed facts and is not
re-exercised here to avoid a live LLM call in the automated suite.
"""

import io


def _png_bytes() -> bytes:
    # Minimal valid 1x1 PNG.
    return bytes.fromhex(
        "89504e470d0a1a0a0000000d494844520000000100000001080600000"
        "01f15c4890000000a49444154789c6360000002000100feff030000000049454e44ae426082"
    )


def _upload(client, filename: str, content_type: str = "image/png"):
    files = [("files", (filename, io.BytesIO(_png_bytes()), content_type))]
    return client.post("/roster/extract", files=files)


def test_extract_rejects_old_format_missing_generation(client):
    # Old KODENAMA_DIVISI format (no angkatan segment) must be rejected.
    resp = _upload(client, "tscheck-badname-VAL_CW.png")
    assert resp.status_code == 422, resp.text
    assert "KODENAMA_DIVISI_ANGKATAN" in resp.json().get("detail", "")


def test_extract_rejects_extra_segment(client):
    resp = _upload(client, "tscheck-VAL_CW_21_EXTRA.png")
    assert resp.status_code == 422, resp.text


def test_extract_rejects_space_in_stem(client):
    resp = _upload(client, "tscheck VAL_CW_21.png")
    assert resp.status_code == 422, resp.text


def test_extract_rejects_nonnumeric_generation(client):
    resp = _upload(client, "tscheckVAL_CW_XY.png")
    assert resp.status_code == 422, resp.text


def test_extract_rejects_division_not_in_required_set(client):
    # QA is not one of RP/FG/VG/CW/IL/WM/PK/DG. Code must be uppercase to pass the
    # filename-shape regex so this hits the division-specific rejection branch.
    resp = _upload(client, "TSCHECKVAL_QA_21.png")
    assert resp.status_code == 422, resp.text
    detail = resp.json().get("detail", "")
    assert "RP" in detail and "DG" in detail


def test_extract_rejects_unsupported_extension_even_with_valid_stem(client):
    resp = _upload(client, "TSC_CW_21.gif", content_type="image/gif")
    assert resp.status_code == 422, resp.text


def test_extract_rejects_empty_upload(client):
    resp = client.post("/roster/extract", files=[])
    assert resp.status_code in (400, 422), resp.text
