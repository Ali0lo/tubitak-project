import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // "Hand-kept ledger" token system.
        paper: {
          DEFAULT: "#F5F6F3", // cool paper background, deliberately not cream
          raised: "#FFFFFF",
          line: "#E4E6E1", // hairline rule color
        },
        ink: {
          DEFAULT: "#20241F", // near-black warm charcoal, primary text
          muted: "#5B655C",
          faint: "#8A9A8E",
        },
        forest: {
          DEFAULT: "#1F4B43", // deep teal-ink, primary accent
          dark: "#163731",
          light: "#2F6B5E",
          tint: "#E6EDEA",
        },
        amber: {
          DEFAULT: "#C9762C", // burnt amber, secondary accent
          dark: "#A65F20",
          tint: "#F6E9D9",
        },
        brick: {
          DEFAULT: "#9B3A2E", // urgent/danger, deliberately not bright red
          tint: "#F3E1DE",
        },
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "serif"],
        sans: ["var(--font-plex-sans)", "sans-serif"],
        mono: ["var(--font-plex-mono)", "monospace"],
      },
      boxShadow: {
        ledger: "0 1px 0 0 rgba(32, 36, 31, 0.06)",
      },
      borderRadius: {
        seal: "0.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
