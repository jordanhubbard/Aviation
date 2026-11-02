---
namespace: aviation
version: 0.1.0
display_name: Aviation decision explanation
profiles:
  - library
  - portable
sample: false
provides:
  - name: aviation.ai.explanation
    version: 0.1.0
    interface:
      uri: interfaces/explanation.md
      pin: null
requires: []
authoring_inputs:
  - kind: specification-to-source-skill
    uri: skills/specification-to-source/portable-application-implementation/SKILL.md
  - kind: specification-to-source-skill
    uri: skills/specification-to-source/portable-specification-planning/SKILL.md
workflow_definition:
  uri: workflows/production/staging/dev/workflow.md
routing_policy:
  uri: routing/production/staging/dev/routing.json
flavor_slots: []
entrypoints: []
acceptance_contracts:
  - kind: acceptance-contract
    uri: acceptance/explanation.md
source_dependencies: []
---
# Aviation decision explanation

This Component owns bounded decision context, follow-up history, queued-provider
acceptance and callback correlation. Applications supply the facts of their own
decisions; the common SDK owns provider communication and the explanation UI.

The public contract is [interfaces/explanation.md](interfaces/explanation.md).
Every realization must satisfy [acceptance/explanation.md](acceptance/explanation.md)
and its authored vectors. Clocks, random credentials, HTTP servers, secret sourcing,
process supervision and browser rendering are SDK runtime adapters. Model selection
and fallback remain RCC behavior.

### Requirement: Explanations use bounded application facts and follow-ups

Context and questions SHALL be nonblank strings. Follow-ups SHALL preserve ordered
user/assistant history without admitting caller-authored system messages. Invalid
input SHALL fail before a provider request. Explanation text SHALL be treated as
text rather than executable markup.

#### Scenario: A pilot asks a follow-up about the selected route

- **WHEN** context, a question and bounded user/assistant history are supplied
- **THEN** their order and text are preserved
- **AND** caller-supplied system history is rejected before submission

### Requirement: Queue acceptance is not an explanation

The RCC adapter SHALL submit a messages array, bounded output budget, callback URL
and opaque correlation metadata with its configured Bearer credential. Only a
202 response containing a successful queued request identity is acceptance.
An immediate 200 response with an explanation field SHALL NOT satisfy this queued
protocol. Applications SHALL receive a request ticket and poll for completion;
waiting for a model SHALL NOT occupy synchronous application workers.

#### Scenario: RCC acknowledges a queued request

- **WHEN** RCC returns HTTP 202 with a successful queued request identity
- **THEN** the SDK issues a local request ticket
- **AND** the ticket does not assert that an explanation is already available

#### Scenario: An obsolete synchronous provider response is returned

- **WHEN** a provider returns HTTP 200 with an explanation field
- **THEN** the queued adapter rejects that response and removes its reservation

### Requirement: Results belong to the matching application and request

A callback SHALL match the application identity, independent callback nonce and
provider request identity. Result text and completion time SHALL be validated.
An early callback SHALL be correlated after queue acceptance. Duplicate, foreign,
expired and malformed callbacks SHALL NOT replace a result or revive a request.
Caller result access SHALL require a separate opaque access credential.

#### Scenario: A callback arrives before queue acknowledgement

- **WHEN** its app and nonce match a pending submission
- **THEN** its candidate result is buffered until the provider request ID is known
- **AND** only a matching provider ID can complete the request

### Requirement: Decision scopes retain their own facts and transcript

The most recently registered decision getter SHALL supply the facts captured when
the pilot opens an explanation. Follow-ups SHALL retain that captured decision.
Replacing or removing the active scope SHALL close its transcript and release its
tickets. Removing an active scope SHALL restore the previous registered getter;
removing an inactive scope SHALL NOT disturb the active transcript.

#### Scenario: A selected record closes over an application's page context

- **WHEN** the selected record's active decision scope is removed
- **THEN** the application's previous page getter becomes active again
- **AND** the selected record's transcript and tickets are released before another explanation

### Requirement: Requests end within a bounded local lifecycle

Runtime adapters SHALL bound submission time, total request lifetime, active request
count and message sizes. Completion, deletion, timeout and shutdown SHALL release
owned local state. They SHALL NOT claim to cancel an RCC job: the provider currently
has no cancellation endpoint. Isolated tests SHALL use SDK-tagged private state and
SDK provider mocks, bypass production credentials and verify zero residual state.

#### Scenario: A requester disconnects during submission

- **WHEN** the owning HTTP caller disconnects before receiving its ticket
- **THEN** the SDK aborts the local submission and releases owned request state
- **AND** a later provider callback cannot revive the removed request
