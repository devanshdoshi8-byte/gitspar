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
      colors: {
        background: "#0a0f1d",
        foreground: "#f8fafc",
        spar: {
          navy: "#0f172a",
          darker: "#090d16",
          card: "#111827",
          border: "#1e293b",
          accent: "#2563eb",
          accentHover: "#1d4ed8",
          emerald: "#10b981",
          emeraldBg: "#064e3b",
          red: "#ef4444",
          redBg: "#7f1d1d",
          muted: "#94a3b8",
        },
      },
    },
  },
  plugins: [],
};
export default config;
