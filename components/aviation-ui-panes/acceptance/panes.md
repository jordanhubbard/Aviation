# Aviation UI pane lifecycle acceptance contract

An independent oracle loads `vectors.json` and evaluates every case against the
TypeScript `@aviation/ui-framework` realization. Acceptance performs no network access,
does not mount React, and requires no application runtime.

## Requirement: Ordering and defaults agree

- Explicit order precedes missing order and title breaks equal-order ties.
- The first source-order default-open pane wins.
- Empty input returns no active identity.
- Closeability defaults to true and respects explicit false.

## Requirement: Navigation agrees

- Relative navigation uses sorted order and wraps for positive and negative deltas.
- Unknown current identities fall back to the declared default.
- Next-active selection prefers the next sorted pane and then the previous pane.

## Requirement: Reordering and closing agree

- Successful moves change one position and normalize orders from one.
- Boundary and unknown moves preserve pane values.
- Closing selects the declared neighbor, removes only the requested pane, and normalizes
  remaining order values.
- Inputs and records are not mutated.

## Requirement: Shared UI CI runs

- Changes to this Component, its vectors, the UI-framework realization, package metadata,
  or the SDK workflow run pane conformance independently of application tests.
