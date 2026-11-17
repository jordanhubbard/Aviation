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
