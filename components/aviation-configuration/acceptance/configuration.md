# Aviation configuration acceptance contract

An independent oracle loads `vectors.json` and evaluates every case against both SDK
language bindings without network, environment, or keystore access.

## Requirement: Definitions and catalogs agree

- Valid definitions are canonicalized without input mutation.
- Invalid identities, categories, URLs, empty fields/scopes, and duplicate catalog
  ownership fail with the declared stable error code.

## Requirement: The shipped catalog agrees

- Both bindings expose the declared service order, field identities, categories,
  environment names, and application scopes.

## Requirement: Lookup, scoping, and status agree

- Canonical lookup and application filtering retain catalog order.
- Required-field status ignores missing optional fields while reporting every field.

## Requirement: Existing consumers remain qualified

- Changes build the configuration package, G1000 frontend, and meta-app, in addition to
  running both independent conformance adapters.
