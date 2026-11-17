(() => {
  "use strict";
  const origins = new Set([
    "https://flight-planner.jordanhubbard.net",
    "https://preflight-check.jordanhubbard.net",
    "https://kmlab.jordanhubbard.net",
  ]);
  const units = {
    takeoff_ground_roll_ft: "ft",
    takeoff_over_50ft_ft: "ft",
    landing_ground_roll_ft: "ft",
    landing_over_50ft_ft: "ft",
    climb_rate_fpm: "ft/min",
    climb_time_min: "min",
    climb_fuel_gal: "US gal",
    climb_distance_nm: "NM",
    cruise_tas_kt: "kt TAS",
    cruise_fuel_flow_gph: "US gal/h",
    endurance_hours: "h",
    range_nm: "NM",
  };
  const text = (v, n = 200) =>
    typeof v === "string" && v.trim().length > 0 && v.length <= n;
  const record = (v) =>
    v !== null &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    Object.getPrototypeOf(v) === Object.prototype;
  const hex = (v) => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
  const date = (v) =>
    typeof v === "string" &&
    /^\d{4}-\d\d-\d\dT.*(?:Z|\+00:00)$/.test(v) &&
    Number.isFinite(Date.parse(v));
  function allowedOrigin(origin, self) {
    if (origins.has(origin)) return true;
    try {
      const a = new URL(origin),
        b = new URL(self);
      return (
        ["127.0.0.1", "[::1]", "localhost"].includes(a.hostname) &&
        ["127.0.0.1", "[::1]", "localhost"].includes(b.hostname) &&
        a.protocol === "http:" &&
        b.protocol === "http:" &&
        a.origin === origin
      );
    } catch {
      return false;
    }
  }
  function cleanConditions(value) {
    if (!record(value) || Object.keys(value).length > 32)
      throw new Error("Invalid reference conditions.");
    const clean = {};
    for (const [k, v] of Object.entries(value)) {
      if (
        !/^[a-z][a-z0-9_]{0,63}$/.test(k) ||
        !(text(v) || (typeof v === "number" && Number.isFinite(v)))
      )
        throw new Error("Invalid reference condition.");
      clean[k] = v;
    }
    return clean;
  }
  function messages(value) {
    if (value === undefined) return [];
    if (
      !Array.isArray(value) ||
      value.length > 20 ||
      value.some((item) => typeof item !== "string" || item.length > 2000)
    )
      throw new Error("Invalid reference warnings or notes.");
    return [...value];
  }
  function validate(value) {
    if (
      !record(value) ||
      JSON.stringify(value).length > 64000 ||
      value.schema !== "aviation/performance-reference@1" ||
      !(
        typeof value.dataset_id === "string" &&
        /^perf_[a-f0-9]{64}$/.test(value.dataset_id)
      ) ||
      !hex(value.content_sha256) ||
      !(typeof value.icao === "string" && /^[A-Z0-9]{2,4}$/.test(value.icao)) ||
      !text(value.variant) ||
      !text(value.configuration, 2000) ||
      !text(value.table_id, 80) ||
      !text(value.metric, 64) ||
      !Object.hasOwn(units, value.metric) ||
      units[value.metric] !== value.units ||
      typeof value.value !== "number" ||
      !Number.isFinite(value.value) ||
      value.value < 0 ||
      value.approved_for_flight !== false ||
      !text(value.reviewer) ||
      !date(value.reviewed_at) ||
      !date(value.calculated_at)
    )
      throw new Error("Invalid sourced reference.");
    if (
      value.registration !== null &&
      !(
        typeof value.registration === "string" &&
        /^[A-Z0-9-]{1,16}$/.test(value.registration)
      )
    )
      throw new Error("Invalid reference registration.");
    const source = value.source;
    if (
      !record(source) ||
      !(
        typeof source.document_id === "string" &&
        /^doc_[a-f0-9]{32}$/.test(source.document_id)
      ) ||
      !hex(source.sha256) ||
      !text(source.revision) ||
      !Array.isArray(source.pages) ||
      source.pages.length < 1 ||
      source.pages.length > 100 ||
      source.pages.some((v) => !Number.isInteger(v) || v < 1 || v > 10000)
    )
      throw new Error("Invalid reference source.");
    return {
      warnings: messages(value.warnings),
      notes: messages(value.notes),
      limitations:
        value.limitations === undefined
          ? "Research reference; not aircraft or flight approval."
          : text(value.limitations, 2000)
            ? value.limitations
            : (() => {
                throw new Error("Invalid reference limitations.");
              })(),
      schema: value.schema,
      dataset_id: value.dataset_id,
      content_sha256: value.content_sha256,
      icao: value.icao,
      variant: value.variant,
      configuration: value.configuration,
      registration: value.registration,
      table_id: value.table_id,
      metric: value.metric,
      units: value.units,
      value: value.value,
      conditions: cleanConditions(value.conditions),
      source: {
        document_id: source.document_id,
        sha256: source.sha256,
        revision: source.revision,
        pages: [...new Set(source.pages)].sort((a, b) => a - b),
      },
      reviewer: value.reviewer,
      reviewed_at: value.reviewed_at,
      calculated_at: value.calculated_at,
      approved_for_flight: false,
    };
  }
  function snapshot(result, dataset) {
    if (
      !dataset ||
      dataset.state !== "reviewed" ||
      !dataset.usable ||
      result.dataset_id !== dataset.id ||
      result.content_sha256 !== dataset.content_sha256 ||
      result.source.sha256 !== dataset.content.source_sha256 ||
      result.source.document_id !== dataset.content.source_document_id
    )
      throw new Error("The current source does not match this calculation.");
    const table = dataset.content.tables.find((t) => t.id === result.table_id);
    if (
      !table ||
      table.metric !== result.metric ||
      result.variant !== dataset.content.variant ||
      result.configuration !== dataset.content.configuration ||
      result.source.revision !== dataset.content.source_revision
    )
      throw new Error("The current table does not match this calculation.");
    const citations = [
      ...(result.contributions || []).flatMap((v) => v.citations || []),
      ...(result.corrections || []).flatMap((v) => v.rule?.citations || []),
      ...(result.interpolation_citations || []),
      ...(result.combination_citations || []),
    ];
    return validate({
      warnings: result.warnings,
      notes: result.notes,
      limitations: result.limitations,
      schema: "aviation/performance-reference@1",
      dataset_id: result.dataset_id,
      content_sha256: result.content_sha256,
      icao: dataset.content.icao,
      variant: result.variant,
      configuration: result.configuration,
      registration: result.registration,
      table_id: result.table_id,
      metric: result.metric,
      units: result.units,
      value: result.value,
      conditions: result.conditions,
      source: {
        document_id: result.source.document_id,
        sha256: result.source.sha256,
        revision: result.source.revision,
        pages: citations.map((v) => v.page),
      },
      reviewer: result.reviewer,
      reviewed_at: result.reviewed_at,
      calculated_at: result.calculated_at,
      approved_for_flight: result.approved_for_flight,
    });
  }
  function descriptor(href, hasOpener) {
    try {
      const u = new URL(href),
        v = JSON.parse(
          new URLSearchParams(u.hash.slice(1)).get("performance-handoff") ||
            "null",
        );
      if (
        !hasOpener ||
        !record(v) ||
        !/^[a-f0-9]{64}$/.test(v.session) ||
        !allowedOrigin(v.origin, u.origin)
      )
        return null;
      return { origin: v.origin, session: v.session };
    } catch {
      return null;
    }
  }
  function compare(reference, context = {}) {
    const missing = [],
      mismatched = [];
    for (const [k, v] of Object.entries({
      icao: reference.icao,
      variant: reference.variant,
      configuration: reference.configuration,
      ...(reference.registration
        ? { registration: reference.registration }
        : {}),
    }).concat(Object.entries(reference.conditions))) {
      const actual = Object.hasOwn(context, k) ? context[k] : undefined;
      if (
        actual === undefined ||
        actual === null ||
        actual === "" ||
        (typeof actual === "string" &&
          /^(?:unknown|unavailable|unspecified|not known|not provided|not specified|not independently verified)(?:\b|$)/i.test(
            actual.trim(),
          ))
      )
        missing.push(k);
      else if (actual !== v) mismatched.push(k);
    }
    if (
      context.observed_start_style === "rolling" &&
      reference.conditions.start_style !== "rolling"
    )
      mismatched.push("start_style");
    return {
      matched: missing.length === 0 && mismatched.length === 0,
      missing,
      mismatched,
    };
  }
  globalThis.AviationPerformanceReference = {
    validate,
    snapshot,
    descriptor,
    allowedOrigin,
    compare,
  };
  if (
    typeof customElements === "undefined" ||
    customElements.get("aviation-performance-reference")
  )
    return;
  const el = (tag, value) =>
    Object.assign(document.createElement(tag), { textContent: value });
  class PerformanceReference extends HTMLElement {
    static observedAttributes = ["registration"];
    constructor() {
      super();
      const pendingContext = Object.hasOwn(this, "context") ? this.context : {};
      delete this.context;
      this.attachShadow({ mode: "open" });
      this.currentContext = pendingContext || {};
      this.message = (event) => this.receive(event);
    }
    connectedCallback() {
      if (this.ready) {
        window.addEventListener("message", this.message);
        return;
      }
      this.ready = true;
      this.shadowRoot.innerHTML = `<style>:host{display:block;font:inherit;margin:1rem 0}section{padding:1rem;border:1px solid #888;border-radius:6px;background:Canvas;color:CanvasText}label{display:block;margin:.6rem 0}input,button{font:inherit;max-width:100%;box-sizing:border-box;padding:.6rem}button{cursor:pointer;margin:.3rem .4rem .3rem 0;background:#183e63;color:white;border:1px solid #183e63;border-radius:4px}button:disabled{opacity:.5;cursor:default}input{color:CanvasText;background:Canvas;border:1px solid #888;border-radius:4px}summary{cursor:pointer}h3{margin-top:0}p,dd{overflow-wrap:anywhere}dt{font-weight:bold}dd{margin:0 0 .6rem}output{font-size:1.4em;font-weight:bold}.warning{border-left:3px solid #b76800;padding:.6rem}</style><section><h3>Sourced performance reference</h3><p>Select and calculate from a reviewed original manual in the private workspace. Returned figures stay in memory; they do not establish aircraft applicability or flight approval.</p><label>Reference ICAO type <input class="icao" maxlength="4" autocomplete="off"></label><label>Reference registration <input class="registration" maxlength="16" autocomplete="off"></label><button type="button" class="open">Select reviewed reference</button><button type="button" class="clear">Clear reference</button><p class="status" role="status"></p><div class="result"></div></section>`;
      this.q(".registration").value = this.getAttribute("registration") || "";
      this.q(".registration").readOnly = this.hasAttribute("registration");
      this.q(".open").onclick = () => this.open();
      this.q(".clear").onclick = () => this.clear("Reference cleared.");
      for (const input of this.shadowRoot.querySelectorAll("input"))
        input.oninput = () =>
          this.clear("Aircraft changed; select a new reference.");
      window.addEventListener("message", this.message);
    }
    disconnectedCallback() {
      window.removeEventListener("message", this.message);
      this.clear("Reference cleared when this workspace closed.");
    }
    attributeChangedCallback() {
      if (!this.ready) return;
      this.q(".registration").value = this.getAttribute("registration") || "";
      this.q(".registration").readOnly = this.hasAttribute("registration");
      this.clear("Aircraft changed; select a new reference.");
    }
    q(s) {
      return this.shadowRoot.querySelector(s);
    }
    set context(value) {
      const next = JSON.parse(JSON.stringify(value || {}));
      if (JSON.stringify(next) === JSON.stringify(this.currentContext)) return;
      this.currentContext = next;
      if (this.ready)
        this.clear("Application inputs changed; select a new reference.");
    }
    get context() {
      return this.currentContext;
    }
    clear(message = "") {
      this.session = null;
      this.reference = null;
      this.operatorContext = {};
      this.removeAttribute("data-aviation-private");
      if (this.ready) {
        this.q(".result").replaceChildren();
        this.q(".status").textContent = message;
      }
      this.dispatchEvent(
        new CustomEvent("performance-reference-cleared", {
          bubbles: true,
          composed: true,
        }),
      );
    }
    open() {
      this.clear();
      const icao = this.q(".icao").value.trim().toUpperCase(),
        registration = this.q(".registration").value.trim().toUpperCase();
      if (
        !/^[A-Z0-9]{2,4}$/.test(icao) ||
        (registration && !/^[A-Z0-9-]{1,16}$/.test(registration))
      ) {
        this.q(".status").textContent =
          "Enter an ICAO type and a valid optional registration.";
        return;
      }
      let target = new URL(
        "https://flight-planner.jordanhubbard.net/aircraft-performance",
      );
      const override = this.getAttribute("workspace");
      if (override) {
        const local = new URL(override, location.href);
        if (
          !allowedOrigin(local.origin, location.origin) ||
          !["127.0.0.1", "localhost", "[::1]"].includes(location.hostname) ||
          !["127.0.0.1", "localhost", "[::1]"].includes(local.hostname) ||
          local.pathname !== "/aircraft-performance"
        ) {
          this.q(".status").textContent = "Invalid local workspace override.";
          return;
        }
        target = local;
      }
      if (!allowedOrigin(location.origin, target.origin)) {
        this.q(".status").textContent =
          "Reference handoff is unavailable for this application origin.";
        return;
      }
      this.session = [...crypto.getRandomValues(new Uint8Array(32))]
        .map((v) => v.toString(16).padStart(2, "0"))
        .join("");
      this.workspaceOrigin = target.origin;
      this.aircraft = { icao, registration };
      target.hash = new URLSearchParams({
        "performance-handoff": JSON.stringify({
          origin: location.origin,
          session: this.session,
        }),
      }).toString();
      this.popup = window.open(target.href, "_blank");
      if (!this.popup) {
        this.clear(
          "Allow the workspace window, then select the reference again.",
        );
        return;
      }
      this.q(".status").textContent =
        "Authenticate in the workspace, calculate and explicitly return the reference.";
    }
    receive(event) {
      const data = event.data;
      if (
        !this.session ||
        event.source !== this.popup ||
        event.origin !== this.workspaceOrigin ||
        !record(data) ||
        data.session !== this.session
      )
        return;
      if (data.type === "aviation.performance.ready") {
        this.popup.postMessage(
          {
            type: "aviation.performance.context",
            session: this.session,
            ...this.aircraft,
          },
          this.workspaceOrigin,
        );
        return;
      }
      if (data.type !== "aviation.performance.reference") return;
      try {
        const reference = validate(data.reference);
        if (
          reference.icao !== this.aircraft.icao ||
          (this.aircraft.registration &&
            reference.registration !== this.aircraft.registration)
        )
          throw new Error("Returned aircraft does not match this selection.");
        this.operatorContext = {};
        this.reference = reference;
        this.setAttribute("data-aviation-private", "true");
        this.renderReference();
        this.dispatchEvent(
          new CustomEvent("performance-reference-selected", {
            detail: reference,
            bubbles: true,
            composed: true,
          }),
        );
      } catch {
        this.clear(
          "The returned reference was invalid or did not match this aircraft.",
        );
      }
    }
    comparisonContext() {
      const r = this.reference;
      const phase = r.metric.startsWith("takeoff_")
        ? "takeoff"
        : r.metric.startsWith("landing_")
          ? "landing"
          : null;
      const phaseWeight = phase && this.currentContext[phase + "_weight_lb"];
      return {
        ...this.operatorContext,
        ...this.currentContext,
        ...(typeof phaseWeight === "number" ? { weight_lb: phaseWeight } : {}),
        icao: this.aircraft.icao,
        ...(this.aircraft.registration
          ? { registration: this.aircraft.registration }
          : {}),
      };
    }
    updateComparison() {
      const r = this.reference,
        context = this.comparisonContext(),
        match = compare(r, context),
        entered = Object.keys(this.operatorContext || {});
      this.q(".comparison").textContent = match.matched
        ? "All supplied scenario conditions match this reference."
        : `Scenario incomplete or different. Missing: ${match.missing.join(", ") || "none"}. Different: ${match.mismatched.join(", ") || "none"}.`;
      this.q(".assertions").textContent = entered.length
        ? "Operator-entered scenario conditions (not measured): " +
          entered.join(", ") +
          "."
        : "";
      const measured = context["measured_" + r.metric];
      const uncertainty = context["measured_uncertainty_" + r.metric];
      this.q(".measured").textContent =
        match.matched &&
        Number.isFinite(measured) &&
        measured >= 0 &&
        r.value > 0
          ? `Observed ${Number(measured.toPrecision(3))} ${r.units}; source ${r.value} ${r.units}; difference ${Number(((measured / r.value - 1) * 100).toFixed(1))}%; measurement uncertainty ${Number.isFinite(uncertainty) && uncertainty >= 0 ? "±" + Number(uncertainty.toPrecision(3)) + " " + r.units : "unavailable"}. Research comparison includes the explicitly entered scenario conditions and does not establish aircraft performance approval.`
          : "No matched measured-performance comparison is available for this scenario.";
      const apply = this.q(".apply");
      if (apply) apply.disabled = !match.matched;
    }
    renderReference() {
      const r = this.reference,
        host = this.q(".result");
      host.replaceChildren();
      this.q(".status").textContent =
        "Calculation-time reference received; no background source refresh.";
      host.append(
        el("output", `${Number(r.value.toPrecision(12))} ${r.units}`),
        el(
          "p",
          `${r.metric.replaceAll("_", " ")} · ${r.icao} · ${r.variant} · ${r.configuration}`,
        ),
      );
      const limits = el("p", r.limitations);
      limits.className = "warning";
      host.append(limits);
      for (const message of [...r.warnings, ...r.notes])
        host.append(el("p", message));
      const status = el("p", "");
      status.className = "comparison warning";
      host.append(status);
      const assertions = el("p", "");
      assertions.className = "assertions";
      host.append(assertions);
      const measured = el("p", "");
      measured.className = "measured";
      host.append(measured);
      const list = document.createElement("dl");
      for (const [k, v] of Object.entries(r.conditions))
        list.append(el("dt", k.replaceAll("_", " ")), el("dd", String(v)));
      host.append(list);
      const missing = compare(r, this.comparisonContext()).missing;
      if (missing.length) {
        const editor = document.createElement("details");
        editor.append(el("summary", "Enter known scenario conditions"));
        editor.append(
          el(
            "p",
            "Leave unknown conditions blank. These entries are your own assertions; they do not become measured flight data or alter the source. Known application conditions cannot be overridden here.",
          ),
        );
        const expected = {
          icao: r.icao,
          variant: r.variant,
          configuration: r.configuration,
          registration: r.registration,
          ...r.conditions,
        };
        for (const key of missing) {
          const label = el(
              "label",
              "Known scenario " + key.replaceAll("_", " "),
            ),
            input = document.createElement("input");
          input.type = typeof expected[key] === "number" ? "number" : "text";
          input.step = "any";
          input.maxLength = 2000;
          input.addEventListener("input", () => {
            const raw = input.value.trim();
            if (
              !raw ||
              (input.type === "number" && !Number.isFinite(input.valueAsNumber))
            )
              delete this.operatorContext[key];
            else
              this.operatorContext[key] =
                input.type === "number" ? input.valueAsNumber : raw;
            this.updateComparison();
          });
          label.append(input);
          editor.append(label);
        }
        host.append(editor);
      }
      const provenance = document.createElement("details");
      provenance.append(el("summary", "Source provenance and review"));
      provenance.append(
        el(
          "p",
          `Original ${r.source.document_id} · SHA-256 ${r.source.sha256} · revision ${r.source.revision} · physical pages ${r.source.pages.join(", ")}`,
        ),
        el("p", `Dataset ${r.dataset_id} · content ${r.content_sha256}`),
        el(
          "p",
          `Review ${r.reviewer} at ${r.reviewed_at}. Calculated ${r.calculated_at}.`,
        ),
      );
      host.append(provenance);
      const applyMetrics = (this.getAttribute("apply-metrics") || "").split(
        " ",
      );
      if (applyMetrics.includes(r.metric)) {
        const apply = el("button", "Use this research value in planning");
        apply.type = "button";
        apply.className = "apply";
        apply.onclick = () => {
          if (compare(r, this.comparisonContext()).matched)
            this.dispatchEvent(
              new CustomEvent("performance-reference-apply", {
                detail: {
                  reference: r,
                  operator_fields: Object.keys(this.operatorContext || {}),
                },
                bubbles: true,
                composed: true,
              }),
            );
        };
        host.append(
          apply,
          el(
            "p",
            "Check applicability yourself. Applying sends this number through the normal planning workflow; private source details stay here. Complete the scenario conditions before applying.",
          ),
        );
      }
      this.updateComparison();
    }
  }
  customElements.define("aviation-performance-reference", PerformanceReference);
})();
