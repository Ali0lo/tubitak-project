import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // "Hand-kept ledger" token system with CSS custom variable values for Dark/Light mode support.
        paper: {
          DEFAULT: "var(--color-paper)",
          raised: "var(--color-paper-raised)",
          line: "var(--color-paper-line)",
        },
        ink: {
          DEFAULT: "var(--color-ink)",
          muted: "var(--color-ink-muted)",
          faint: "var(--color-ink-faint)",
        },
        forest: {
          DEFAULT: "var(--color-forest)",
          dark: "var(--color-forest-dark)",
          light: "var(--color-forest-light)",
          tint: "var(--color-forest-tint)",
        },
        amber: {
          DEFAULT: "var(--color-amber)",
          dark: "var(--color-amber-dark)",
          tint: "var(--color-amber-tint)",
        },
        brick: {
          DEFAULT: "var(--color-brick)",
          tint: "var(--color-brick-tint)",
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
