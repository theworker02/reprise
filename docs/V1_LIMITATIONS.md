# V1 limitations

- The Neon adapter supports documented branch lifecycle only. It does not claim Neon snapshot/PITR, object-storage, function, auth, Data API, or AI Gateway operations.
- Checkpoints persist as a local integrity-validated JSON repository. Multi-project indexed storage, retention, and compaction are not yet implemented.
- The CLI exposes only the deterministic local acquisition scenario. It intentionally cannot promote or restore production.
- Verification plugins validate supplied evidence/attributes. Live health, schema, and application probes require an execution adapter.
- The provided JSON Schema is a conservative public shape. Runtime Zod validation is the definitive implementation schema.
