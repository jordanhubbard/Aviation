# Docker container image deployment

### Requirement: Assemble the image from selected packages, scripts, and parent containers

The generated container definition SHALL be assembled from exactly three contribution
sources: the runtime-install actions of the selected packaging Flavors (for example pip
installs or apt packages), the Component's declared entrypoints and their invoked
scripts, and the ordered closure of parent container Flavors. Each source SHALL appear
in the generated `Dockerfile`; no dependency, file, or script may enter the image
except through one of these sources.

#### Scenario: Packages and scripts are consumed

- **WHEN** a Component with selected packaging Flavors and declared entrypoints is
  generated with this Flavor
- **THEN** the generated `Dockerfile` installs exactly those packages and copies or
  invokes exactly the declared entrypoint scripts, each traceable to its selecting
  Flavor or Component declaration

### Requirement: Inherit base images through the Flavor graph

A Docker deployment SHALL select its base containers exclusively through typed
capability composition. The Docker Flavor requires `deploy.container-base`, and every
providing Flavor in the resolved closure — including Flavors inherited from repository
parents — contributes an immutable OCI image reference. Generated `FROM` instructions
SHALL use those digest-qualified references in DAG order, with the root of the closure
as the first (base-most) image. A tag-only reference or a base image outside this
closure SHALL fail validation.

#### Scenario: Derived container chains its parents

- **WHEN** a project selects a Docker deployment whose requirement resolves to two
  container-base Flavors inherited through the lineage DAG
- **THEN** the generated `Dockerfile` contains one `FROM` chain whose order matches the
  resolved DAG order and every `FROM` uses the exact digest supplied by one selected
  Flavor

### Requirement: Detect the container toolchain before use

Container construction SHALL detect a usable Docker-compatible builder on PATH and
bind its version before any build step. When unavailable, deployment stops with a
concrete host prerequisite; no tool is installed without separate authorization.

#### Scenario: Builder is unavailable

- **WHEN** no Docker-compatible builder can be resolved on the host
- **THEN** the deployment phase fails closed before executing any build command

### Requirement: Build locally; never publish without authorization

Image verification SHALL inspect built layers, labels binding the Component lock and
recipe identities, and the declared entrypoints against the exact plan. Publishing
(push) SHALL occur only through an explicitly authorized release step and never during
generation, build, or ordinary test gates.

#### Scenario: Publish attempted outside release authorization

- **WHEN** an image push is requested outside the authorized release workflow
- **THEN** the action is refused and no registry credentials are read
