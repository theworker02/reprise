# Credential model

Reprise must never store provider tokens in the ledger, graph, checkpoint, receipt, fixture, or configuration file. A future Neon adapter should resolve a minimum-scope token only at runtime, redact it from errors, and record non-sensitive provider identifiers as provenance. The local demo needs no credentials.
