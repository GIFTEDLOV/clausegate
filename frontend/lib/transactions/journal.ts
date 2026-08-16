import type { TransactionReceipt } from "@/lib/contracts/types";

export type PendingExpected =
  | { kind: "rulebook"; id: string; title: string; description: string; rules: string }
  | { kind: "submission"; id: string; rulebookId: string; title: string; proposalText: string }
  | { kind: "review"; id: string };

/**
 * A journalled transaction. `outcome` distinguishes the three states the
 * recovery path must keep separate:
 *   - "pending": a hash exists but its outcome is not yet known. It must be
 *     reconciled by observation, never re-sent.
 *   - "failed": the transaction conclusively failed consensus/execution. Kept
 *     as an auditable record so the UI can surface it; still never re-sent
 *     automatically.
 * A successful, postcondition-verified transaction is removed from the journal.
 */
export interface PendingTransaction {
  key: string;
  action: string;
  entityId: string;
  hash: string;
  createdAt: string;
  outcome?: "pending" | "failed";
  detail?: string;
  expected?: PendingExpected;
}

const JOURNAL_KEY = "clausegate:pending-transactions";

function readJournal(): PendingTransaction[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(JOURNAL_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeJournal(entries: PendingTransaction[]) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(JOURNAL_KEY, JSON.stringify(entries));
  }
}

export function pendingKey(action: string, entityId: string) {
  return `${action}:${entityId}`;
}

export function getPendingTransactions() {
  return readJournal();
}

export function getPendingTransaction(action: string, entityId: string) {
  return readJournal().find((entry) => entry.key === pendingKey(action, entityId));
}

export function rememberTransaction(
  action: string,
  entityId: string,
  hash: string,
  expected?: PendingExpected,
) {
  const entry: PendingTransaction = {
    key: pendingKey(action, entityId),
    action,
    entityId,
    hash,
    createdAt: new Date().toISOString(),
    outcome: "pending",
    ...(expected ? { expected } : {}),
  };
  writeJournal([...readJournal().filter((item) => item.key !== entry.key), entry]);
  return entry;
}

/**
 * Record that the transaction for this action conclusively failed. The entry is
 * retained (not deleted) so the failure is auditable and, because a hash is
 * present, the write path will reconcile it rather than blindly re-sending.
 */
export function markTransactionFailed(action: string, entityId: string, detail: string) {
  const key = pendingKey(action, entityId);
  const existing = readJournal().find((entry) => entry.key === key);
  if (!existing) return;
  const updated: PendingTransaction = { ...existing, outcome: "failed", detail };
  writeJournal([...readJournal().filter((entry) => entry.key !== key), updated]);
}

/** Remove a journalled transaction. Called only after a verified success. */
export function clearTransaction(action: string, entityId: string, receipt?: TransactionReceipt) {
  void receipt;
  writeJournal(readJournal().filter((entry) => entry.key !== pendingKey(action, entityId)));
}
