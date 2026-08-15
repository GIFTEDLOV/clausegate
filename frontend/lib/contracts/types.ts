export type Verdict = "COMPLIANT" | "NON_COMPLIANT" | "UNCLEAR";
export type SubmissionStatus = "SUBMITTED" | "REVIEWED";

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
}

export interface ApprovalCertificate {
  certificate_version: string;
  submission_id: string;
  rulebook_id: string;
  verdict: "COMPLIANT";
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
