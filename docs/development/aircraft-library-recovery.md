# Aircraft-library recovery

The [library contract](../architecture/aircraft-library.md) owns recovery semantics.
This procedure addresses #489; it does not establish complete document coverage.

Before recovery, confirm that no indexing, embedding or distillation job is active.
Retain a consistent SQLite backup and verify every original PDF against its stored
SHA-256. Keep backups private and outside the served library. Rehearse on a copy.
Do not copy a live SQLite file without the SQLite backup API, or ignore uncheckpointed
WAL contents. A recovery candidate must be a standalone consistent snapshot.

Use the deployed provider configuration and the canonical operator function:

```python
from app.services.aircraft_library.models import Models
from app.services.aircraft_library.store import Store
from app.services.aircraft_library.recovery import recover_distillation

result = recover_distillation(Store(library_root), Models(), document_id, backup_file)
```

The function makes no inference calls. It verifies the saved evidence identity,
original bytes, applicability metadata, extraction, full ordered passage text and
all saved claims; remaps passage IDs only for identical evidence; and revalidates
the mapped prefix before an atomic compare-and-swap. It rejects a changing live
extraction/artifact and retains a current prefix covering at least as much evidence.
Its audit identifies the snapshot, source fingerprint and recovered batch/claim
counts. Paths, credentials and original text are not returned in that audit.

After applying image-verified supplemental OCR, use the separate explicit
`recover_reviewed_ocr_prefix(store, models, document_id, backup_file)` operation
only on an idle document. Rehearse on a copy of the latest corpus. Its snapshot
must precede those additions and match the current original, metadata, model and
prompt/profile. Native source and all prior OCR provenance must remain identical;
only appended, server-verified reviews and passages are eligible. It admits only
fully revalidated leading batch scopes that still match current evidence exactly,
stopping before changed scopes. Every other current passage remains in the saved
unresolved partition. The receipt records that the source generation changed and
identifies the original summary/snapshot and new reviews. Historical summaries
remain unchanged. An earlier insertion may leave no eligible prefix; recover
nothing in that case. An active/newly queued job, changed source or concurrent
artifact update rejects publication. This operator function exposes no filesystem
path through the HTTP/MCP API and makes no inference calls.

After adding explicitly reviewed original-page transcriptions, use
`recover_reviewed_page_text_prefix(store, models, document_id, backup_file)`.
It permits only appended server-verified OCR/transcription reviews and preserves
the same original, metadata, profile, unchanged-scope, full-claim validation,
image-integrity and idle/compare-and-swap requirements. Its
`reviewed_page_text_prefix` receipt lists new OCR and transcription IDs separately.
The OCR-only function rejects transcription additions; exact-source recovery
retains its existing boundary. A new transcription never grants coverage to an
old summary of that page. Rehearse on a private copy before using the live corpus.

After verifying the recovery result, enqueue **distillation**, rather than a new
index run, to continue inference. A new index request intentionally refreshes
extraction and derived work. Reclaimed leases belonging to the same index job now
reuse its atomic extraction checkpoint and provider-identified vectors. Strict
validation failures remain explicit partial coverage; retrying never grants
permission to invent facts, drop rejected claims or claim unread pages were covered.

Deterministic acceptance includes death during index-job distillation, lease
reclamation, stale-owner write rollback, metadata/extraction invalidation, explicit
reindexing, durable truncation partitions, correction budgets, snapshot remapping,
changed source/model/numeric claims and complete-prefix preservation. The real-data
rehearsal recovered 13 maintenance batches / 147 claims with zero model calls,
preserved all seven originals and the completed 27-batch / 311-claim POH, and made
no production-library changes. Initial configured-provider continuation preserved
that prefix but exhausted an output budget; it is not evidence of full completion.
