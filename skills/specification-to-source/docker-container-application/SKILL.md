---
name: "docker-container-application"
description: "Docker container image assembly from selected packaging Flavors, declared entrypoints, and parent-container Flavor closure. Use for Literate AI workflow tasks."
metadata:
  author: "Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>"
schema: "urn:literate-ai:schema:v1:specification-to-source-skill"
skill_id: "docker-container-application"
version: "1.0.0"
title: "Docker container image assembly"
stages:
  - "generate"
dependencies: []
limitations:
  - "Every Dockerfile input must be traceable to a selected packaging Flavor, a Component-declared entrypoint or script, or a parent container Flavor; do not introduce undeclared base images, packages, or files."
  - "Every external base image must come from a selected deploy.container-base provider and use its complete digest-qualified OCI reference; mutable or tag-only FROM references are forbidden."
  - "Do not push, tag remotely, or read registry credentials during generation, build, or test gates; publishing belongs to an explicitly authorized release step only."
  - "Do not run the container application as root in the generated image when the Component specification does not require elevated privileges."
  - "Do not treat this skill's build-system preferences as authority over an explicit Component specification or selected Flavor requirement."
trust: "repository-reviewed"
---
# Docker container image assembly

Assemble the generated `Dockerfile` from exactly three contribution sources, in this
order of authority: explicit Component specifications, selected Flavor requirements,
then this skill's preferences below them.

## Inputs

1. **Parent containers (base layers).** Resolve the `deploy.container-base`
   capability closure. Every providing container Flavor — including Flavors inherited
   through the repository lineage DAG — contributes exactly one immutable OCI image
   reference. Emit `FROM` instructions using those complete digest-qualified
   references in resolved DAG order, root closure first. A tag is only a human-readable
   upgrade hint and is never build authority. If no base provider resolves, stop with a
   concrete missing-capability diagnostic; never invent or look up an ambient image.
2. **Packages.** For each selected packaging Flavor (`package-pip`, `package-apt`,
   `package-brew`, `package-winget`, `package-chocolatey`, `package-conan`), emit its
   runtime-install actions inside the appropriate layer: pip requirements install for
   Python wheels, apt-get install for Debian packages, and equivalent actions per
   packaging target. Never fetch packages outside these declared actions.
3. **Entrypoints and scripts.** Copy only files invoked by the Component's declared
   entrypoints from the built artifact closure into the image, and declare each
   entrypoint so `docker run` reaches it directly.

## Construction rules

- Bind identity: label the image with the exact Component lock identity and recipe
  identity supplied by the generation context.
- Record each selected base in the pre-build CycloneDX SBOM with its digest as the
  exact `version`; do not represent a selected base as an unresolved `versionRange`.
- One concern per layer in dependency-safe order: base chain, OS packages, language
  packages, artifact copy, entrypoint declaration.
- Run as a non-root user unless the specification explicitly requires elevation.
- Detect the builder before use; if no Docker-compatible builder resolves on PATH,
  stop with a concrete host prerequisite instead of improvising.
- Verify locally by building the image and running the Component acceptance contract
  inside it before any deployment gate consumes the result.
