# Aircraft document knowledge service

Behavioral authority for [#489](https://github.com/jordanhubbard/Aviation/issues/489), part of [#488](https://github.com/jordanhubbard/Aviation/issues/488). Flight Planner hosts the service and Meta exposes the same typed operations through the planning HTTP/MCP gateway. This is a private, single-operator library; public source URLs do not make uploaded aircraft documents public.

## Ingestion and identity

Accept PDF originals by upload or public-web acquisition. Persist the exact original bytes by SHA-256, and retain each acquisition URL/filename/retrieval time. Catalog documents by explicit ICAO type designator, document kind (POH, AFM, PIM, maintenance, supplement or other), manufacturer/model/variant, title, revision, serial applicability, and optional one or more aircraft registrations. ICAO association is an operator/source claim, not verified solely from a filename or an LLM. Identical bytes deduplicate storage without dropping acquisition provenance or tail associations. Separate aircraft-specific documents from type references; selecting a different registration SHALL NOT retrieve another aircraft's private document. Unknown revision/applicability remains unknown.

Every page retains physical PDF page number, printed page label when available, extracted text and extraction method. Scanned pages use OCR when available; unreadable pages remain explicitly missing. Encrypted/malformed files and resource limits return explicit states and never claim complete extraction. Originals survive failed extraction. Text and page-aware chunks are indexed persistently. Restarting the service preserves catalog, originals, sources and retrieval state.

## Retrieval, distillation and answers

For [#520](https://github.com/jordanhubbard/Aviation/issues/520), operators may set
`AIRCRAFT_LIBRARY_VALIDATION_TRACE_DIR` to an absolute protected server directory.
Unset/empty disables diagnostics and performs no diagnostic storage I/O. On claim
validation failure, retain the bounded candidate, actual correction response,
replacement positions, exact supplied passages/excerpts and signed numeric failure
details, including the final attempt. Identify document original/index identity,
batch and generation profile; hash the question instead of retaining prompt journals.
Truncation records retain any prior rejected candidate and explicitly identify
the absence of a parseable response; partial JSON is never admitted or reinterpreted.
Question traces hash the exact supplied evidence and label any separately observed
index identity as observed at trace time. Diagnostic context is resolved lazily only
on rejection, and lookup failures cannot change the original validation result.
Provider headers, credentials and unrelated response properties are excluded; redact
any configured model key reflected in selected text. Traces never enter public errors,
job responses, HTTP/MCP discovery or browser storage.

Use a separate owner-only directory/database (0700/0600), reject links and insecure
existing permissions, and atomically retain at most 64 immutable records of at most
512 KiB each across processes/restarts. Oversize/limit/storage failures leave a private
status and preserve the original validation outcome. Do not evict old traces or silently
truncate one into an apparently complete diagnostic. Diagnostics do not change prompts,
retry limits, provider requests, embedding/distillation identities, valid prefixes or
admission. The private model object exposes only its last diagnostic state and record
ID to operator code; inspect the protected SQLite records locally, never through
public adapters. A full store requires selecting a new explicit private directory;
existing records are retained. Inspect actual failures against originals before
changing interpretation.

Interactive answers may correct a rejected citation/schema/numeric candidate once,
for at most two model completions against the same evidence. Distillation keeps
its existing three-completion limit per batch. Both paths retain valid claims,
revalidate every replacement, reject dropped claims, and fail explicitly when
the correction budget is exhausted. Provider HTTP failures are not retried.

Answer metadata reports the retrieval strategy actually used. An incomplete
document extraction adds a coverage warning without relabeling successful hybrid
retrieval as full-text fallback. Embedding failures or absent matching vectors
still report full-text fallback with their own warning.

When a structured JSON-schema provider corrects rejected claim positions, its
request schema requires exactly that many replacement claims and false
insufficient-evidence status, matching the existing replacement protocol. Use a
private per-request schema copy: initial answers, configured generation identity,
shared schema and concurrent requests remain unchanged. Plain JSON providers and
custom providers implementing only the two-argument completion protocol retain
the existing prompt-based correction path. Provider noncompliance still fails
the exact replacement-count check; every replacement and retained claim must pass
the complete source and numeric validator within the same correction budget.

Model evidence supplies deterministic indexed contiguous excerpts, each at most
1,007 characters, covering the complete original passage without dropping text.
The `indexed-excerpts-v2` provider format omits the top-level physical PDF `page`
and page `label` locator fields. Both remain server-owned provenance in verified
citations, source-page reads and private validation traces. Labels can repeat
physical ordinals and must not become an alternate channel for uncited numbers.
Original passage text, including printed page numbers, is unchanged; document
identity, extraction method and applicability metadata remain available to the
model. Passage/excerpt IDs still select exact source spans. The format identity
changes the distillation generation: retain previous summaries in immutable history
and never resume their prefixes under the changed provider input. Embeddings,
source/numeric validation and correction budgets remain unchanged.
Passages shorter than the existing eight-character quote minimum remain visible
as text and cannot establish a valid citation alone. Models may cite an integer
`excerpt_id` within a supplied `passage_id`; the service resolves it to original
text before applying the unchanged 8–1200 character exact-span and numeric checks.
Unknown, boolean, negative, out-of-range or contradictory references fail closed.
Legacy literal quotes remain subject to the same validation. Public responses
retain original quotes and page/source metadata, not model-invented excerpt text.
The excerpt-format version participates in resumable evidence identity. All
readable passages must still be reviewed before a distillation is complete.

For numeric comparison, a run of at least three ASCII periods immediately before
a numeric token is a PDF layout leader, not the preceding decimal point of that
token. Recognize the following complete integer/decimal and preserve an adjacent
minus sign, including the mathematical minus character U+2212. Ordinary decimal
boundaries and identifier handling otherwise remain unchanged. This normalization
is local to numeric comparison; original quotations, passages, source identities
and model evidence are never rewritten. Positive magnitudes do not satisfy signed
negative evidence. Unsupported figures still fail against the exact cited spans,
not metadata or uncited neighboring text. Saved prefixes must pass the current
validator before they are reused or recovered.

PDF extraction can flatten a lowercase superscript footnote marker directly onto
a delay value. Numeric comparison recognizes a single lowercase letter at the
start of a line (after optional horizontal indentation), followed immediately by
a signed integer/decimal and `second delay` or `seconds delay`, only when that
same exact quoted span contains a numeric table value suffixed by the matching
letter. Recognition inserts a comparison boundary before the complete signed
delay value. It does not split general identifiers, uppercase or multiple-letter
prefixes, inline markers, or references supplied only by another citation,
metadata or uncited text. Exact quotations and provider evidence stay unchanged.

Horizontal extraction whitespace immediately before thousands commas may be removed for
numeric comparison inside a complete signed token: a one-to-three-digit leading
group, one or more commas immediately followed by three-digit groups and an
optional decimal fraction. Whitespace after a comma remains a boundary because
it can separate a list of independent values. Never join lines, separate
quotations, identifiers or malformed groups.
The complete grouped value retains its sign; its components do not independently
support claims. Original evidence, exact citations and generation identity remain
unchanged by this comparison-only normalization.

PDF spacing can make a hyphenated printed reference look like a signed scalar.
When a numeric value would otherwise fail, discount it only if every occurrence
in the claim belongs to a complete printed reference also present in an exact
cited quote. Recognized references are numeric `SL`/`SB` service codes and
hyphenated Figure, Table or Section numbers (including Fig. and Sec. labels).
Only horizontal spacing and label case/abbreviations are equivalent; preserve
hyphens and all digits, including leading zeros. Match references separately in
each quoted span, never metadata, uncited neighbors or combined partial quotes.
The same number used outside matching references still requires numeric support.
This comparison-only disambiguation leaves ordinary numeric parsing, negative
measurements, original claim/quote text, model evidence and generation identity
unchanged. Existing passing claims retain their validation behavior.

Search filters include ICAO, registration, document IDs, variant and revision. Retrieval combines full-text ranking with semantic vectors when the configured embedding provider is available; stored vectors identify their provider endpoint, model and embedding mode. Symmetric OpenAI-compatible embeddings remain the default. An explicitly configured query/passage mode sends `input_type=passage` for document indexing and `input_type=query` for questions; incompatible providers, models or modes must not reuse one another's vectors. Existing vectors without this identity require reindexing. Operators may bound embedding batches from 1 to 32 passages for provider limits; every passage is still indexed, and a batch failure preserves previously completed work without claiming a complete index. Provider configuration is operator-owned and must not silently select a remote model. Distillation covers document sections using page-cited evidence and marks missing extraction. Operators may bound distillation batches from 2,000 to 18,000 text characters for a provider context/token budget; every readable passage must still be included, with the batching/evidence identity preventing reuse across changed batches. Each batch summarizes supported facts actually present; topics absent from a batch do not invalidate supported facts in that batch. Preserve qualifiers and footnotes, and never invent content for missing topics. Requests include an explicit cited JSON shape and a bounded completion budget; truncated or malformed generation cannot establish a completed distillation. At most three candidate completions may correct citation/schema/numeric validation failures, using the failed candidate and validation reason as feedback against the same evidence. Correction feedback distinguishes a non-array claims value from an over-limit array, reporting the actual count and the maximum of 12; it never silently drops excess claims. Numeric rejection identifies the one-based failing claim and asks for supporting excerpts or removal of unsupported assertions, without echoing document text or numeric values into the error. The bounded correction loop still revalidates the whole answer. Every admitted candidate passes the unchanged evidence checks; exhausted correction attempts preserve a partial artifact. A retry resumes only a validated prefix of a partial distillation whose provider, model, prompt, metadata and exact evidence fingerprint still match; provider rate limits must not discard completed batches. Batches with insufficient evidence remain unresolved, so they cannot establish a complete distillation. Provider HTTP failures are not retried by this correction loop. An explicit per-process minimum interval may pace chat-completion start times across foreground answers and background distillation, including failed requests. The default adds no delay; operator-configured pacing does not alter evidence or completion coverage. It never presents an extractive index as an LLM summary. A configured LLM answers from retrieved original-page evidence, returns document/page citations with exact original-text spans (model-normalized whitespace may be resolved back to a contiguous original span; changed words or punctuation remain invalid), and states insufficient evidence rather than inventing figures or applicability. Document text is untrusted evidence, never instructions. Conflicting editions/variants remain separate and visible; unknown applicability is not approval for a particular aircraft. Generated answers and summaries are derived artifacts distinct from original text.

Performance questions must retain units, weight/configuration, source revision and applicability. No LLM-derived number becomes a planning dataset without separate review and independent numerical acceptance under #494. Maintenance information can be retrieved from relevant manuals but no inferred service interval or return-to-service authority is fabricated.

## Web acquisition

Search multiple ICAO/model/manual queries and collect multiple examples, keeping per-result URL/title/query/provider provenance, deduplication and explicit failures. Fetch public documents and PDF links from public result pages using bounded, SSRF-resistant requests, honoring redirects only after revalidation. Do not bypass accounts/paywalls. Keep originals private, with publisher/source attribution and unknown rights explicit. Missing search credentials/provider failure is an unavailable search, never zero known manuals. Background work is persistent, inspectable and bounded per request; users can extend discovery with further batches.

## Access and lifecycle

Index jobs checkpoint extraction and embedding separately from their final result.
An expired lease resumes completed phases only when the original, metadata,
extraction and exact passage identity still match. Extraction and its checkpoint
commit atomically. A new explicit index job still performs a new extraction.
An owner whose lease was reclaimed cannot write artifacts, checkpoints or a final
job state. Checkpoints and accepted distillation batches survive provider failures.

When a first candidate is explicitly truncated, distillation may bisect its
contiguous passage batch, durably recording the complete ordered partition before
continuing. Every original passage remains covered exactly once. A single passage
that still truncates fails explicitly; splitting is bounded by the passage count.
Never split a rejected correction to evade unresolved assertions. HTTP failures,
schema errors and numeric failures retain their existing bounded correction rules.
An explicitly truncated correction may consume the remaining correction attempt
against the same evidence and rejected positions, within the original call limit.
Resume revalidates the partition and every saved section against the same root
evidence identity; existing prefixes without a partition remain compatible.

Snapshot recovery is an explicit operator action, separate from inference. Admit
only an original/metadata/model/prompt-identical, fully validated prefix from a
read-only snapshot. Passage-ID remapping requires identical page, label, offset,
method and complete text. Revalidate all remapped citations against current
evidence and preserve a longer current valid prefix. Record source identity and
recovered coverage; never infer missing batches from hashes or claim completeness.
The [operator recovery procedure](../development/aircraft-library-recovery.md)
describes backup, rehearsal, admission and subsequent distillation.

Processing work remains inspectable after a page closes or the service restarts.
Authenticated GET `/api/aircraft-library/jobs` returns lightweight summaries with
manual/ICAO context, state, UTC timestamps, errors and a result-availability flag.
It defaults to 20 records, permits at most 100 per page and uses bounded offset
pagination. Running and queued work precede recent terminal history. Summaries
omit raw requests and potentially large result bodies; GET `/jobs/{job_id}`
retains the detailed record. Existing jobs and their history are preserved.

The UI restores summaries when the user opens the library and refreshes only on
explicit request. Completed/failed history is collapsed and detailed results are
loaded explicitly. Credentials and job state stay in page memory; locking or
changing the access key clears private results and fences late responses. Request
ownership lasts through body consumption, so abandoning a scope cancels body reads.

Repeated index/embed/distill requests for the same document reuse an already
queued or running operation atomically across processes. After a terminal result,
an explicit new request creates a new run. This does not delete or rewrite prior
jobs and does not merge different operation kinds or document identities.

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

Operators may set `AIRCRAFT_LIBRARY_LLM_REASONING_EFFORT=none`, `low` or `high`
for a compatible provider, or leave it unset/empty to omit the field. Explicit
thinking and reasoning-effort settings are mutually exclusive to avoid ambiguous
provider behavior. `AIRCRAFT_LIBRARY_LLM_MAX_TOKENS` is a decimal integer from 512
to 32768 (default/unset/empty 4096); it bounds total completion output, including
reasoning for providers sharing that budget. Nondefault token budgets and explicit
reasoning effort participate in the distillation identity and never change embeddings.
Unsupported options fail at the provider without a silent mode or budget fallback.

A completion ending at its output limit must report truncation distinctly, without
exposing provider response text, and must never admit even parseable partial JSON.
All original-span, numeric, applicability and completeness guards remain in force.
NVIDIA documents this opt-in control in its [model card](https://build.nvidia.com/nvidia/nemotron-3.5-super-vl-120b-a12b/modelcard);
it must not be sent implicitly to other providers.

When a structurally valid answer fails individual claim validation, bounded model
correction targets only those rejected claims. Supply their original positions,
validation failures and private unsupported-number diagnostics to the configured
model, using the same original evidence and citation schema. Preserve already
validated claims unchanged, require a replacement for every rejected position in
order, and revalidate the complete merged answer. A short/empty correction or an
insufficient-evidence response cannot silently erase failed assertions or claim
complete coverage. Whole-answer schema/claim-count failures may request a full
correction. The total bound remains three model calls; unresolved failures retain
partial distillation. Private diagnostics include the cited signed numeric values
so PDF hyphen/spacing differences can be corrected with faithful source forms or
additional supporting excerpts. Negative measurements never gain absolute-value
equivalence. Public errors never expose source text or numeric diagnostics.
Physical PDF page ordinals stay in verified citation metadata; correction removes
duplicate metadata-only page-locator wording from factual claims while preserving
the actual document facts and their source references. Metadata page numbers never
become support for otherwise uncited numeric assertions.

Operators may configure model response read timeouts from 10 to 600 seconds,
defaulting to 120 seconds; connection and pool acquisition remain bounded at
10 seconds and writes at 30 seconds. A transport timeout identifies its safe
exception category and configured read limit without including endpoint secrets,
request contents or provider response bodies. This does not add HTTP retries or
weaken citation validation. Worker leases continue to heartbeat during inference.

All document data and search/LLM operations require the operator's library bearer credential. Missing configuration disables private routes instead of opening them publicly. The UI shell exposes no private content before authentication and keeps credentials out of URLs and persistent browser storage. Separate original file download from rendered text; original downloads use attachment/nosniff and private no-store. UI report strings use text rendering. Browser selection changes discard stale data.

Test deterministic PDFs, duplicate bytes/acquisitions, persistence, wrong-type/tail isolation, malformed/encrypted/scanned pages, partial extraction, citation validation, absent evidence, conflicting metadata, provider failures, SSRF redirects/addresses, authentication and desktop/mobile flows. Real PDF extraction/rendering and configured LLM/provider acceptance are separate from fixture tests. Full completion requires current authority/receipt/CI plus exact-image deployment and live HTTP/MCP/UI checks; no fixture proves live model or provider access.

## Historical distillations

Changing generation settings changes the evidence identity; an earlier summary
must never be relabelled as output from that new generation. Before replacing a
distillation with another generation, reducing or changing its admitted prefix,
editing source applicability, or replacing its extraction, atomically preserve
the previous artifact with the original SHA, source metadata and extraction
identity. Append-only checkpoints within one generation do not create redundant
historical copies. Identical historical payloads deduplicate by SHA-256; detail
reads verify that identity and reject corrupted history. Archive
and replacement/invalidation share the lease-fenced SQLite transaction, including
recovery compare-and-swap checks. Existing version-1 stores gain the additive
history table without rewriting originals, vectors or prior artifacts. New
distillation artifacts retain their configured generation options; older records
are not retroactively assigned a profile.

Authenticated, private/no-store `GET /api/aircraft-library/documents/{document_id}/distillations`
returns bounded history summaries (`limit` 1–100, default 20, `offset` 0–1000000)
and `next_offset`; `GET .../distillations/{revision_id}` returns one immutable
historical record with its retained source context and summary. Both operations
have typed HTTP/MCP schemas. Historical records are explicitly ineligible for
current-generation resume or automatic retrieval; citations identify the retained
original but do not assert that current extraction, metadata or applicability
still match. There is no restore mutation or model call on either read.

The library UI offers explicit history loading and inspection for each document,
shows the retained metadata and original identity alongside page-cited claims,
and labels the record historical. History responses and private tokens remain in
memory, clear on type/tail/key changes, and cannot reappear from a stale request.

## Verified blank pages

Empty extracted text remains unknown unless its blank state is verified. During
new extraction a successful full-page PDFium render may establish a pure-white
page only when the decoded source content streams are empty, it has no PDF
content objects or annotations, and every RGB channel of every rendered pixel is exactly white, at
least one pixel per PDF point and at most 12 million pixels. Preserve the physical
page and printed label, use method `blank`, retain the renderer/classification
provenance and contribute no passage or invented text. Non-white marks, sparse
or faint text, graphics, oversized pages, rendering errors and failed OCR cannot
automatically become blank. Original bytes remain immutable. Even visually white embedded images require explicit
review; raster quantization must not silently erase extremely faint source objects.

Existing scanned blank backs require explicit operator review. Authenticated,
private/no-store `GET /api/aircraft-library/documents/{document_id}/blank-pages`
returns bounded candidate/verified pages, original SHA, current extraction
status and identity. Unprocessed/failed sources are explicitly unknown; zero
candidates never establishes completed extraction. Readable text or indexed passages cannot be dismissed as blank.
`POST .../blank-pages` accepts 1–100 distinct selected physical page numbers,
expected original SHA and extraction identity, a named reviewer and an explicit
attestation that the original pages were inspected and contain neither text nor
graphics. No implicit selection, automatic review, background OCR, embedding or
model call occurs. Unknown pages outside the selection remain incomplete.

Validate the retained original bytes, compare-and-swap the source/extraction
identity, reject queued/running work on the document, and admit the review,
immutable audit record, old distillation context and updated blank page states
in one lease-fenced transaction. Reject stale identities and active work with
409; reject invalid selections and missing attestation rather than partially
applying them. Preserve all readable page text, passage IDs, vectors and current
summary sections. A blank-only review can make extraction complete; it does not
relabel or declare an existing LLM summary complete. Only a subsequent explicit
same-evidence distillation may resume its validated prefix.

`GET .../blank-page-reviews` and `GET .../blank-page-reviews/{review_id}` expose
bounded immutable review history and integrity-checked detail with before/after
extraction identities, original identity, reviewed pages and reviewer/attestation.
Reindexing retains audit records but never carries a manual blank classification
into a new extraction implicitly. Historical summaries retain their earlier
extraction context.

The private library UI explicitly loads candidate pages and reviews, offers the
retained original download, and requires individual page choices, reviewer and
an unchecked attestation before saving. Render returned blank/unknown states and
provenance, show the saved audit identity and keep unknowns visible. Clear review
choices and stale requests on document/type/tail/key changes. No credentials,
originals or review payloads enter persistent browser storage.
