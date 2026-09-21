# Architecture map

```mermaid
flowchart LR
  P[Provider observations] --> G[State graph]
  P --> L[Change ledger]
  G --> C[Compound checkpoints]
  L --> B[Boundary analysis]
  C --> T[Time Machine]
  B --> T
  T --> V[Verification]
  V --> S[Reprise Signal]
  S --> R[Recovery Guard + receipt]
```

The graph/ledger/checkpoint layers are provider-neutral. Provider adapters are the only place that performs platform API calls. A promotion executor is intentionally absent; the Guard returns a decision and evidence that a separately authorized executor must honor.
