import type { TransactionReceipt } from "@/lib/contracts/types";

export interface PendingTransaction {
  key: string;
  action: string;
  entityId: string;
  hash: string;
  createdAt: string;
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

export function rememberTransaction(action: string, entityId: string, hash: string) {
  const entry: PendingTransaction = {
    key: pendingKey(action, entityId),
    action,
    entityId,
    hash,
    createdAt: new Date().toISOString(),
  };
  writeJournal([...readJournal().filter((item) => item.key !== entry.key), entry]);
  return entry;
}

export function clearTransaction(action: string, entityId: string, receipt?: TransactionReceipt) {
  void receipt;
  writeJournal(readJournal().filter((entry) => entry.key !== pendingKey(action, entityId)));
}

