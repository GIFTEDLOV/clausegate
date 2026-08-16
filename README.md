# ClauseGate

Rules in. Decisions out.

ClauseGate lets a user publish a natural-language Rulebook, submit a proposal against it, and request a consensus-backed compliance decision. The contract stores the exact Rulebook and proposal text. GenLayer leaders and validators independently classify the same stored text as `COMPLIANT`, `NON_COMPLIANT`, or `UNCLEAR`.

GenLayer is necessary here because the authoritative classification is nondeterministic model execution. The frontend only submits text and reads the result; it never computes or overrides the verdict. A strict custom leader/validator equivalence function rejects malformed output, disagreement, and validator failure. Only `COMPLIANT` creates a queryable approval certificate.

## Architecture

- `contracts/clausegate.py` — minimal Rulebook/submission storage, strict state machine, prompt boundary, consensus review, digest and certificate views.
- `frontend/` — Next.js, React, TypeScript, Tailwind and GenLayerJS application.
- `tests/direct/` — deterministic in-memory contract tests with model fixtures and consensus fault cases.
- `deploy/deployScript.ts` — source-hashed, crash-safe deployment journal in `artifacts/clausegate-deployment.json`.

There is no application database. Explicit on-chain ID collections support frontend enumeration.

## Setup

Prerequisites are recorded in [`docs/TOOLCHAIN.md`](docs/TOOLCHAIN.md). Install the existing npm workflow:

```bash
npm ci
copy frontend\.env.example frontend\.env.local
```

Set `NEXT_PUBLIC_GENLAYER_RPC_URL`, the network values, and the deployed `NEXT_PUBLIC_CONTRACT_ADDRESS` in `frontend/.env.local`.

Run the app:

```bash
npm run dev
```

## Contract API

Writes: `create_rulebook(rulebook_id, title, description, rules)`, `submit_proposal(submission_id, rulebook_id, title, proposal_text)`, and `review_submission(submission_id)`.

Views: `get_rulebook`, `get_submission`, `get_certificate`, `get_rulebook_ids`, `get_submission_ids`, and `contract_info`.

The only terminal verdicts are `COMPLIANT`, `NON_COMPLIANT`, and `UNCLEAR`. Terminal reviews cannot be overwritten. Failed consensus leaves a submission in `SUBMITTED` and never issues a certificate.

## Testing and release checks

```bash
python -m pytest tests/direct/ -q
$env:PYTHONUTF8='1'; genvm-lint check contracts/clausegate.py
npm run typecheck
npm run build
```

The direct suite covers Rulebook/proposal validation, duplicate and missing IDs, enumeration, strict output parsing, matching/mismatching consensus, validator exceptions, prompt-injection fixtures, digest recomputation, certificate gating, terminal state, and clock/randomness guardrails. `tools/mutation_test.py` runs actual source mutations against those tests and writes results to `artifacts/mutation-results.json`.

Integration tests require a running GenLayer Studio/localnet:

```bash
gltest tests/integration/ -v -s
```

## Deployment

Unlock the intended GenLayer CLI account, then run the repository deployment command. It is pinned to the SDK's `testnetBradbury` chain and refuses mixed-network configuration:

```bash
npm run deploy
```

The deployment script persists the source SHA-256 and transaction hash immediately, resumes a recorded transaction after interruption, requires `FINALIZED + AGREE +` successful execution, verifies materialized code/source parity and `contract_info()`, and records the exact receipt. Failed or unknown outcomes remain in `deploy/bradbury/deployment.json`; a recorded hash is never rebroadcast.

## Security model

Rulebook titles, descriptions, rules, submission titles, and proposal bodies are untrusted data inside explicit prompt delimiters. The prompt forbids browsing, web search, instruction changes, schema changes, and assumptions outside the submitted text. The parser accepts only one exact verdict field. No local clock or consensus-sensitive randomness enters contract state. Certificate digests bind the Rulebook content, submission content, submitter, identity, and final verdict.

## Live Bradbury proof

No Bradbury deployment evidence is claimed in this repository until the local release gates are green and a final deployment, fresh compliant case, and fresh non-compliant case have independently verified final receipts, consensus results, source parity, certificate behavior, and digests.
