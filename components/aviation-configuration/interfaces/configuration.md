# `aviation.configuration` interface

## Service definition

- `id`: required lowercase slug.
- `name` and `description`: required trimmed text.
- `category`: `weather`, `navigation`, `auth`, `monitoring`, `streaming`, or
  `database`.
- `docsUrl`: optional trimmed HTTPS URL.
- `fields`: one or more field definitions with a unique lowercase snake-case `key`,
  required label/description, `required` and `secret` booleans, and a unique uppercase
  environment-variable name.
- `appScope`: one or more unique lowercase application slugs; `all` declares a global
  service.

Python exposes idiomatic snake-case fields while preserving the same portable values.

## Operations

- `normalizeServiceDefinition(input)`: validate and canonicalize without mutating the
  input.
- `normalizeServiceCatalog(input)`: normalize a catalog and reject duplicate service
  IDs or environment-variable ownership.
- `getServicesByApp(appId, catalog?)`: return scoped/global services in catalog order.
- `getServiceById(id, catalog?)`: perform canonical identity lookup.
- `buildServiceStatus(service, configuredKeys)`: report ordered boolean field status
  and compute service status from required fields only.

Environment and keystore resolution MAY feed configured-key presence into the status
operation. Secret values, storage behavior, HTTP protocols, and UI are not portable
inputs or outputs.
