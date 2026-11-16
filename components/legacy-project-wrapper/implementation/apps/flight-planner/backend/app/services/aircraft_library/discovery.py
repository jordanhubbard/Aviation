"""Public manual discovery and bounded, DNS-pinned document acquisition."""

from __future__ import annotations

from html.parser import HTMLParser
import http.client
import ipaddress
import os
import socket
import ssl
import time
from urllib.parse import parse_qsl, urljoin, urlsplit, urlunsplit
from urllib.robotparser import RobotFileParser

import httpx

from .pdf import MAX_PDF_BYTES
from .store import Store, icao

AGENT = "AviationAircraftLibrary/1.0"


class AcquisitionError(RuntimeError):
    pass


def public_address(host, port):
    try:
        addresses = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
        if not addresses or any(not ipaddress.ip_address(row[4][0]).is_global for row in addresses):
            raise AcquisitionError("Only public internet sources are allowed")
        return addresses
    except (socket.gaierror, ValueError) as error:
        raise AcquisitionError("Source hostname could not be resolved") from error


def validate_url(url):
    try:
        parsed = urlsplit(url)
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.hostname
            or parsed.username
            or parsed.password
            or parsed.port not in {None, 80, 443}
            or len(url) > 4000
            or any(ord(c) < 32 for c in url)
            or any(
                k.lower() in {"key", "api_key", "token", "access_token", "password", "signature"}
                for k, _ in parse_qsl(parsed.query)
            )
        ):
            raise ValueError("Invalid source URL")
        return parsed
    except ValueError as error:
        raise AcquisitionError(
            "Expected a public HTTP(S) document URL without credentials"
        ) from error


class PublicWeb:
    def __init__(self):
        self.robots = {}

    def _request(self, url, *, max_bytes):
        parsed = validate_url(url)
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        addresses = public_address(parsed.hostname, port)
        family, socktype, proto, _, sockaddr = addresses[0]
        sock = socket.socket(family, socktype, proto)
        connection = None
        try:
            sock.settimeout(25)
            sock.connect(sockaddr)
            if parsed.scheme == "https":
                sock = ssl.create_default_context().wrap_socket(
                    sock, server_hostname=parsed.hostname
                )
            connection = http.client.HTTPConnection(parsed.hostname, port, timeout=25)
            connection.sock = sock
            path = urlunsplit(("", "", parsed.path or "/", parsed.query, ""))
            connection.request(
                "GET",
                path,
                headers={
                    "User-Agent": AGENT,
                    "Accept": "application/pdf,text/html,application/rss+xml,text/plain,*/*;q=0.5",
                    "Accept-Encoding": "identity",
                },
            )
            response = connection.getresponse()
            headers = {key.lower(): value for key, value in response.getheaders()}
            if 300 <= response.status < 400:
                return response.status, headers, b""
            length = headers.get("content-length", "")
            if length.isdigit() and int(length) > max_bytes:
                raise AcquisitionError("Source response exceeds the acquisition size limit")
            content = bytearray()
            started = time.monotonic()
            while True:
                if time.monotonic() - started > 120:
                    raise AcquisitionError("Source download deadline exceeded")
                chunk = response.read(min(65536, max_bytes + 1 - len(content)))
                if not chunk:
                    break
                content.extend(chunk)
                if len(content) > max_bytes:
                    raise AcquisitionError("Source response exceeds the acquisition size limit")
            return response.status, headers, bytes(content)
        except (OSError, http.client.HTTPException) as error:
            raise AcquisitionError("Public source request failed") from error
        finally:
            if connection:
                connection.close()
            sock.close()

    def allowed(self, url):
        parsed = validate_url(url)
        origin = urlunsplit((parsed.scheme, parsed.netloc, "", "", ""))
        cached = self.robots.get(origin)
        if cached and cached[0] > time.monotonic():
            return cached[1].can_fetch(AGENT, url)
        status, _, content = self._request(origin + "/robots.txt", max_bytes=256_000)
        if status == 404:
            lines = []
        elif status in {401, 403}:
            return False
        elif status != 200:
            raise AcquisitionError("Could not verify source robots policy")
        else:
            lines = content.decode("utf-8", errors="replace").splitlines()
        policy = RobotFileParser()
        policy.parse(lines)
        self.robots[origin] = (time.monotonic() + 3600, policy)
        return policy.can_fetch(AGENT, url)

    def get(self, url, *, max_bytes=MAX_PDF_BYTES, check_robots=True):
        for _ in range(6):
            validate_url(url)
            if check_robots and not self.allowed(url):
                raise AcquisitionError("Source robots policy disallows acquisition")
            status, headers, data = self._request(url, max_bytes=max_bytes)
            if 300 <= status < 400:
                location = headers.get("location")
                if not location:
                    raise AcquisitionError("Source redirect has no destination")
                url = urljoin(url, location)
                continue
            if status != 200:
                raise AcquisitionError(f"Public source returned HTTP {status}")
            return {"url": url, "content": data, "content_type": headers.get("content-type", "")}
        raise AcquisitionError("Source redirect limit exceeded")


class PDFLinks(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        if tag.lower() == "a":
            href = dict(attrs).get("href", "")
            if ".pdf" in href.lower():
                self.links.append(href)


class Search:
    def __init__(self, web=None, environment=None):
        self.web = web or PublicWeb()
        env = os.environ if environment is None else environment
        self.key = env.get("AIRCRAFT_LIBRARY_BRAVE_SEARCH_KEY", "")
        self.endpoint = env.get("AIRCRAFT_LIBRARY_SEARCH_URL", "")
        if self.endpoint:
            parsed = urlsplit(self.endpoint)
            local = parsed.hostname in {"localhost", "127.0.0.1", "::1"}
            if (
                not parsed.hostname
                or parsed.username
                or parsed.password
                or parsed.query
                or parsed.fragment
                or (parsed.scheme != "https" and not (parsed.scheme == "http" and local))
            ):
                raise ValueError("Search endpoint must use HTTPS, or HTTP on loopback")

    def capabilities(self):
        return {
            "configured": bool(self.key or self.endpoint),
            "provider": "Brave Search" if self.key else "SearXNG" if self.endpoint else None,
        }

    def query(self, query):
        if self.key:
            try:
                with httpx.Client(timeout=30, trust_env=False, follow_redirects=False) as client:
                    response = client.get(
                        "https://api.search.brave.com/res/v1/web/search",
                        headers={"X-Subscription-Token": self.key},
                        params={"q": query, "count": 20},
                    )
                    response.raise_for_status()
                    records = response.json().get("web", {}).get("results", [])
                return [
                    {
                        "url": row["url"],
                        "title": row.get("title", ""),
                        "query": query,
                        "provider": "Brave Search",
                    }
                    for row in records
                ]
            except (httpx.HTTPError, ValueError, TypeError, KeyError) as error:
                raise AcquisitionError("Manual search provider unavailable") from error
        if self.endpoint:
            try:
                with httpx.Client(timeout=30, trust_env=False, follow_redirects=False) as client:
                    response = client.get(self.endpoint, params={"q": query, "format": "json"})
                    response.raise_for_status()
                    records = response.json()["results"]
                return [
                    {
                        "url": row["url"],
                        "title": row.get("title", ""),
                        "query": query,
                        "provider": "SearXNG",
                    }
                    for row in records[:50]
                ]
            except (httpx.HTTPError, ValueError, TypeError, KeyError) as error:
                raise AcquisitionError("Manual search provider unavailable") from error
        raise AcquisitionError("Configure Brave Search or a SearXNG JSON search endpoint")


def discover(store: Store, values: dict, *, maximum=30, web=None, search=None):
    """Multiple independent queries, PDFs plus linked manuals, with per-candidate evidence."""
    if not 1 <= maximum <= 200:
        raise ValueError("Discovery batch must request 1 to 200 documents")
    code = icao(values["icao"])
    from .store import metadata

    values = metadata(values)
    web = web or PublicWeb()
    search = search or Search(web)
    identity = " ".join(
        v
        for v in [code, values["manufacturer"][:80], values["model"][:80], values["variant"][:80]]
        if v
    )
    queries = [
        identity + suffix
        for suffix in [
            ' "pilot operating handbook" filetype:pdf',
            ' "airplane flight manual" filetype:pdf',
            " POH AFM PDF manual",
            ' "maintenance manual" filetype:pdf',
            ' "pilot information manual" filetype:pdf',
            " flight manual supplements PDF",
        ]
    ]
    candidates, errors, seen = [], [], set()
    for query in queries:
        try:
            for result in search.query(query):
                if result["url"] not in seen:
                    seen.add(result["url"])
                    candidates.append(result)
        except AcquisitionError as error:
            errors.append({"query": query, "error": str(error)})
    if len(errors) == len(queries):
        raise AcquisitionError("All manual discovery searches failed")
    result = acquire_candidates(store, values, candidates, maximum=maximum, web=web)
    return {**result, "queries": queries, "search_errors": errors}


def acquire_candidates(store: Store, values: dict, candidates: list[dict], *, maximum=30, web=None):
    from .store import metadata

    values = metadata(values)
    code = values["icao"]
    if not 1 <= maximum <= 200 or len(candidates) > 300:
        raise ValueError("Acquisition batch limit exceeded")
    web = web or PublicWeb()
    results, downloaded, fetched = [], set(), set()
    for candidate in candidates:
        if len(downloaded) >= maximum:
            break
        pending = [candidate["url"]]
        while pending and len(downloaded) < maximum:
            url = pending.pop(0)
            if url in fetched:
                continue
            fetched.add(url)
            try:
                response = web.get(url)
                if response["content"].startswith(b"%PDF-"):
                    name = urlsplit(response["url"]).path.rsplit("/", 1)[-1] or code + ".pdf"
                    # Web type/variant association is deliberately marked unverified.
                    associated = values
                    if candidate.get("provider") != "operator-provided URL":
                        associated = {
                            **values,
                            "kind": "OTHER",
                            "variant": "",
                            "revision": "",
                            "serial_applicability": "",
                            "title": candidate.get("title", "")[:500] or name,
                            "notes": "Web-discovered example: aircraft identity, variant, revision and applicability require review.",
                        }
                    acquired = store.ingest(
                        response["content"],
                        associated,
                        filename=name,
                        extract=False,
                        url=response["url"],
                        provenance={
                            **candidate,
                            "method": "web_discovery",
                            "requested_url": url,
                            "rights": "not_verified",
                            "aircraft_match": "unverified",
                        },
                    )
                    downloaded.add(acquired["sha256"])
                    results.append(
                        {
                            "url": url,
                            "document_id": acquired["id"],
                            "sha256": acquired["sha256"],
                            "status": acquired["status"],
                        }
                    )
                elif "text/html" in response["content_type"] and url == candidate["url"]:
                    parser = PDFLinks()
                    parser.feed(response["content"][:2_000_000].decode("utf-8", errors="replace"))
                    pending.extend(urljoin(response["url"], link) for link in parser.links[:30])
                    results.append({"url": url, "status": "page", "pdf_links": len(parser.links)})
                else:
                    results.append({"url": url, "status": "not_pdf"})
            except (AcquisitionError, ValueError) as error:
                results.append({"url": url, "status": "failed", "error": str(error)})
    return {
        "icao": code,
        "candidates": candidates,
        "results": results,
        "unique_originals": len(downloaded),
        "batch_limit": maximum,
        "limit_reached": len(downloaded) >= maximum,
        "next_action": "Review aircraft identity, variant, revision, serial applicability and source rights; repeat with model/variant terms for more examples.",
    }
