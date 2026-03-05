"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { createThirdwebClient } from "thirdweb";
import { sepolia } from "thirdweb/chains";
import type { Theme } from "@/lib/theme";

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "demo",
});

// Lazily load the ConnectButton so the main dashboard UI can render
// before the heavy wallet UI bundle is ready.
const ConnectButton = dynamic(
  () => import("thirdweb/react").then((m) => m.ConnectButton),
  { ssr: false }
);

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/verify": "Verify Agent",
  "/attest": "Request Attestation",
  "/demo": "Agent Demo",
};

function SunIcon() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="5" />
      <path strokeLinecap="round" d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  );
}

interface HeaderProps {
  onMenuToggle: () => void;
  theme: Theme;
  onToggleTheme: () => void;
}

export function Header({ onMenuToggle, theme, onToggleTheme }: HeaderProps) {
  const pathname = usePathname();
  const pageTitle = PAGE_TITLES[pathname] ?? "AAS";

  return (
    <header className="h-16 border-b border-card-border bg-card flex items-center justify-between px-5 sm:px-7 gap-4 flex-shrink-0 card-shadow">
      {/* Left: hamburger (mobile) + page title */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 rounded-lg text-muted hover:text-foreground hover:bg-card-hover transition-colors"
          aria-label="Open menu"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <h1 className="text-2xl font-bold text-foreground tracking-tight">{pageTitle}</h1>
      </div>

      {/* Right: network badge + actions */}
      <div className="flex items-center gap-1.5">
        <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-full bg-cl-green/10 text-cl-green border border-cl-green/20 mr-2">
          <span className="w-1.5 h-1.5 rounded-full bg-cl-green animate-pulse" />
          Sepolia
        </span>

        {/* Bell */}
        <button className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-card-hover transition-colors" aria-label="Notifications">
          <BellIcon />
        </button>

        {/* Theme toggle */}
        <button
          onClick={onToggleTheme}
          className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-card-hover transition-colors"
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
        </button>

        <div className="ml-1">
          <ConnectButton
            client={client}
            chain={sepolia}
            connectButton={{
              label: "Connect Wallet",
              style: {
                fontSize: "12px",
                height: "34px",
                padding: "0 14px",
                borderRadius: "8px",
                background: "rgba(8, 71, 247, 0.1)",
                border: "1px solid rgba(8, 71, 247, 0.25)",
                color: "var(--cl-blue-light)",
                fontWeight: "600",
                letterSpacing: "0.01em",
              },
            }}
          />
        </div>
      </div>
    </header>
  );
}
