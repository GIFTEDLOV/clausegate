import { formatAddress } from "@/lib/genlayer/wallet";

export function AddressDisplay({ address }: { address: string | null }) {
  if (!address) return null;
  return <span title={address} className="font-mono text-xs">{formatAddress(address, 13)}</span>;
}
