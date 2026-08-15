"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { WalletProvider } from "@/lib/genlayer/WalletProvider";
import { getContractAddress } from "@/lib/genlayer/client";
import ClauseGate from "@/lib/contracts/ClauseGate";
import { clearTransaction, getPendingTransactions } from "@/lib/transactions/journal";
import { useWallet } from "@/lib/genlayer/WalletProvider";

function TransactionRecovery() {
  const { address } = useWallet();

  useEffect(() => {
    const contractAddress = getContractAddress();
    if (!contractAddress) return;
    const contract = new ClauseGate(contractAddress, address);
    let cancelled = false;

    void Promise.all(
      getPendingTransactions().map(async (entry) => {
        try {
          const receipt = await contract.waitForHash(entry.hash);
          if (!cancelled) clearTransaction(entry.action, entry.entityId, receipt);
        } catch {
          // The journal remains durable; a later visit can resume polling.
        }
      }),
    );
    return () => { cancelled = true; };
  }, [address]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  // Use useState to ensure QueryClient is only created once per component lifecycle
  // This prevents the client from being recreated on every render
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 2000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <WalletProvider>
        {children}
        <TransactionRecovery />
      </WalletProvider>
      <Toaster
        position="top-right"
        theme="dark"
        richColors
        closeButton
        offset="80px"
        toastOptions={{
          style: {
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            color: 'hsl(var(--foreground))',
            boxShadow: '0 8px 32px hsl(var(--background) / 0.8)',
          },
        }}
      />
    </QueryClientProvider>
  );
}
