import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { ThirdwebProvider } from "@/components/providers/ThirdwebProvider";

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

// Inline script runs before hydration to prevent flash-of-wrong-theme
const themeScript = `
try {
  var t = localStorage.getItem('theme');
  if (t === 'light') {
    document.documentElement.classList.remove('dark');
  } else {
    document.documentElement.classList.add('dark');
  }
} catch(e) {
  document.documentElement.classList.add('dark');
}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
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
