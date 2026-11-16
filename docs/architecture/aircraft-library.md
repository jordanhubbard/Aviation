# Aircraft document knowledge service

Behavioral authority for [#489](https://github.com/jordanhubbard/Aviation/issues/489), part of [#488](https://github.com/jordanhubbard/Aviation/issues/488). Flight Planner hosts the service and Meta exposes the same typed operations through the planning HTTP/MCP gateway. This is a private, single-operator library; public source URLs do not make uploaded aircraft documents public.

## Ingestion and identity

Accept PDF originals by upload or public-web acquisition. Persist the exact original bytes by SHA-256, and retain each acquisition URL/filename/retrieval time. Catalog documents by explicit ICAO type designator, document kind (POH, AFM, PIM, maintenance, supplement or other), manufacturer/model/variant, title, revision, serial applicability, and optional one or more aircraft registrations. ICAO association is an operator/source claim, not verified solely from a filename or an LLM. Identical bytes deduplicate storage without dropping acquisition provenance or tail associations. Separate aircraft-specific documents from type references; selecting a different registration SHALL NOT retrieve another aircraft's private document. Unknown revision/applicability remains unknown.

Every page retains physical PDF page number, printed page label when available, extracted text and extraction method. Scanned pages use OCR when available; unreadable pages remain explicitly missing. Encrypted/malformed files and resource limits return explicit states and never claim complete extraction. Originals survive failed extraction. Text and page-aware chunks are indexed persistently. Restarting the service preserves catalog, originals, sources and retrieval state.

## Retrieval, distillation and answers

Search filters include ICAO, registration, document IDs, variant and revision. Retrieval combines full-text ranking with semantic vectors when the configured embedding provider is available; stored vectors identify their model. Distillation covers document sections using page-cited evidence and marks missing extraction. It never presents an extractive index as an LLM summary. A configured LLM answers from retrieved original-page evidence, returns document/page citations, and states insufficient evidence rather than inventing figures or applicability. Document text is untrusted evidence, never instructions. Conflicting editions/variants remain separate and visible; unknown applicability is not approval for a particular aircraft. Generated answers and summaries are derived artifacts distinct from original text.

Performance questions must retain units, weight/configuration, source revision and applicability. No LLM-derived number becomes a planning dataset without separate review and independent numerical acceptance under #494. Maintenance information can be retrieved from relevant manuals but no inferred service interval or return-to-service authority is fabricated.

## Web acquisition

Search multiple ICAO/model/manual queries and collect multiple examples, keeping per-result URL/title/query/provider provenance, deduplication and explicit failures. Fetch public documents and PDF links from public result pages using bounded, SSRF-resistant requests, honoring redirects only after revalidation. Do not bypass accounts/paywalls. Keep originals private, with publisher/source attribution and unknown rights explicit. Missing search credentials/provider failure is an unavailable search, never zero known manuals. Background work is persistent, inspectable and bounded per request; users can extend discovery with further batches.

## Access and lifecycle

All document data and search/LLM operations require the operator's library bearer credential. Missing configuration disables private routes instead of opening them publicly. The UI shell exposes no private content before authentication and keeps credentials out of URLs and persistent browser storage. Separate original file download from rendered text; original downloads use attachment/nosniff and private no-store. UI report strings use text rendering. Browser selection changes discard stale data.

Test deterministic PDFs, duplicate bytes/acquisitions, persistence, wrong-type/tail isolation, malformed/encrypted/scanned pages, partial extraction, citation validation, absent evidence, conflicting metadata, provider failures, SSRF redirects/addresses, authentication and desktop/mobile flows. Real PDF extraction/rendering and configured LLM/provider acceptance are separate from fixture tests. Full completion requires current authority/receipt/CI plus exact-image deployment and live HTTP/MCP/UI checks; no fixture proves live model or provider access.
