# ClauseGate release record

## Frozen production contract

- Network: GenLayer Bradbury, chain ID 4221
- Address: `0x49446d1e225Ba9821d38457DcdCAb31b2170c061`
- Source: `contracts/clausegate.py`
- Source SHA-256: `47817b41586e44ac1a08b2a5daff8b184a0f9c69e9f020d23cf43dce8d87810`
- Source bytes: `12195`
- Deployment transaction: `0xf368d4c9c188ccc5f5475b6dab9df7e88e3b2e6ec068e50ea8c33899e86d1c78`
- [Production contract](https://explorer-bradbury.genlayer.com/address/0x49446d1e225Ba9821d38457DcdCAb31b2170c061)
- [Deployment transaction](https://explorer-bradbury.genlayer.com/tx/0xf368d4c9c188ccc5f5475b6dab9df7e88e3b2e6ec068e50ea8c33899e86d1c78)

The deployment evidence records `FINALIZED`, `AGREE`,
`FINISHED_WITH_RETURN`, materialized code, source parity, matching
`contract_info()`, and fresh empty state reads.

## Release lineage

The hardened contract-source release is commit
`66f05ad5700f5b5446f776a653b04bc69b2190f0`. The current frontend release is a
later UI-only lineage; it does not change the deployed contract and was not a
new Bradbury deployment. This distinction is recorded in
`deploy/bradbury/release-manifest.json`.

Production frontend: [clausegate.vercel.app](https://clausegate.vercel.app).

## Finalized proof records

- Rulebook: `clausegate-canonical-20260816`, [transaction](https://explorer-bradbury.genlayer.com/tx/0xd0a0841935068ed33576b96ee55779fcbea4b965ab119904cb037b4b39728e3a)
- COMPLIANT submit: [transaction](https://explorer-bradbury.genlayer.com/tx/0x7327a8d190087273ccd83225fbbc83264f712449a31b399ea55ff70e8c273b8d)
- COMPLIANT review: [transaction](https://explorer-bradbury.genlayer.com/tx/0xac0d127d3cfb29fe202d91851129bb77814ef21ba4f17c1d61aee0e07bd675bb)
- NON_COMPLIANT submit: [transaction](https://explorer-bradbury.genlayer.com/tx/0xa1d9d88f6ec9a4d286cdd9fea429e4ba91fa1b12d81027c6ff6406ac8931f34d)
- NON_COMPLIANT review: [transaction](https://explorer-bradbury.genlayer.com/tx/0x8a0119082d0b69e1f5833b212d08cb84acf5fe5a09e088f31e560af1e41c30d7)

The COMPLIANT record is finalized and agreeing with successful execution,
issues a certificate, and has the independently verified digest recorded in
the evidence. The NON_COMPLIANT record is finalized and agreeing with
successful execution and has no certificate.

## Evidence and verification

Preserved raw records and a compact canonical structure live under
`deploy/bradbury/`. They contain public addresses, hashes, consensus results,
and contract metadata only. Local environment files and credentials are not
part of release evidence.

Run the offline verifier:

```bash
npm ci
npm run verify:evidence
```

It verifies manifest shape, chain/address/hash invariants, source parity,
deployment outcomes, proof state, certificate gating, and the recorded
COMPLIANT digest. The preserved offline artifact does not include the
submitter field required to recompute the digest from first principles, so the
verifier reports that specific recomputation as skipped rather than inventing
missing data. The preserved release evidence records that independent digest
verification was performed.

An optional network read-only check is available with:

```bash
npm run verify:production
```

It does not send transactions. RPC/network failures are reported as blocked
network checks rather than silently treated as evidence mismatches.
