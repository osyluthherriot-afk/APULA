import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Inter",
          "Segoe UI",
          "sans-serif",
        ],
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Inter",
          "Segoe UI",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      colors: {
        ap: {
          charcoal: "#0E1017",
          electric: "#0080FF",
          neon: "#8B00FF",
          pink: "#FF1493",
          teal: "#20B2AA",
          canvas: "#FFFFFF",
          surface: "#F5F5F7",
          stage: "#161617",
          primary: "#0071E3",
          accent: "#2997FF",
          ember: "#B64400",
        },
      },
    },
  },
  plugins: [],
};

export default config;
