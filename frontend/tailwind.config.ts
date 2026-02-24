import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Chainlink Brand — Primary
        "cl-blue": {
          DEFAULT: "#0847F7",
          light: "#8AA6F9",
          muted: "#1e3a8a",
          50: "#eff4ff",
        },
        "cl-dark": "#0B101C",
        // Chainlink Brand — Secondary
        "cl-green": "#217B71",
        "cl-orange": "#E54918",
        "cl-yellow": {
          DEFAULT: "#F7B808",
          light: "#FCD34D",
        },
        "cl-purple": "#4A21C2",
        // Card system
        card: {
          DEFAULT: "#111827",
          border: "#1e293b",
        },
      },
    },
  },
  plugins: [],
};
export default config;
