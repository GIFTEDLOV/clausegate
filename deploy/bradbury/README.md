# ClauseGate Bradbury release evidence

These files record the already-verified ClauseGate production deployment and
the two required public proof cases. They contain public chain addresses,
transaction hashes, consensus/execution observations, and committed proposal
content only. No wallet keys, mnemonics, tokens, or local environment values
are included.

`release-manifest.json` is the compact canonical index. `deployment.json` and
`release-evidence.json` are preserved original local release records; the
canonical derivatives under `compliant/` and `noncompliant/` retain the
verification-critical observations without rewriting the original records.

Run the deterministic verifier from the repository root:

```text
npm run verify:evidence
```
