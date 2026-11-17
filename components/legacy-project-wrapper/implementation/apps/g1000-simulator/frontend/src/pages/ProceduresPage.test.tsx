import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ProceduresPage } from "./ProceduresPage";

function wire(airport = "KSFO", page = 1) {
  return {
    airport,
    total: 1,
    page,
    limit: 20,
    procedures: [
      {
        record: {
          identifier: "FIXTURE1",
          procedure_type: "SID",
          runway: null,
          transitions: [],
          legs: [
            {
              fix: "FIX",
              path_type: "TF",
              altitude_ft: null,
              course_deg: null,
              altitude_constraint: "FL180",
              speed_constraint: null,
            },
          ],
        },
        provider: {
          id: "fixture-one",
          route_type: "1",
          usage: "Reference only",
          omitted_from_common_legs: 1,
          records: [
            {
              raw: "synthetic source record",
              fields: { Altitude: "FL180" },
              primary: true,
            },
          ],
        },
      },
    ],
    source: {
      cycle: "test-cycle",
      url: "https://example.test/fixture.zip",
      effective_from: "2026-10-29T09:01:00Z",
      effective_to: "2026-11-26T09:01:00Z",
      retrieved_at: "2026-11-16T20:00:00Z",
      source_checked_at: "2026-11-16T20:00:00Z",
      freshness: "current",
      verification_state: "verified",
      records_sha256: "a".repeat(64),
    },
    parse_receipt: { rejected: [] },
    limitations: "Incomplete reference; not complete guidance.",
  };
}
const response = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
function open() {
  render(
    <MemoryRouter>
      <ProceduresPage />
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText("Published airport identifier"), {
    target: { value: "KSFO" },
  });
}
beforeEach(() => {
  window.history.replaceState({}, "", "/procedures");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response(wire())),
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("loads only explicitly and preserves raw source, unknowns, constraints and the chart handoff", async () => {
  open();
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Load procedures" }));
  await screen.findByRole("heading", { name: "KSFO · FAA cycle test-cycle" });
  expect(screen.getAllByText("Unknown").length).toBeGreaterThan(1);
  expect(screen.getAllByText("FL180").length).toBeGreaterThan(0);
  expect(screen.getByText("synthetic source record")).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "Open FAA charts and airport diagrams" }),
  ).toHaveAttribute(
    "href",
    "https://flight-planner.jordanhubbard.net/charts?airport=KSFO",
  );
  expect(screen.getByText(/1 source legs/)).toBeInTheDocument();
  const count = vi.mocked(fetch).mock.calls.length;
  vi.useFakeTimers();
  await act(async () => vi.advanceTimersByTime(60000));
  expect(fetch).toHaveBeenCalledTimes(count);
});

it("changes airport/type/runway without automatic requests and paginates only on request", async () => {
  vi.mocked(fetch).mockImplementation(async (url) =>
    (() => {
      const page = Number(
        new URL(String(url), "http://test").searchParams.get("page"),
      );
      const value = wire("KSFO", page);
      value.total = 21;
      if (page === 1)
        value.procedures = Array.from({ length: 20 }, (_, i) => ({
          ...value.procedures[0],
          provider: { ...value.procedures[0].provider, id: "fixture-" + i },
        }));
      return response(value);
    })(),
  );
  open();
  fireEvent.change(screen.getByLabelText("Procedure type"), {
    target: { value: "SID" },
  });
  fireEvent.change(screen.getByLabelText("Runway (optional)"), {
    target: { value: "28L" },
  });
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Load procedures" }));
  await screen.findByText("21 procedure/transition groups · page 1");
  fireEvent.click(screen.getByRole("button", { name: "Next procedure page" }));
  await screen.findByText("21 procedure/transition groups · page 2");
  const [url] = vi.mocked(fetch).mock.calls[1];
  const params = new URL(String(url), "http://test").searchParams;
  expect(Object.fromEntries(params)).toEqual({
    page: "2",
    limit: "20",
    procedure_type: "SID",
    runway: "28L",
  });
});

it("clears previous coverage on scope change and never labels an unavailable provider as zero results", async () => {
  open();
  fireEvent.click(screen.getByRole("button", { name: "Load procedures" }));
  await screen.findByText("1 procedure/transition groups · page 1");
  vi.mocked(fetch).mockResolvedValue(
    response({ detail: "Cycle verification unavailable" }, 503),
  );
  fireEvent.change(screen.getByLabelText("Published airport identifier"), {
    target: { value: "KPAO" },
  });
  expect(
    screen.queryByText("1 procedure/transition groups · page 1"),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Load procedures" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Cycle verification unavailable",
  );
  expect(screen.queryByText(/No matching published/)).not.toBeInTheDocument();
});

it("owns the response body until completion and fences late data after an airport change", async () => {
  let finish!: (value: unknown) => void;
  const body = new Promise((resolve) => {
    finish = resolve;
  });
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: true,
    json: () => body,
  } as Response);
  open();
  fireEvent.click(screen.getByRole("button", { name: "Load procedures" }));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  const signal = vi.mocked(fetch).mock.calls[0][1]?.signal as AbortSignal;
  expect(signal.aborted).toBe(false);
  fireEvent.change(screen.getByLabelText("Published airport identifier"), {
    target: { value: "KPAO" },
  });
  expect(signal.aborted).toBe(true);
  vi.mocked(fetch).mockResolvedValue(response(wire("KPAO")));
  fireEvent.click(screen.getByRole("button", { name: "Load procedures" }));
  await screen.findByRole("heading", { name: "KPAO · FAA cycle test-cycle" });
  await act(async () => finish(wire("KSFO")));
  expect(
    screen.queryByRole("heading", { name: "KSFO · FAA cycle test-cycle" }),
  ).not.toBeInTheDocument();
});

it("aborts a body still being read when the browser leaves the page", async () => {
  let finish!: (value: unknown) => void;
  vi.mocked(fetch).mockResolvedValue({
    ok: true,
    json: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  } as Response);
  const view = render(
    <MemoryRouter>
      <ProceduresPage />
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText("Published airport identifier"), {
    target: { value: "KSFO" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Load procedures" }));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  const signal = vi.mocked(fetch).mock.calls[0][1]?.signal as AbortSignal;
  view.unmount();
  expect(signal.aborted).toBe(true);
  await act(async () => finish(wire()));
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("rejects malformed success bodies and invalid airport input explicitly", async () => {
  vi.mocked(fetch).mockResolvedValue(
    response({ ...wire(), parse_receipt: {} }),
  );
  open();
  fireEvent.click(screen.getByRole("button", { name: "Load procedures" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Navigation response is invalid",
  );
  fireEvent.change(screen.getByLabelText("Published airport identifier"), {
    target: { value: "BAD!" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Load procedures" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Enter a published");
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("accepts a valid published seed without fetching and does not truncate an invalid airport association", () => {
  window.history.replaceState({}, "", "/procedures?airport=ksfo");
  const view = render(
    <MemoryRouter>
      <ProceduresPage />
    </MemoryRouter>,
  );
  expect(screen.getByLabelText("Published airport identifier")).toHaveValue(
    "KSFO",
  );
  expect(fetch).not.toHaveBeenCalled();
  view.unmount();
  window.history.replaceState({}, "", "/procedures?airport=KSFOBAD");
  render(
    <MemoryRouter>
      <ProceduresPage />
    </MemoryRouter>,
  );
  expect(screen.getByLabelText("Published airport identifier")).toHaveValue("");
  expect(fetch).not.toHaveBeenCalled();
});
