"use client";

import { ConnectButton } from "thirdweb/react";
import { createThirdwebClient } from "thirdweb";
import { sepolia } from "thirdweb/chains";

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "demo",
});

interface HeaderProps {
  onMenuToggle: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  return (
    <header className="h-16 border-b border-card-border bg-card flex items-center justify-between px-4 sm:px-6 gap-3 flex-shrink-0">
      <div className="flex items-center gap-3">
        {/* Hamburger button — mobile only */}
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 rounded-md text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
          aria-label="Open menu"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <h2 className="hidden sm:block text-sm font-medium text-slate-400">
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
