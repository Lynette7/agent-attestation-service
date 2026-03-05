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
        muted: "var(--muted)",
        // Chainlink Brand — Primary
        "cl-blue": {
          DEFAULT: "#0847F7",
          light: "var(--cl-blue-light)",
          muted: "var(--cl-blue-muted)",
          50: "#eff4ff",
        },
        "cl-dark": "var(--cl-dark)",
        // Chainlink Brand — Secondary
        "cl-green": "var(--cl-green)",
        "cl-orange": "#E54918",
        "cl-yellow": {
          DEFAULT: "var(--cl-yellow)",
          light: "#FCD34D",
        },
        "cl-purple": "var(--cl-purple)",
        // Card system
        card: {
          DEFAULT: "var(--card)",
          border: "var(--card-border)",
          hover: "var(--card-hover)",
        },
        // Sidebar
        sidebar: {
          DEFAULT: "var(--sidebar-bg)",
          border: "var(--sidebar-border)",
        },
        // Input
        "input-bg": "var(--input-bg)",
        "input-border": "var(--input-border)",
      },
    },
  },
  plugins: [],
};
export default config;
