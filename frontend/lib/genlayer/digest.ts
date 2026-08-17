/**
 * Independent recomputation of the contract's result_digest.
 *
 * The contract commits sha256 over a canonical JSON object with recursively
 * sorted keys and no whitespace (Python json.dumps sort_keys=True,
 * separators=(",",":")). We reproduce exactly that here so the UI can verify a
 * COMPLIANT certificate against the committed content instead of trusting it.
 */

import type { EvidenceAssessment, EvidenceReference, Rulebook, Submission } from "@/lib/contracts/types";

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortDeep((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

/** Canonical JSON: recursively sorted keys, no whitespace. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Recompute result_digest from committed rulebook + submission + verdict. */
export async function recomputeResultDigest(
  rulebook: Rulebook,
  submission: Submission,
  verdict: string,
): Promise<string> {
  const payload = canonicalJson({
    rulebook: {
      id: rulebook.rulebook_id,
      title: rulebook.title,
      description: rulebook.description,
      rules: rulebook.rules,
    },
    submission: {
      id: submission.submission_id,
      submitter: submission.submitter,
      title: submission.title,
      proposal_text: submission.proposal_text,
    },
    verdict,
  });
  return sha256Hex(payload);
}

export async function recomputeEvidenceAssessmentDigest(
  evidence: EvidenceReference[],
  assessment: EvidenceAssessment[],
): Promise<string> {
  return sha256Hex(canonicalJson({ evidence, assessment }));
}

/** Recompute the v2 result digest, including committed evidence and assessment. */
export async function recomputeResultDigestV2(
  rulebook: Rulebook,
  submission: Submission,
  verdict: string,
): Promise<string> {
  const evidence = submission.evidence || [];
  const assessment = submission.evidence_assessment || [];
  const assessmentDigest = submission.evidence_assessment_digest || await recomputeEvidenceAssessmentDigest(evidence, assessment);
  return sha256Hex(canonicalJson({
    rulebook: {
      id: rulebook.rulebook_id,
      title: rulebook.title,
      description: rulebook.description,
      rules: rulebook.rules,
    },
    submission: {
      id: submission.submission_id,
      submitter: submission.submitter,
      title: submission.title,
      proposal_text: submission.proposal_text,
    },
    evidence,
    evidence_commitment: submission.evidence_commitment || "",
    evidence_assessment: assessment,
    evidence_assessment_digest: assessmentDigest,
    verdict,
  }));
}
