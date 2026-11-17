/** Built shipped UI and real cached FAA source; no provider interception. */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import { launchOwnedBrowser } from "../../../../deploy/browser-runner.mjs";
const [application, suppliedAirport, destination] = process.argv.slice(2);
if (
  !application ||
  !suppliedAirport ||
  !destination ||
  !path.isAbsolute(destination)
)
  throw new Error(
    "Usage: node e2e/navigation-acceptance.mjs <application-origin> <published-airport> <absolute-evidence-directory>",
  );
const origin = new URL(application);
if (
  !["http:", "https:"].includes(origin.protocol) ||
  origin.username ||
  origin.password ||
  origin.search ||
  origin.hash ||
  origin.pathname !== "/"
)
  throw new Error(
    "Use an application origin without credentials, query or base path",
  );
const airport = suppliedAirport.toUpperCase();
assert.match(airport, /^[A-Z0-9]{3,4}$/);
const base = origin.origin,
  out = pathToFileURL(path.resolve(destination) + path.sep);
mkdirSync(out, { recursive: true, mode: 0o700 });
const deadline = Date.now() + 20000;
while (true) {
  try {
    const r = await fetch(base + "/api/health", {
      signal: AbortSignal.timeout(2000),
    });
    if (r.ok) break;
  } catch {}
  if (Date.now() > deadline)
    throw new Error("Packaged backend did not become ready");
  await new Promise((resolve) => setTimeout(resolve, 200));
}
const browser = await launchOwnedBrowser(chromium, { headless: true });
const results = [];
try {
  for (const [name, viewport] of [
    ["desktop", { width: 1440, height: 1000 }],
    ["mobile", { width: 390, height: 844 }],
  ]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    const errors = [],
      requests = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("requestfailed", (r) =>
      errors.push(r.failure()?.errorText + ": " + r.url()),
    );
    page.on("response", (r) => {
      if (r.status() >= 400) errors.push("HTTP " + r.status() + ": " + r.url());
    });
    page.on("request", (r) => {
      if (new URL(r.url()).pathname.startsWith("/api/navigation"))
        requests.push(r.url());
    });
    try {
      await page.goto(base + "/", { waitUntil: "networkidle" });
      await page
        .getByRole("link", { name: "FAA procedures and charts", exact: true })
        .click();
      await page
        .getByRole("heading", {
          name: "FAA procedures and navigation cycles",
          exact: true,
        })
        .waitFor();
      assert.equal(requests.length, 0);
      await page.getByLabel("Published airport identifier").fill(airport);
      const pending = page.waitForResponse(
        (r) => new URL(r.url()).pathname === "/api/navigation/" + airport,
      );
      await page
        .getByRole("button", { name: "Load procedures", exact: true })
        .click();
      const response = await pending;
      assert.equal(response.status(), 200);
      const value = await response.json();
      assert.equal(value.airport, airport);
      assert.ok(
        typeof value.source.cycle === "string" && value.source.cycle.length > 0,
      );
      assert.equal(value.source.freshness, "current");
      assert.equal(value.source.verification_state, "verified");
      assert.equal(value.procedures.length, 20);
      assert.ok(value.total > 20);
      await page
        .getByRole("heading", {
          name: airport + " · FAA cycle " + value.source.cycle,
          exact: true,
        })
        .waitFor();
      assert.ok(
        (await page
          .getByRole("cell", { name: "Unknown", exact: true })
          .count()) > 0,
      );
      const first = page.locator("article").first();
      await first
        .locator("summary", { hasText: "Original ARINC records and fields" })
        .click();
      assert.equal(
        await first.locator("pre").first().textContent(),
        value.procedures[0].provider.records[0].raw,
      );
      await first
        .locator("summary", { hasText: "Original ARINC records and fields" })
        .click();
      if (name === "mobile") {
        const table = first.locator(".procedure-table");
        assert.equal(
          await table.evaluate((e) => e.scrollWidth > e.clientWidth),
          true,
        );
        await table.evaluate((e) => (e.scrollLeft = 200));
        assert.ok((await table.evaluate((e) => e.scrollLeft)) > 0);
        await table.evaluate((e) => (e.scrollLeft = 0));
      }
      const link = page.getByRole("link", {
        name: "Open FAA charts and airport diagrams",
        exact: true,
      });
      assert.equal(
        await link.getAttribute("href"),
        "https://flight-planner.jordanhubbard.net/charts?airport=" + airport,
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
        false,
      );
      assert.doesNotMatch(
        await page.locator("body").innerText(),
        /\bNaN\b|\bInfinity\b/,
      );
      await page.screenshot({
        path: new URL(name + ".png", out).pathname,
        fullPage: true,
      });
      writeFileSync(
        new URL(name + ".yml", out),
        await page.locator("body").ariaSnapshot(),
      );
      const count = requests.length;
      await page.waitForTimeout(1500);
      assert.equal(requests.length, count, "no automatic polling");
      await page
        .getByRole("button", { name: "Next procedure page", exact: true })
        .click();
      await page
        .getByText(value.total + " procedure/transition groups · page 2", {
          exact: true,
        })
        .waitFor();
      const beforeChange = requests.length;
      await page.getByLabel("Published airport identifier").fill("BAD!");
      assert.equal(
        await page
          .getByRole("heading", {
            name: airport + " · FAA cycle " + value.source.cycle,
            exact: true,
          })
          .count(),
        0,
      );
      assert.equal(requests.length, beforeChange);
      await page
        .getByRole("button", { name: "Load procedures", exact: true })
        .click();
      await page.getByRole("alert").waitFor();
      assert.equal(requests.length, beforeChange);
      assert.deepEqual(errors, []);
      results.push({
        viewport: name,
        shipped_dashboard_link: true,
        actual_faa_cycle: value.source.cycle,
        total_groups: value.total,
        page_groups: value.procedures.length,
        raw_source_identity: true,
        unknowns_preserved: true,
        explicit_pagination: true,
        invalid_input_clears_coverage_without_fetch: true,
        no_polling: true,
        no_overflow: true,
        errors,
      });
    } finally {
      await context.close();
    }
  }
  writeFileSync(
    new URL("acceptance.json", out),
    JSON.stringify(
      {
        status: "PASS",
        origin: base,
        airport,
        provider_intercepts: 0,
        results,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ status: "PASS", results }));
} finally {
  await browser.close();
}
