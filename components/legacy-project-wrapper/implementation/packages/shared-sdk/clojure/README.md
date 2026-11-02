# JVM explanation binding

`aviation.explanation/wrap-explanation` mounts the common explanation API in a Ring
application. Add this package's `src` to the application's source paths and place
the wrapper outside its JSON and session middleware. Run the JVM under the shared
Node broker supervisor, which assigns `AVIATION_EXPLAIN_BROKER_URL` to its child.

The binding owns transport only. It admits a literal loopback HTTP broker, checks
application and private-run response identities, disables proxies and redirects,
and bounds request/response bytes and total RPC time. Provider configuration,
queue/callback correlation, request state and browser UI remain in
`@aviation/ai-explainer`.

The SDK has its own Leiningen project. With Java 21, Node and the built common
broker available, run:

```sh
AVIATION_EXPLANATION_NODE_ENTRY=/absolute/path/to/ai-explainer/dist/run.js lein test
```

The tests launch a private real SDK broker with a minimal environment and synthetic
credentials. They cover queued results, follow-ups, result-token isolation, cleanup,
destination policy, foreign identities, redirects, size bounds and a stalled stream.
They never call a live model. The Common Aviation SDK workflow runs these tests.
