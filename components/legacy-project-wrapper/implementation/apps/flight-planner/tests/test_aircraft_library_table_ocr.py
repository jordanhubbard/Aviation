"""Table preprocessing remains bounded and separate from original review pixels."""

from io import BytesIO
import shutil

from PIL import Image, ImageDraw
from pypdf import PdfWriter
import pytest

from app.services.aircraft_library import ocr


def test_only_long_straight_dark_runs_are_whitened_without_mutating_original():
    image = Image.new("RGB", (300, 200), "white")
    draw = ImageDraw.Draw(image)
    draw.line((10, 20, 289, 20), fill="black", width=1)
    draw.line((20, 10, 20, 189), fill="black", width=1)
    draw.line((40, 40, 158, 40), fill="black", width=1)  # under horizontal threshold
    draw.line((40, 60, 40, 138), fill="black", width=1)  # under vertical threshold
    draw.line((60, 160, 260, 160), fill=(100, 100, 100), width=1)  # not dark
    draw.ellipse((190, 60, 215, 90), outline="black", width=2)
    before = image.tobytes()
    result, policy = ocr._table_image(image)
    assert result.size == image.size
    assert image.tobytes() == before
    for xy in ((100, 20), (20, 100)):
        assert result.getpixel(xy) == 255
    for xy in ((80, 40), (40, 90), (190, 75)):
        assert result.getpixel(xy) == 0
    assert result.getpixel((100, 160)) == 100
    assert policy == {
        "method": "straight-rules-v1",
        "dark_threshold": 100,
        "horizontal_min_run": 120,
        "vertical_min_run": 80,
    }
    # All changes remove dark pixels. No coordinate shift or added ink is allowed.
    original = image.convert("L").tobytes()
    for a, b in zip(original, result.tobytes()):
        assert a == b or (a < 100 and b == 255)
    repeated, again = ocr._table_image(image)
    assert result.tobytes() == repeated.tobytes() and policy == again
    result.close()
    repeated.close()
    image.close()


def test_broken_short_rules_and_page_edges_are_handled_as_complete_runs():
    image = Image.new("L", (240, 160), 255)
    draw = ImageDraw.Draw(image)
    draw.line((0, 0, 119, 0), fill=0)
    draw.line((239, 80, 239, 159), fill=0)
    draw.line((10, 30, 128, 30), fill=0)
    draw.line((130, 30, 239, 30), fill=0)
    result, _ = ocr._table_image(image)
    assert result.getpixel((0, 0)) == result.getpixel((119, 0)) == 255
    assert result.getpixel((239, 159)) == 255
    assert result.getpixel((50, 30)) == result.getpixel((180, 30)) == 0
    result.close()
    image.close()


def test_pixel_bound_precedes_grayscale_allocation(monkeypatch):
    image = Image.new("RGB", (8, 8))
    monkeypatch.setattr(ocr, "MAX_PIXELS", 63)
    monkeypatch.setattr(image, "convert", lambda *a, **kw: pytest.fail("Allocated oversized input"))
    with pytest.raises(ocr.OCRError, match="pixel limit"):
        ocr._table_image(image)
    image.close()


@pytest.mark.skipif(not shutil.which("tesseract"), reason="Native Tesseract unavailable")
def test_actual_table_preview_keeps_same_original_image_as_sparse_and_binds_input(tmp_path):
    writer = PdfWriter()
    writer.add_blank_page(300, 200)
    stream = BytesIO()
    writer.write(stream)
    path = tmp_path / "source.pdf"
    original = stream.getvalue()
    path.write_bytes(original)
    sparse, sparse_images = ocr.extract_selected(path, [1], mode="sparse", timeout=30)
    table, table_images = ocr.extract_selected(path, [1], mode="table", timeout=30)
    assert table["mode"] == "table" and not table["approved"]
    assert table_images == sparse_images and path.read_bytes() == original
    page = table["pages"][0]
    assert page["fragments"] == [] and page["error"] is None
    assert page["image_sha256"] == ocr.digest(table_images[1])
    with Image.open(BytesIO(table_images[1])) as image:
        processed, policy = ocr._table_image(image)
    encoded = BytesIO()
    processed.save(encoded, format="PNG")
    processed.close()
    assert ocr.digest(encoded.getvalue()) == page["ocr_input_sha256"]
    assert page["ocr_preprocessing"] == policy
    assert "ocr_preprocessing" not in sparse["pages"][0]
    assert "ocr_input_sha256" not in sparse["pages"][0]
    assert set(tmp_path.iterdir()) == {path}


@pytest.mark.parametrize(
    "width,height", [(0, 1), (1, 0), (-1, 1), (True, 1), (1.0, 1), (None, 1), (12_000_001, 1)]
)
def test_invalid_dimensions_cannot_bypass_preprocessing_bound(width, height):
    with pytest.raises(ocr.OCRError, match="pixel limit"):
        ocr._table_policy(width, height)


@pytest.mark.parametrize(
    "failure,expected",
    [
        ("mode", "requested mode"),
        ("policy", "preprocessing identity"),
        ("missing-input", "input is unavailable"),
        ("input-hash", "integrity failure"),
        ("input-size", "image size limit"),
    ],
)
def test_parent_rejects_mismatched_child_table_input_without_exposing_text(
    tmp_path, monkeypatch, failure, expected
):
    import json
    from pathlib import Path
    from types import SimpleNamespace

    def child(command, **kwargs):
        output = Path(command[3])
        original, processed = b"private page fixture", b"private processed fixture"
        (output / "page-1.png").write_bytes(original)
        if failure != "missing-input":
            (output / "ocr-input-1.png").write_bytes(processed)
        candidate = {
            "mode": "normal" if failure == "mode" else "table",
            "pages": [
                {
                    "page": 1,
                    "width": 1,
                    "height": 1,
                    "image_sha256": ocr.digest(original),
                    "ocr_input_sha256": (
                        "0" * 64 if failure == "input-hash" else ocr.digest(processed)
                    ),
                    "ocr_preprocessing": {} if failure == "policy" else ocr._table_policy(1, 1),
                }
            ],
        }
        (output / "candidate.json").write_text(json.dumps(candidate))
        if failure == "input-size":
            monkeypatch.setattr(ocr, "MAX_IMAGE_BYTES", len(original))
        return SimpleNamespace(returncode=0, wait=lambda **kw: 0)

    monkeypatch.setattr(ocr.subprocess, "Popen", child)
    monkeypatch.setattr(ocr, "_kill", lambda process: None)
    with pytest.raises(ocr.OCRError, match=expected) as error:
        ocr.extract_selected(tmp_path / "private-source.pdf", [1], mode="table")
    assert "private" not in str(error.value)
