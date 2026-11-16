"""Original-backed FAA chart catalogs and real navigation-cycle acquisition."""

from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime, timezone
from io import BytesIO
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import sqlite3
import tempfile
import threading
from urllib.parse import urlsplit
from xml.etree import ElementTree
from zipfile import ZipFile, BadZipFile

from bs4 import BeautifulSoup
from pypdf import PdfReader

from .aircraft_library.discovery import PublicWeb, AcquisitionError

FAA = "https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/"
FAA_HOSTS = {"www.faa.gov", "aeronav.faa.gov", "nfdc.faa.gov"}
MAX_ASSET = 256 * 1024 * 1024
MAX_UNPACKED = 2 * 1024 * 1024 * 1024


class ChartError(ValueError):
    pass


def instant():
    return datetime.now(timezone.utc).isoformat()


def digest(data):
    return hashlib.sha256(data).hexdigest()


def faa_url(url):
    try:
        parsed = urlsplit(url)
        if (
            parsed.scheme != "https"
            or parsed.hostname not in FAA_HOSTS
            or parsed.username
            or parsed.password
            or parsed.port not in {None, 443}
            or parsed.query
            or parsed.fragment
        ):
            raise ValueError()
    except ValueError as error:
        raise ChartError("Chart acquisition requires an official FAA HTTPS URL") from error
    return url


class FAAWeb(PublicWeb):
    def _request(self, url, *, max_bytes):
        faa_url(url)  # Applies to every redirect and robots request, before connection.
        return super()._request(url, max_bytes=max_bytes)


def publication_date(text, *, hour=9, minute=1):
    text = re.sub(r"\s+", " ", text.strip()).replace(",", "")
    for pattern in ("%b %d %Y", "%d %B %Y", "%m/%d/%y"):
        try:
            value = datetime.strptime(text, pattern)
            return value.replace(hour=hour, minute=minute, tzinfo=timezone.utc).isoformat()
        except ValueError:
            pass
    raise ChartError("Unrecognized FAA publication date")


def lifecycle(start, end, at=None):
    reference = (
        datetime.fromisoformat(at.replace("Z", "+00:00")) if at else datetime.now(timezone.utc)
    )
    if reference.tzinfo is None:
        raise ChartError("Chart reference time requires a timezone")
    if start and reference < datetime.fromisoformat(start):
        return "future"
    if end and reference >= datetime.fromisoformat(end):
        return "expired"
    return "current" if start and end else "undated"


def asset_id(source, identity):
    return "chart_" + digest((source + "\n" + identity).encode())[:32]


def cifp_editions(html):
    soup = BeautifulSoup(html, "html.parser")
    editions = []
    for row in soup.select("tr"):
        cells = row.find_all("td", recursive=False)
        if len(cells) < 3:
            continue
        link = row.find("a", href=re.compile(r"/CIFP_\d{6}\.zip$", re.I))
        if link:
            url = faa_url(link["href"])
            start, end = (publication_date(cells[i].get_text(" ", strip=True)) for i in (1, 2))
            if start >= end:
                raise ChartError("Invalid CIFP effective interval")
            editions.append({"url": url, "effective_from": start, "effective_to": end})
    if not editions:
        raise ChartError("FAA CIFP page contains no dated distributions")
    return editions


def unpack_cifp(data, edition):
    try:
        with ZipFile(BytesIO(data)) as archive:
            entries = archive.infolist()
            if len(entries) > 100 or sum(i.file_size for i in entries) > MAX_UNPACKED:
                raise ChartError("CIFP archive exceeds resource limits")
            raw_name = next(
                i.filename for i in entries if PurePosixPath(i.filename).name == "FAACIFP18"
            )
            readme = next(
                i.filename for i in entries if re.search(r"CIFP Readme.*\.pdf$", i.filename, re.I)
            )
            text = PdfReader(BytesIO(archive.read(readme))).pages[0].extract_text()
            volume = re.search(r"Volume:\s*(\d{4})\b", text or "")
            if not volume:
                raise ChartError("CIFP cycle identity missing from distribution readme")
            for label, key in (("Effective", "effective_from"), ("To", "effective_to")):
                date = re.search(label + r":\s*0901Z\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})", text)
                if not date or publication_date(date[1]) != edition[key]:
                    raise ChartError("CIFP readme and published effective interval disagree")
            raw = archive.read(raw_name)
            if not raw or len(raw) > 120 * 1024 * 1024:
                raise ChartError("Invalid CIFP record payload")
            return {
                **edition,
                "cycle": volume.group(1),
                "archive_sha256": digest(data),
                "records_sha256": digest(raw),
                "records": raw,
                "readme": archive.read(readme),
            }
    except (BadZipFile, KeyError, StopIteration) as error:
        raise ChartError("Invalid FAA CIFP distribution") from error


def terminal_catalog(data, expected_cycle=None):
    if len(data) > 40 * 1024 * 1024 or b"<!DOCTYPE" in data.upper():
        raise ChartError("Invalid or oversized terminal catalog")
    try:
        root = ElementTree.fromstring(data)
        cycle = root.attrib["cycle"]
        if (
            root.tag != "digital_tpp"
            or not re.fullmatch(r"\d{4}", cycle)
            or (expected_cycle and cycle != expected_cycle)
        ):
            raise ValueError("Unexpected terminal cycle")
        dates = []
        for key in ("from_edate", "to_edate"):
            match = re.fullmatch(r"(\d{2})(\d{2})Z\s+(\d{2}/\d{2}/\d{2})", root.attrib[key])
            if not match:
                raise ValueError("Invalid terminal validity")
            dates.append(publication_date(match[3], hour=int(match[1]), minute=int(match[2])))
        start, end = dates
        if start >= end:
            raise ValueError("Invalid terminal interval")
        records = []
        for state in root.findall("state_code"):
            for city in state.findall("city_name"):
                for airport in city.findall("airport_name"):
                    identity = (
                        airport.get("icao_ident", "").strip()
                        or airport.get("apt_ident", "").strip()
                    )
                    for record in airport.findall("record"):
                        fields = {child.tag: (child.text or "").strip() for child in record}
                        name = fields.get("pdf_name", "")
                        if not re.fullmatch(r"[A-Za-z0-9_-]+\.[Pp][Dd][Ff]", name):
                            continue  # FAA withdrawal/deletion entries retain no downloadable PDF.
                        url = faa_url(f"https://aeronav.faa.gov/d-tpp/{cycle}/{name}")
                        code = fields.get("chart_code", "")
                        key = "|".join([cycle, identity, code, fields.get("chartseq", ""), name])
                        records.append(
                            {
                                "id": asset_id("FAA-dTPP", key),
                                "name": fields.get("chart_name", name),
                                "kind": code,
                                "family": "terminal",
                                "format": "pdf",
                                "url": url,
                                "airport": identity,
                                "faa_ident": airport.get("apt_ident"),
                                "icao": airport.get("icao_ident") or None,
                                "airport_name": airport.get("ID"),
                                "state": state.get("ID"),
                                "cycle": cycle,
                                "effective_from": start,
                                "effective_to": end,
                                "record": fields,
                                "source": "FAA d-TPP",
                            }
                        )
        if not records:
            raise ValueError("Empty terminal catalog")
        return records
    except (ElementTree.ParseError, KeyError, ValueError) as error:
        raise ChartError("Malformed FAA terminal catalog") from error


def raster_catalog(html, family):
    if family not in {"vfr", "ifr"}:
        raise ChartError("Unknown chart family")
    soup = BeautifulSoup(html, "html.parser")
    records = []
    date_pattern = re.compile(r"[A-Z][a-z]{2}\s+\d{1,2},?\s+\d{4}")
    for row in soup.select("tr"):
        cells = row.find_all("td", recursive=False)
        if len(cells) < 3:
            continue
        name = cells[0].get_text(" ", strip=True)
        dates = [date_pattern.search(c.get_text(" ", strip=True)) for c in cells[1:]]
        for index, cell in enumerate(cells[1:]):
            if not dates[index]:
                continue
            start = publication_date(dates[index][0])
            end = (
                publication_date(dates[index + 1][0])
                if index + 1 < len(dates) and dates[index + 1]
                else None
            )
            for link in cell.find_all("a", href=True):
                url = link["href"]
                if not re.search(r"\.(pdf|zip)$", url, re.I):
                    continue
                faa_url(url)
                label = link.get_text(" ", strip=True).upper()
                form = (
                    "geotiff"
                    if "TIFF" in label
                    else "pdf_zip" if url.lower().endswith("zip") else "pdf"
                )
                kind = (
                    "sectional"
                    if "/sectional-files/" in url
                    else (
                        "terminal_area"
                        if "_TAC" in url
                        else "enroute" if family == "ifr" else "visual"
                    )
                )
                records.append(
                    {
                        "id": asset_id("FAA-raster", "|".join([name, start, url])),
                        "name": name,
                        "family": family,
                        "kind": kind,
                        "format": form,
                        "url": url,
                        "airport": None,
                        "icao": None,
                        "faa_ident": None,
                        "cycle": start[:10],
                        "effective_from": start,
                        "effective_to": end,
                        "source": "FAA VFR raster" if family == "vfr" else "FAA IFR enroute",
                        "record": {"download_label": label},
                    }
                )
    if not records:
        raise ChartError("FAA chart page contains no dated downloads")
    return records


class Charts:
    def __init__(self, root=None, *, web=None, quota=None):
        self.root = Path(root or os.environ.get("AVIATION_CHARTS_DIR", "/app/data/charts"))
        self.root.mkdir(parents=True, exist_ok=True)
        self.objects = self.root / "objects"
        self.objects.mkdir(exist_ok=True)
        self.db = self.root / "charts.sqlite3"
        self.web = web or FAAWeb()
        self.quota = quota or int(os.environ.get("AVIATION_CHARTS_CACHE_BYTES", str(4 * 1024**3)))
        self.lock = threading.RLock()
        with self.connection() as c:
            if c.execute("PRAGMA user_version").fetchone()[0] not in {0, 1}:
                raise ChartError("Unsupported chart database schema")
            c.executescript("""
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS catalog(id TEXT PRIMARY KEY,family TEXT,airport TEXT,name TEXT,metadata TEXT);
                CREATE INDEX IF NOT EXISTS catalog_airport ON catalog(airport);
                CREATE TABLE IF NOT EXISTS receipts(id INTEGER PRIMARY KEY,chart_id TEXT,url TEXT,sha256 TEXT,size INTEGER,at TEXT,members TEXT);
                CREATE TABLE IF NOT EXISTS sources(name TEXT PRIMARY KEY,metadata TEXT);
                CREATE TABLE IF NOT EXISTS cycles(cycle TEXT PRIMARY KEY,metadata TEXT);
                PRAGMA user_version=1;
            """)

    @contextmanager
    def connection(self):
        c = sqlite3.connect(self.db, timeout=30)
        c.row_factory = sqlite3.Row
        try:
            with c:
                yield c
        finally:
            c.close()

    def save_object(self, content):
        key = digest(content)
        path = self.objects / key
        if not path.exists():
            used = sum(p.stat().st_size for p in self.objects.iterdir() if p.is_file())
            if (
                used + len(content) > self.quota
                or shutil.disk_usage(self.root).free < len(content) + 2 * 1024**3
            ):
                raise ChartError(
                    "Chart cache quota or disk reserve reached; acquired originals retained"
                )
            with tempfile.NamedTemporaryFile(dir=self.objects, delete=False) as output:
                temporary = Path(output.name)
                try:
                    output.write(content)
                    output.flush()
                    os.fsync(output.fileno())
                    os.replace(temporary, path)
                finally:
                    temporary.unlink(missing_ok=True)
        return key

    def save_stream(self, stream, declared_size):
        used = sum(p.stat().st_size for p in self.objects.iterdir() if p.is_file())
        if (
            declared_size > MAX_UNPACKED
            or used + declared_size > self.quota
            or shutil.disk_usage(self.root).free < declared_size + 2 * 1024**3
        ):
            raise ChartError("Extracted chart would exceed cache quota or disk reserve")
        hasher, size = hashlib.sha256(), 0
        with tempfile.NamedTemporaryFile(dir=self.objects, delete=False) as output:
            temporary = Path(output.name)
            try:
                while block := stream.read(1024 * 1024):
                    size += len(block)
                    if size > declared_size:
                        raise ChartError("Unexpected decompressed chart length")
                    hasher.update(block)
                    output.write(block)
                if size != declared_size:
                    raise ChartError("Incomplete decompressed chart")
                output.flush()
                os.fsync(output.fileno())
                key = hasher.hexdigest()
                os.replace(temporary, self.objects / key)
            finally:
                temporary.unlink(missing_ok=True)
        return key

    def source(self, name, value):
        with self.connection() as c:
            c.execute("INSERT OR REPLACE INTO sources VALUES (?,?)", (name, json.dumps(value)))

    def replace(self, family, records):
        with self.connection() as c:
            # Preserve old cycles and immutable IDs for existing offline manifests.
            cycles, present = {r["cycle"] for r in records}, {r["id"] for r in records}
            prior = [
                r
                for r in c.execute("SELECT id,metadata FROM catalog WHERE family=?", (family,))
                if json.loads(r["metadata"])["cycle"] in cycles
            ]
            if len(prior) > 50 and len(records) < len(prior) / 2:
                raise ChartError("Unexpected chart catalog count drop; previous records retained")
            for row in prior:
                if row["id"] not in present:
                    metadata = {**json.loads(row["metadata"]), "withdrawn": True}
                    c.execute(
                        "UPDATE catalog SET metadata=? WHERE id=?",
                        (json.dumps(metadata), row["id"]),
                    )
            c.executemany(
                "INSERT OR REPLACE INTO catalog VALUES (?,?,?,?,?)",
                [(r["id"], family, r.get("airport"), r["name"], json.dumps(r)) for r in records],
            )

    def refresh(self):
        with self.lock:
            results = []
            try:
                page = self.web.get(FAA + "cifp/download/", max_bytes=4_000_000)
                index_hash = self.save_object(page["content"])
                editions = cifp_editions(page["content"])
                for edition in editions:
                    content = self.web.get(edition["url"], max_bytes=40_000_000)["content"]
                    unpacked = unpack_cifp(content, edition)
                    archive_hash = self.save_object(content)
                    records_hash = self.save_object(unpacked.pop("records"))
                    readme_hash = self.save_object(unpacked.pop("readme"))
                    metadata = {
                        **unpacked,
                        "archive_sha256": archive_hash,
                        "records_sha256": records_hash,
                        "readme_sha256": readme_hash,
                        "retrieved_at": instant(),
                        "index_sha256": index_hash,
                    }
                    with self.connection() as c:
                        c.execute(
                            "INSERT OR REPLACE INTO cycles VALUES (?,?)",
                            (metadata["cycle"], json.dumps(metadata)),
                        )
                    url = f"https://aeronav.faa.gov/d-tpp/{metadata['cycle']}/xml_data/d-TPP_Metafile.xml"
                    xml = self.web.get(url, max_bytes=40_000_000)["content"]
                    rows = terminal_catalog(xml, metadata["cycle"])
                    if (
                        rows[0]["effective_from"] != edition["effective_from"]
                        or rows[0]["effective_to"] != edition["effective_to"]
                    ):
                        raise ChartError("Terminal and CIFP edition intervals disagree")
                    xml_hash = self.save_object(xml)
                    self.replace("terminal", rows)
                    results.append(
                        {
                            "source": "terminal-" + metadata["cycle"],
                            "status": "available",
                            "records": len(rows),
                            "snapshot": xml_hash,
                            "url": url,
                            "retrieved_at": instant(),
                        }
                    )
                self.source(
                    "terminal", {"status": "available", "at": instant(), "editions": results.copy()}
                )
            except (ChartError, AcquisitionError, OSError) as error:
                failure = {
                    "source": "terminal",
                    "status": "unavailable",
                    "error": str(error),
                    "at": instant(),
                }
                self.source("terminal", failure)
                results.append(failure)
            for family in ("vfr", "ifr"):
                try:
                    url = FAA + family + "/"
                    response = self.web.get(url, max_bytes=6_000_000)
                    rows = raster_catalog(response["content"], family)
                    snapshot = self.save_object(response["content"])
                    self.replace(family, rows)
                    status = {
                        "source": family,
                        "status": "available",
                        "records": len(rows),
                        "snapshot": snapshot,
                        "url": url,
                        "at": instant(),
                    }
                    self.source(family, status)
                    results.append(status)
                except (ChartError, AcquisitionError, OSError) as error:
                    failure = {
                        "source": family,
                        "status": "unavailable",
                        "error": str(error),
                        "at": instant(),
                    }
                    self.source(family, failure)
                    results.append(failure)
            return {"results": results, "partial": any(r["status"] != "available" for r in results)}

    def status(self):
        with self.connection() as c:
            sources = {
                r["name"]: json.loads(r["metadata"]) for r in c.execute("SELECT * FROM sources")
            }
            cycles = [
                json.loads(r["metadata"]) for r in c.execute("SELECT * FROM cycles ORDER BY cycle")
            ]
            count = c.execute("SELECT COUNT(*) FROM catalog").fetchone()[0]
        return {
            "sources": sources,
            "cycles": [
                {**r, "freshness": lifecycle(r["effective_from"], r["effective_to"])}
                for r in cycles
            ],
            "charts": count,
            "cache_bytes": sum(p.stat().st_size for p in self.objects.iterdir() if p.is_file()),
            "quota_bytes": self.quota,
        }

    def get(self, identifier):
        with self.connection() as c:
            row = c.execute("SELECT metadata FROM catalog WHERE id=?", (identifier,)).fetchone()
            cached = c.execute(
                "SELECT * FROM receipts WHERE chart_id=? ORDER BY id DESC LIMIT 1", (identifier,)
            ).fetchone()
        if row is None:
            raise ChartError("Chart not found")
        record = json.loads(row["metadata"])
        record["freshness"] = (
            "withdrawn"
            if record.get("withdrawn")
            else lifecycle(record.get("effective_from"), record.get("effective_to"))
        )
        record["cached"] = (
            {**dict(cached), "members": json.loads(cached["members"])} if cached else None
        )
        record["original_url"] = f"/api/charts/{identifier}/original"
        return record

    def search(self, *, airport=None, query="", family=None, freshness=None, page=1, limit=40):
        if not 1 <= page <= 1000 or not 1 <= limit <= 100:
            raise ChartError("Invalid catalog pagination")
        where, args = [], []
        for column, value in [
            ("airport", airport.upper() if airport else None),
            ("family", family),
        ]:
            if value:
                where.append(column + "=?")
                args.append(value)
        if query:
            where.append("name LIKE ? ESCAPE '\\'")
            args.append(
                "%" + query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
            )
        with self.connection() as c:
            rows = c.execute(
                "SELECT id,metadata FROM catalog"
                + (" WHERE " + " AND ".join(where) if where else "")
                + " ORDER BY name,id",
                args,
            ).fetchall()

        def state(row):
            value = json.loads(row["metadata"])
            return (
                "withdrawn"
                if value.get("withdrawn")
                else lifecycle(value.get("effective_from"), value.get("effective_to"))
            )

        ids = [r["id"] for r in rows if not freshness or state(r) == freshness]
        return {
            "charts": [self.get(i) for i in ids[(page - 1) * limit : page * limit]],
            "total": len(ids),
            "page": page,
            "limit": limit,
            "source_status": self.status()["sources"],
        }

    def acquire(self, identifier, *, force=False):
        with self.lock:
            chart = self.get(identifier)
            if chart["cached"] and not force:
                return chart
            response = self.web.get(faa_url(chart["url"]), max_bytes=MAX_ASSET)
            content = response["content"]
            key = self.save_object(content)
            members = []
            if chart["format"] == "pdf":
                if not content.startswith(b"%PDF-"):
                    raise ChartError("FAA chart response is not a PDF; response retained")
                members.append(
                    {
                        "name": PurePosixPath(urlsplit(chart["url"]).path).name,
                        "sha256": key,
                        "format": "pdf",
                    }
                )
            else:
                try:
                    with ZipFile(BytesIO(content)) as archive:
                        entries = archive.infolist()
                        if len(entries) > 100 or sum(i.file_size for i in entries) > MAX_UNPACKED:
                            raise ChartError("Chart archive exceeds extraction limits")
                        for entry in entries:
                            path = PurePosixPath(entry.filename)
                            if (
                                path.is_absolute()
                                or ".." in path.parts
                                or "\\" in entry.filename
                                or (entry.external_attr >> 16) & 0o170000 == 0o120000
                            ):
                                raise ChartError("Unsafe chart archive path")
                            if entry.is_dir() or path.suffix.lower() not in {
                                ".pdf",
                                ".tif",
                                ".tiff",
                            }:
                                continue
                            with archive.open(entry) as source:
                                member_hash = self.save_stream(source, entry.file_size)
                            if path.suffix.lower() == ".pdf":
                                with (self.objects / member_hash).open("rb") as source:
                                    if source.read(5) != b"%PDF-":
                                        raise ChartError("Invalid PDF in chart archive")
                            members.append(
                                {
                                    "name": path.name,
                                    "sha256": member_hash,
                                    "format": "pdf" if path.suffix.lower() == ".pdf" else "geotiff",
                                }
                            )
                except BadZipFile as error:
                    raise ChartError("Invalid FAA chart archive; response retained") from error
                if not members:
                    raise ChartError("Chart archive contains no supported originals")
            with self.connection() as c:
                c.execute(
                    "INSERT INTO receipts(chart_id,url,sha256,size,at,members) VALUES (?,?,?,?,?,?)",
                    (
                        identifier,
                        response["url"],
                        key,
                        len(content),
                        instant(),
                        json.dumps(members),
                    ),
                )
            return self.get(identifier)

    def member(self, identifier, number=0, sha256=None):
        chart = self.get(identifier)
        if not chart["cached"]:
            raise ChartError("Download this chart before opening its cached copy")
        if sha256 is not None:
            with self.connection() as c:
                versions = c.execute(
                    "SELECT members FROM receipts WHERE chart_id=? ORDER BY id DESC", (identifier,)
                ).fetchall()
            for version in versions:
                members = json.loads(version["members"])
                if 0 <= number < len(members) and members[number]["sha256"] == sha256:
                    return self.objects / sha256, members[number]
            raise ChartError("Pinned chart member is not present in the acquisition history")
        members = chart["cached"]["members"]
        if not 0 <= number < len(members):
            raise ChartError("Chart member not found")
        member = members[number]
        return self.objects / member["sha256"], member
