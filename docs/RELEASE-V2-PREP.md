# ClauseGate v2 release preparation

This document describes the un-deployed v2 candidate. It does not alter the
historical v1 release record in [`RELEASE.md`](RELEASE.md), the Bradbury
manifest, proof artifacts, production address, or production frontend.

## Version boundary

- v1 source: `contracts/clausegate.py`, preserved at baseline
  `9bf75f5129d4f7b822f5d0ac57c44e176e708768`
- v1 production contract:
  `0x49446d1e225Ba9821d38457DcdCAb31b2170c061`
- v2 candidate source: `contracts/clausegate_v2.py`
- v2 contract name/version: `ClauseGate` / `2.0.0`
- v2 address: not deployed

V1 is consensus interpretation of committed proposal claims. V2 is
evidence-aware compliance: validators independently retrieve committed evidence
references, assess them against the Rulebook and proposal, and bind a v2
certificate to the compact assessment.

## Evidence schema

```json
[
  {
    "type": "GITHUB_REPOSITORY",
    "url": "https://github.com/owner/repository",
    "claim": "The project's source repository is publicly accessible under an MIT license."
  }
]
```

The exact bounded constants are:

- maximum evidence items: `4`
- maximum URL length: `500`
- maximum claim length: `1000`
- maximum fetched text included in the evaluator prompt per source: `6000`
- supported types: `GITHUB_REPOSITORY`, `WEB_PAGE`

Submission validates and canonicalizes evidence without network access. Only
HTTPS is accepted. GitHub references normalize to lowercase
`https://github.com/<owner>/<repo>` and derive the public API endpoint inside
the nondeterministic block. Localhost, loopback, private-network, unsupported
scheme, user-info, and non-canonical GitHub targets are rejected where
deterministically identifiable.

## Trust and consensus

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

The leader and every validator call the documented
`gl.nondet.web.request(...)` API inside their nondeterministic execution. The
validator does not trust leader-fetched source content. Consensus compares only
the normalized verdict and ordered `{index,status}` assessment; raw webpages,
dynamic fields, and free-form rationale are not consensus fields.

External content is untrusted input. It cannot change the trusted evaluation
instructions, schema, Rulebook, or verdict semantics. Prompt-injection fixtures
cover instruction-like web text, fake JSON schema instructions, source-spoofing
claims, and contradictory sources.

Permanent source failures (for example 404) become insufficient or contradicted
evidence and cannot produce `COMPLIANT`. Transient failures (408, 429, 500,
502, 503, 504, timeout/provider exceptions) return a separate transient outcome
and leave the submission `SUBMITTED` for a later review; they are not converted
into factual `NON_COMPLIANT`.

## Digest and certificate binding

At submission, v2 stores SHA-256 of canonical JSON evidence references as
`evidence_commitment`. After consensus it stores the compact assessment and
`evidence_assessment_digest`, which hashes the submitted references plus ordered
statuses. A v2 `result_digest` binds the Rulebook id/title/description/rules,
submission id/submitter/title/proposal, evidence references, evidence
commitment, assessment, assessment digest, and verdict.

Only `COMPLIANT` produces certificate version `2`, containing the evidence
commitment, assessment digest, result digest, and evidence count. `NON_COMPLIANT`,
`UNCLEAR`, failed consensus, and transient evidence failures produce no
certificate.

## Frontend compatibility

The submission UI supports 1–4 evidence references and shows each source and
post-review status as `SUPPORTED`, `CONTRADICTED`, or `INSUFFICIENT`. The
certificates page lists only certificate version `2` responses. Historical v1
certificates, when viewed directly, are labeled claim-based v1 and are not
presented as evidence-bound approvals.

V2 is opt-in for local/test configuration with
`NEXT_PUBLIC_CLAUSEGATE_CONTRACT_VERSION=2` and a separately deployed candidate
address. The production `NEXT_PUBLIC_CONTRACT_ADDRESS` remains v1, and no
production frontend repoint is part of this preparation pass.

## Deployment gate

Before a future v2 deployment review, run the pinned GenLayer lint/direct,
security, mutation, frontend, evidence, reproducibility, secret, and clean
checkout gates. This preparation pass sends no Bradbury writes, runs no live
proofs, and fabricates no v2 transaction or address.
