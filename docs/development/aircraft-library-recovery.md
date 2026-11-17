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
