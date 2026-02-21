"use client";

import { ConnectButton } from "thirdweb/react";
import { createThirdwebClient } from "thirdweb";
import { sepolia } from "thirdweb/chains";

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "demo",
});

export function Header() {
  return (
    <header className="h-16 border-b border-[#1e1e2e] bg-[#111118] flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <h2 className="text-sm font-medium text-gray-400">
          Verifiable Trust Layer for AI Agents
        </h2>
        <span className="px-2 py-0.5 text-[10px] rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
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
              background: "rgba(59, 130, 246, 0.1)",
              border: "1px solid rgba(59, 130, 246, 0.3)",
              color: "#93c5fd",
            },
          }}
        />
      </div>
    </header>
  );
}
