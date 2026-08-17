export type Verdict = "COMPLIANT" | "NON_COMPLIANT" | "UNCLEAR";
export type SubmissionStatus = "SUBMITTED" | "REVIEWED";
export type EvidenceType = "GITHUB_REPOSITORY" | "WEB_PAGE";
export type EvidenceAssessmentStatus = "SUPPORTED" | "CONTRADICTED" | "INSUFFICIENT";

export interface EvidenceReference {
  type: EvidenceType;
  url: string;
  claim: string;
}

export interface EvidenceAssessment {
  index: number;
  status: EvidenceAssessmentStatus;
}

export interface Rulebook {
  rulebook_id: string;
  owner: string;
  title: string;
  description: string;
  rules: string;
  active: boolean;
}

export interface Submission {
  submission_id: string;
  rulebook_id: string;
  submitter: string;
  title: string;
  proposal_text: string;
  status: SubmissionStatus;
  verdict: Verdict | "";
  result_digest: string;
  certificate_issued: boolean;
  evidence?: EvidenceReference[];
  evidence_commitment?: string;
  evidence_assessment?: EvidenceAssessment[];
  evidence_assessment_digest?: string;
}

export interface ApprovalCertificate {
  certificate_version: string;
  submission_id: string;
  rulebook_id: string;
  verdict: "COMPLIANT";
  evidence_commitment?: string;
  evidence_assessment_digest?: string;
  evidence_count?: number;
  result_digest: string;
}

export interface ContractInfo {
  name: string;
  version: string;
  tagline: string;
  review_status: string[];
  verdicts: Verdict[];
  max_rulebook_rules: number;
  max_proposal: number;
  max_evidence_items?: number;
  max_evidence_url?: number;
  max_evidence_claim?: number;
  evidence_types?: EvidenceType[];
}

export interface TransactionReceipt {
  hash?: string;
  status?: string;
  statusName?: string;
  result?: string;
  resultName?: string;
  [key: string]: unknown;
}

export type WriteStage = "connecting" | "sent" | "confirming" | "finalized" | "error";
