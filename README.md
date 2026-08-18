# ClauseGate

## Rules in. Decisions out.

ClauseGate turns a published Rulebook, submitted proposal, and committed evidence
references into a finalized, consensus-backed compliance decision. The public
frontend is now configured for the reviewed v2 evidence-bound contract.

- Live app: [clausegate.vercel.app](https://clausegate.vercel.app)
- Network: GenLayer Bradbury
- Production contract v2: [`0x25F2c44F55b597B9124Af414F991F1aE68913dBa`](https://explorer-bradbury.genlayer.com/address/0x25F2c44F55b597B9124Af414F991F1aE68913dBa)
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
- `contracts/clausegate_v2.py` — deployed v2 evidence-aware review contract.
- `frontend/` — Next.js/React application, including `/decisions` and `/certificates` read-only views.
- `deploy/scripts/` — Bradbury deployment, receipt classification, recovery, and materialization checks.
- `deploy/bradbury/` — preserved public deployment and proof evidence.
- `tests/` — direct contract, adversarial, and mutation coverage.

There is no application database. On-chain ID collections provide enumeration.

## Contract API

Both versions expose `create_rulebook`, `submit_proposal`, and `review_submission`.
The v2 `submit_proposal` call adds `evidence_json`; v1 remains preserved as a
historical claim-based release at its original address.
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

The current public proof records are the v2 evidence-bound cases:

### Current v2 proof table

| Proof | Submission | Submit | Review | Result |
| --- | --- | --- | --- | --- |
| COMPLIANT | `v2-bradbury-compliant-20260818` | [transaction](https://explorer-bradbury.genlayer.com/tx/0xca86f7fb1402a8dc9d04f5360105207118e7e0616e7b80f94c873873c6f46bb8) | [transaction](https://explorer-bradbury.genlayer.com/tx/0xf729e293000cb2e34e53804e38689fb7589da3771b94e87af6a0b41d20c9976e) | certificate v2; SUPPORTED; control VERIFIED |
| NON_COMPLIANT | `v2-bradbury-noncompliant-20260818` | [transaction](https://explorer-bradbury.genlayer.com/tx/0x8f75c66f6807c6b4a31ee43e4b4b53a541ade3b39022fb2a1224b6a1b0fd01f3) | [transaction](https://explorer-bradbury.genlayer.com/tx/0x4c96a49d3554ace74dcc2229dd931dfb087f2a592d204b2a0cd9e5792404a247) | certificate absent; CONTRADICTED; control VERIFIED |

### Historical release context

| Proof | Submission | Submit | Review | Result |
| --- | --- | --- | --- | --- |
| Canonical Rulebook | `clausegate-canonical-20260816` | — | [transaction](https://explorer-bradbury.genlayer.com/tx/0xd0a0841935068ed33576b96ee55779fcbea4b965ab119904cb037b4b39728e3a) | verified |
| COMPLIANT | `v2-bradbury-compliant-20260818` | [transaction](https://explorer-bradbury.genlayer.com/tx/0xca86f7fb1402a8dc9d04f5360105207118e7e0616e7b80f94c873873c6f46bb8) | [transaction](https://explorer-bradbury.genlayer.com/tx/0xf729e293000cb2e34e53804e38689fb7589da3771b94e87af6a0b41d20c9976e) | certificate v2; SUPPORTED; control VERIFIED |
| NON_COMPLIANT | `v2-bradbury-noncompliant-20260818` | [transaction](https://explorer-bradbury.genlayer.com/tx/0x8f75c66f6807c6b4a31ee43e4b4b53a541ade3b39022fb2a1224b6a1b0fd01f3) | [transaction](https://explorer-bradbury.genlayer.com/tx/0x4c96a49d3554ace74dcc2229dd931dfb087f2a592d204b2a0cd9e5792404a247) | certificate absent; CONTRADICTED; control VERIFIED |

The original records remain preserved v1 claim-based compliance artifacts under
`deploy/bradbury/`; they are not presented as v2 evidence-bound certificates.
The v2 control-file history is preserved by the exact commits recorded in the
proof manifest: `29242bc0c6f2f79b320c82c1204317415581188f` for COMPLIANT and
`79627a37d2993712dd26a638a8826acdea90da0b` for NON_COMPLIANT.

The separate v2 Bradbury deployment is
`0x25F2c44F55b597B9124Af414F991F1aE68913dBa`. Its canonical evidence-bound
proofs and per-action transaction journals are recorded under
[`deploy/bradbury/v2/proof/`](deploy/bradbury/v2/proof/). The v2 COMPLIANT proof
has certificate version `2`, `SUPPORTED` evidence, and `VERIFIED` source control;
the v2 NON_COMPLIANT proof uses the same authenticated public repository against
a private-only Rulebook and has no certificate.

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

## v2 deployed release

`contracts/clausegate_v2.py` implements the reviewer-requested trust-model
upgrade while preserving the v1 address and Bradbury evidence. Its
bounded schema supports `GITHUB_REPOSITORY` and `WEB_PAGE`, canonical HTTPS
validation, evidence commitments, independently fetched source-control
attestations, `gl.nondet.web.request` plus rendered `WEB_PAGE` content, strict
evidence/control assessments, transient-provider fail-closed behavior, and v2
certificate/digest binding. See [`docs/RELEASE-V2-PREP.md`](docs/RELEASE-V2-PREP.md)
for the source, deployment, live-proof, and production frontend release record.

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
and never holds a wallet or private key. The v1 and v2 sources remain separate;
the public frontend now points at the verified v2 contract while v1 evidence stays
historical.

For a v2 review, publish the generated exact control JSON at
`.well-known/clausegate.json` on each cited first-party source. The v2 UI
generates and copies these attestations; validators recompute the challenge
from the wallet, submission, Rulebook, source URL, and evidence commitment.
`npm run deploy:v2:selfcheck` checks the isolated recovery path offline;
`npm run deploy:v2` requires an explicit deployment arming value. The v2
deployment journal and proof journals use hash-first recovery and are never
mixed with the v1 deployment evidence.

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
