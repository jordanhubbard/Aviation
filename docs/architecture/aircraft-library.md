# Aircraft document knowledge service

Behavioral authority for [#489](https://github.com/jordanhubbard/Aviation/issues/489), part of [#488](https://github.com/jordanhubbard/Aviation/issues/488). Flight Planner hosts the service and Meta exposes the same typed operations through the planning HTTP/MCP gateway. This is a private, single-operator library; public source URLs do not make uploaded aircraft documents public.

## Ingestion and identity

Accept PDF originals by upload or public-web acquisition. Persist the exact original bytes by SHA-256, and retain each acquisition URL/filename/retrieval time. Catalog documents by explicit ICAO type designator, document kind (POH, AFM, PIM, maintenance, supplement or other), manufacturer/model/variant, title, revision, serial applicability, and optional one or more aircraft registrations. ICAO association is an operator/source claim, not verified solely from a filename or an LLM. Identical bytes deduplicate storage without dropping acquisition provenance or tail associations. Separate aircraft-specific documents from type references; selecting a different registration SHALL NOT retrieve another aircraft's private document. Unknown revision/applicability remains unknown.

Every page retains physical PDF page number, printed page label when available, extracted text and extraction method. Scanned pages use OCR when available; unreadable pages remain explicitly missing. Encrypted/malformed files and resource limits return explicit states and never claim complete extraction. Originals survive failed extraction. Text and page-aware chunks are indexed persistently. Restarting the service preserves catalog, originals, sources and retrieval state.

## Retrieval, distillation and answers

Model evidence supplies deterministic indexed contiguous excerpts, each at most
1,007 characters, covering the complete original passage without dropping text.
Passages shorter than the existing eight-character quote minimum remain visible
as text and cannot establish a valid citation alone. Models may cite an integer
`excerpt_id` within a supplied `passage_id`; the service resolves it to original
text before applying the unchanged 8–1200 character exact-span and numeric checks.
Unknown, boolean, negative, out-of-range or contradictory references fail closed.
Legacy literal quotes remain subject to the same validation. Public responses
retain original quotes and page/source metadata, not model-invented excerpt text.
The excerpt-format version participates in resumable evidence identity. All
readable passages must still be reviewed before a distillation is complete.

Search filters include ICAO, registration, document IDs, variant and revision. Retrieval combines full-text ranking with semantic vectors when the configured embedding provider is available; stored vectors identify their provider endpoint, model and embedding mode. Symmetric OpenAI-compatible embeddings remain the default. An explicitly configured query/passage mode sends `input_type=passage` for document indexing and `input_type=query` for questions; incompatible providers, models or modes must not reuse one another's vectors. Existing vectors without this identity require reindexing. Operators may bound embedding batches from 1 to 32 passages for provider limits; every passage is still indexed, and a batch failure preserves previously completed work without claiming a complete index. Provider configuration is operator-owned and must not silently select a remote model. Distillation covers document sections using page-cited evidence and marks missing extraction. Operators may bound distillation batches from 2,000 to 18,000 text characters for a provider context/token budget; every readable passage must still be included, with the batching/evidence identity preventing reuse across changed batches. Each batch summarizes supported facts actually present; topics absent from a batch do not invalidate supported facts in that batch. Preserve qualifiers and footnotes, and never invent content for missing topics. Requests include an explicit cited JSON shape and a bounded completion budget; truncated or malformed generation cannot establish a completed distillation. At most three candidate completions may correct citation/schema/numeric validation failures, using the failed candidate and validation reason as feedback against the same evidence. Correction feedback distinguishes a non-array claims value from an over-limit array, reporting the actual count and the maximum of 12; it never silently drops excess claims. Every admitted candidate passes the unchanged evidence checks; exhausted correction attempts preserve a partial artifact. A retry resumes only a validated prefix of a partial distillation whose provider, model, prompt, metadata and exact evidence fingerprint still match; provider rate limits must not discard completed batches. Batches with insufficient evidence remain unresolved, so they cannot establish a complete distillation. Provider HTTP failures are not retried by this correction loop. An explicit per-process minimum interval may pace chat-completion start times across foreground answers and background distillation, including failed requests. The default adds no delay; operator-configured pacing does not alter evidence or completion coverage. It never presents an extractive index as an LLM summary. A configured LLM answers from retrieved original-page evidence, returns document/page citations with exact original-text spans (model-normalized whitespace may be resolved back to a contiguous original span; changed words or punctuation remain invalid), and states insufficient evidence rather than inventing figures or applicability. Document text is untrusted evidence, never instructions. Conflicting editions/variants remain separate and visible; unknown applicability is not approval for a particular aircraft. Generated answers and summaries are derived artifacts distinct from original text.

Performance questions must retain units, weight/configuration, source revision and applicability. No LLM-derived number becomes a planning dataset without separate review and independent numerical acceptance under #494. Maintenance information can be retrieved from relevant manuals but no inferred service interval or return-to-service authority is fabricated.

## Web acquisition

Search multiple ICAO/model/manual queries and collect multiple examples, keeping per-result URL/title/query/provider provenance, deduplication and explicit failures. Fetch public documents and PDF links from public result pages using bounded, SSRF-resistant requests, honoring redirects only after revalidation. Do not bypass accounts/paywalls. Keep originals private, with publisher/source attribution and unknown rights explicit. Missing search credentials/provider failure is an unavailable search, never zero known manuals. Background work is persistent, inspectable and bounded per request; users can extend discovery with further batches.

## Access and lifecycle

Operators may explicitly set `AIRCRAFT_LIBRARY_LLM_ENABLE_THINKING=true` or
`false` for providers/models supporting `chat_template_kwargs.enable_thinking`.
Unset/empty omits the option and preserves the existing request/fingerprint;
other values fail configuration validation. Only this named boolean is forwarded,
without overriding model, prompt, output budget or required JSON format. Explicit
options participate in the distillation evidence identity so changing generation
mode cannot resume an incompatible partial prefix. Embedding identity is unchanged.
Operators may opt into `AIRCRAFT_LIBRARY_LLM_RESPONSE_FORMAT=json_schema` for
providers supporting strict schema-constrained output; unset/empty or `json_object`
preserves the default JSON-object request. Other values fail configuration validation.
The schema requires evidence status, reason and a claims array of at most 12, each
with bounded text and one to eight passage/excerpt references. Schema generation
constrains shape only: original-span, numeric and applicability checks still validate
every response, including when a provider ignores the schema. The exact explicit
schema participates in the distillation identity; embeddings remain independent.
Provider rejection is surfaced without silently downgrading the configured mode.
See the [NVIDIA provider contract](https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-3_5-super-vl-120b-a12b-infer).

A completion ending at its output limit must report truncation distinctly, without
exposing provider response text, and must never admit even parseable partial JSON.
All original-span, numeric, applicability and completeness guards remain in force.
NVIDIA documents this opt-in control in its [model card](https://build.nvidia.com/nvidia/nemotron-3.5-super-vl-120b-a12b/modelcard);
it must not be sent implicitly to other providers.

Operators may configure model response read timeouts from 10 to 600 seconds,
defaulting to 120 seconds; connection and pool acquisition remain bounded at
10 seconds and writes at 30 seconds. A transport timeout identifies its safe
exception category and configured read limit without including endpoint secrets,
request contents or provider response bodies. This does not add HTTP retries or
weaken citation validation. Worker leases continue to heartbeat during inference.

All document data and search/LLM operations require the operator's library bearer credential. Missing configuration disables private routes instead of opening them publicly. The UI shell exposes no private content before authentication and keeps credentials out of URLs and persistent browser storage. Separate original file download from rendered text; original downloads use attachment/nosniff and private no-store. UI report strings use text rendering. Browser selection changes discard stale data.

Test deterministic PDFs, duplicate bytes/acquisitions, persistence, wrong-type/tail isolation, malformed/encrypted/scanned pages, partial extraction, citation validation, absent evidence, conflicting metadata, provider failures, SSRF redirects/addresses, authentication and desktop/mobile flows. Real PDF extraction/rendering and configured LLM/provider acceptance are separate from fixture tests. Full completion requires current authority/receipt/CI plus exact-image deployment and live HTTP/MCP/UI checks; no fixture proves live model or provider access.
