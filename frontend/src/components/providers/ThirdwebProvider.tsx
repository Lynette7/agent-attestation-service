"use client";

import { ThirdwebProvider as TwProvider } from "thirdweb/react";

export function ThirdwebProvider({ children }: { children: React.ReactNode }) {
  return <TwProvider>{children}</TwProvider>;
}
