import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium, expect } from "@playwright/test";
import { launchOwnedBrowser } from "../../deploy/browser-runner.mjs";
import {
  tagTestData,
  createE2ERunId,
} from "../../packages/shared-sdk/dist-esm/e2e/index.js";
const asset = readFileSync(
  new URL("./public/performance-reference.js", import.meta.url),
  "utf8",
);
// Browser unit fixtures only. Original-AFM/native-API evidence is separate.
const reference = () => ({
  schema: "aviation/performance-reference@1",
  dataset_id: "perf_" + "a".repeat(64),
  content_sha256: "b".repeat(64),
  icao: "SR22",
  variant: 'Synthetic <img src=x onerror="window.injected=true">',
  configuration: "Synthetic cruise configuration",
  registration: null,
  table_id: "cruise",
  metric: "cruise_tas_kt",
  units: "kt TAS",
  value: 177,
  conditions: { weight_lb: 2900, rpm: 2500, isa_deviation_c: 0 },
  source: {
    document_id: "doc_" + "c".repeat(32),
    sha256: "d".repeat(64),
    revision: "Synthetic revision",
    pages: [173],
  },
  reviewer: "Synthetic source reviewer",
  reviewed_at: "2026-11-17T00:00:00Z",
  calculated_at: "2026-11-17T00:01:00Z",
  warnings: ["Synthetic research warning"],
  notes: ["Synthetic table restriction"],
  limitations: "Not aircraft or flight approval",
  approved_for_flight: false,
});

test("performance reference browser boundaries and cold navigation", async (t) => {
  const browser = await launchOwnedBrowser(chromium, { headless: true });
  t.after(() => browser.close());
  for (const [name, viewport] of [
    ["desktop", { width: 1280, height: 900 }],
    ["mobile", { width: 390, height: 844 }],
  ])
    await t.test(
      name + " preserves ownership, explicit conditions and cleanup",
      async (t) => {
        const page = await browser.newPage({ viewport });
        t.after(() => page.close());
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        t.after(() => assert.deepEqual(errors, []));
        await page.setContent(
          '<aviation-performance-reference apply-metrics="cruise_tas_kt"></aviation-performance-reference>',
        );
        // Property assigned before custom-element upgrade must survive loading order.
        await page.locator("aviation-performance-reference").evaluate((e) => {
          e.context = { weight_lb: 2900 };
          e.addEventListener("performance-reference-apply", (event) => {
            window.savedReference = event.detail;
          });
        });
        await page.addScriptTag({ content: asset });
        const widget = page.locator("aviation-performance-reference");
        await widget.evaluate((e) => {
          e.session = "f".repeat(64);
          e.popup = window;
          e.workspaceOrigin = "https://flight-planner.jordanhubbard.net";
          e.aircraft = { icao: "SR22", registration: "" };
        });
        async function send(change = {}) {
          await page.evaluate(
            ({ value, change }) =>
              window.dispatchEvent(
                new MessageEvent("message", {
                  source: change.foreign ? null : window,
                  origin:
                    change.origin || "https://flight-planner.jordanhubbard.net",
                  data: {
                    type: "aviation.performance.reference",
                    session: change.session || "f".repeat(64),
                    reference: { ...value, ...change.reference },
                  },
                }),
              ),
            { value: reference(), change },
          );
        }
        await send();
        await expect(widget.locator("output")).toHaveText("177 kt TAS");
        await send({ foreign: true, reference: { value: 999 } });
        await send({
          origin: "https://evil.invalid",
          reference: { value: 999 },
        });
        await send({ session: "0".repeat(64), reference: { value: 999 } });
        await expect(widget.locator("output")).toHaveText("177 kt TAS");
        assert.equal(
          await widget
            .getByRole("button", {
              name: "Use this research value in planning",
              exact: true,
            })
            .isDisabled(),
          true,
        );
        await widget
          .getByText("Enter known scenario conditions", { exact: true })
          .click();
        assert.equal(
          await widget
            .getByLabel("Known scenario rpm", { exact: true })
            .inputValue(),
          "",
        );
        await widget
          .getByLabel("Known scenario variant", { exact: true })
          .fill(reference().variant);
        await widget
          .getByLabel("Known scenario configuration", { exact: true })
          .fill(reference().configuration);
        await widget
          .getByLabel("Known scenario rpm", { exact: true })
          .fill("2500");
        await widget
          .getByLabel("Known scenario isa deviation c", { exact: true })
          .fill("0");
        await expect(
          widget.getByRole("button", {
            name: "Use this research value in planning",
            exact: true,
          }),
        ).toBeEnabled();
        await widget
          .getByRole("button", {
            name: "Use this research value in planning",
            exact: true,
          })
          .click();
        const saved = await page.evaluate(() => window.savedReference);
        assert.equal(saved.reference.value, 177);
        assert.ok(saved.operator_fields.includes("rpm"));
        assert.ok(!saved.operator_fields.includes("weight_lb"));
        assert.deepEqual(saved.reference.warnings, reference().warnings);
        assert.deepEqual(saved.reference.notes, reference().notes);
        assert.equal(await widget.locator("img").count(), 0);
        assert.equal(await page.evaluate(() => window.injected), undefined);
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
        );
        await widget.evaluate((e) => (e.context = { weight_lb: 3000 }));
        await expect(widget.locator("output")).toHaveCount(0);
        await send();
        await expect(widget.locator("output")).toHaveCount(0);
      },
    );
  await t.test(
    "Analyzer performance hash opens the actual performance workspace",
    async (t) => {
      const page = await browser.newPage();
      t.after(() => page.close());
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      t.after(() => assert.deepEqual(errors, []));
      const calls = [];
      const root = new URL(
          "../flight-track-analyzer/app/static/",
          import.meta.url,
        ),
        run = createE2ERunId(),
        tag = tagTestData(run, {});
      await page.route("https://meta-app.jordanhubbard.net/**", (route) =>
        route.fulfill({
          contentType: "text/javascript",
          body: route.request().url().endsWith("/performance-reference.js")
            ? asset
            : "",
        }),
      );
      await page.route("https://kmlab.jordanhubbard.net/**", (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path === "/api/explain/widget.js")
          return route.fulfill({
            contentType: "text/javascript",
            body: "window.AviationExplain={registerContext(){return ()=>{}}};",
          });
        if (path.startsWith("/api/")) {
          calls.push(path);
          let value;
          if (path === "/api/capabilities") value = { ...tag, llm: false };
          else if (path === "/api/aircraft")
            value = { ...tag, aircraft: [{ ...tag, tail: "E2E", flights: 1 }] };
          else if (path === "/api/performance")
            value = {
              ...tag,
              aircraft: [
                {
                  ...tag,
                  has_poh: false,
                  sections: {
                    takeoff: null,
                    takeoff_rolling: null,
                    landing: null,
                  },
                },
              ],
            };
          else if (path === "/api/aircraft/E2E/poh")
            value = { ...tag, takeoff: [], landing: [], weight_lb: null };
          else
            return route.fulfill({
              status: 404,
              json: { ...tag, error: "Unexpected fixture request" },
            });
          return route.fulfill({ json: value });
        }
        if (path === "/favicon.ico")
          return route.fulfill({ status: 204, body: "" });
        const name = path === "/" ? "index.html" : path.slice(1);
        if (
          ![
            "index.html",
            "app.js",
            "charts.js",
            "help.js",
            "style.css",
          ].includes(name)
        )
          return route.fulfill({ status: 404, body: "" });
        return route.fulfill({
          contentType: name.endsWith(".js")
            ? "text/javascript"
            : name.endsWith(".css")
              ? "text/css"
              : "text/html",
          body: readFileSync(new URL(name, root), "utf8"),
        });
      });
      await page.goto("https://kmlab.jordanhubbard.net/#/performance");
      await page
        .locator("aviation-performance-reference")
        .getByLabel("Reference ICAO type", { exact: true })
        .waitFor();
      await page
        .getByRole("heading", { name: "Performance", exact: true })
        .waitFor();
      assert.ok(calls.includes("/api/performance"));
      assert.ok(!calls.includes("/api/summary"));
    },
  );
});
