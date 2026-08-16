import { EXPLORER } from "./network";

export function contractExplorerUrl(address: string): string {
  return `${EXPLORER}/address/${address}`;
}

export function transactionExplorerUrl(hash: string): string {
  return `${EXPLORER}/tx/${hash}`;
}
