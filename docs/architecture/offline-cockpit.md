# Offline flight packages and cockpit connectivity

Behavioral authority for [#493](https://github.com/jordanhubbard/Aviation/issues/493),
part of [#488](https://github.com/jordanhubbard/Aviation/issues/488).

## Offline flight packages

The planner must let a user select a saved route, chart editions and airport
references, and retrieve the associated source weather briefing into an explicit
offline package. Include the application shell needed to open it without a network.
Each package retains its route, creation time, original source and retrieval time,
effective and expiration instants, content type, byte length and SHA-256 for each
asset. Use the chart service's immutable member hashes. Never replace a pinned
edition with a newly current edition under the same package identity.

Persist packages in browser storage with bounded per-package and aggregate quotas,
storage estimates, cancellation, deletion and visible progress. Installation is
transactional: interrupted or failed downloads cannot appear complete. Verify all
asset hashes before admitting a package, and check them on opening. Retain originals
and distinguish an unavailable download from an intentionally excluded asset.
Private aircraft-library documents and bearer credentials are excluded unless a
separate explicit private export contract is added.

Offline navigation must work after a full browser restart, not only while the
current page's JavaScript remains loaded. Show online/offline state, package source
age, expired charts, missing references and stale weather. Existing cached source
material never becomes a fresh observation merely because the package was opened.
Provide an explicit update action creating a new package revision, and preserve
the old package until its replacement is complete. Offline route references and
source weather must remain readable without an external map tile server.

Package PDF originals together with the page previews needed for disconnected
viewing. Raster packages retain the original and declare their rendered tile
coverage, bounds and zoom levels; let the user choose full-chart or route-area
coverage and show the resulting storage estimate before downloading. Unavailable
tiles outside that declared coverage must have an explicit offline state. Include
derived-asset hashes and their original-source identity, rather than treating a
server-rendered preview as the unmodified original. Never cache authenticated
API responses or request headers in the application-shell service worker.

### Package preparation and storage contract

`POST /api/offline/prepare` accepts either 2–20 airport identifiers or an existing
saved-plan ID, plus at most four already-acquired chart members. It returns a typed
manifest with a new immutable package ID, optional previous revision ID, route,
source briefing, airport references, chart metadata and asset descriptors. Preparing
a package never files a flight plan or downloads an uncached chart. Original
chart assets use pinned member URLs; derived PNGs have their own byte hashes and
retain `source_sha256`. Source hashes must never be advertised as PNG content hashes. Provider source URLs
and retrieval times come from the acquisition receipt matching the pinned member,
not an internal download alias or a later receipt for different bytes.
Inline route/briefing/reference JSON is bounded and retained only in the response,
not in the server's public chart object store. Selecting an existing saved plan
retains its complete serialized flight data, metadata and authored notes, rather
than reconstructing a field subset. This explicit plan export does not include
application credentials or aircraft-library document payloads. Responses are private/no-store.

Preparation renders at most 128 PDF pages and 512 map tiles in total, uses at most
128 MiB per package, and admits only one rendering preparation at a time per process.
Raster coverage is explicitly full-chart bounds or a declared route-area WGS84
rectangle at a selected zoom; antimeridian rectangles are rejected rather than
silently dropping coverage. The browser displays actual bounds, zoom and byte count
before installation. Downloads use only enumerated same-origin public chart/asset
URLs, omit credentials and reject redirects. Private library URLs are never admitted.

Browser packages use IndexedDB and a cross-window writer lock. Limit storage to
512 MiB and 32 complete packages. Download and verify assets before publishing a
complete package record; interrupted installs never appear complete. Serialize
install/delete across windows, check quota before and during installation, and
remove abandoned unreferenced assets on the next writer operation. Verify manifest
identity and all retained bytes whenever opening a package. Service-worker shell
caches contain only the build's explicit public HTML/JS/CSS/assets, never API data,
request credentials, user route data or private documents. A failed shell install
must leave the previous shell usable.

## Cockpit receiver page

The planner exposes a discoverable cockpit page for an explicitly configured local
bridge URL and operator token. Opening it must not contact a receiver or start
polling. Connecting reads one snapshot; repeated refresh is a separate opt-in.
Start/stop buttons operate the already configured listener, never discover devices
or change source restrictions. Keep credentials only in page memory, clear them
on disconnect/navigation, omit cookies, reject redirects and bound request time.
Require HTTPS except for loopback HTTP; explain origin allowlisting and browser
local-network permission instead of weakening bridge access control.

Display listening/connection/error state, UTC receipt times and report ages.
A saved snapshot continues aging locally; failed refresh or disconnected telemetry
must never remain labeled live. Preserve separate receiver sources and session IDs,
ownship GPS validity, traffic identity/address type and quality/reference fields.
Pressure altitude and geometric altitude/datum stay explicitly distinct, with
unknown/invalid values visible. Keep full normalized report details accessible.
Receiver reports are advisory and incomplete; supported receiver text weather is
separately attributed and never implies current product validity.
Private receiver telemetry is excluded from general AI explanations and shell caches.
Desktop/mobile verification must exercise explicit connection, refresh, start/stop,
opt-in polling, disconnection and stale/invalid/error states, without claiming
hardware acceptance from loopback test packets.

## Local receiver bridge

An operator-run local process receives UDP packets from an explicitly configured
receiver and exposes bounded, authenticated browser-readable telemetry. UDP bind
address, port and receiver source restrictions are operator configuration. Do not
start a receiver listener, contact network devices, or enable telemetry polling as
a side effect of ordinary application startup. The default bridge control/read
surface binds to loopback; a remote browser requires an explicit reachable binding
and origin allowlist. Reject unauthorized origins and credentials before processing
requests. Do not put bridge tokens in URLs or persistent browser storage.

An explicitly launched local gateway profile reuses the existing Meta App gateway
engine for `/api/v1/cockpit`, `v1.cockpit.request`, `v1.cockpit.describe` and
`aviation://v1/cockpit/openapi`. It publishes only the cockpit service and forwards
explicit caller credentials to the configured bridge. The ordinary hosted gateway
keeps its existing service list and does not discover or contact operator loopback
services. Profile isolation must be covered by HTTP/MCP tests.

The portable GDL90 byte decoder belongs to `aviation.avionics`; transport, bounded
history and receiver lifecycle belong to the bridge. The browser consumes normalized
reports rather than maintaining a separate decoder. Validate framing, escape
sequences, message sizes, IDs and FCS before using payloads. Recover after malformed
frames without unbounded buffers. A datagram can carry multiple frames; unsupported
message IDs remain explicit and never masquerade as valid traffic or weather.

Support heartbeat, ownship, traffic, geometric-altitude and ForeFlight version-1
device-ID reports. Preserve address
type alongside participant address, alert status, NIC/NACp, track/heading reference,
airborne state and extrapolation. Invalid altitude/speed/vertical-rate sentinels are
unknown, not zero. Pressure altitude, ellipsoid height and an extension-declared MSL
height are distinct. Respect ownship GPS validity and report each receiver timestamp
and host receipt time separately. A heartbeat's seconds since midnight do not supply
a calendar date by themselves.

The standalone bridge exposes authenticated `GET /api/cockpit/status`,
`GET /api/cockpit/state`, `POST /api/cockpit/start` and
`POST /api/cockpit/stop`, with typed OpenAPI at `/api/openapi.json`. Start/stop
operate only on the UDP address, port and source allowlist provided by the operator
at process launch. Tokens are at least 32 characters and are not in command-line
arguments. An Origin header must match the explicit operator allowlist; preflight
may advertise allowed headers without granting access to report data. The process
has no UDP listener until an authenticated start or explicit CLI `--start`.

Each UDP datagram is an independent framing boundary. Discard incomplete frames
at its end rather than combining bytes across lost/reordered datagrams or senders.
Bound admitted datagrams to 200 per second with a burst of 100 and 1 MiB per
second with a burst of 256 KiB, eight sender
endpoints, 500 traffic tracks and 128 diagnostic reports. Source rejection occurs
before decoding. Each sender retains its own heartbeat, ownship and geometric
altitude and device ID; values from different senders must never be fused. A recent known telemetry report
establishes a receiver connection for five seconds; an unknown CRC-valid message
alone does not. Ownship requires a fresh heartbeat's valid GPS indication as well
as a usable ownship position before `gps_fix_valid` can be true. Missing heartbeat
validity is unknown. Traffic becomes stale after 15 seconds and is removed after
60 seconds; individual report receipt times remain visible. Restarting a listener
clears the previous session's telemetry. Stopping retains last-known values with
`live=false`, and subsequent stray callbacks cannot revive the stopped session.
A device ID retains the lossless 64-bit serial, names, declared datum and internet
policy; reserved bits remain visible. It does not establish a telemetry connection
or refresh older measurements. Apply its declared datum only to subsequent
same-sender geometry through the shared resolver; never convert pressure altitude
or relabel a prior geometric measurement. The standard raw decoder uses WGS84
ellipsoid. Once an identified sender has an observed gap beyond five seconds,
new geometry has unknown datum until a new supported ID arrives. Continuous
telemetry preserves the profile without requiring an undocumented ID interval.
An unknown ID version invalidates the active profile; an unknown subtype remains
unsupported. A changed known serial clears that endpoint's previous fix and tracks
before accepting new measurements. Restart discards all declarations. Sender state
exposes `device_profile_valid` (null for a standard sender with no observed ID,
false for an uncertain profile). Device-ID envelope ages may exceed five seconds
while the profile remains valid through continuous telemetry; the validity field
is the applicability indicator.

Weather decoding capabilities and missing products remain explicit while the
supported-product implementation is incomplete.

Age advances by the larger elapsed interval from host monotonic and wall clocks
at each observation, including suspend gaps. The elapsed clock is shared by every
sender, so a gap observed while processing one sender also ages the others.
Retain each report's maximum observed age so a later
clock correction cannot make stale data fresh again. Only a new receiver report
can reset its age. This accommodates portable clock differences documented by
[Python's clock reference](https://docs.python.org/3/library/time.html#time.CLOCK_BOOTTIME)
without assuming that every monotonic clock includes suspend time. Connection,
GPS eligibility, traffic expiration and diagnostic report ages use the same rule.
The diagnostic `clock_discontinuities` counter records observed clock-delta
disagreements larger than one second.

Retain and decode supported UAT/FIS-B weather with product identifiers, report times,
segmentation and expiry. Missing or unsupported products are explicit coverage gaps;
internet weather and receiver weather remain separately attributed. Only complete,
validated products may be presented as decoded receiver weather.

Connection state requires recent valid receiver reports. Mark ownship, traffic and
weather stale independently, age out tracks with bounded history, and retain useful
last-known values with their timestamps. Transport connection alone does not prove
valid GPS, complete traffic coverage or current weather. Never invent a receiver
connection from test fixtures or an internet flight-tracking source.

## Receiver FIS-B text products (#528)

The shared portable decoder recognizes the exact 436-byte GDL90 message 7 after
ordinary framing/FCS verification. TOR is a little-endian fractional second in
80 ns units: expose nanoseconds only for values below 12,500,000, otherwise null;
it supplies no calendar date. Preserve the original payload hex. The eight-byte
UAT header must declare application data valid (byte 6 bit 5, zero-based within
the UAT payload) before its fixed 424-byte application field is interpreted.

Each information-frame length is nine bits excluding its two-byte header. Zero
length ends the zero-filled field; a final single zero is padding. Reject an
out-of-bounds length or nonzero reserved/padding fields without publishing partial
results from that uplink. Bound traversal to the 141 nonempty frames physically
possible in 424 bytes. Non-FIS-B frame types and unsupported product IDs remain
explicit diagnostic coverage, without establishing decoded weather.

For product 413, support complete independent generic text APDUs with the normal
or extended time-option header sizes. Header time is unused for this product:
retain actual text-record time rather than infer product age from the APDU or TOR.
Optional product-descriptor flags and segmented APDUs remain explicitly unsupported;
never interpret their bytes as a complete report. Decode the DLAC six-bit alphabet
MSB first, including bounded tab expansion and LF. Ignore the DLAC null character
(NC); reject unsupported change-cipher (CC) and embedded ETX controls. Require each nonempty record's
RS delimiter and zero fill to the following byte boundary, with zero-only trailing
padding. Reject a truncated record, dangling tab, nonzero fill, invalid control or
more than 4,096 expanded characters / 128 records in one uplink. A malformed APDU
contributes a bounded diagnostic and no partial records; independent valid APDUs
in the same structurally valid uplink remain usable.

Expose an `uplink` report with `application_data_valid`, nullable
`time_of_reception_ns`, complete `records`, `unsupported_frames`, unique
`unsupported_products` and bounded `errors`. Each record carries `product_id=413`,
`raw_text`, `report_type`, `location_id`, `report_time` and `body`. Preserve raw text
and report body exactly after protocol DLAC decoding; single-space-delimited type,
location and time fields are required (each at most 32 characters). METAR, TAF,
optional SP/AM markers, NIL= and unfamiliar generic text types remain visible
without turning text into a numeric planning authority or silently rewriting it.

The bridge derives `fisb_text` envelopes from complete records, with the original
uplink payload and source/session attribution. Bound retained weather to 128
content-deduplicated reports, keyed by sender and exact raw record; count duplicate
receptions, evictions and expiry. A repeated record updates only its receipt
observation. Remove reports 900 seconds after their latest receipt using the same
monotonic/wall-clock maximum-age rule as traffic. Stopping keeps last-known reports;
restarting and an identified device replacement clear previous-source reports.
Unsupported or empty uplinks do not establish a receiver connection. Reports from
different senders are never fused. Product age and validity remain unassessed:
`product_age_seconds=null`, `validity=unassessed`, and `live=false` for derived
weather envelopes. Receipt age is independent of product freshness.

Authenticated HTTP/OpenAPI and the explicitly launched local HTTP/MCP gateway
expose these same typed records and limits. Capabilities name product 413 and the
unsupported segmented/graphical coverage. Hosted gateway isolation is unchanged.
The Cockpit page shows received text, report type/location/time, source and receipt
age in plain escaped text, including an explicit product-age/validity limitation.
It preserves current private-session and opt-in refresh controls; no report enters
the public Internet-weather cache or general AI context. Qualification requires the
FAA section 5.2.4 five-TAF wire example in both language bindings, adversarial framing
and product cases, actual local UDP/HTTP/MCP and built desktop/mobile evidence.
Loopback packets do not establish physical receiver/RF or graphical weather support.

## Applications and discovery

Expose typed package-manifest and bridge status/report contracts through the normal
HTTP/MCP discovery paths. Keep binary file transfer over HTTP and secrets out of
discovery/results. Provide desktop/mobile controls for package selection, download,
open, update and deletion, and explicit receiver connect/disconnect. The receiver
view shows source identity, validity, age, coverage and advisory limitations together
with ownship/traffic/weather data. Preserve route handoffs from planner and preflight.

## Evidence required

The packaged application must serve its browser shell on cold direct requests to
`/offline` and `/cockpit`, as well as navigation from the planner. Exercise the
production application factory's static-artifact layout; a test harness must not
add missing production routes. Unknown API and static paths retain their errors.

Deterministic acceptance includes independent published protocol vectors, escaped
frames, bad FCS/length/ID, concatenated and partial frames, invalid sentinels, source
restrictions, bounded load, stale transitions and receiver shutdown/restart. Package
tests cover actual chart/source bytes, corrupted assets, quota exhaustion, interrupted
installation, revision pinning and credential exclusion.

Single-browser cockpit acceptance uses the shared owned-browser lifecycle, retaining
startup/connect/close diagnostics and bounded cleanup. A graceful browser exit
must not strand the runner; persistent-profile offline restart tests still verify
the separate whole-browser persistence boundary.

Browser acceptance must install a real package, disable the network, restart the
browser, open its route/charts/briefing, inspect expired/missing states, and delete it
on desktop and mobile. Real UDP integration verifies transport without being labelled
hardware acceptance. Actual receiver evidence must identify the receiver make/model,
configured protocol and real report provenance; it remains pending until available.
Current receipts, exact-head CI, reviewed merge, deployment and hosted verification
remain required. No simulated data proves actual receiver compatibility.

## Protocol sources

- [Garmin GDL90 Public ICD Rev A, hosted by FAA](https://www.faa.gov/sites/faa.gov/files/air_traffic/technology/adsb/archival/GDL90_Public_ICD_RevA.PDF)
  defines framing, FCS, standard reports and UAT/FIS-B products. Original SHA-256:
  `81904b5cc7f0a3b66317e5bd285c4e96976577bd089d238a5271269ba131c738`.
- [ForeFlight's extension specification](https://foreflight.com/connect/spec/)
  defines its UDP transport conventions, device identity and altitude-datum
  capability. Extension support must be explicit and separately tested.
