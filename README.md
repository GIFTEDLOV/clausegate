# ClauseGate

## Rules in. Decisions out.

ClauseGate turns a published Rulebook and a submitted proposal into a finalized,
consensus-backed compliance decision.

- Live app: [clausegate.vercel.app](https://clausegate.vercel.app)
- Network: GenLayer Bradbury
- Production contract: [`0x49446d1e225Ba9821d38457DcdCAb31b2170c061`](https://explorer-bradbury.genlayer.com/address/0x49446d1e225Ba9821d38457DcdCAb31b2170c061)
- Source: [github.com/GIFTEDLOV/clausegate](https://github.com/GIFTEDLOV/clausegate)

## What ClauseGate is

ClauseGate stores exact requirements, exact proposal text, and the resulting
decision in a GenLayer Intelligent Contract. The frontend presents those
records; it does not calculate or override verdicts.

## Why GenLayer

The review is model-assisted and therefore nondeterministic. GenLayer lets
independent validators evaluate the same committed inputs and reach consensus.
ClauseGate accepts only `COMPLIANT`, `NON_COMPLIANT`, or `UNCLEAR`.

## User workflow

**Rulebook → Proposal → Review → Decision**

1. Publish a Rulebook with a title, description, and exact rules.
2. Submit a proposal against that Rulebook.
3. Request a review of the stored proposal.
4. Read the finalized verdict and, for a compliant result, its certificate and digest.

## Architecture

- `contracts/clausegate.py` — frozen Rulebook, submission, review, verdict, certificate, and digest logic.
- `frontend/` — Next.js/React application, including `/decisions` and `/certificates` read-only views.
- `deploy/scripts/` — Bradbury deployment, receipt classification, recovery, and materialization checks.
- `deploy/bradbury/` — preserved public deployment and proof evidence.
- `tests/` — direct contract, adversarial, and mutation coverage.

There is no application database. On-chain ID collections provide enumeration.

## Contract API

Writes are `create_rulebook`, `submit_proposal`, and `review_submission`.
Read methods are `get_rulebook`, `get_submission`, `get_certificate`,
`get_rulebook_ids`, `get_submission_ids`, and `contract_info`.

Only a finalized `COMPLIANT` review issues a certificate. A failed or unknown
transaction is not treated as success, and a recorded transaction hash is
reconciled rather than rebroadcast.

## Security and consensus model

User text is delimited as untrusted data in the review prompt. The contract
accepts one exact verdict field, rejects malformed or disagreeing consensus,
does not use local time or randomness for state, and never overwrites a
terminal review. Certificates bind the Rulebook, proposal, submitter, identity,
and final verdict through the result digest.

## Live Bradbury proof

The preserved evidence records finalized, agreeing transactions with successful execution:

| Proof | Submission | Submit | Review | Result |
| --- | --- | --- | --- | --- |
| Canonical Rulebook | `clausegate-canonical-20260816` | — | [transaction](https://explorer-bradbury.genlayer.com/tx/0xd0a0841935068ed33576b96ee55779fcbea4b965ab119904cb037b4b39728e3a) | verified |
| COMPLIANT | `clausegate-compliant-20260816` | [transaction](https://explorer-bradbury.genlayer.com/tx/0x7327a8d190087273ccd83225fbbc83264f712449a31b399ea55ff70e8c273b8d) | [transaction](https://explorer-bradbury.genlayer.com/tx/0xac0d127d3cfb29fe202d91851129bb77814ef21ba4f17c1d61aee0e07bd675bb) | certificate and digest verified |
| NON_COMPLIANT | `clausegate-noncompliant-20260816` | [transaction](https://explorer-bradbury.genlayer.com/tx/0xa1d9d88f6ec9a4d286cdd9fea429e4ba91fa1b12d81027c6ff6406ac8931f34d) | [transaction](https://explorer-bradbury.genlayer.com/tx/0x8a0119082d0b69e1f5833b212d08cb84acf5fe5a09e088f31e560af1e41c30d7) | certificate absent |

The COMPLIANT proof is `FINALIZED + AGREE + FINISHED_WITH_RETURN`, with verdict
`COMPLIANT`, a certificate, and an independently verified result digest. The
NON_COMPLIANT proof has the same finalized consensus/execution state, verdict
`NON_COMPLIANT`, and no certificate.

## Reproducibility and evidence

The deployed contract source is frozen at SHA-256
`47817b41586e44ac1a08b2a5daff8b184a0f9c69e9f020d23cf43dce8d87810` and 12,195
bytes. The Node SDK is exactly `genlayer-js@1.1.8` and the frontend is pinned
to Bradbury chain ID 4221.

```bash
npm ci
npm run repro
npm run verify:evidence
npm run secret-scan
```

The canonical manifest and proof records are under [`deploy/bradbury/`](deploy/bradbury/).
The deployment transaction is [viewable here](https://explorer-bradbury.genlayer.com/tx/0xf368d4c9c188ccc5f5475b6dab9df7e88e3b2e6ec068e50ea8c33899e86d1c78).
An optional read-only production check is available with `npm run verify:production`.

## Local development

Prerequisites and the pinned Python toolchain are documented in [`docs/TOOLCHAIN.md`](docs/TOOLCHAIN.md).

```bash
npm ci
copy frontend\.env.example frontend\.env.local
npm run dev
```

Set the public Bradbury RPC and contract address in the local environment file.
Never commit `.env.local`, wallet material, or Vercel credentials.

## Tests and release gates

```bash
python -m pytest tests/direct/ -q
python -m pytest tests/test_clausegate_security.py -q
python tools/mutation_test.py
genvm-lint check contracts/clausegate.py
npm run repro
npm run verify:evidence
npm run typecheck
npm run build
npm run test:frontend
npm run test:browser
npm run test:a11y
npm run test:shots
```

The browser checks are read-only structural smoke, accessibility, console/request,
and responsive checks. Mandatory CI does not depend on live Bradbury availability
and never holds a wallet or private key.

## Deployment and release history

The production contract was deployed once and is immutable for this release.
The hardened contract-source lineage and later frontend-only releases are
separated in [`docs/RELEASE.md`](docs/RELEASE.md); a later UI commit is not
represented as a new contract deployment.

## Repository map

- `contracts/` — frozen Intelligent Contract source
- `deploy/` — deployment tooling and public Bradbury evidence
- `docs/` — toolchain and release records
- `frontend/` — Next.js application
- `tests/` — direct and adversarial contract tests
- `tools/` — offline evidence, reproducibility, and security checks
