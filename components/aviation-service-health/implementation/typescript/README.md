# `@aviation/service-health`

This package is the Component-owned TypeScript qualification candidate for
`aviation.service.health`. It is built and tested independently from the retained
shared SDK against the Component's verifier-owned `acceptance/vectors.json`.

The retained `@aviation/shared-sdk` implementation remains the application-facing and
release-authoritative realization until regenerative qualification and consumer parity
permit the compatibility export to delegate here. Do not remove or bypass that boundary
based only on these package tests.

Run the independent gate with:

```sh
pnpm install --frozen-lockfile --ignore-workspace
pnpm run build
pnpm run test
```
