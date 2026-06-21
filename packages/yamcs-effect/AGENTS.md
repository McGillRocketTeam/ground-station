## Package Intent

`@mrt/yamcs-effect` should stay platform agnostic and easy to compose into frontend atom runtimes.

- Keep Yamcs protocol logic in this package.
- Keep browser and node transport details outside this package.
- Surface precise Effect requirements so app runtimes can provide them cleanly.

## Service Boundaries

- Domain services like `Parameters` and `Commands` should depend on:
  - `HttpClient.HttpClient` for REST calls
  - platform socket or websocket requirements for live subscriptions
  - `YamcsConfig` for Yamcs-specific connection details
- If this package exposes a Yamcs-specific websocket client, it should only own Yamcs websocket protocol behavior and should itself depend on platform socket services.

## Requirements Discipline

- Avoid schema annotations that widen requirements to `unknown`.
- For recursive schemas, follow Effect's `Schema.Codec<...>` pattern so decoding and encoding service requirements stay concrete.
- Frontend atom wrappers should stay thin and provide runtime layers rather than re-implementing Yamcs merge or subscription logic.
