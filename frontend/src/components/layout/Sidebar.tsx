"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    label: "Dashboard",
    href: "/",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    label: "Verify Agent",
    href: "/verify",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
  {
    label: "Request Attestation",
    href: "/attest",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
    ),
  },
  {
    label: "Agent Demo",
    href: "/demo",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
];

/** Chainlink hexagon logo (simplified SVG) */
function ChainlinkHexIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 37 42" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18.5 0L37 10.5V31.5L18.5 42L0 31.5V10.5L18.5 0Z" fill="currentColor" />
      <path d="M18.5 8L28.5 13.5V26.5L18.5 32L8.5 26.5V13.5L18.5 8Z" fill="#0B101C" />
      <path d="M18.5 14L23.5 16.75V23.25L18.5 26L13.5 23.25V16.75L18.5 14Z" fill="currentColor" />
    </svg>
  );
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-card-border flex flex-col",
        "transition-transform duration-300 ease-in-out",
        "lg:relative lg:z-auto lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      {/* Logo */}
      <div className="p-6 border-b border-card-border flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3" onClick={onClose}>
          <div className="w-9 h-9 rounded-lg cl-gradient flex items-center justify-center">
            <ChainlinkHexIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">AAS</h1>
            <p className="text-[10px] text-slate-500 tracking-widest uppercase">
              Agent Attestation
            </p>
          </div>
        </Link>

        {/* Close button — mobile only */}
        <button
          onClick={onClose}
          className="lg:hidden p-1.5 rounded-md text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
          aria-label="Close menu"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200",
                isActive
                  ? "bg-cl-blue/10 text-cl-blue-light border border-cl-blue/20"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-card-border space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-600 uppercase tracking-wider">Built on</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {["CRE", "EAS", "UltraHonk", "Noir"].map((tech) => (
            <span
              key={tech}
              className="px-2 py-0.5 text-[10px] rounded-md bg-cl-blue/5 text-cl-blue-light/60 border border-cl-blue/10"
            >
              {tech}
            </span>
          ))}
        </div>
        <p className="text-[10px] text-slate-700">Convergence Hackathon 2026</p>
      </div>
    </aside>
  );
}
