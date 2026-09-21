"""Criterion: Upload PDF/PNG/JPG dengan format nama KODENAMA_DIVISI dan ekstraksi OCR.

Covers the filename-contract half of the criterion (fast, deterministic): an invalid
filename must be rejected with a clear message before any OCR call is attempted. Real
OCR extraction on a valid filename was verified manually per the briefing seed facts
(public URL + TST_QA.png -> 200) and is not re-exercised here to avoid a live LLM call
in the automated suite.
"""

import io

import pytest


def _png_bytes() -> bytes:
    # Minimal valid 1x1 PNG.
    return bytes.fromhex(
        "89504e470d0a1a0a0000000d494844520000000100000001080600000"
        "01f15c4890000000a49444154789c6360000002000100feff030000000049454e44ae426082"
    )


def test_extract_rejects_invalid_filename(client):
    files = [("files", ("tscheck-badname-upload.png", io.BytesIO(_png_bytes()), "image/png"))]
    resp = client.post("/roster/extract", files=files)
    assert resp.status_code == 422, resp.text
    detail = resp.json().get("detail", "")
    assert "KODENAMA_DIVISI" in detail


def test_extract_rejects_unsupported_extension_even_with_valid_stem(client):
    files = [("files", ("TSC_QA.gif", io.BytesIO(_png_bytes()), "image/gif"))]
    resp = client.post("/roster/extract", files=files)
    assert resp.status_code == 422, resp.text


def test_extract_rejects_empty_upload(client):
    resp = client.post("/roster/extract", files=[])
    assert resp.status_code in (400, 422), resp.text
