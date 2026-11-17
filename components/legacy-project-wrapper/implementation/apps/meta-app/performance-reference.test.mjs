import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
const realm = vm.createContext({ URL, URLSearchParams });
vm.runInContext(
  readFileSync(
    new URL("./public/performance-reference.js", import.meta.url),
    "utf8",
  ),
  realm,
);
const protocol = realm.AviationPerformanceReference;
const fresh = () => ({
  warnings: ["Research reference"],
  notes: ["No extrapolation"],
  limitations: "Not flight approval",
  schema: "aviation/performance-reference@1",
  dataset_id: "perf_" + "a".repeat(64),
  content_sha256: "b".repeat(64),
  icao: "SR22",
  variant: "Perspective",
  configuration: "3400 lb, flaps 50%",
  registration: null,
  table_id: "takeoff",
  metric: "takeoff_ground_roll_ft",
  units: "ft",
  value: 917,
  conditions: {
    pressure_altitude_ft: 0,
    temperature_c: 0,
    weight_lb: 3400,
    headwind_kt: 0,
  },
  source: {
    document_id: "doc_" + "c".repeat(32),
    sha256: "d".repeat(64),
    revision: "Reissue A",
    pages: [165],
  },
  reviewer: "Original-manual reviewer",
  reviewed_at: "2026-11-17T00:00:00Z",
  calculated_at: "2026-11-17T00:01:00Z",
  approved_for_flight: false,
});
function local(value) {
  realm.input = JSON.stringify(value);
  return vm.runInContext("JSON.parse(input)", realm);
}
const plain = (value) => JSON.parse(JSON.stringify(value));
test("preserves exact zero conditions and provenance while discarding unknown private fields", () => {
  const input = fresh();
  input.token = "synthetic-secret";
  input.source.quote = "private original quote";
  input.unexpected = { payload: "private" };
  input.source.pages = [165, 164, 165];
  const actual = plain(protocol.validate(local(input)));
  assert.deepEqual(actual.conditions, input.conditions);
  assert.deepEqual(actual.source.pages, [164, 165]);
  assert.equal(actual.value, 917);
  assert.ok(!JSON.stringify(actual).includes("synthetic-secret"));
  assert.ok(!JSON.stringify(actual).includes("private"));
  assert.equal(actual.approved_for_flight, false);
});
for (const [name, mutate] of [
  ["unit mismatch", (v) => (v.units = "m")],
  ["missing source", (v) => delete v.source],
  ["wrong content hash", (v) => (v.content_sha256 = "x")],
  ["invented approval", (v) => (v.approved_for_flight = true)],
  ["negative result", (v) => (v.value = -1)],
  ["unknown metric", (v) => (v.metric = "mystery")],
  ["invalid original page", (v) => (v.source.pages = [0])],
  ["missing review", (v) => (v.reviewer = "")],
  ["invalid time", (v) => (v.calculated_at = "tomorrow")],
  ["empty source revision", (v) => (v.source.revision = "")],
  ["unbounded condition", (v) => (v.conditions.surface = "x".repeat(201))],
  ["malformed registration", (v) => (v.registration = "bad tail")],
  ["empty page evidence", (v) => (v.source.pages = [])],
  ["array conditions", (v) => (v.conditions = [])],
])
  test("rejects " + name, () => {
    const value = fresh();
    mutate(value);
    assert.throws(() => protocol.validate(local(value)));
  });
test("rejects non-finite numeric results and conditions", () => {
  for (const expression of [
    "input.value=Infinity",
    "input.conditions.weight_lb=NaN",
  ]) {
    realm.input = local(fresh());
    vm.runInContext(expression, realm);
    assert.throws(() => protocol.validate(realm.input));
  }
});
test("unknown or different scenario values cannot establish a match", () => {
  const reference = local(fresh()),
    context = {
      icao: "SR22",
      variant: "Perspective",
      configuration: "3400 lb, flaps 50%",
      ...fresh().conditions,
    };
  assert.equal(protocol.compare(reference, local(context)).matched, true);
  delete context.headwind_kt;
  assert.deepEqual(plain(protocol.compare(reference, local(context))).missing, [
    "headwind_kt",
  ]);
  context.headwind_kt = 12;
  assert.deepEqual(
    plain(protocol.compare(reference, local(context))).mismatched,
    ["headwind_kt"],
  );
});
test("requires an opener, an exact allowed parent origin and bounded random session", () => {
  const href = (origin, session = "f".repeat(64)) =>
    "https://flight-planner.jordanhubbard.net/aircraft-performance#" +
    new URLSearchParams({
      "performance-handoff": JSON.stringify({ origin, session }),
    });
  assert.equal(
    protocol.descriptor(
      href("https://preflight-check.jordanhubbard.net"),
      false,
    ),
    null,
  );
  assert.ok(
    protocol.descriptor(
      href("https://preflight-check.jordanhubbard.net"),
      true,
    ),
  );
  for (const origin of [
    "https://evil.invalid",
    "https://preflight-check.jordanhubbard.net.evil.invalid",
    "https://preflight-check.jordanhubbard.net:444",
    "http://127.0.0.1:8888",
  ])
    assert.equal(protocol.descriptor(href(origin), true), null);
  assert.equal(
    protocol.descriptor(
      href("https://preflight-check.jordanhubbard.net", "short"),
      true,
    ),
    null,
  );
  assert.equal(
    protocol.descriptor(
      "https://flight-planner.jordanhubbard.net/#performance-handoff=garbage",
      true,
    ),
    null,
  );
});
test("local qualification origin exception requires both participants to be loopback HTTP", () => {
  assert.equal(
    protocol.allowedOrigin("http://127.0.0.1:18191", "http://127.0.0.1:18494"),
    true,
  );
  assert.equal(
    protocol.allowedOrigin(
      "http://127.0.0.1:18191",
      "https://flight-planner.jordanhubbard.net",
    ),
    false,
  );
  assert.equal(
    protocol.allowedOrigin("http://evil.invalid", "http://127.0.0.1:18494"),
    false,
  );
});

test("rejects arrays masquerading as string identities", () => {
  for (const key of ["dataset_id", "icao", "metric"]) {
    const value = fresh();
    value[key] = [value[key]];
    assert.throws(() => protocol.validate(local(value)));
  }
  const value = fresh();
  value.source.document_id = [value.source.document_id];
  assert.throws(() => protocol.validate(local(value)));
});
test("unknown labels and rolling starts cannot become matching measured comparisons", () => {
  const reference = fresh(),
    context = {
      icao: reference.icao,
      variant: reference.variant,
      configuration: reference.configuration,
      ...reference.conditions,
    };
  reference.conditions.surface = "unknown";
  context.surface = "unknown";
  assert.equal(
    protocol.compare(local(reference), local(context)).matched,
    false,
  );
  delete reference.conditions.surface;
  delete context.surface;
  context.observed_start_style = "rolling";
  assert.ok(
    plain(
      protocol.compare(local(reference), local(context)),
    ).mismatched.includes("start_style"),
  );
});
test("creates a quote-free snapshot only from the current reviewed source and table", () => {
  const reference = fresh(),
    dataset = {
      id: reference.dataset_id,
      content_sha256: reference.content_sha256,
      state: "reviewed",
      usable: true,
      content: {
        icao: reference.icao,
        variant: reference.variant,
        configuration: reference.configuration,
        source_document_id: reference.source.document_id,
        source_sha256: reference.source.sha256,
        source_revision: reference.source.revision,
        tables: [{ id: reference.table_id, metric: reference.metric }],
      },
    };
  const result = {
    ...reference,
    source: { ...reference.source },
    contributions: [
      { citations: [{ page: 165, quote: "Private original quotation" }] },
    ],
  };
  assert.deepEqual(
    plain(protocol.snapshot(local(result), local(dataset))),
    reference,
  );
  for (const change of [
    { state: "draft" },
    { usable: false },
    { content_sha256: "e".repeat(64) },
  ])
    assert.throws(() =>
      protocol.snapshot(local(result), local({ ...dataset, ...change })),
    );
  assert.throws(() =>
    protocol.snapshot(
      local({ ...result, variant: "another variant" }),
      local(dataset),
    ),
  );
  assert.throws(() =>
    protocol.snapshot(
      local({ ...result, configuration: "another configuration" }),
      local(dataset),
    ),
  );
  assert.throws(() =>
    protocol.snapshot(
      local({
        ...result,
        source: { ...result.source, revision: "another revision" },
      }),
      local(dataset),
    ),
  );
});
