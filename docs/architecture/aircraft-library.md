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
Explicit page references (#561) also include a complete hyphenated identifier
introduced by Page/Pages or p./pp., or enclosed by a Title (...) entry. The first
component may be numeric or an alphanumeric page prefix; subsequent components
are numeric. Treat these page/title contexts as the same reference kind only
when their entire identifiers match, including every digit and leading zero.
Horizontal spacing around the hyphens may differ. Require the complete title
parentheses in one cited span, and never infer a page marker for a bare code,
model, version or registration. Newlines, Unicode dash/minus substitutions,
partial identifiers and digit changes are not layout equivalences. The paired
mask must remove the same complete reference from claim and quote, so neither
its positive nor signed components can support a separate measurement.
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
three-candidate budget. Citation-location hints do not change initial model-request bytes;
correction-policy versioning below owns generation identity.
Policy `rejected-assertion-repair-v2` (#567) ensures numeric occurrence
hints never make rejected text immutable: an unrelated page reference, identifier,
or measurement cannot establish the assertion's meaning. The model may correct an
unsupported rejected assertion to the literal supplied source form, keeping its
topic, supported facts, conditions and qualifiers. Preserve every validated claim
byte-for-byte, require exactly one replacement per rejected position in order, and
revalidate the complete merged answer. Never silently drop a failed claim, inject a
server-written answer, increase attempts, convert printed decimal notation into
clock notation, or infer semantic support from matching numbers. Changed rejected
text remains an untrusted model candidate subject to all existing checks; numeric
validation alone does not prove semantic applicability.

Policy `signed-source-feedback-v4` (#569), inherited by the version-5 condition
policy below, retains the assertion repair and fixed-position replacement rules above. For an unsupported positive
numeric value, private correction feedback may identify a different signed value
already present in that claim's actual, permitted cited source spans. Resolve
indexed citations and valid legacy quoted spans through the existing source
provenance and quotation checks. Do not search other passages or uncited excerpts,
use metadata, include explicitly marked identifier/reference components, or
expose restricted/unverified source channels. Report only positive rejected values
whose negative counterpart occurs in those cited spans, with at most eight
citation/value pairs covering at most 32 rejected values; mark truncation explicitly.
Include citation locators and numeric diagnostics, never copied source text or a
server-written replacement. These signed-source diagnostics explicitly do not
support the rejected positive value or prove meaning, conditions or applicability.

The signed-source correction instruction explains that an unsigned operand in a
subtraction expression remains distinct from a printed negative amount. The model
must describe the signed amount in its source form or replace the unsupported
expression with supported literal facts, preserving its topic, conditions and
qualifiers. Neither the validator nor feedback evaluates arithmetic, removes signs,
normalizes letters, changes stored candidates/source text, expands evidence or
admits a rejected claim. The complete replacement still passes the unchanged
numeric/source validator within the existing correction budget. Add this diagnostic
and instruction only for signed-source policies when such a mismatch is present. Version 4
excludes explicitly marked identifiers across ordinary, minus-sign and en-dash
typography, including spaced signs, compound codes and page/figure references.
Identifier masks must preserve unrelated genuine signed amounts in the same span.
Version-4 counterpart comparisons are exact and independent of Decimal precision
or rounding context; rounded nearby values are not signed counterparts.
Version 3 is retained only for exact replay of its stopped private generation;
its earlier identifier diagnostics never constitute evidence for admission.

Record the applicable correction version in distillation artifacts, diagnostic records
and generation fingerprints. Changing correction behavior creates a new generation;
archive prior artifacts unchanged and do not silently resume or recover an old-policy
prefix under the new policy. The initial question, SYSTEM, evidence selection,
model/provider profile, numeric/source validators and three-candidate limit remain
unchanged for those predecessor policies. Explicit internal reconstruction with
`numeric-citation-only-v1`, `rejected-assertion-repair-v2`, the stopped private
`signed-source-feedback-v3`, and `signed-source-feedback-v4` preserves each predecessor fingerprint, initial request
and complete correction wire behavior; missing policy on historical
artifacts means that legacy policy. Unknown policies fail closed before provider
calls. Legacy numeric hints covering every rejected token continue to enforce exact
citation-only replacement text, including isolated structured-schema enums, solely
for explicit replay. They are not the new completion default.

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

### Complete native-page context (#563)

New distillations of documents with multiple native passages on a physical page
use `native-page-context-v1`. Include all readable passages from each primary
page when their total source characters fit the configured budget, including
verified reviewed OCR/transcriptions. Pack against this complete request size;
primary passages still form a unique ordered partition. Refinements use the same
page context. A page larger than the budget uses bounded primary passages plus
the existing mandatory reviewed context; never truncate a source passage. Retain
`unresolved_context_pages` and an explicit warning for these pages, count their
batches as unresolved and keep the artifact partial even after all primary batches
finish. HTTP/MCP and SDK document artifacts retain these fields; current and
historical summary views show the affected physical pages and context warning.
If primary plus mandatory reviewed context exceeds the budget, fail before
inference as before. Context repetition is not extra primary coverage.

This versioned policy participates in generation identity. Documents without
multiple native passages retain their existing default policy and identity.
Explicit `ordered-passages-v1` and `reviewed-page-context-v1` reconstruction keeps
the exact previous requests and fingerprints. Do not widen historical evidence,
relabel a changed request or reuse a prefix merely because its claims would pass
against new context. Snapshot admission compares complete ordered request evidence
and stops at the first changed scope; preserve archived generations and failures.
Source text, model/profile, question, system instructions and numeric validation
remain unchanged. Context repair does not repair independently known table OCR.

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

### Reviewed bold emphasis (#581)

An optional `presentation` on a page transcription records visually reviewed bold
emphasis separately from its unchanged literal `text`. It contains at most 128
`bold_spans`, each with `start`, exclusive `end` (Unicode code-point offsets), and
the exact nonblank `text` at that range, plus its own `attest_matches_image: true`.
Spans must be ordered, nonoverlapping and within that transcription. Reject unknown
fields, coerced indices/attestations, mismatched text, stale image/index pins and
forged ledger provenance at queueing and application. The separate attestation
confirms all bold within the transcribed text was marked and all unmarked text
was reviewed as not bold. An explicitly reviewed empty list means no bold in the
transcribed text; absence means unknown, never an inferred negative. Capitalization,
OCR confidence, list numbers and reviewer explanations do not establish emphasis.
Literal transcription preserves printed checklist order; presentation cannot invent
an order, change words or inject markup into literal text.

Retain presentation in the same immutable image/reviewer-bound ledger and verified
passage/citation provenance. Same text with a different reviewed presentation is a
distinct addition, with previous reviews and contradictory observations retained;
an exact active text/presentation duplicate is rejected. All source/recovery,
history, leases and compare-and-swap protections still apply. Plain historical
transcriptions, model wires and generation identities remain unchanged. New
presentation is source evidence: its identity participates in changed-generation
and unchanged-scope checks; it is never silently grafted onto an old generation.

Only server-verified presentation reaches the model. For each existing quotable
excerpt, expose ordered literal `text`/`bold` runs covering exactly that excerpt,
alongside its unchanged literal text. Clip runs at excerpt boundaries without
borrowing words or emphasis from other pages, sources or omitted excerpts. Do not
send span offsets, review hashes or reviewer annotations as factual evidence.
Concatenated runs must equal the excerpt exactly; no extra source text or automatic
OCR/style interpretation is admitted. The existing 18,000-character literal-source
budget, quotation/numeric validators and three-candidate correction bound remain.
This supports observing which words are bold; it does not claim general semantic
entailment or approval of a generated procedure.

HTTP/OpenAPI/MCP and Python/TypeScript SDKs expose the same optional typed structure.
Desktop/mobile review keeps the pinned original beside a literal text editor,
allows marking/removing bold selections without modifying the text, previews the
emphasis safely, and requires the separate complete-emphasis attestation. Changing
text clears spans and attestation; changing page/document/image, locking, stale
responses and failed requests clear pending presentation state. Historical detail
distinguishes unknown emphasis from reviewed emphasis and shows it with the original.
No private source or access key is persisted in browser storage.

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
restriction reason: `layout_relationships_unavailable` for unrepresented spatial
relationships, or `native_text_inaccurate` for image-confirmed incorrect native
words, signs or numbers (#566). These are explicit reviewer decisions, never
automatic OCR-confidence thresholds or inferred corrections. Keep existing
layout decisions valid and retain the unchanged `original_text_reviewed` release
reason. A draft or preview changes nothing.
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

HTTP/OpenAPI/MCP discovery and both SDKs retain the exact reason. Desktop/mobile
page review offers both restriction reasons, shows the chosen reason in history,
and clears attestation when the reason changes. Reset the selection with the
page/image/document/credential context. Require an image, named reviewer and
unchecked explicit attestation for either reason. Reject unknown or mismatched
action/reason combinations in requests and retained ledgers. A native-text
restriction uses the existing exclusion, coverage, integrity and history rules;
separately verified OCR/transcriptions remain independent usable sources without
silently overriding contradictions or admitting performance data.

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
continuing. Both child requests must supply strictly less source text and a proper
subset of the parent's supplied passages after applying the unchanged page-context
policy. Measure source text in the actual provider projection; retained native
text excluded by a source-use restriction cannot count as a reduction. Retain the
primary midpoint when it meets these conditions; otherwise use
the nearest effective contiguous boundary, preferring the lower boundary on a tie.
Search is bounded logarithmically in the primary passage count because supplied
context grows monotonically with a prefix and shrinks with a suffix. Required
native-page and reviewed context must never be dropped to make a split fit.
If no effective boundary exists, fail explicitly without changing the partition
or making another provider request. Every original primary passage remains covered
exactly once. A single passage that still truncates fails explicitly; successful
splitting remains bounded by the passage count. This changes retry partitioning,
not evidence policies, generation identities, validators or correction limits;
compatible saved partitions and their validated prefixes remain resumable.
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

### Conditional certification assertions (#576)

Generations recorded under `source-scope-feedback-v7` apply the following rules. In addition to
all existing quotation, source-use and numeric checks, reject a positive
flight-operation certification or authorization assertion when its supplied cited
source explicitly frames that operating entry as an equipment-dependent example
or as a statement at original airworthiness-certificate issuance, and the claim
omits the corresponding qualification. Inspect the quotable excerpts of the
provided cited source, including its available same-page context; selecting a
shorter excerpt cannot conceal an explicitly supplied condition. Never fetch or
invent evidence, borrow another manual's conditions, or use metadata as proof.

A faithful description of a conditional example must keep its example/as-equipped
scope and historical-certificate qualification when present. A generic research
caveat, a recommendation to check the manual, or the word "placard" alone does not
retain those conditions. Recognize the bounded equivalent forms "vary", "varies"
and "varying" in both supplied conditions and their faithful reporting; negated
forms such as "not varying" or "never varying" do not retain an affirmative
equipment-dependent condition. Matching remains whole-word and keeps the required
example and equipment cues. Distinguish a qualified report from current-aircraft
certification. Unrelated facts sharing a page, explicit prohibitions, and assertions
supported by unconditional source statements must not become conditional merely
because certification vocabulary occurs elsewhere. This bounded source-cue check
does not establish general semantic entailment or operational approval.

Affirmative flight-operation equipment assertions also retain an explicit
"as delivered" configuration scope supplied in their cited page's quotable source.
The selected quotation must cover that equipment assertion and its delivery scope;
a later fuel or placard excerpt cannot supply support for an earlier equipment
statement merely because its numbers match. Explicitly negative and hypothetical
equipment statements do not assert the current configuration. Do not import a
configuration condition from another page, document, metadata or restricted text.
A delivery phrase in an unrelated assertion cannot qualify an unscoped equipment
assertion; a negative or hypothetical replacement cannot erase a rejected affirmative
operating assertion. Keep each retained operating entry under its supplied scope.

Condition failures identify the one-based rejected claim and private source-derived
condition requirements. New-policy feedback distinguishes missing example scope,
equipment scope, equipment dependence, original-certificate date, as-delivered
scope and quotation coverage where applicable. It may identify at most six
provided same-page qualification excerpts, each retaining its provided passage and
excerpt IDs and exact text within the existing 1,200-character quotation bound.
The six-excerpt limit applies per rejected claim. These are existing request
evidence, never a new source or permission to invent a
condition. Source text remains untrusted data. Preserve this feedback even when a
numeric failure is detected first. A repair of the retained operating assertion
must restore its specific missing scope and cite its supporting excerpt; a reason
string claiming that a condition was restored does not substitute for claim text. Correct only rejected claims against the same evidence,
keep already validated claims unchanged, and require every rejected certification
assertion's operating-entry obligations and supplied qualifications in its repair.
An unrelated replacement, a dropped operating assertion, an empty repair, or a
non-specific caveat cannot silently erase it. Revalidate the complete merged
answer; at most three total candidate calls remain available. Exhaustion retains
partial work with the existing public failure shapes. Public errors never include
raw source text, private condition diagnostics or provider contents.

The new policy participates in every distillation fingerprint. A policy change
starts a fresh generation; do not graft an older accepted prefix into it or relabel
saved partitions/history. Explicit versions 1 through 6 retain their exact prior
requests, correction behavior and validation semantics for reconstruction. Their
known unsupported assertions remain preserved and unapproved under the new policy.
In particular, v5 retains its recorded rejection of "varying"; do not retroactively
revalidate, relabel or graft a v5 prefix under a newer recognizer. Version 6 retains
its prior equipment-admission and correction-feedback behavior for reconstruction;
known failures remain unapproved. The new qualification feedback and equipment
scope checks apply only to version 7.
Source originals, native/OCR/transcription identities, numeric grammar, provider,
model, system/question, budgets, API/SDK/UI shapes and embedding behavior remain
unchanged. Qualification requires the actual retained failure plus independent
controls and a finite changed-policy canonical generation whose complete affected
batches are compared claim by claim with their original page images.

### Procedure qualifications and quoted support (#583)

The `procedure-source-feedback-v8` policy retains the recorded v7 behavior above
and adds bounded procedure checks. A valid quotation
from a passage does not establish support for every assertion about that passage.
Inspect only quotable, actually supplied source and its available same-page
context. Never obtain requirements from another manual, unprovided pages,
restricted native text, page locators, reviewer metadata, capitalization as a
proxy for bold, or an inferred operating rule.

When a claim reports an action governed by an explicitly supplied limiting phase,
retain that limitation and cite its supporting excerpt. In particular, a source
instruction permitting flap use only as required for final approach and touchdown
cannot become unrestricted "flaps only as required." Associate the source action
and its procedure context before requiring its qualification; unrelated uses of
the same component elsewhere do not inherit that procedure's limitation.

Preserve the source's distinction between required inspection followed by
remediation and genuine alternatives. Where the supplied procedure says to
inspect, repair damage or replace damaged components before another flight,
"inspect or repair" is not equivalent. A supported partial statement about
inspection alone does not assert that inspection substitutes for remediation;
do not require a summary to reproduce every checklist item or call it complete.

Reject definite quoted-support gaps in asserted procedure topics, actions and
qualifications when their supporting supplied neighboring excerpt was not
selected. Keep passage and excerpt identities distinct: an overlapping warning
or a quotation from the same page does not cover an omitted wing-fire action,
flap-use phase, or icing condition. A literal fraction such as `1/4 inch` needs
its complete fraction in selected source support; independent printed checklist
step numbers `1` and `4` do not establish it. This additional check preserves
literal source forms and does not calculate or invent fraction equivalences.
The existing explicitly recognized half-percent comparison remains unchanged;
this policy adds no new conversions and never rewrites a claim or quotation.
These are negative admission guards for recognized source relationships, not a
word-overlap test that approves arbitrary paraphrases or general entailment.

Private rejected-claim feedback identifies the missing source-derived relationship
and up to six actually provided supporting excerpt witnesses within the existing
quotation bound. Retain the rejected operating topic, qualifications and every
unaffected accepted claim. A replacement cannot evade a rejected restriction by
dropping the operating entry, adding unrelated qualifying words, negating the
original assertion, or silently omitting a rejected position. Apply full source,
numeric and procedure validation to the merged answer within existing claim,
citation, evidence, diagnostic and completion bounds. Public errors continue to
exclude private source text and feedback. No API/SDK schema or provider settings
change merely to add this internal validation policy.

Keep recorded v4-v7 validation, feedback, exact actual-wire replay and recovery
behavior fixed. The v8 policy has its own generation identity: archive preceding
artifacts unchanged and start an actual changed-policy generation at zero. Never
graft an old-policy prefix or use controls, diagnostics, browser output, edited
claims or model responses as source evidence. Original-image comparison of every
final claim in the complete affected canonical scope remains mandatory; a narrow
guard or a passing numeric validator does not complete semantic acceptance.

Prospective controls precede implementation:

| Source and claim relationship | Required result |
| --- | --- |
| Action retains its limiting phase and selects the actual supporting excerpt | Allow, subject to other validation |
| Action drops final-approach/touchdown scope or borrows it from an unrelated assertion | Reject |
| Phase is retained but only a neighboring warning is cited | Reject |
| Similar component appears in an unrelated procedure/manual or an unasserted topic | Do not import its restriction |
| Inspection followed by repair/replacement becomes inspection **or** repair | Reject |
| Source explicitly offers genuine alternatives, or claim reports supported inspection alone | Do not invent a conjunction or completeness obligation |
| Wing-fire or icing assertion omits its actually supplied supporting excerpt | Reject; require that source support |
| Claimed fraction is supported only by separate checklist numerals | Reject |
| Complete literal fraction is quoted with its actual condition | Allow, subject to other validation |
| Source has unknown emphasis, or only metadata supplies a cue | Do not infer typography or factual support |
| Rejected-claim correction repairs support/qualification while preserving accepted claims | Admit only after complete revalidation |
| Correction drops the topic, qualification, claim position, or an accepted claim | Reject |
| Actual recorded v4-v7 exchange is replayed under its recorded policy | Exact predecessor behavior |

### Airspeed glossary quotation coverage (#586)

The `symbol-quote-feedback-v9` policy inherits the v8
procedure guards and adds a bounded negative check for asserted, source-provided
airspeed glossary concepts. A literal quote from the same page does not cover
recognized definitions in a neighboring excerpt that was not selected. In
particular, naming VNE, VS and VSO while quoting only the preceding KCAS-through-VNO
excerpt must fail when their actual definitions were provided separately.

Recognize only a fixed airspeed glossary vocabulary: KCAS, KIAS, KTAS, VA, VFE,
VNO, VNE, VS, VSO, Vx and Vy. An unambiguous printed expanded name, such as
"Never Exceed Speed," may identify the same concept without its abbreviation.
Do not treat overlapping generic stall-speed wording as interchangeable VS/VSO
support. Discover a requirement only when the claim asserts that concept and its
same-document, same-page, actually supplied quotable context establishes the
concept. Never derive glossary facts from another manual, an unprovided page,
restricted native text, provenance metadata, or a guessed definition. Ambiguous
cross-document assertions do not create invented source associations.

A supported partial glossary summary need not assert unmentioned entries. The
check detects absent selected support for recognized asserted concepts; a matching
word is not proof of an arbitrary definition or general semantic entailment.
Every claim must still pass the existing source, quotation, numeric, applicability,
procedure and fraction checks, followed by original-image comparison of the whole
affected canonical scope. This policy does not approve operating data or make a
partial research summary a complete operating or maintenance procedure.

Carry the rejected claim's original concept and provided-source obligations across
all bounded repairs, including when a numeric error was reported first. Replacing
missing definitions with a shorter unrelated summary, moving them into reason
text, dropping their symbols and expanded names, or borrowing a quotation from a
foreign manual cannot repair known missing support. Keep unaffected accepted
claims exact. Private feedback may repeat only already provided quotable excerpt
witnesses, within the existing shared maximum of six witnesses and 1,200 characters
per quote. Completion, evidence, citation and diagnostic bounds remain unchanged;
source text, quote boundaries and configured model/profile settings are not
altered to make a candidate pass. Public errors contain no private source text.

Preserve exact recorded v4-v8 validation, feedback, actual-wire replay and recovery
behavior. Give v9 its own generation identity: archive the prior v8 artifact,
claims and legitimate recovery receipt verbatim and start actual v9 generation
at zero. Do not graft an old-policy prefix or use controls, diagnostics, browser
output, edited claims or model responses as factual source. No unchanged
stochastic rerun, embedding retry, FAA authentication retry or production corpus
import is authorized by this validation change. No public API/SDK/UI schema
change is needed for internal feedback alone.

Prospective controls precede implementation:

| Source and asserted relationship | Required result |
| --- | --- |
| Complete asserted glossary concepts select their actual supporting excerpts | Allow, subject to other validation |
| VNE/VS/VSO asserted but only the preceding glossary excerpt selected | Reject; identify missing quoted concepts and provided witness |
| Supported partial summary asserts only KCAS/KIAS from their selected excerpt | Do not require unasserted later entries |
| Unambiguous expanded name is quoted instead of its abbreviation | Allow the recognized equivalent concept |
| Generic stall-speed wording is borrowed between VS and VSO | Do not treat it as interchangeable support |
| No corresponding glossary concept in the supplied quotable source | Do not invent a glossary requirement or remembered fact |
| Only restricted native text, metadata or an unrelated manual supplies a cue | Do not admit it as the source of an obligation or supporting quote |
| A known rejected concept is dropped, disguised by an unrelated replacement, or moved only to reason | Reject evasion; retain the frozen source/concept obligation |
| Numeric repair precedes glossary repair, or both fail in one claim | Preserve both obligations and all accepted claims within the existing bound |
| A replacement cites a foreign manual instead of its frozen provided context | Reject evasion |
| Procedure and glossary witnesses coexist | Keep the existing shared six-witness bound and original IDs/text |
| Historical v4-v8 wire or recovered generation is replayed with its recorded policy | Exact predecessor behavior |
| Actual generation changes from v8 to v9 | Archive old claims/receipt unchanged; start at zero; no prefix graft |

### BHP and conversion-unit quotation coverage (#589)

New answers and distillations use `definition-quote-feedback-v10`, retaining the
recorded v9 airspeed checks. In addition, discover the recognized BHP/brake
horsepower concept from the assertion and actually supplied quotable context on
its cited manual page. Require its selected quotations to retain that concept;
`horsepower` or `HP` alone is not an unambiguous substitute for brake horsepower.

For an asserted conversion/chart/table/scale relationship whose supplied same-page
source identifies weight conversions, recognize only the asserted pounds and
kilograms unit families. `lb`, `lbs` and `pound(s)` identify the former; `kg` and
`kilogram(s)` identify the latter. Require each asserted unit family in selected
quotations from the bound manual context. A supported partial statement may omit
unasserted labels. Do not impose conversion-label requirements on ordinary weight
statements or infer labels from absent, restricted, foreign-manual or unrelated-page
context. These are bounded negative coverage checks, not general definition,
operator, dimension or chart-relationship entailment approval.

The observed actual v9 BHP claim selected only the Static RPM/manifold-pressure
excerpt, while its BHP witness was supplied in the earlier excerpt. The observed
chart claim selected the scale footer without its supplied pounds/kilograms
headers. Both require selected source support; correct prose, numeric matches,
metadata and a citation to the same physical page do not establish it.

Retain rejected-position concept/source obligations through numeric and citation
repairs, including a numeric error reported first. Known aliases may preserve a
concept; dropping it, placing it only in the reason, changing to unrelated facts or
borrowing a foreign manual cannot evade repair. Preserve all accepted claims
exactly. Feedback may repeat only already supplied source witnesses within the
existing shared six-option limit, 1,200-character quotation limit, correction
attempts, citation limits and diagnostic bounds. The new families share that same
budget with procedure and airspeed requirements.

Preserve exact recorded v4-v9 settings, validation, feedback, wire replay and
historical receipts. Give v10 a distinct generation identity. Archive prior
artifacts/claims/legitimate receipts unchanged and start actual generation at zero;
never graft an old-policy prefix or use controls, edited output, diagnostics or
browser state as factual source. Keep numeric extraction, literal quotes, excerpt
boundaries, source budgets, model/profile/settings and retrieval unchanged. No
public HTTP/MCP/SDK/UI schema changes are needed for this internal feedback.

A corrupted printed operator or unsafe table/graph extraction belongs to the
image-reviewed source boundary (#588), not to numeric normalization or generated
claim editing. Preserve the actual failed output and native text. Restrict unsafe
native use and add only literally reviewed source through the canonical image-pinned
APIs. Partial header/footer transcriptions do not establish table-cell or graph
values, and pending vectors remain visible. After source and software admission,
compare every final claim of each entire fresh affected canonical batch with its
original images before admission or more inference. Unchanged stochastic reruns,
embedding or FAA retries and qualification-database production imports are outside
this correction change.

Prospective controls precede implementation:

| Source/assertion case | Required result |
| --- | --- |
| BHP/expanded name is provided but absent from selected quote | Reject with bounded same-source witness |
| Selected quote retains BHP or its unambiguous expansion | Accept this negative coverage check only |
| Conversion assertion names both units but quotes only footer or one unit | Reject missing asserted unit labels |
| Conversion assertion uses recognized lb/lbs/kg aliases | Preserve the same unit obligations |
| Supported partial conversion assertion names one unit | Do not require the unasserted unit |
| Ordinary weight statement lacks conversion context | Do not invent conversion-label obligations |
| Original concept/label is dropped, moved to reason or foreign source during repair | Reject evasion |
| Numeric failure precedes the quotation failure | Keep both obligations and accepted claims |
| Unprovided/restricted/foreign-page context contains a label | Do not discover obligations from it |
| Procedure, airspeed and definition witnesses coexist | One shared six-option bound |
| Historical v4-v9 wire or receipt is revalidated | Exact recorded behavior |
| Actual generation changes to v10 | Archive prior state unchanged; start zero |


### Quoted chart-sheet date associations (#592)

New answers and distillations use `chart-date-feedback-v11`. They retain v10
checks and add a bounded negative check for a named figure/chart sheet and a
printed date. A repeated date in a different sheet's quotation is not support
for the claimed association. This does not prove a chart's values or general
semantic entailment.

Discover an obligation only from one provided manual, an explicitly asserted
figure identifier, an asserted date, and a quotable provided page that contains
that figure/sheet/date association. Figure/Fig. identifiers and Sheet 1 of 2,
Sheet 2, sheets 1 and 2, both sheets and plural sheets are recognized literal
forms. A plural sheet assertion binds each matching provided sheet, while an
explicit single-sheet partial assertion binds only that sheet. Unsheeted named
figures may bind their own provided date. Do not infer absent sheets, unasserted
dates, chart cells, revision status, or associations from foreign manuals,
restricted text, metadata or unprovided pages. Recognize literal named-month
US dates and their unambiguous expanded month/day/year aliases; do not calculate
or reinterpret ambiguous numeric dates. Existing numeric validation still rejects
an expanded year absent from selected source; these aliases never bypass it.
Separate contrast clauses so dates for
one chart are not assigned to another by token co-occurrence. Ambiguous clauses
are outside discovery rather than guessed associations.

Each bound association must be supported by selected quotations on its original
provided manual page, retaining its figure, sheet when present, and date. Separate
selected excerpts on that same page may collectively retain these fields; the
same date on another page cannot replace them. Known rejected-position
associations remain frozen through numeric/citation repairs. Dropping or changing
the figure, sheet or date, moving them to reason, negating the original fact or
borrowing a foreign manual does not repair the rejected claim. All accepted
claims remain exact. Only already supplied excerpts may be returned as witnesses;
all source concept families share the existing six-option/1,200-character bounds,
eight citations per claim, diagnostics and normal attempt limits.

Preserve exact recorded v4-v10 policy/settings/validation/feedback, all 71 actual
historical provider exchanges and legitimate recovery receipts. A new actual v11
generation starts at zero and archives all prior output unchanged. Do not graft
old prefixes, modify correct source to fix a quotation gap, rerun an unchanged
failed contract, narrow the canonical question, change source budgets or model
settings, retry embeddings/FAA access, or import qualification data to production.
HTTP/MCP/SDK/UI schemas remain unchanged for this private feedback refinement.
After software delivery and admitted source lineage, compare every final claim
of each entire naturally generated affected canonical scope with all originals
before admission or more inference. Later procedure and page-111 acceptance
remain separate open requirements.

Prospective controls precede implementation:

| Case | Required result |
| --- | --- |
| Both Figure 1-3 sheets asserted dated Nov 15/00; only Sheet 2 quoted | Reject missing Sheet 1 association with supplied footer witness |
| Both sheets' figure/sheet/date support selected | Pass this negative coverage check |
| Only Sheet 2 asserted and quoted; Sheet 1 date unasserted | Do not invent the omitted obligation |
| Date/figure labels split across selected same-page excerpts | Preserve collective same-page support |
| Date matches only another page/figure, or source is foreign/restricted | No borrowed association support |
| Named-month/date and figure/sheet aliases | Preserve the same literal association |
| Contrasting clauses assign different dates | Bind only the explicit unambiguous clause date |
| Numeric error is repaired first, or association is dropped/changed/negated/moved to reason | Keep the original association and accepted claims |
| Missing page was not actually supplied or no date asserted | No fabricated witness or obligation |
| Procedure/glossary/definition and chart-date witnesses coexist | Existing shared six-option bound |
| Recorded v4-v10 actual wires or receipt | Exact predecessor behavior |
| New v11 actual generation | Start zero, archive prior output and receipts verbatim |


## Quoted flap-indicator colors (#596)

Under a new explicit correction policy, recognize only the bounded negative
coverage case where a claim names a flap control indicator and asserts supplied
literal dark-blue, light-blue or white color labels. A same-manual, same-page
provided source containing that indicator heading establishes the context;
restricted, absent or foreign evidence cannot supply a witness. Every asserted
recognized color must occur in the selected quotations from that original page.
Selected excerpts can support the claim collectively. This does not infer table
rows, validate color-to-speed associations, or establish general entailment.

Bind the original page, color labels and indicator topic per rejected position,
including when numeric or applicability validation fails first. Repair must
retain those assertions in claim text and quote their original page; dropping,
negating, moving them to the reason, or switching manuals cannot discharge the
obligation. Offer only verbatim actually supplied excerpts under the existing
shared six-option / 1200-character bound and eight-citation limit. Never rewrite
source, add a provider request budget, or relax numeric/quotation validation.

Recorded policies through v11 retain their exact behavior. A new generation
archives the complete prior output and receipts verbatim, starts at zero and
requires fresh whole-batch original-image acceptance before further inference.
No source changes, embedding retry or production database import follows from a
validator change. HTTP/MCP/SDK/UI schemas remain unchanged.

Prospective controls, authored before implementation:

| Case | Required result |
| --- | --- |
| Actual selected quote ends at `(Light `; light-blue/white asserted | Reject with supplied remaining excerpt witness |
| All asserted colors selected, including split same-page quotations | Pass this negative coverage check |
| Only the supported dark-blue entry asserted | No invented light-blue/white obligation |
| Color elsewhere on another page/manual | No borrowed support |
| Unprovided/restricted source or no indicator/color assertion | No fabricated witness or approval |
| Numeric failure occurs first, accepted sibling claim exists | Preserve original colors/topic and sibling through repair |
| Repair drops topic/color, negates, moves to reason or switches manual | Reject; keep original page witness context |
| Color and chart-date/procedure witnesses coexist | Shared six-option bound remains |
| Recorded v11 wire and complete legitimate recovery receipt | Exact predecessor behavior; new policy starts zero |


## Selected supplied-source phrases (#598)

The next explicit policy extends negative quotation coverage beyond hand-picked
aviation concepts. From the original claim and its actually supplied quotable
cited-page manual context, recognize at most six disjoint initially unquoted source phrases, each
three to twelve content tokens. Match through a finite, documented function-word,
whitespace, case and hyphen comparison view only. Keep negation, alternatives,
explicit if/when/only/except operators and numeric barriers; never normalize source text, measurements or
identifiers. Already quoted phrases do not create new lexical obligations on otherwise valid
semantic repairs. Existing recognized glossary/definition aliases are comparison
barriers and keep their established validators; this check cannot require a
symbol in addition to its valid expanded-name quotation. Do not invent phrases from metadata, restricted/absent source or an
ambiguous compound cross-manual assertion.

Retain each missing phrase's original provided manual and page alternatives per rejected
position, including on an earlier numeric or applicability failure. Selected
same-page quotations can collectively support its normalized token sequence.
Repair retains these already-source-supported phrases in claim text and selects
their original source. Dropping the phrase, immediately negating it, moving it to
reason text or switching manuals does not discharge an existing obligation.
These are bounded literal-coverage witnesses, not a semantic verifier: matching
words do not prove clause relationships, table rows, applicability or correctness.
Paraphrases without a recognized provided phrase remain outside this discovery.

Offer only verbatim actually supplied excerpts, sharing the existing six-option
and 1200-character witness limits with procedure, glossary, definition, chart-date
and color feedback. Existing eight-citation, source, request, profile and repair
budgets remain unchanged. Do not add a verifier provider call. Preserve recorded
v1–v12 behavior explicitly; a new policy archives the entire old artifact and
receipt and starts generation at zero. Every fresh final claim still requires
whole-batch comparison with originals before further inference. No source edit,
embedding/FAA retry or production corpus import follows from this change.

Prospective controls, authored before implementation:

| Case | Required result |
| --- | --- |
| Actual performance claim selects tail but omits supplied conditions sentence | Reject with the omitted original excerpt witness |
| Same missing-quote pattern in unrelated source prose | Discover without adding domain-specific keywords |
| All recognized phrases selected, including collective same-page excerpts | Pass this negative coverage check |
| Function-word, case, whitespace and hyphen variations | Same comparison view; literal quotes remain unchanged |
| Short/unprovided/restricted/metadata-only phrase or ambiguous manual context | No invented witness or approval |
| Correct numeric citation repaired first; valid sibling claim exists | Preserve bound phrases and sibling while repairing only rejected positions |
| Repair drops, immediately negates, moves phrase to reason or cites another manual/page | Original source obligations persist |
| Source content/claim contains numbers, alternatives, negation or conditions | Numeric barriers and condition tokens remain; no sign/identifier rewriting |
| Many matches and existing feedback families | Six disjoint phrases, twelve tokens each, shared six literal options |
| Recorded v1–v12 wires and legitimate complete recovery receipt | Exact old behavior; new generation starts zero |


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

## Selected optional-status support (#600)

The `optional-status-feedback-v14` policy adds a bounded negative quotation
coverage check. When a claim calls something optional or optionally installed,
its selected, supplied quotations must contain explicit optional-status wording
from its single bound manual. Listing alternative configurations alone does not
establish optional status. Metadata, restricted/unquotable text, a foreign manual
or an unselected excerpt cannot supply that coverage. Preserve the original
manual context across numeric, applicability and quotation repairs.

If optional wording has no selected support, reject the claim with private,
actionable feedback. Permit removal of that unsupported status while preserving
its supported subject, numbers and existing source obligations. Do not freeze an
invented qualifier into a repair requirement or fabricate missing source anchors.
Keep accepted sibling claims intact. Use the existing three-attempt, citation,
source and output budgets without a separate verifier call.

This lexical check cannot establish equipment relationships, applicability,
negation or general entailment merely because an optional word occurs in a
quotation. Whole-batch comparison with original images remains required. Literal
source, quotations and numeric comparison stay unchanged; explicit v1–v13
policies retain their recorded behavior. A changed-policy generation archives
the entire preceding artifact and recovery receipt and starts at zero.

The `option-noun-feedback-v15` policy extends that same bounded word family to
the nouns `option` and `options`, alongside `optional` and `optionally`. Calling
an equipment configuration an "option" can introduce the same unsupported
selection/applicability assertion. Separate configuration headings alone do not
establish that status. Require selected supplied wording from this explicit
family in the original bound manual; permit removing the unsupported noun
designation while retaining the supported configuration details. Match whole
words, never substrings such as `adoption`. Keep explicit v14 behavior unchanged
for recorded histories and exact replay. This remains negative lexical coverage,
with the same semantic limitations, budgets and original-image acceptance gate.

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


## Selected definition subjects (#604)

The `definition-subject-feedback-v16` correction policy derives at most six missing definition
subjects from the original assertion and the supplied same-document/page excerpts.
A subject is a literal sequence of two through six alphabetic words immediately
followed by `is`, `are` or `means`; comparison collapses whitespace, case and the
existing condition-view hyphens only. For each original copula occurrence, prefer
the longest suffix also supplied immediately before a copula. Require that exact
subject/copula boundary in an individually selected excerpt on its supplied page.
Thus `Center of Gravity Arm is` cannot cover `Center of Gravity is`. A subject
must occur with a copula within a single supplied excerpt to create an obligation;
this does not infer unseen or cross-boundary definitions, synonyms, predicate truth,
negation, dimensional correctness or table relationships.

Only originally missing selected subjects create obligations. Keep their original
subject, document, page and passage anchors throughout rejected-position numeric,
applicability and citation repairs, including when a repair drops the definition
or moves it into reason text. Preserve supported sibling claims and the existing
three normal attempts, 18,000 source characters, indexed quotations, six shared
1,200-character witness excerpts and existing citation bounds. Use supplied verbatim
excerpts only. Ambiguous cross-manual assertions do not acquire guessed anchors.
An explicit v15 policy preserves its exact old validation and repair prompts;
the new default policy changes the generation identity and archives the complete
old artifact before starting at zero. Source projections and numeric/quotation
validation remain unchanged. Every fresh whole batch still needs original-image
comparison before advancement. #603 source admission is independent of this guard.


## Selected tabular-layout wording (#608)

The `restricted-layout-feedback-v17` correction policy requires explicit selected
whole-word `table`, `tables` or `tabular` wording when a claim asserts that family
while citing a page with verified original-image-only source restrictions.
Derive affected original document/page pairs from cited pages and supplied verified
restrictions. Reviewed header/footer text and conversion factors do not themselves
supply layout. Metadata, unselected excerpts, restricted graphic text, and wording
on another page or in another manual cannot discharge the requirement.

Retain the original affected page pairs through numeric, applicability and citation
repairs. Unsupported layout wording may be removed while preserving supported facts,
formulas, original source obligations and siblings. Reason text cannot provide quoted
support. Require selected wording on each bound page if the layout family remains.
Use no new source text, guessed anchors, manual-specific names, or extra model calls.
This negative lexical coverage does not prove a table's structure, relationships,
values, meaning or applicability; original-image review remains mandatory.

Preserve exact explicit v1–v16 behavior, numeric/quotation/source projection functions,
the existing three attempts, 18,000 source characters, six shared 1,200-character
witness bounds and configured model settings. The changed default creates a new
generation identity: archive the complete old output and begin at zero. A source
with no verified page restriction does not acquire one from metadata alone.
