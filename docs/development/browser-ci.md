# Browser CI runner compatibility

The Monorepo CI/CD `build-check` job and Common Aviation SDK `typescript` job
install the Chromium revision selected by the committed pnpm lock. Run those jobs
on `ubuntu-24.04`. The locked Playwright 1.59.1 rejects Chromium installation on
Ubuntu 26.04, so `ubuntu-latest` is not a stable carrier for these browser gates.
The observed installation failure is tracked in
[#510](https://github.com/jordanhubbard/Aviation/issues/510).

Before changing the runner label or Playwright lock, verify the actual managed
Chromium installation and browser acceptance on the proposed image. Preserve the
frozen dependency graph, lifecycle cleanup, and complete browser tests. An
unsupported-platform override or a skipped browser gate does not establish
compatibility. Application container targets and jobs without managed Chromium
remain governed by their own declared configuration.


## Frontend unit-test worker bound (#605)

Flight Planner runs its complete Vitest/JSDOM suite with at most two workers.
Retained qualification on a 12-CPU Mac observed seven existing tests exceeding
Vitest's five-second timeout with host-default parallelism, 130.59 seconds of
aggregate imports and 75.70 seconds of aggregate environment startup. CPU/import
contention is the working diagnosis, not evidence of a product startup failure.
Keep all test cases, assertions and default timeouts; do not mask contention with
retries or longer test deadlines. Run the full retained gate without another
backend suite competing on the same worker, and preserve any failed run. Browser
lifecycle cleanup and shutdown deadlines remain independently required.

## Owned Chromium startup target (#607)

An owned Chromium server must retain an isolated default-context `about:blank`
target until server shutdown. Create it through the public browser CDP session
during connection, before returning the client, then detach that session. Client
contexts remain independent. This keeps the owner's last target alive when the
client closes its contexts; native qualification must observe process exit code
zero within the existing five-second shutdown bound.

Target preparation is bounded by five seconds within the existing connection
deadline. Missing target identity, session errors and preparation timeouts fail
startup and clean up that owned launch. Other browser types skip this Chromium
operation. Preserve concurrent-close sharing, signal cleanup, loopback ownership,
and bounded owned-process recovery. Forced recovery remains a distinct outcome
and never proves graceful shutdown. Qualify closed-page, open-page, concurrent
close and injected-stall cases on the supported browser carriers.
