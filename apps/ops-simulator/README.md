# @mrt/ops-simulator

Primitive gas-fill simulator built around `effect/Graph`.

Current model:

- `N20 tank` is an infinite `900 psi` source.
- `PT-I1` is the pre-fill pressure node.
- `V-22` sits downstream of `PT-I1`.
- After `V-22` the line splits.
- One branch goes through `V-23` to the environment for dumping.
- The other branch goes to `PT-I2` for post-fill pressure.

Why this shape:

- The physical topology is mostly static, so the graph should stay immutable.
- Valves are better modeled as edge state than as topology changes.
- Pressure belongs to control volumes, so it fits naturally on nodes.
- A simple equalization step is enough for the first cut and can later evolve into a better flow model.

Source layout:

- `src/domain.ts`: shared types.
- `src/topology.ts`: graph construction for the current plumbing layout.
- `src/simulator.ts`: primitive pressure-step logic and sensor reads.
- `src/yamcs.ts`: `YamcsApi` HTTP client layer.
- `src/index.ts`: demo scenario runner.

Component metadata:

- Nodes and edges can carry `metadata.yamcs.qualifiedName`.
- PTs and valves are tagged with placeholder qualified names now.
- This keeps Yamcs identity attached to the physical component model without coupling it to the simulation math.

YAMCS:

- The app now initializes a typed HTTP client from `@mrt/yamcs-effect`'s `YamcsApi`.
- Set `YAMCS_BASE_URL` to point at the Yamcs server.
- If unset, it defaults to `http://localhost:8090`.
