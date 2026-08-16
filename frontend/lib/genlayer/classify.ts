/**
 * Strict transaction classification (ported from the UptimeBond Bradbury path).
 *
 * Two rules drive this:
 *  1. A returned transaction hash is NOT success. It means the node accepted the
 *     transaction for processing; consensus and execution are separate later
 *     outcomes and either can still fail.
 *  2. FINALIZED alone is NOT success. A write succeeded only when consensus
 *     AGREEd AND the execution result is explicitly a successful one. Anything
 *     unrecognised stays UNKNOWN and is never promoted to success.
 */

export interface TxClassification {
  /** True only for AGREE + a successful execution result on a settled consensus. */
  ok: boolean;
  consensusStatus: string;
  consensusResult: string;
  executionResult: string;
  validatorVotes: string[];
  validatorTally: Record<string, number>;
  /** Human-facing summary; safe to show, technical detail kept in the fields above. */
  reason: string;
}

const OK_CONSENSUS = new Set(["FINALIZED"]);
const OK_EXECUTION = new Set(["FINISHED_WITH_RETURN", "FINISHED_WITH_NO_RETURN"]);

function str(...candidates: unknown[]): string {
  for (const c of candidates) {
    if (typeof c === "string" && c.length > 0) return c.toUpperCase();
    if (typeof c === "number") return String(c);
  }
  return "UNKNOWN";
}

/**
 * Classify a receipt (from waitForTransactionReceipt or an explorer record).
 * Never throws — an unreadable receipt classifies as not-ok with reason UNKNOWN.
 */
export function classify(receipt: unknown): TxClassification {
  const r = (receipt ?? {}) as Record<string, unknown>;
  const consensusStatus = str(r.status_name, r.statusName, r.status);
  const consensusResult = str(r.result_name, r.resultName, r.result);
  const executionResult = str(
    r.tx_execution_result_name,
    r.txExecutionResultName,
    r.execution_result,
    r.executionResult,
  );

  const round = (r.last_round ?? r.lastRound ?? {}) as Record<string, unknown>;
  const votesRaw =
    (round.validatorVotesName as unknown[]) ??
    (round.validator_votes_name as unknown[]) ??
    (r.validators as unknown[]) ??
    [];
  const validatorVotes = Array.isArray(votesRaw) ? votesRaw.map((v) => String(v)) : [];
  const validatorTally = validatorVotes.reduce<Record<string, number>>((m, v) => {
    m[v] = (m[v] ?? 0) + 1;
    return m;
  }, {});

  const consensusOk = OK_CONSENSUS.has(consensusStatus);
  const agree = consensusResult === "AGREE";
  const execOk = OK_EXECUTION.has(executionResult);
  const ok = consensusOk && agree && execOk;

  let reason: string;
  if (ok) {
    reason = "Consensus agreed and the contract executed successfully.";
  } else if (!consensusOk) {
    reason =
      consensusStatus === "UNKNOWN"
        ? "The transaction outcome could not be read yet."
        : `The network reported consensus status ${consensusStatus}.`;
  } else if (!agree) {
    reason = `Validators did not agree (${consensusResult}).`;
  } else if (executionResult === "FINISHED_WITH_ERROR") {
    reason = "The transaction reached consensus but the contract call failed.";
  } else {
    reason = `Execution result was ${executionResult}; not a confirmed success.`;
  }

  return { ok, consensusStatus, consensusResult, executionResult, validatorVotes, validatorTally, reason };
}
