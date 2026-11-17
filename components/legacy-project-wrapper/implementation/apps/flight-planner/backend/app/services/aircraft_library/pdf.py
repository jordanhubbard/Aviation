"""Page-preserving PDF extraction. PDF content is never executed."""

from __future__ import annotations

from io import BytesIO
from pathlib import Path
import shutil
import subprocess
import tempfile
import json
import os
import signal
import sys

from pypdf import PdfReader

MAX_PDF_BYTES = 100 * 1024 * 1024
MAX_PAGES = 1500
MAX_PAGE_CHARACTERS = 100_000
MAX_DOCUMENT_CHARACTERS = 12_000_000


class PDFError(ValueError):
    pass


def extract(data: bytes, *, ocr: bool = True) -> dict:
    if not data.startswith(b"%PDF-") or len(data) > MAX_PDF_BYTES:
        raise PDFError("Expected a PDF of at most 100 MiB")
    try:
        reader = PdfReader(BytesIO(data), strict=False)
        encryption = "none"
        if reader.is_encrypted:
            # Some public manuals open normally with an empty reader password.
            # Never guess passwords or bypass a password-required document.
            try:
                opened = reader.decrypt("")
            except Exception as error:
                raise PDFError(
                    "Encrypted PDF could not be opened; provide an unlocked copy"
                ) from error
            if not opened:
                raise PDFError("Encrypted PDF requires a password; provide an unlocked copy")
            encryption = "empty_reader_password"
        count = len(reader.pages)
        if not 0 < count <= MAX_PAGES:
            raise PDFError(f"PDF must contain 1 to {MAX_PAGES} pages")
        labels = reader.page_labels
        pages, total = [], 0
        for number, page in enumerate(reader.pages, 1):
            error, method = None, "text"
            try:
                text = page.extract_text(extraction_mode="layout") or ""
            except Exception:
                text, error = "", "PDF text extraction failed"
            # Sparse pages may be title pages; record exactly what was recovered.
            if len(text.strip()) < 30 and ocr:
                try:
                    recovered = ocr_page(data, number)
                    if len(recovered.strip()) > len(text.strip()):
                        text, method, error = recovered, "ocr", None
                except (RuntimeError, subprocess.SubprocessError, OSError, ValueError):
                    error = "OCR unavailable or failed; text may be incomplete"
            if len(text) > MAX_PAGE_CHARACTERS or total + len(text) > MAX_DOCUMENT_CHARACTERS:
                pages.append(
                    {
                        "page": number,
                        "label": str(labels[number - 1]),
                        "text": "",
                        "method": "missing",
                        "error": "Extraction text limit reached",
                    }
                )
                continue
            total += len(text)
            pages.append(
                {
                    "page": number,
                    "label": str(labels[number - 1]),
                    "text": text,
                    "method": method if text.strip() else "missing",
                    "error": error or (None if text.strip() else "No readable text"),
                }
            )
        missing = [p["page"] for p in pages if p["error"] or p["method"] == "missing"]
        return {
            "status": "partial" if missing else "indexed",
            "pages": pages,
            "page_count": count,
            "incomplete_pages": missing,
            "extractor": "pypdf-layout+pdfium-tesseract",
            "encryption": encryption,
            "characters": total,
        }
    except PDFError:
        raise
    except Exception as error:
        raise PDFError("Malformed or unsupported PDF") from error


def ocr_page(data: bytes, number: int) -> str:
    if not shutil.which("tesseract"):
        raise RuntimeError("Tesseract is not installed")
    import pypdfium2 as pdfium

    with tempfile.TemporaryDirectory(prefix="aviation-pdf-") as temporary:
        image = Path(temporary) / "page.png"
        with pdfium.PdfDocument(data) as document:
            page = document[number - 1]
            # Bound rendered pixels for unusual or malicious page dimensions.
            width, height = page.get_size()
            if width <= 0 or height <= 0:
                raise ValueError("Invalid page dimensions")
            scale = min(2.5, (12_000_000 / (width * height)) ** 0.5)
            bitmap = page.render(scale=scale)
            try:
                bitmap.to_pil().save(image)
            finally:
                bitmap.close()
                page.close()
        result = subprocess.run(
            ["tesseract", str(image), "stdout"], capture_output=True, timeout=45, check=True
        )
        return result.stdout[: MAX_PAGE_CHARACTERS * 4].decode("utf-8", errors="replace")


def chunks(pages: list[dict], size: int = 1800, overlap: int = 250):
    """Never join distinct pages: every retrieval unit has an exact source page."""
    for page in pages:
        text = page["text"].strip()
        offset = 0
        while offset < len(text):
            end = min(len(text), offset + size)
            if end < len(text):
                boundary = text.rfind("\n", offset + size // 2, end)
                if boundary > offset:
                    end = boundary
            yield {
                "page": page["page"],
                "label": page["label"],
                "offset": offset,
                "text": text[offset:end],
                "method": page["method"],
            }
            if end == len(text):
                break
            offset = max(offset + 1, end - overlap)


def extract_file(path: Path, *, ocr=True, timeout=600):
    """Keep untrusted parsing/OCR out of the web/queue process and bound its lifetime."""
    with tempfile.TemporaryDirectory(prefix="aviation-extract-") as temporary:
        output = Path(temporary) / "pages.json"
        command = [
            sys.executable,
            str(Path(__file__)),
            str(path),
            str(output),
            "ocr" if ocr else "text",
        ]
        with open(Path(temporary) / "diagnostics.log", "wb") as diagnostics:
            process = subprocess.Popen(
                command, stdout=diagnostics, stderr=diagnostics, start_new_session=True
            )
            try:
                process.wait(timeout=timeout)
            except subprocess.TimeoutExpired as error:
                if os.name == "posix":
                    os.killpg(process.pid, signal.SIGKILL)
                else:
                    process.kill()
                process.wait()
                raise PDFError("PDF extraction deadline exceeded; original retained") from error
        if process.returncode or not output.exists() or output.stat().st_size > 80 * 1024 * 1024:
            raise PDFError("PDF extraction failed or exceeded resource limits; original retained")
        result = json.loads(output.read_text())
        if "error" in result:
            raise PDFError(result["error"])
        return result


if __name__ == "__main__":
    if sys.platform.startswith("linux"):
        import resource

        resource.setrlimit(resource.RLIMIT_AS, (1536 * 1024 * 1024, 1536 * 1024 * 1024))
        resource.setrlimit(resource.RLIMIT_CPU, (180, 180))
        resource.setrlimit(resource.RLIMIT_FSIZE, (100 * 1024 * 1024, 100 * 1024 * 1024))
    try:
        result = extract(Path(sys.argv[1]).read_bytes(), ocr=sys.argv[3] == "ocr")
    except PDFError as error:
        result = {"error": str(error)}
    Path(sys.argv[2]).write_text(json.dumps(result))
