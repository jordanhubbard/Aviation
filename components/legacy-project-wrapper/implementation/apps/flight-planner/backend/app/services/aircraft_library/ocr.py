"""Untrusted, bounded selected-page OCR. Candidates are never approved evidence."""

from __future__ import annotations

import csv
import hashlib
from io import BytesIO, StringIO
import json
import math
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import tempfile
import time

MAX_PAGES = 10
MAX_PIXELS = 12_000_000
MAX_CANDIDATE_BYTES = 512 * 1024
MAX_IMAGE_BYTES = 24 * 1024 * 1024
MAX_TSV_BYTES = 4 * 1024 * 1024
MAX_FRAGMENTS = 500
MODES = {"normal": 3, "sparse": 11}


class OCRError(ValueError):
    """Safe operator-facing failure; no source text or subprocess output."""


def selection(pages, mode):
    if not isinstance(mode, str) or mode not in MODES:
        raise OCRError("OCR mode must be normal or sparse")
    if (
        not isinstance(pages, list)
        or not 1 <= len(pages) <= MAX_PAGES
        or any(type(page) is not int or not 1 <= page <= 1500 for page in pages)
        or len(set(pages)) != len(pages)
    ):
        raise OCRError("Select 1 to 10 distinct physical pages")
    return sorted(pages)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def encoded(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()


def fragments(tsv: str, width: int, height: int):
    """Group Tesseract words by line; retain exact token characters and uncertainty."""
    lines = {}
    try:
        rows = csv.DictReader(StringIO(tsv), delimiter="\t", quoting=csv.QUOTE_NONE)
        expected = {
            "level",
            "page_num",
            "block_num",
            "par_num",
            "line_num",
            "word_num",
            "left",
            "top",
            "width",
            "height",
            "conf",
            "text",
        }
        if set(rows.fieldnames or []) != expected:
            raise ValueError("Invalid TSV header")
        for row in rows:
            if None in row or any(not isinstance(value, str) for value in row.values()):
                raise ValueError("Invalid TSV row")
            if row["level"] != "5" or not row["text"].strip():
                continue
            text = row["text"]
            x, y, w, h = (int(row[key]) for key in ("left", "top", "width", "height"))
            confidence = float(row["conf"])
            if (
                not math.isfinite(confidence)
                or not -1 <= confidence <= 100
                or min(x, y, w, h) < 0
                or x + w > width
                or y + h > height
                or len(text) > 1000
                or any(ord(char) < 32 for char in text)
            ):
                raise ValueError("Invalid OCR word")
            key = tuple(int(row[name]) for name in ("page_num", "block_num", "par_num", "line_num"))
            lines.setdefault(key, []).append((text, x, y, w, h, confidence))
        output, offset = [], 0
        for words in lines.values():
            # Split only at OCR word boundaries, never truncate a recognized word.
            groups, group, length = [], [], 0
            for word in words:
                if group and length + 1 + len(word[0]) > 1000:
                    groups.append(group)
                    group, length = [], 0
                length += len(word[0]) + bool(group)
                group.append(word)
            if group:
                groups.append(group)
            for group in groups:
                text = " ".join(word[0] for word in group)
                left, top = min(w[1] for w in group), min(w[2] for w in group)
                right = max(w[1] + w[3] for w in group)
                bottom = max(w[2] + w[4] for w in group)
                output.append(
                    {
                        "id": f"fragment_{len(output) + 1}",
                        "text": text,
                        "offset": offset,
                        "bbox": [left, top, right - left, bottom - top],
                        "confidence": min(w[5] for w in group),
                    }
                )
                offset += len(text) + 1
                if len(output) > MAX_FRAGMENTS:
                    raise ValueError("Too many OCR fragments")
        return output
    except (ValueError, TypeError, KeyError, csv.Error, OverflowError) as error:
        raise OCRError("OCR returned invalid or excessive fragment data") from error


def _generate(path: Path, output: Path, pages: list[int], mode: str):
    """Child only: parse/render/OCR; parent owns the process-tree deadline."""
    from pypdf import PdfReader
    import pypdfium2 as pdfium

    pages = selection(pages, mode)
    if not path.is_file() or path.stat().st_size > 100 * 1024 * 1024:
        raise OCRError("Expected a PDF of at most 100 MiB")
    data = path.read_bytes()
    if not data.startswith(b"%PDF-"):
        raise OCRError("Expected a PDF")
    reader = PdfReader(BytesIO(data), strict=False)
    if reader.is_encrypted and not reader.decrypt(""):
        raise OCRError("Provide an unlocked PDF for OCR")
    if not 0 < len(reader.pages) <= 1500 or pages[-1] > len(reader.pages):
        raise OCRError("Selected physical page is outside the PDF")
    executable = shutil.which("tesseract")
    if not executable:
        raise OCRError("Tesseract is unavailable")
    # Keep even version diagnostics out of the service's logs and memory buffers.
    version_path = output / "version.txt"
    with version_path.open("wb") as log:
        version = subprocess.run([executable, "--version"], stdout=log, stderr=log, timeout=10)
    if version.returncode or version_path.stat().st_size > 16 * 1024:
        raise OCRError("Cannot identify OCR engine")
    version_text = version_path.read_text(errors="strict").splitlines()[0]
    if not version_text.startswith("tesseract ") or len(version_text) > 200:
        raise OCRError("Cannot identify OCR engine")
    result = {
        "source_sha256": digest(data),
        "page_count": len(reader.pages),
        "mode": mode,
        "engine": "tesseract",
        "engine_version": version_text,
        "renderer": "pdfium",
        "renderer_version": str(pdfium.PYPDFIUM_INFO),
        "status": "preview",
        "approved": False,
        "pages": [],
    }
    labels = reader.page_labels
    total_images = 0
    with pdfium.PdfDocument(data) as document:
        for number in pages:
            record = {"page": number, "label": str(labels[number - 1]), "fragments": []}
            page = document[number - 1]
            try:
                width, height = page.get_size()
                if not all(math.isfinite(v) and v > 0 for v in (width, height)):
                    raise OCRError("Invalid PDF page dimensions")
                # Small margin accounts for PDFium rounding each dimension upward.
                scale = min(3.0, math.sqrt((MAX_PIXELS - 20_000) / (width * height)))
                if scale < 0.1:
                    raise OCRError("PDF page dimensions exceed OCR limits")
                bitmap = page.render(scale=scale, fill_color=(255, 255, 255, 255))
                try:
                    image = bitmap.to_pil().convert("RGB")
                    if image.width * image.height > MAX_PIXELS:
                        raise OCRError("OCR render exceeds pixel limit")
                    image_path = output / f"page-{number}.png"
                    image.save(image_path)
                    w, h = image.size
                    image.close()
                finally:
                    bitmap.close()
            finally:
                page.close()
            total_images += image_path.stat().st_size
            if total_images > MAX_IMAGE_BYTES:
                raise OCRError("OCR preview exceeds image size limit")
            record.update(
                {
                    "width": w,
                    "height": h,
                    "scale": scale,
                    "image_sha256": digest(image_path.read_bytes()),
                }
            )
            base = output / f"ocr-{number}"
            with open(os.devnull, "wb") as log:
                try:
                    run = subprocess.run(
                        [executable, str(image_path), str(base), "--psm", str(MODES[mode]), "tsv"],
                        stdout=log,
                        stderr=log,
                        timeout=45,
                    )
                    tsv_path = base.with_suffix(".tsv")
                    if run.returncode or not tsv_path.exists():
                        raise OCRError("OCR failed for this page")
                    if tsv_path.stat().st_size > MAX_TSV_BYTES:
                        raise OCRError("OCR fragment data exceeds size limit")
                    tsv = tsv_path.read_bytes()
                    record["tsv_sha256"] = digest(tsv)
                    record["fragments"] = fragments(tsv.decode("utf-8"), w, h)
                    record["error"] = None
                except (subprocess.TimeoutExpired, OCRError, UnicodeError):
                    record["error"] = "OCR failed or exceeded page limits; no fragments retained"
                    result["status"] = "partial"
            result["pages"].append(record)
            if len(encoded(result)) > MAX_CANDIDATE_BYTES:
                raise OCRError("OCR preview exceeds candidate size limit")
    (output / "candidate.json").write_bytes(encoded(result))


def _kill(process):
    try:
        if os.name == "posix":
            os.killpg(process.pid, signal.SIGKILL)
        else:
            process.kill()
    except ProcessLookupError:
        pass
    process.wait()


def extract_selected(path: Path, pages, *, mode="normal", timeout=600, cancelled=None):
    """Return a candidate and page-image bytes, without writing any library source."""
    pages = selection(pages, mode)
    if (
        not isinstance(timeout, (int, float))
        or not math.isfinite(timeout)
        or not 0 < timeout <= 600
    ):
        raise OCRError("OCR deadline must be between zero and 600 seconds")
    if cancelled and cancelled():
        raise OCRError("OCR preview cancelled; source unchanged")
    with tempfile.TemporaryDirectory(prefix="aviation-ocr-") as temporary:
        output = Path(temporary)
        command = [
            sys.executable,
            str(Path(__file__)),
            str(Path(path).resolve()),
            str(output),
            json.dumps(pages),
            mode,
        ]
        with open(os.devnull, "wb") as log:
            process = subprocess.Popen(command, stdout=log, stderr=log, start_new_session=True)
            deadline = time.monotonic() + timeout
            try:
                while True:
                    if cancelled and cancelled():
                        raise OCRError("OCR preview cancelled; source unchanged")
                    remaining = deadline - time.monotonic()
                    if remaining <= 0:
                        raise OCRError("OCR preview deadline exceeded; source unchanged")
                    try:
                        process.wait(timeout=min(0.1, remaining))
                        break
                    except subprocess.TimeoutExpired:
                        pass
            finally:
                # Also reap descendants after a parser crash or normal parent exit.
                _kill(process)
        candidate_path = output / "candidate.json"
        if process.returncode or not candidate_path.exists():
            raise OCRError("OCR preview failed or exceeded resource limits; source unchanged")
        if candidate_path.stat().st_size > MAX_CANDIDATE_BYTES:
            raise OCRError("OCR preview exceeds candidate size limit")
        candidate = json.loads(candidate_path.read_bytes())
        images, size = {}, 0
        if [page["page"] for page in candidate["pages"]] != pages:
            raise OCRError("OCR preview does not match requested pages")
        for page in candidate["pages"]:
            image_path = output / f"page-{page['page']}.png"
            size += image_path.stat().st_size
            if size > MAX_IMAGE_BYTES:
                raise OCRError("OCR preview exceeds image size limit")
            data = image_path.read_bytes()
            if digest(data) != page["image_sha256"]:
                raise OCRError("OCR page image integrity failure")
            images[page["page"]] = data
        return candidate, images


if __name__ == "__main__":
    if os.name == "posix":
        import resource

        resource.setrlimit(resource.RLIMIT_CPU, (180,) * 2)
        resource.setrlimit(resource.RLIMIT_FSIZE, (32 * 1024 * 1024,) * 2)
        if sys.platform.startswith("linux"):
            resource.setrlimit(resource.RLIMIT_AS, (1536 * 1024 * 1024,) * 2)
    try:
        _generate(Path(sys.argv[1]), Path(sys.argv[2]), json.loads(sys.argv[3]), sys.argv[4])
    except Exception:
        # Never emit subprocess diagnostics, PDF text, URLs or document paths.
        sys.exit(1)
