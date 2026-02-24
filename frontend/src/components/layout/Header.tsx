"use client";

import { ConnectButton } from "thirdweb/react";
import { createThirdwebClient } from "thirdweb";
import { sepolia } from "thirdweb/chains";

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "demo",
});

export function Header() {
  return (
    <header className="h-16 border-b border-card-border bg-card flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <h2 className="text-sm font-medium text-slate-400">
          Verifiable Trust Layer for AI Agents
        </h2>
        <span className="px-2 py-0.5 text-[10px] rounded-full bg-cl-green/10 text-cl-green border border-cl-green/20">
          Sepolia
        </span>
      </div>

      <div className="flex items-center gap-4">
        <ConnectButton
          client={client}
          chain={sepolia}
          connectButton={{
            label: "Connect Wallet",
            style: {
              fontSize: "13px",
              height: "36px",
              padding: "0 16px",
              borderRadius: "8px",
              background: "rgba(8, 71, 247, 0.1)",
              border: "1px solid rgba(8, 71, 247, 0.3)",
              color: "#8AA6F9",
            },
          }}
        />
      </div>
    </header>
  );
}
