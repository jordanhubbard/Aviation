# `aviation.ai.explanation`

## Input

An input contains `context`, optional `question`, and optional `history`.
Context is a nonblank string of at most 16,384 UTF-8 bytes. A supplied question is
a nonblank string of at most 2,048 bytes; omission uses `Explain this decision using
the supplied facts.` History defaults to an empty array and contains at most twelve
ordered `{role, content}` messages. Roles are exactly `user` or `assistant`; content
is a nonblank string of at most 4,096 bytes. Context, question and history together
must not exceed 32,768 bytes. Valid text is preserved without trimming or mutation.
Invalid input fails with `explanation-input-invalid`.

The SDK constructs a system instruction to reason from supplied facts, followed by
the decision context, history and current question. Provider credentials are HTTP
authorization only and never enter messages, callback metadata or browser output.

## RCC queue adapter

The authoritative integration is RCC's
[request route](https://github.com/jordanhubbard/rocky-and-friends/blob/11f5e2a125ee94bffde6f6eaeea9c40c1fef8ae8/rcc/api/index.mjs)
and [brain callback](https://github.com/jordanhubbard/rocky-and-friends/blob/11f5e2a125ee94bffde6f6eaeea9c40c1fef8ae8/rcc/brain/index.mjs).
Submit `messages`, `maxTokens`, `priority: normal`, `callbackUrl` and `metadata` to
`POST /api/brain/request` with the operator's configured Bearer token.
Only HTTP 202 and `{ok: true, status: queued, requestId: nonblank-id}` are valid
acceptance. A request ID has no whitespace/control characters and at most 128 bytes.
An invalid response fails with `explanation-queue-invalid`.

The callback URL is the application's `/api/explain/callback`. Metadata contains
`aviation_app_id` and an independent 64-character lowercase hexadecimal
`aviation_callback_nonce`. RCC echoes that metadata. The nonce is carried in the
body rather than the callback URL. Other metadata may carry SDK E2E ownership tags.

## Callback

The callback contains `requestId`, `result`, `completedAt`, optional `model`, and
`metadata`. It must match the pending request's app ID, nonce and accepted provider
ID. Result is a nonblank string of at most 65,536 bytes. Completion time is a valid
canonical UTC ISO timestamp with millisecond precision. A supplied model is a
nonblank string of at most 128 bytes. It is optional because RCC may omit it after
an earlier exhausted fallback round. Valid output preserves result text and returns
`{explanation, completedAt, model?}`. Invalid callbacks fail with
`explanation-callback-invalid`. Provider timestamps never extend local expiry.

## Application HTTP adapters

`POST /api/explain` accepts the input and returns HTTP 202 with an opaque local
`requestId`, separate `accessToken`, `status: queued`, `expiresAt` and polling delay.
`GET /api/explain/requests/{requestId}` requires `X-Aviation-Explain-Token` and
returns queued or completed state; completed state contains the explanation.
`DELETE` of the same resource with the same credential removes owned state.
Unknown, deleted, expired and wrong-token tickets return the same 404 response.
`POST /api/explain/callback` validates the provider callback. A callback received
before submission acceptance is buffered until its provider ID can be checked.
At most one valid result can complete a request. Errors expose stable generic
messages and never provider response bodies or credentials.

Public HTTP body limits, authorization policy, rate limits, callback origin,
deadlines and storage are SDK/application adapter policy. The common deployment
uses one SDK broker per application instance; Python/JVM workers proxy these routes
to that broker so callbacks do not depend on which application worker receives them.

## Browser decision scopes

The common browser control uses the most recently registered decision-context getter.
Closing that registration restores the previous active getter, so a selected record
can temporarily specialize an application's page context. Registering or removing
the active scope closes its transcript and releases owned tickets before another
decision can be explained. Removing an inactive scope does not disturb the active
decision. Getter output is captured when the pilot opens the explanation; follow-ups
stay bound to that captured decision until close or a scope change.
