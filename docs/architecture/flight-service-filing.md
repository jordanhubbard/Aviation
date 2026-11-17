# Flight Service filing and lifecycle

Behavioral authority for [#492](https://github.com/jordanhubbard/Aviation/issues/492), part of #488.
Flight Planner owns the provider adapter, private SQLite workflow and HTTP/UI;
Meta exposes the same typed private operations through planning HTTP/MCP. Saved
routes and exports are distinct from a provider-acknowledged filed flight plan.

## Provider authority and readiness

Use the Leidos Flight Service REST contract, preemptive HTTP Basic vendor
authentication and `application/x-www-form-urlencoded` requests with JSON responses.
The [authentication](https://lmfswebservices.atlassian.net/wiki/spaces/WSS/pages/1605656)
and [workflow](https://lmfswebservices.atlassian.net/wiki/spaces/WSS/pages/1605682/Flight%2BPlanning)
documents and [published schema](https://www.1800wxbrief.com/Website/resources/doc/WebService.xml)
own field names, version stamps and states. The inspected schema snapshot SHA-256
is `1adb3b5b1c25124ac7e868db09700d121164f898d68bac0bd7645cc34ae57c4b`.
The [onboarding contract](https://lmfswebservices.atlassian.net/wiki/spaces/WSS/pages/1605648)
requires vendor vetting/lab access and later operational approval. A pilot must
also authorize the vendor for credentialed service requests. No account creation,
vendor contact or operational flight-plan submissions are authorized by implementing
or qualifying this adapter.

Select `FLIGHT_SERVICE_ENVIRONMENT=lab|production` explicitly. Origins are fixed:
`https://ffspelabs.leidos.com/Website2/rest` and
`https://www.1800wxbrief.com/Website/rest`. Vendor username/password stay in
`FLIGHT_SERVICE_VENDOR_USERNAME` / `FLIGHT_SERVICE_VENDOR_PASSWORD` on the server.
Require a separate private API bearer `FLIGHT_SERVICE_TOKEN` of at least 32 characters.
Missing/invalid configuration is unavailable, never successful filing or an empty
pilot account. Production mutations additionally require an explicit operator
`FLIGHT_SERVICE_OPERATIONS_APPROVAL_REFERENCE`; configuration is an operator
attestation, not proof of provider approval. Report that distinction.

Capabilities expose only nonsecret configuration/readiness. Reads never infer pilot
authorization for filing. An explicit authenticated pilot-account check may retrieve
that account's summaries and report read access; a provider action's actual receipt
remains the authority for its success. No startup/provider polling or automatic action.
Use TLS verification, bounded response bytes/timeouts, no redirects, proxy inheritance
or transparent mutation retries. Sanitize errors and never return vendor credentials
or raw authorization headers. The provider's test service and contract fixtures are
not evidence of successful operational filing.

## ICAO draft and eligibility

Keep drafts private and revisioned. Allow incomplete working drafts, with explicit
field-level validation results. Support provider ICAO VFR/IFR fields, callsign,
type, departure/destination and optional disambiguating coordinates, UTC departure,
duration, route, alternates, equipment/surveillance, speed, altitude with explicit
units/type, endurance, persons/color, pilot information and supplemental information.
Do not infer equipment, pilot authorization, current onboard fuel or actual departure
from generic aircraft references or saved planning estimates. Preserve optional
field clearing. Published extended-ETA VFR inputs retain their distinct constraints.
Persons on board require an explicit value or an explicit to-be-notified choice.
A format-valid draft is not ATC approval, aircraft eligibility or a completed briefing.

VFR supports file, amend, activate, cancel and close; IFR supports file, amend and
cancel. Refresh existing provider state explicitly before preparing a lifecycle
mutation. Retain provider `flightIdentifier` and latest `versionStamp` as opaque
identities, and require the stamp for amend/activate. Report the source state,
retrieval time, timing limits and unsupported/unknown states. Proposed VFR plans
can amend/cancel until two hours after ETD; active VFR can amend/close, including
an overdue closure with explicit destination information. Activation requires an
explicit actual departure within 30 minutes of current time. IFR amend/cancel
cutoffs depend on departure ARTCC: the verified machine-readable contract lists
43 minutes for Anchorage, 55 for Boston, 61 for Indianapolis/New York, 22.5 hours
for Guam/Honolulu and 46 for other centers. The overview instead gives the general
46-minute case. Preserve this source distinction, require known source ARTCC before
claiming a computed cutoff, and leave unknown eligibility to the provider.  IFR activation/closure belong
to ATC and are not exposed as successful service actions. Provider responses remain
authoritative when local eligibility cannot establish availability.

## Confirmation, receipts and uncertain outcomes

Prepare a specific action with an exact draft/local revision, provider state/stamp
and explicit inputs. Return a five-minute review containing the full relevant
plan or amendment changes, environment, action, constraints and a single-use opaque
confirmation token. No provider mutation occurs during prepare. Changing a draft,
provider state/version, action or inputs invalidates an earlier review. The user
must explicitly confirm the exact reviewed action and environment at execution.
External changes after review are still possible: amend/activate use the provider
version stamp; cancel/close have no corresponding wire precondition in this contract.
The provider action response remains authoritative.

Reserve execution durably under a SQLite writer transaction before outbound I/O.
Hold an operation-specific operating-system file lock across transmission and
receipt persistence, outside the SQLite writer transaction. Reconciliation must
acquire that same lock without waiting; a live owner prevents reconciliation
even after the nominal network window. Process loss releases the lock without
erasing the durable uncertain operation.
Use a caller idempotency key and request identity: repeat identical calls return the
same operation/receipt; changed calls with a reused key conflict. Consume confirmation
once and prevent parallel actions for a filing. Persist provider acceptance/rejection,
identities/version, coded messages, bounded credential-redacted provider JSON, the
original response byte hash and audit chronology.
Do not invent filed state from local saving, HTTP 200 alone or missing receipt fields.
A boolean provider `returnStatus` and the required operation-specific receipt fields
must validate. Unknown provider states remain unknown.

A transport failure, ambiguous response or process loss after reservation can mean
the action reached the provider. Mark outcome unknown; do not blindly resend or
allow a new filing to bypass that uncertainty. Provide explicit reconciliation:
inspect account/provider records, attach a verified matching provider receipt or
record an operator-attested provider resolution with a reference. Absence from a
summary list cannot prove that no flight plan was filed. Keep the original uncertain
operation and its audit records. Amend only explicitly changed fields; do not
retransmit old unrelated values over changes made by ATC or another client.

## API, UI and private state

Expose typed `/api/filing` capabilities, validation, private draft CRUD,
pilot-account check, filing list/detail/refresh, action prepare/execute,
operation receipts/audit and explicit reconciliation. The generic planning
HTTP/MCP paths retain native schemas and authentication; do not add private
filing routes to public cross-app CORS. Every private success/error response is
private/no-store. Bound bodies, strings, list sizes and pagination.

The Planner UI offers editable drafts, field-level validation, provider status,
explicit state refresh and a clear review/confirm step with the selected environment.
Show receipts and uncertain outcomes with useful next actions; never label a saved
route filed. Carry only explicitly selected planning inputs into a new filing draft;
require the remaining real aircraft/pilot details. Private keys, pilot data, draft
reviews and responses stay in memory and clear on key/account/context changes;
no persistent browser storage. Render source strings as text. Keep desktop/mobile
controls usable and abort/ignore stale responses.

Persist SQLite state under `FLIGHT_SERVICE_DIR`, default `DATA_DIR/flight-service`,
with owner-only directory/database permissions and an explicit supported schema
version. Preserve drafts, revisions, confirmations, executions and immutable audit
across restarts. Back up with a consistent SQLite snapshot; rollback restores a
compatible complete private store. Fail closed on unsupported schema or corruption.
