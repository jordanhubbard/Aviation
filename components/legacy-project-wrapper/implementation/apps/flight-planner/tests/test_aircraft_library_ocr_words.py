"""Individual review retains complete recognized words without character repair."""

from io import BytesIO
import shutil

from pypdf import PdfWriter
import pytest

from app.services.aircraft_library import ocr
from .test_aircraft_library_ocr import tsv


def test_words_keep_token_boundaries_coordinates_confidence_and_literal_misreads():
    data = tsv(
        [
            (1, 10, 45, 20, "Badlabel"),
            (1, 60, 20, 92, "No."),
            (1, 85, 5, 96, "1"),
            (2, 10, 5, 70, "I"),
            (2, 20, 25, 88, "No.1"),
        ]
    )
    line = ocr.fragments(data, 200, 100)
    words = ocr.fragments(data, 200, 100, individual_words=True)
    assert line[0]["text"] == "Badlabel No. 1"
    assert [f["text"] for f in words] == ["Badlabel", "No.", "1", "I", "No.1"]
    assert words[2]["bbox"] == [85, 10, 5, 20] and words[2]["confidence"] == 96
    assert words[2]["offset"] == len("Badlabel No. ")
    assert all("approved" not in f for f in words)
    assert ocr.selection([3, 1], "words") == [1, 3]


def test_word_bound_is_separate_from_existing_line_bound_and_never_truncates(monkeypatch):
    data = tsv([(1, 10, 20, 90, "one"), (1, 35, 20, 90, "two")])
    monkeypatch.setattr(ocr, "MAX_FRAGMENTS", 1)
    assert len(ocr.fragments(data, 200, 100, individual_words=True)) == 2
    monkeypatch.setattr(ocr, "MAX_WORD_FRAGMENTS", 1)
    with pytest.raises(ocr.OCRError, match="invalid or excessive"):
        ocr.fragments(data, 200, 100, individual_words=True)
    assert len(ocr.fragments(data, 200, 100)) == 1


@pytest.mark.skipif(not shutil.which("tesseract"), reason="Native Tesseract unavailable")
def test_native_word_mode_keeps_the_unmodified_review_image(tmp_path):
    writer = PdfWriter()
    writer.add_blank_page(200, 100)
    stream = BytesIO()
    writer.write(stream)
    original = stream.getvalue()
    path = tmp_path / "source.pdf"
    path.write_bytes(original)
    words, images = ocr.extract_selected(path, [1], mode="words", timeout=30)
    sparse, baseline = ocr.extract_selected(path, [1], mode="sparse", timeout=30)
    assert images == baseline and path.read_bytes() == original
    assert words["mode"] == "words" and not words["approved"]
    assert words["pages"][0]["fragments"] == sparse["pages"][0]["fragments"] == []
    assert "ocr_preprocessing" not in words["pages"][0]
    assert "ocr_input_sha256" not in words["pages"][0]
