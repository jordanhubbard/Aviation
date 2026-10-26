# Python container base

### Requirement: Use the reviewed immutable Python base

Container generation SHALL use
`docker.io/library/python@sha256:cd04730b8511def3fbf14204d66a0c1536f290b8e896ed5a94cd64cb15ac1356`
as the Python base image. The `3.11-alpine` tag is an upgrade-discovery hint only and
SHALL NOT appear as `FROM` authority without the digest.

#### Scenario: Dockerfile consumes the exact base

- **WHEN** this Flavor satisfies the Docker deployment's `deploy.container-base`
  requirement
- **THEN** every applicable `FROM` instruction uses the complete digest-qualified
  reference and the source SBOM records the digest as an exact version
