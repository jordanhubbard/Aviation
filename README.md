# Aviation

Aviation is a monorepo of flight planning, tracking, weather, training, and
analysis applications. It is being adopted into Literate AI while the existing
applications remain under
[`components/legacy-project-wrapper/implementation`](components/legacy-project-wrapper/implementation/README.md).

The root `apps/`, `packages/`, package manifests, and Makefile point to that
retained workspace so existing developer and CI commands continue to work.
Run `make build` or `make test` for the retained workspace, or inspect its
Literate AI state with `litai status`. The root [project guide](docs/README.md)
tracks the adoption; the [existing Aviation documentation](components/legacy-project-wrapper/implementation/docs/)
covers the applications and their APIs.
The [deployment guide](components/legacy-project-wrapper/implementation/deploy/README.md)
describes the per-app systemd/Caddy services, DNS names, and `make deploy-*`
commands for the hosted instance.

The applications are educational tools and are not approved for real flight
operations. See [LEGAL.md](LEGAL.md).

<!-- literate-ai:parent-repositories -->
- Parent repository: [github.com/jordanhubbard/literate-ai](<https://github.com/jordanhubbard/literate-ai>)
<!-- /literate-ai:parent-repositories -->
