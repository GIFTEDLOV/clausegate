"use client";

import { useState } from "react";
import { ChevronDown, Copy, LogOut, WalletCards } from "lucide-react";

import { AddressDisplay } from "./AddressDisplay";
import { useWallet } from "@/lib/genlayer/WalletProvider";

export function AccountPanel() {
  const { address, isConnected, isLoading, connectWallet, disconnectWallet, isOnCorrectNetwork } = useWallet();
  const [open, setOpen] = useState(false);

  if (!isConnected || !address) {
    return (
      <button
        className="button-primary button-small"
        onClick={() => void connectWallet()}
        disabled={isLoading}
      >
        <WalletCards size={15} />
        {isLoading ? "Connecting…" : "Connect wallet"}
      </button>
    );
  }

  return (
    <div className="relative">
      <button className="wallet-pill" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span className={`status-dot ${isOnCorrectNetwork ? "status-dot-good" : "status-dot-warn"}`} />
        <AddressDisplay address={address} />
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="wallet-menu" role="menu">
          <div className="space-y-1 border-b border-line pb-3">
            <p className="eyebrow">Connected wallet</p>
            <p className="break-all font-mono text-xs text-muted">{address}</p>
            <p className="text-xs text-muted">{isOnCorrectNetwork ? "GenLayer network" : "Switch to GenLayer"}</p>
          </div>
          <button
            className="menu-action"
            onClick={() => void navigator.clipboard?.writeText(address)}
          >
            <Copy size={14} /> Copy address
          </button>
          <button className="menu-action" onClick={disconnectWallet}>
            <LogOut size={14} /> Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
