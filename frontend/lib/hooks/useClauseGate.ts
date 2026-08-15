"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import ClauseGate from "@/lib/contracts/ClauseGate";
import { getContractAddress } from "@/lib/genlayer/client";
import { useWallet } from "@/lib/genlayer/WalletProvider";
import type { Rulebook, Submission } from "@/lib/contracts/types";

export function useClauseGateContract() {
  const { address } = useWallet();
  const contractAddress = getContractAddress();
  return useMemo(
    () => (contractAddress ? new ClauseGate(contractAddress, address) : null),
    [address, contractAddress],
  );
}

export function useRulebooks() {
  const contract = useClauseGateContract();
  return useQuery<Rulebook[], Error>({
    queryKey: ["clausegate", "rulebooks"],
    queryFn: () => contract!.getRulebooks(),
    enabled: Boolean(contract),
    staleTime: 4_000,
  });
}

export function useRulebook(id: string) {
  const contract = useClauseGateContract();
  return useQuery<Rulebook, Error>({
    queryKey: ["clausegate", "rulebook", id],
    queryFn: () => contract!.getRulebook(id),
    enabled: Boolean(contract && id),
    staleTime: 4_000,
  });
}

export function useSubmissions() {
  const contract = useClauseGateContract();
  return useQuery<Submission[], Error>({
    queryKey: ["clausegate", "submissions"],
    queryFn: () => contract!.getSubmissions(),
    enabled: Boolean(contract),
    staleTime: 4_000,
  });
}

export function useSubmission(id: string) {
  const contract = useClauseGateContract();
  return useQuery<Submission, Error>({
    queryKey: ["clausegate", "submission", id],
    queryFn: () => contract!.getSubmission(id),
    enabled: Boolean(contract && id),
    staleTime: 2_000,
  });
}

export function useCertificate(id: string, enabled: boolean) {
  const contract = useClauseGateContract();
  return useQuery({
    queryKey: ["clausegate", "certificate", id],
    queryFn: () => contract!.getCertificate(id),
    enabled: Boolean(contract && id && enabled),
    staleTime: 4_000,
  });
}
