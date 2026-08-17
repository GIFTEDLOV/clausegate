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

export function canonicalizeEvidence(evidence: EvidenceReference[]): EvidenceReference[] {
  return evidence.map((item) => {
    const raw = item.url.trim();
    const withoutFragment = raw.split("#", 1)[0];
    const parsed = new URL(withoutFragment);
    const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
    const path = parsed.pathname || "/";
    const url = item.type === "GITHUB_REPOSITORY"
      ? `https://github.com/${path.replace(/^\/+|\/+$/g, "").split("/").map((part) => part.toLowerCase()).join("/")}`
      : `https://${host}${path}${parsed.search}`;
    return { type: item.type, url, claim: item.claim.trim() };
  });
}

export async function recomputeEvidenceCommitment(evidence: EvidenceReference[]): Promise<string> {
  return sha256Hex(canonicalJson(canonicalizeEvidence(evidence)));
}

export interface ControlChallenge {
  schema: "clausegate-control-v1";
  submission_id: string;
  rulebook_id: string;
  submitter: string;
  source_url: string;
  evidence_commitment: string;
}

export async function controlAttestation(
  submissionId: string,
  rulebookId: string,
  submitter: string,
  sourceUrl: string,
  evidenceCommitment: string,
): Promise<ControlChallenge & { control_digest: string }> {
  const payload: ControlChallenge = {
    schema: "clausegate-control-v1",
    submission_id: submissionId,
    rulebook_id: rulebookId,
    submitter,
    source_url: sourceUrl,
    evidence_commitment: evidenceCommitment,
  };
  return { ...payload, control_digest: await sha256Hex(canonicalJson(payload)) };
}

export function controlLocation(evidence: EvidenceReference): string {
  if (evidence.type === "GITHUB_REPOSITORY") {
    return ".well-known/clausegate.json on the repository default branch";
  }
  const url = new URL(evidence.url);
  return `https://${url.hostname.toLowerCase()}/.well-known/clausegate.json`;
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
