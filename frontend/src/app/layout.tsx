import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { ThirdwebProvider } from "@/components/providers/ThirdwebProvider";

// Chainlink brand fonts: Inter for body/interface
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AAS — Agent Attestation Service",
  description:
    "Verifiable reputation & trust layer for autonomous AI agents. Two-tier attestation system powered by Chainlink CRE, EAS, and UltraHonk ZK proofs.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        <ThirdwebProvider>
          <AppShell>{children}</AppShell>
        </ThirdwebProvider>
      </body>
    </html>
  );
}
