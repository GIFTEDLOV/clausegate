# ClauseGate

## Rules in. Decisions out.

ClauseGate turns a published Rulebook and a submitted proposal into a finalized,
consensus-backed compliance decision. The preserved production deployment is v1;
the v2 candidate adds independently retrieved external evidence before factual
certification.

- Live app: [clausegate.vercel.app](https://clausegate.vercel.app)
- Network: GenLayer Bradbury
- Production contract: [`0x49446d1e225Ba9821d38457DcdCAb31b2170c061`](https://explorer-bradbury.genlayer.com/address/0x49446d1e225Ba9821d38457DcdCAb31b2170c061)
- Source: [github.com/GIFTEDLOV/clausegate](https://github.com/GIFTEDLOV/clausegate)

## What ClauseGate is

ClauseGate stores exact requirements, exact proposal text, committed evidence
references, and the resulting decision in a GenLayer Intelligent Contract. The
frontend presents those records; it does not calculate or override verdicts.

## Why GenLayer

The review is model-assisted and therefore nondeterministic. GenLayer lets
independent validators evaluate the same committed inputs and reach consensus.
ClauseGate accepts only `COMPLIANT`, `NON_COMPLIANT`, or `UNCLEAR`.

## User workflow

**Rulebook → Proposal → Evidence References → Review → Decision**

1. Publish a Rulebook with a title, description, and exact rules.
2. Submit a proposal and, for v2, one to four bounded HTTPS evidence references.
3. Request a review of the stored proposal.
4. Read the finalized verdict and, for a compliant result, its certificate and digest.

## Architecture

- `contracts/clausegate.py` — preserved v1 Rulebook, submission, claim-based review, certificate, and digest logic.
- `contracts/clausegate_v2.py` — release candidate for evidence-aware reviews; not deployed.
- `frontend/` — Next.js/React application, including `/decisions` and `/certificates` read-only views.
- `deploy/scripts/` — Bradbury deployment, receipt classification, recovery, and materialization checks.
- `deploy/bradbury/` — preserved public deployment and proof evidence.
- `tests/` — direct contract, adversarial, and mutation coverage.

There is no application database. On-chain ID collections provide enumeration.

## Contract API

Both versions expose `create_rulebook`, `submit_proposal`, and `review_submission`.
The v2 `submit_proposal` call adds `evidence_json`; v1 remains claim-based and
unchanged at the production address.
Read methods are `get_rulebook`, `get_submission`, `get_certificate`,
`get_rulebook_ids`, `get_submission_ids`, and `contract_info`.

Only a finalized v2 `COMPLIANT` review with supported committed evidence issues
an evidence-bound certificate. A failed or unknown
transaction is not treated as success, and a recorded transaction hash is
reconciled rather than rebroadcast.

## Security and consensus model

Rulebook data, proposal data, and external web content are explicitly delimited
as untrusted data in the v2 review prompt. Validators independently retrieve the
same committed evidence references, derive compact statuses, and compare
`verdict` plus the ordered evidence assessment rather than raw webpages or LLM
prose. Proposal claims alone are not sufficient for factual certification.

### Evidence-aware v2 flow

```text
Rulebook
   +
Proposal
   +
Evidence References
        ↓
Independent Validator Fetch
        ↓
Evidence Assessment
        ↓
Consensus Verdict
        ↓
Evidence-Bound Certificate
```

The external source itself remains mutable. A v2 certificate binds the submitted
reference, the assessment reached at review time, and the result digest; it does
not claim to prove every fact on the internet.

## Live Bradbury proof

The preserved evidence records finalized, agreeing transactions with successful execution:

| Proof | Submission | Submit | Review | Result |
| --- | --- | --- | --- | --- |
| Canonical Rulebook | `clausegate-canonical-20260816` | — | [transaction](https://explorer-bradbury.genlayer.com/tx/0xd0a0841935068ed33576b96ee55779fcbea4b965ab119904cb037b4b39728e3a) | verified |
| COMPLIANT | `clausegate-compliant-20260816` | [transaction](https://explorer-bradbury.genlayer.com/tx/0x7327a8d190087273ccd83225fbbc83264f712449a31b399ea55ff70e8c273b8d) | [transaction](https://explorer-bradbury.genlayer.com/tx/0xac0d127d3cfb29fe202d91851129bb77814ef21ba4f17c1d61aee0e07bd675bb) | certificate and digest verified |
| NON_COMPLIANT | `clausegate-noncompliant-20260816` | [transaction](https://explorer-bradbury.genlayer.com/tx/0xa1d9d88f6ec9a4d286cdd9fea429e4ba91fa1b12d81027c6ff6406ac8931f34d) | [transaction](https://explorer-bradbury.genlayer.com/tx/0x8a0119082d0b69e1f5833b212d08cb84acf5fe5a09e088f31e560af1e41c30d7) | certificate absent |

These preserved records are v1 claim-based compliance artifacts. They are not
v2 evidence-bound certificates and are not rewritten to suggest that external
evidence was fetched. The v1 COMPLIANT proof is `FINALIZED + AGREE +
FINISHED_WITH_RETURN`, with verdict `COMPLIANT`, a certificate, and an
independently verified result digest. The v1 NON_COMPLIANT proof has the same
finalized consensus/execution state, verdict `NON_COMPLIANT`, and no certificate.

## Reproducibility and evidence

The deployed v1 contract source is frozen at SHA-256
`47817b41586e44ac1a08b2a5daff8b184a0f9c69e9f020d23cf43dce8d87810` and 12,195
bytes. The Node SDK is exactly `genlayer-js@1.1.8` and the frontend is pinned
to Bradbury chain ID 4221.

```bash
npm ci
npm run repro
npm run verify:evidence
npm run secret-scan
```

The canonical v1 manifest and proof records are under [`deploy/bradbury/`](deploy/bradbury/).
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

## v2 release candidate

`contracts/clausegate_v2.py` implements the reviewer-requested trust-model
upgrade without changing the v1 production address or Bradbury evidence. Its
bounded schema supports `GITHUB_REPOSITORY` and `WEB_PAGE`, canonical HTTPS
validation, evidence commitments, independent `gl.nondet.web.request` fetches,
strict evidence assessments, transient-provider fail-closed behavior, and v2
certificate/digest binding. See [`docs/RELEASE-V2-PREP.md`](docs/RELEASE-V2-PREP.md)
for the deployment-preparation record. No v2 address or transaction is claimed.

## Tests and release gates

```bash
python -m pytest tests/direct/ -q
python -m pytest tests/test_clausegate_security.py -q
python tools/mutation_test.py
genvm-lint check contracts/clausegate.py
genvm-lint check contracts/clausegate_v2.py
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
and never holds a wallet or private key. The v1 and v2 sources are tested as
separate candidates; no Bradbury write or production frontend repoint is part of
this release-preparation pass.

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
