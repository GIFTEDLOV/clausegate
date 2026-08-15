# ClauseGate developer notes

## Quick commands

```bash
python -m pytest tests/direct/ -q
genvm-lint check contracts/clausegate.py
npm run typecheck
npm run build
genlayer network
npm run deploy
```

The current contract uses `gl.vm.run_nondet_unsafe` with strict parsing and an explicit validator that independently calls `gl.nondet.exec_prompt` against the same stored Rulebook and proposal. This is the supported current GenLayer runtime pattern inspected in the installed SDK cache. Validator exceptions and disagreement return a failed consensus path; contract writes happen only after consensus returns.

The frontend contract wrapper persists each broadcast hash before polling. The deployment script persists the source hash and deployment hash in `artifacts/clausegate-deployment.json`.
