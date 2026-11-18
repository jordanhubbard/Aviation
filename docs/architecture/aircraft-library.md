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

For numeric comparison, a definite unary en dash before a number is a minus sign,
including signed endpoints after connectors such as `to` or `and`. Preserve en
dashes separating numeric range bounds: a preceding numeric operand, optionally
followed by a unit word or symbol, remains a range boundary even with horizontal
spacing. Do not join lines or normalize dashes attached to identifiers, drawing
rules or other ambiguous forms. Apply this only to temporary comparison text in
both claim and quote; keep their original characters, model inputs and generation
identity unchanged. A definite unary negative cannot use positive-only evidence.

Horizontal PDF layout gaps around a decimal point can split a complete measured
value (#532). For numeric comparison only, remove horizontal whitespace immediately
around a single decimal point between integer and fractional digits when the full
signed scalar or two-endpoint range has an explicit complete physical unit. Support
the existing speed, distance, mass, volume, flow, time and temperature unit words,
plus load-factor `g`, pressure (`psi`, `inHg`, `hPa`, `mbar`), `kg`, `cm`, `mm`,
`inch(es)` and `%`; unit case may vary and may be attached to the fractional digits.
Range connectors are the existing hyphen/en-dash/em-dash or `to`/`through` forms;
preserve their characters and both endpoints' signs and precision. Grouped integer
parts retain the existing comma rules. Apply this comparison boundary before unary
dash interpretation so a measured range remains a range.

Require an ordinary token boundary and exclude embedded/hyphenated/slashed/dotted
identifiers, explicit part/model/code/reference labels, numbered Section/Figure/Table
labels, malformed comma groups, separated unary signs and unit-like identifier
suffixes. Never join lines, merge distinct decimal points, infer a missing digit,
reinterpret decimal hours as clock notation or remove a negative sign. Bare spaced
decimals without explicit unit context remain unchanged. Preserve original source,
quote and claim bytes, model evidence and generation identities. A previously
unsupported rounded integer component must not survive as false numeric support
when the exact measured decimal is recognized; audit retained artifacts explicitly.

An explicit uppercase `ISA` temperature-offset heading (#533) disambiguates a
horizontal gap between its sign and measured magnitude. In temporary numeric
comparison text only, join a hyphen/minus, mathematical minus, en dash or plus to
its complete integer/decimal magnitude when `ISA`, sign, magnitude and a complete
degree-marked Celsius/Fahrenheit unit occur on the same line. Preserve the sign,
precision and existing grouped-integer/decimal-gap rules; never retain the detached
positive magnitude as additional support for a recognized negative offset.
Require ordinary token boundaries and exclude part/model/code/reference labels,
embedded identifiers, doubled signs, shared-unit ranges and unit-like suffixes.
Other separated signs, arbitrary subtraction, missing units and line breaks remain
ambiguous. Exact original source/quote/claim bytes, model inputs, generation
identities and previously admitted artifacts stay intact; audit retained claims
explicitly when comparison changes.

An explicitly printed conversion relation (#546) can join a complete known unit
name to `x` or `×`, a signed coefficient, `=`, and another complete known unit.
Recognize spelled-out or conventional abbreviated mass, distance, length, volume,
area, speed, temperature, power and pressure units. Fixed compound names such as
`statute Miles`, `Nautical Miles` and `U.S. Gallons` may lose their internal
horizontal separators; arbitrary identifier suffixes remain excluded. The
coefficient may be an integer, grouped integer, ordinary decimal or leading-dot
decimal. Horizontal gaps around a decimal point between digits may be removed;
a leading dot still requires immediately following fractional digits. Insert only
a temporary numeric-comparison boundary after the multiplication marker and a
leading zero where needed. Preserve adjacent signs and precision. Every part of
the relation must remain on one line, with complete unit/token boundaries; reject
code/reference labels, chained expressions, exponents, percentages, malformed
grouping and detached signs. Existing mass-only exclusions for other recognized
units and tight multiplication boundaries are superseded by this complete-relation
grammar. This recognizes printed literals only: it does not evaluate a conversion,
verify physical unit equivalence, infer a coefficient or replace OCR letters with
digits. In particular, a corrupted coefficient remains unsupported even when a
known conversion constant could be guessed. Source/model input bytes, quotations,
generation profiles, fingerprints, correction budgets and scope coverage remain
unchanged; audit all retained current and historical claims after parser changes.

Ordinary delimited leading decimals such as `.375` are numeric literals independent
of the spelling of neighboring unit words. Compare them with `0.375`, preserving
an adjacent sign, without changing quotation bytes or repairing OCR text. Require
complete literal boundaries, reject identifier/reference labels and malformed
decimal chains, and never turn a detached sign into positive numeric support.
An explicit preceding numeric operand on the same line makes a spaced operator
binary; a following literal retains its own adjacent sign. Count-dash list rows
have this same lexical form. An unsigned fractional tail immediately after a
number and whitespace remains ambiguous and is not exposed as a standalone value.
A delimited literal on a separate line remains a literal on that line; recognizing
it does not join an equation across lines. A decimal attached directly to `x` still
requires the complete known-unit relation above. No missing digits, OCR letters,
fraction conversions or unit equivalences are inferred.

Complete leading-decimal measurements attached to a recognized physical unit
(#558), such as `.375nm`, compare with their leading-zero spelling. Use the
existing physical-measurement, frequency and conversion-unit vocabulary and require a
complete unit boundary. Preserve adjacent unary signs and precision. Explicit
`to`/`through` ranges may contain independently complete measurements; this does
not introduce a new parser for joined ranges or detached signs.

Keep identifier, part/model/code/reference, Section/Figure/Table, serial/tail and
version/revision labels outside this new recognition, including labels followed
by `=`, `:` or `#`. Do not expose suffixes of embedded, dotted, slashed or
hyphenated identifiers, unknown or corrupted units, chained decimals, detached
signs or mixed-number tails. Require a prose/delimiter boundary before the value
and a complete punctuation/whitespace boundary after its unit. Unicode identifier
separators and unsupported dash/minus glyphs must not expose a positive value.
Keep existing delimited-literal behavior unchanged.
This changes temporary comparison text only; preserve quotations, model evidence,
source hashes, generation identities and immutable failed output. Audit all saved
current and historical claims before a fresh configured-provider continuation.

A successful numeric comparison does not establish layout-dependent semantic
relationships. Independently review the original image where native extraction
scrambles labelled values. Apply any restriction/transcription through the
canonical image-pinned source channels and admit only unchanged validated prefix
scopes. Never admit a previously rejected interpretation merely because its
numbers now compare.

Historical summaries preserve their original generated claims and quotations,
including claims that can fail stricter current comparison rules. The history
view states that retained claims may fail current evidence checks. A qualification
audit validates all current claims and reports any exact unvalidated historical
claim separately; it must not silently edit that archive, reclassify it as current
evidence or claim that the entire historical corpus passed. Historical artifacts
remain ineligible for current-generation resume.

Explicit standalone half percentages (#538), written `½%`, `1/2%` or with
horizontal whitespace around the ASCII slash or before `%`, compare as `0.5%`.
Preserve an immediately adjacent sign. Require the complete percent unit and
ordinary token boundaries; reject identifier/reference labels, mixed numbers,
chained fractions, detached signs and line joins from this normalization. Other
fractions and quantities without `%` retain existing behavior. The numerator and
denominator of a recognized half percentage cannot separately support whole
numbers. This changes comparison only: source/claim text, exact cited quotations,
model evidence, original hashes and generation fingerprints remain unchanged.
Audit all saved current and historical claims before native continuation.

For complete frequency measurements (#536), a missing boundary after lowercase or
title-case `at`, `from`, `to`, `of`, `than`, `between`, `and` or `in` may be restored
in temporary numeric comparison text. Require the existing complete signed
integer/decimal or two-endpoint range grammar followed by horizontal whitespace
or a single ASCII hyphen separating the value from a complete `Hz`, `kHz`, `MHz`
or `GHz` unit (unit case may vary). Horizontal spacing may surround that unit
hyphen. Keep the hyphen, numeric signs, range connectors and precision unchanged;
this inserts only the boundary after the prose word. No unit conversion, digit
inference, decimal-gap joining or line joining is introduced.

Require ordinary token boundaries. Exclude embedded/hyphenated/slashed/dotted
identifiers, explicit part/model/code/reference and Section/Figure/Table labels,
malformed numeric expressions, doubled unit hyphens, missing unit separators and
unit-like identifier suffixes. Keep bare joined measurements without a recognized
prose prefix unchanged. Preserve original source, claim and quote bytes, model
evidence and generation identities; audit all retained current/historical claims
for any change to prior numeric support, including a lost negative sign.

PDF layout extraction can join ordinary prose directly to a quantity (#526).
For numeric comparison only, recognize lowercase or title-case `at`, `from`,
`to`, `of`, `than`, `between` and `and` joined to a signed scalar or numeric range
when the complete expression is followed on the same line by horizontal
whitespace and an explicit supported physical unit: KIAS, KCAS, KTAS, knot(s),
kt(s), RPM, ft, feet, foot, lb(s), pound(s), gallon(s), gal, GPH, hour(s), hr(s),
minute(s), min(s), second(s), sec(s), or a degree-marked Celsius/Fahrenheit unit.
Unit case may vary. A recognized word must start at a prose boundary; do not
split uppercase identifiers, embedded/hyphenated/slashed codes, bare word/digit
strings without a unit, or identifier-like corrupted table headings. Require a
complete unit token, not a prefix of an identifier. An explicit identifier label
(`P/N`, `PN`, `part no.`, `part number`, `part #`, `model`, `code`, `identifier`,
`ref.` or `reference`, optionally followed by a colon or hash) immediately before
the joined token prevents this split, including across layout whitespace. Preserve signed endpoints,
decimal/grouped values and ranges. This introduces only a temporary comparison
boundary after the prose word, before existing sign/grouping processing; never
rewrite original bytes, extracted passages, citations, model evidence, applicability
or generation identities. Missing quantities and wrong signs remain rejected.

For joined temperature thresholds (#552), recognize lowercase or title-case
`above` and `below` immediately followed by a complete signed integer/decimal
(including the existing grouped-integer form) and an explicit degree-marked
Celsius/Fahrenheit unit. The unit may touch the number or follow horizontal
whitespace; its letter is case-insensitive. Insert only a temporary comparison
boundary after the condition word. Preserve the complete scalar's sign and
precision; a recognized negative must not also supply its positive magnitude.

Require ordinary prose and complete unit boundaries. Exclude embedded,
hyphenated, slashed or dotted identifiers; uppercase condition-like codes;
explicit part/model/code/reference or Section/Figure/Table labels; unit-like
identifier suffixes; missing units; detached signs; malformed numeric chains;
and line joins. Do not extend other prose-prefix/unit grammar, infer digits,
convert units or change original text, exact quotes, model evidence, generation
identities or reviewed-source restrictions. Audit current and historical claims
for any changed numeric support and retain existing failures explicitly.

PDF spacing can make a hyphenated printed reference look like a signed scalar.
When a numeric value would otherwise fail, discount it only if every occurrence
in the claim belongs to a complete printed reference also present in an exact
cited quote. Recognized references are numeric `SL`/`SB` service codes and
hyphenated Figure, Table or Section numbers (including Fig. and Sec. labels).
Only horizontal spacing and label case/abbreviations are equivalent; preserve
hyphens and all digits, including leading zeros. Match references separately in
each quoted span, never metadata, uncited neighbors or combined partial quotes.
The same number used outside matching references still requires numeric support.
For this fallback, mask those same matched references in both the claim and its
quotes before recomputing numeric support. Reference components in a quote cannot
support a separate scalar elsewhere in the claim, including a negative scalar.
This comparison-only disambiguation leaves ordinary numeric parsing, negative
measurements, original claim/quote text, model evidence and generation identity
unchanged. Existing passing claims retain their validation behavior.

For unavailable or conflicting citation references (#529), private correction
feedback may identify the failed citation position, bounded integer proposed IDs,
and the exact request's provided/quotable excerpt IDs. Limit this to eight failed
citations per claim, eight excerpt IDs per list and, for an unknown passage only,
eight available passage IDs. Include actual availability counts and explicit
truncation when a list is longer. Never echo arbitrary malformed ID values,
source text, quotes, credentials or metadata as reference hints. A quotable excerpt
only meets the existing exact-source quotation form; it does not prove a claim's
meaning, quantities or applicability. Unavailable, conflicting and unquotable
references remain rejected by the unchanged validator. Do not decrement, relabel,
replace or otherwise silently repair references. Preserve accepted claims and
existing fixed-position/citation-only correction constraints, model evidence,
initial question, generation identity and public error messages. The provider must
choose supported citations from the original supplied evidence or remain unresolved.

For a numeric citation rejection, private correction feedback may identify possible
supporting excerpts from the same supplied evidence. Compare complete signed tokens;
metadata and passages outside that request cannot supply options. Return at most
eight excerpt references covering at most 32 rejected values, mark truncated option
sets explicitly, and include no source text in these hints. Matching a number only
locates possible evidence; it does not establish a fact or its applicability.
Corrections must put their citations in the actual replacement JSON. When eight
citation slots are occupied, replace redundant citations with relevant ones rather
than claiming in prose to have added an omitted reference. Never add a citation
automatically, persist an edited counterfactual, weaken validation or increase the
three-candidate budget. Initial generation inputs and identities stay unchanged.
When those options cover every rejected numeric token in a claim, correction is
citation-only: keep that claim's exact text and repair its citations. This mode
protects potentially supported assertions from silent contraction; it does not
prove that the assertion is true. If the original assertion cannot be supported,
leave it unresolved. Enforce exact text server-side even for legacy adapters and
plain JSON output. Structured requests may additionally constrain replacement
text to the original strings using an isolated per-request schema; still enforce
the original position of each string after the response. Unsupported numbers
without candidate evidence retain the general correction path.

Search filters include ICAO, registration, document IDs, variant and revision. Retrieval combines full-text ranking with semantic vectors when the configured embedding provider is available; stored vectors identify their provider endpoint, model and embedding mode. Symmetric OpenAI-compatible embeddings remain the default. An explicitly configured query/passage mode sends `input_type=passage` for document indexing and `input_type=query` for questions; incompatible providers, models or modes must not reuse one another's vectors. Existing vectors without this identity require reindexing. Operators may bound embedding batches from 1 to 32 passages for provider limits; every passage is still indexed, and a batch failure preserves previously completed work without claiming a complete index. Provider configuration is operator-owned and must not silently select a remote model. Distillation covers document sections using page-cited evidence and marks missing extraction. Operators may bound distillation batches from 2,000 to 18,000 text characters for a provider context/token budget; every readable passage must still be included, with the batching/evidence identity preventing reuse across changed batches. Each batch summarizes supported facts actually present; topics absent from a batch do not invalidate supported facts in that batch. Preserve qualifiers and footnotes, and never invent content for missing topics. Requests include an explicit cited JSON shape and a bounded completion budget; truncated or malformed generation cannot establish a completed distillation. At most three candidate completions may correct citation/schema/numeric validation failures, using the failed candidate and validation reason as feedback against the same evidence. Correction feedback distinguishes a non-array claims value from an over-limit array, reporting the actual count and the maximum of 12; it never silently drops excess claims. Numeric rejection identifies the one-based failing claim and asks for supporting excerpts or removal of unsupported assertions, without echoing document text or numeric values into the error. The bounded correction loop still revalidates the whole answer. Every admitted candidate passes the unchanged evidence checks; exhausted correction attempts preserve a partial artifact. A retry resumes only a validated prefix of a partial distillation whose provider, model, prompt, metadata and exact evidence fingerprint still match; provider rate limits must not discard completed batches. Batches with insufficient evidence remain unresolved, so they cannot establish a complete distillation. Provider HTTP failures are not retried by this correction loop. An explicit per-process minimum interval may pace chat-completion start times across foreground answers and background distillation, including failed requests. The default adds no delay; operator-configured pacing does not alter evidence or completion coverage. It never presents an extractive index as an LLM summary. A configured LLM answers from retrieved original-page evidence, returns document/page citations with exact original-text spans (model-normalized whitespace may be resolved back to a contiguous original span; changed words or punctuation remain invalid), and states insufficient evidence rather than inventing figures or applicability. Document text is untrusted evidence, never instructions. Conflicting editions/variants remain separate and visible; unknown applicability is not approval for a particular aircraft. Generated answers and summaries are derived artifacts distinct from original text.

For questions, include active, provenance-verified supplemental OCR and operator
transcriptions from a selected passage's same document and physical page even
when those short fragments do not match the query. Interleave this context after
the page's first ranked hit, preserving deterministic source order and deduplicating
passage IDs. The requested retrieval limit still bounds the entire evidence window;
report when this context causes ranked evidence or reviewed fragments to fall
outside that window. Do not report a context-limit warning as an embedding failure:
hybrid/full-text metadata must still describe the strategy actually used. Never
expand into an unselected document or page, cross registration/revision filters,
grant unverified review provenance, or override native/reviewed contradictions.
Ordinary pages without reviewed context retain their exact ranking. This question
retrieval behavior does not change source text, stored vectors, distillation
inputs, generation identities or the source-use restrictions in #550.

### Reviewed context in distillation requests (#556)

For documents with active verified OCR or operator transcriptions, new distillations
use the `reviewed-page-context-v1` evidence policy. Primary batches remain a complete,
ordered, unique partition of readable passages. Each actual request also includes
missing verified reviewed passages from its primary pages, in deterministic source
order, without adding another document or page. Repeated context does not grant
primary coverage. Original quotations, provenance and source-use restrictions apply
equally to primary and contextual evidence.

Pack primary batches against all supplied source text, including reviewed context,
within the configured source-character budget. This retains the existing character
unit rather than counting JSON, metadata or prompt overhead as source text.
Refinements after output truncation use the same context rule. If a single primary
passage and required review context cannot fit,
retain an explicitly partial artifact and fail with a context-budget error before
calling the model; never drop context or silently exceed the budget.

Record the evidence policy and context limit in the artifact and generation identity.
Documents without reviewed passages retain their exact legacy identities and requests.
Artifacts without an evidence-policy field use their original ordered-passage evidence;
never retroactively validate their claims against newly supplied context. Unknown or
invalid policies cannot establish a validated prefix. Historical artifacts remain
immutable and failed archived claims stay failed.

Canonical snapshot recovery must reconstruct the snapshot's recorded policy, verify
its original fingerprint and every saved claim, and compare old and new complete
request evidence before admitting an unchanged leading scope. Stop at the first changed
scope; do not skip ahead or relabel old generations. Preserve the old artifact in
history when admitting a new identity, retain a recovery receipt and use the existing
source/lease/compare-and-swap guards. New source additions and a changed request policy
do not grant completion to unprocessed material. Carry a recovery receipt only while
resuming its fully validated prefix; a fresh run or invalidated prefix must not inherit
an older admission receipt.

Performance questions must retain units, weight/configuration, source revision and applicability. No LLM-derived number becomes a planning dataset without separate review and independent numerical acceptance under #494. Maintenance information can be retrieved from relevant manuals but no inferred service interval or return-to-service authority is fabricated.

## Supplemental OCR review

Mixed text/diagram pages may receive an explicitly requested supplemental OCR
preview even when native text extraction succeeded (#523). Preview at most ten
distinct physical pages using `normal` (Tesseract PSM 3), `sparse` (PSM 11), or
explicitly selected `table` (PSM 11 with straight-rule suppression, #539), or
`words` (PSM 11 with each recognized word retained independently, #542).
Keep the original PDF, native page text, native passages, vectors and summaries
unchanged during preview. Pin each immutable candidate to the original SHA-256,
metadata and exact index identity. Retain PDFium-rendered page images, image
hashes, engine/version/mode, dimensions and OCR fragments with bounding boxes and
confidence. Confidence is recognition metadata, not approval. Bound renders to
12 million pixels, each OCR invocation to 45 seconds, the supervised extraction
to 600 seconds, candidate JSON to 512 KiB and retained images to 24 MiB per preview.
Reject resource-limit failures without silently truncating evidence. The child
process tree must be killed and reaped on cancellation or deadline.

Table previews keep the untouched PDFium page rendering as the retained review
image. A separate grayscale OCR input suppresses only contiguous horizontal dark
runs of at least `max(120, width // 10)` pixels and vertical runs of at least
`max(80, height // 24)` pixels, measured independently against the original
grayscale pixels below intensity 100. Replace only those pixels with white;
never add strokes, change coordinates or rewrite recognized text. The fixed
`straight-rules-v1` preprocessing identity, threshold, run lengths and SHA-256 of
the actual processed OCR input belong to the immutable page candidate. Bound
processed images to the same pixel limit and at most another 24 MiB per preview.
Keep the complete operation inside the existing supervised child deadline and
resource bounds. Existing modes, defaults and old previews remain compatible.
Display that table rules were suppressed for recognition, while review uses the
original page. Rule suppression can also damage text; every selected fragment
still requires literal comparison with the original image. No automatic review,
value inference or performance-data approval follows from this mode.

Individual-word previews preserve each complete TSV token's characters, box and
confidence without editing or splitting the token. They permit selecting faithful
words within an otherwise incorrectly recognized line. Bound this explicit mode
to 1,000 fragments per page; existing line modes retain their 500-fragment bound.
All modes retain the same total candidate, image, process and review limits.
An independently reviewed word becomes its own complete attributed fragment;
unreviewed substrings do not acquire the short-quotation exception.
Provide a local exact-word filter for this mode; filtering changes only display,
makes no requests, never selects evidence, and clears with private review state.

An explicit reviewed application selects at most 100 candidate fragments, names
the reviewer and attests that those selected fragments match the original page
image. No fragment is selected automatically. Accept fragment IDs, never edited
text, arbitrary OCR arguments or an assertion that a desired numeric value is
correct. The source/index/metadata must still match the preview, and document
work must be exclusively owned. Reject stale, duplicate or conflicting applies;
resume a committed apply through its durable job checkpoint without appending
the same passages twice. Preview, application and semantic indexing are durable,
inspectable bounded jobs. A failed embedding stage retains its applied review and
new source passages, and can resume only pending vectors under the configured
embedding identity. Applying OCR never chooses a model or invokes an LLM.

Keep applied OCR fragments separate from native page text and separately
attributed in search, retrieval and citations. Their offsets refer to the OCR
candidate channel. Order them immediately after native passages on the same
physical page without changing existing native IDs or vectors; leave ordering
and generation identity unchanged for documents without supplemental OCR. Archive
the affected document's old distillation before changing its evidence identity.
Retain source images, selected fragment text, original source/applicability,
reviewer, before/after identities and integrity hashes for historical inspection.
Reindexing is a new source version and invalidates prior active supplements;
historical reviews remain inspectable. Never clear native extraction errors or
mark unreadable/blank pages resolved merely because selected OCR text was approved.

Short diagram labels may be retained as complete reviewed OCR fragments. Only
server-verified applied OCR provenance permits citing such a whole fragment below
the ordinary eight-character quotation minimum; arbitrary short substrings and
unreviewed/native short text retain the existing guard. Numeric sign, applicability
and whole-answer checks remain unchanged. OCR remains derived, fallible evidence,
distinct from an independently reviewed performance dataset.

Expose typed private HTTP operations and their OpenAPI/MCP discovery, plus SDK
and desktop/mobile controls for preview jobs, original-image comparison, fragment
selection, reviewed application and retained review inspection. Require the same
library credential and no-store policy. Context/credential changes abandon stale
requests, revoke image URLs and clear private state. Source conflicts require a
fresh preview. Keep generated text inert and display both recognition uncertainty
and source provenance. An explicit operation may poll only its owned job until
terminal state; no background provider polling is introduced.

The TypeScript `AircraftLibraryOCRClient` and Python
`aviation.aircraft_library.AircraftLibraryOCRClient` accept a caller-owned private
library transport rooted at `/api/aircraft-library`. The transport owns the Bearer
credential, bounded response reads, no-store behavior and redirect rejection; never
persist credentials or derive them from document metadata. The TypeScript adapter
sets no-store/redirect-error options on each request, and the application transport
supplies the in-memory credential. Both SDKs expose explicit context, preview,
image, review, embedding-retry, history and job operations without polling or
model selection. The planning gateway's existing OpenAPI resource and request tool
discover/forward these native operations, preserving authentication and binary
image responses; images above its 4 MiB MCP bound use authenticated HTTP.
Browser consumers import the dedicated
`@aviation/shared-sdk/aviation/aircraft-library` entry point so unrelated server
integrations do not enter the browser bundle. Recognition coordinates, confidence
and image-page URLs remain review/citation provenance; model evidence includes
the selected OCR text and minimal review attribution, without those numeric fields.

## Reviewed original-page transcriptions

When recognition is inaccurate, an operator may explicitly transcribe visible
page content through a separate provenance channel (#548). This does not relax
the unchanged-fragment OCR contract. Require a retained immutable preview and its
integrity hash, one physical page and its original image hash, the exact original
and index identities, 8 to 12,000 characters of literal text, a named reviewer and
an explicit image-match attestation. Preserve the submitted text exactly;
reject blank/control-only text, invalid controls and size violations. Transcribe
visible words, punctuation, signs, units and table layout; do not supply inferred
relationships, computed values or numeric answers absent from the visible source.
The service never requests model transcriptions or accepts proposed text
automatically. Every caller, including an authorized agent, must explicitly
compare the text with the pinned image and record its reviewer identity. Identify
agent reviews as such; they are not independent human review or performance-data
approval. Neither a preview nor a draft transcription changes source evidence.
Bound active transcripts to 500 per document; retain inactive historical receipts.

Application is an exclusively owned durable job. Revalidate original bytes,
metadata, index, preview and image integrity when queueing and when committing.
Atomically archive the prior distillation, append a separate
`operator_transcription` passage, retain an integrity-checked review with the
exact text, page/image/preview pins, reviewer and before/after identities, and
checkpoint the job. Replaying a committed job returns the same review without
duplicating passages. Reject a duplicate active transcription of the same page
and exact text, stale identities, conflicts and forged provenance. Preserve all
native extraction errors, blank-page decisions, native text, machine OCR,
existing vectors, unrelated documents and originals. A later native reindex
invalidates active transcriptions while preserving their historical ledgers.

Expose distinct inspectable review/history and pending-vector retry operations.
Applying text invokes no chat model. Embedding failure retains the committed
transcription and leaves indexing visibly pending. Retrieval, citations and
inspection must identify operator transcription and its image/reviewer receipt,
without an OCR engine or recognition-confidence claim. Only server-verified
ledger provenance may acquire this attribution. Keep the ordinary quotation and
numeric-evidence checks; no automatic performance-data approval follows. Model
evidence includes the literal text and minimal channel attribution, excluding
reviewer names, hashes, image coordinates and page locators as factual numbers.

An explicit additive-transcription recovery operation may preserve only complete
unchanged leading scopes from a separately retained snapshot. Verify original,
metadata, generation profile, native/previous OCR/transcription records and image
bytes, and the new server-verified transcription ledger. Revalidate every prior
claim and publish with idle/source/recovery compare-and-swap guards. Never edit
history or relabel an old section that now contains additional source as reviewed.
Existing exact-source and OCR-only recovery keep their existing boundaries.

Keep HTTP/OpenAPI/MCP, Python/TypeScript SDKs and desktop/mobile controls in sync.
Show the original page beside a separately labeled editable transcription draft,
with reviewer identity and explicit attestation; never prefill a draft from an
LLM, select approval or submit automatically. Display failure, pending indexing,
retained text and historical/inactive status distinctly. Keep text inert, require
the private library credential and no-store policy, and clear drafts, attestation,
image URLs and stale requests on document/context/credential changes or locking.
Poll only the explicitly submitted owned job until terminal state.

The existing private `AircraftLibraryOCRClient` adapters expose distinct
`transcribe`, `transcription`, `transcriptions` and `embedTranscription`
(`embed_transcription` in Python) methods. Their existing preview/image/job
operations provide the retained page image; OCR application still accepts only
candidate fragment IDs. Transcription methods never poll or infer provider/model
selection and use the same caller-owned private transport.

## Reviewed source limitations

For [#550](https://github.com/jordanhubbard/Aviation/issues/550), exact quotations
and matching numbers do not establish a diagram's label-to-value or spatial
relationships. A named reviewer may mark a physical page's native extraction as
`original_image_only` after comparing its retained original image. This is a
source-use limitation, not a correction of original text or approval of any
generated interpretation. Agent reviews identify the agent explicitly; they do
not claim independent human review or performance-data approval.

Use the current source/index identity and an immutable, integrity-checked page
preview. Require the original SHA, preview integrity, physical page/image hash,
named reviewer, explicit image-comparison attestation and a fixed
`layout_relationships_unavailable` reason. A draft or preview changes nothing.
Apply/release a limitation through bounded, exclusive durable jobs with the same
ownership, stale-source, original-image and idempotent-commit guards as source
reviews. Application is atomic with archiving the previous distillation and
advancing the source-use identity. No inference or embedding request is implicit.
An explicit release requires a new current-image comparison and named attestation
that native text is suitable evidence; retain both decisions immutably.

Preserve original bytes, native pages/text, passages, existing vectors, reviewed
OCR/transcriptions, jobs and historical artifacts. Active restrictions follow the
same original page across metadata edits and reindexing; neither operation may
silently restore excluded evidence. Original download, page-image viewing and
full-text search remain available and show the source-use limitation. Verified
literal operator transcriptions and separately reviewed OCR remain distinct
sources. A literal table does not authorize interpreting an adjacent diagram.

Native passages from a restricted page remain in the extraction/coverage ledger,
but their text/excerpts must not enter factual model evidence or support a claim.
Require server-verified provenance for every restriction; forged dictionary flags,
altered ledgers, missing images or a changed original fail closed. A model candidate
that cites restricted native text remains rejected even when every number occurs
in its quotations. If retrieval supplies only restricted text, return honest
insufficient evidence and the affected original-page references without a chat
completion request. Configured semantic retrieval retains its explicit embedding
query behavior. Do not infer a corrected value, add unrelated numeric citations or
rewrite the generated claim to make validation pass.

Expose active source limitations on search results, answers, document detail and
distillation coverage. Distillation remains partial while any reviewed page still
requires original-image interpretation, including when all otherwise usable text
batches have been processed. Preserve the ordered passage/coverage plan; do not
delete excluded passages or call reduced input complete coverage. An explicit
recovery operation may retain only completely unchanged leading scopes after
verifying the original, profile, prior source/review records and restriction
ledger. It must stop before the first affected scope. A known rejected
interpretation remains archived and ineligible for current-source resume/admission;
do not waive additional historical validation failures.

Documents with no source-limit reviews retain their current generation identities,
model wire inputs, numeric grammar, prompt/profile and behavior. A release is a
new reviewed source-use generation; it never automatically admits a previously
rejected interpretation or retroactively certifies an old artifact.

Expose typed private apply, release, detail and paginated-history operations through
native HTTP/OpenAPI, planning HTTP/MCP and TypeScript/Python SDKs. Preserve
authentication, no-store and safe conflict/failure behavior. Page-review UI keeps
the compared original visible, starts unapproved, identifies the reviewer,
displays the active restriction and unresolved coverage, and supports explicit
current-image release and inspectable history. Clear review drafts and private
state when document, ICAO/tail, credential or library context changes. Historical
generated material is visibly ineligible, not silently removed.

Qualification includes the privately pinned actual diagram paraphrase that passed
numeric/citation checks but failed original-image review. Reject that exact case,
preserve the original and archived candidate, verify the literal table remains
usable, and obtain a separate actual configured-provider outcome. Synthetic
controls or source-only recovery are not new native completion evidence.

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

Separate explicit operator recovery after reviewed OCR additions (#542) may admit
only unchanged leading batch scopes from a standalone snapshot. Preserve strict
snapshot recovery unchanged. Require identical original bytes, metadata, provider,
model, prompt/profile, native page/blank-review rows and complete native/prior OCR
passages in the same order. The only source changes may be appended active,
server-verified supplemental OCR reviews and their passages; reject removed,
reordered, edited or unauthenticated evidence. Revalidate the entire saved prefix,
then stop reuse at the first changed batch scope or current root boundary. Preserve
any valid refinements, and explicitly partition every remaining current passage
as unresolved evidence. Never skip an inserted fragment or infer its review.
Preserve a longer valid current prefix. Publish a new current-generation artifact
with an explicit recovery receipt identifying its snapshot, prior generation,
new reviews and unchanged scope digest; leave the historical artifact untouched.
Require idle document work and atomic metadata/index/native/review/artifact/idle checks so a
concurrent job or source change cannot lose progress. Make no model calls and
never count recovery as a new LLM completion or complete-document admission.
Current-summary controls identify reused sections after source review and keep
remaining unresolved evidence explicit until distillation completes.

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
