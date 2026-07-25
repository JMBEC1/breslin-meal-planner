import type { Config } from "tailwindcss"
import typography from "@tailwindcss/typography"

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Scran palette — dark ink UI, one tomato accent.
        // Token names kept for compatibility; values re-pointed.
        meal: {
          cream: "#121211",     // page background (near-black ink)
          card: "#1C1C1A",      // raised surfaces: cards, inputs, modals
          warm: "#292927",      // borders, subtle fills, hover states
          sage: "#D5522F",      // tomato — interactive: buttons, active nav, links
          sageHover: "#E0603C",
          coral: "#D5522F",     // tomato — the accent (matches the dot)
          amber: "#C9A03C",     // ochre — gluten warning
          sky: "#6E93B0",
          plum: "#8A80A0",      // slate lavender — special / manual picks
          charcoal: "#F0F0EC",  // primary text (off-white)
          muted: "#96968F",     // secondary text
          gf: "#4E9960",        // green — reserved for GF badges only
        },
      },
      fontFamily: {
        sans: ["var(--font-jost)", "system-ui", "sans-serif"],
        display: ["var(--font-space-grotesk)", "var(--font-jost)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        // Dark-theme elevation. Black drop shadows are invisible on #121211, so
        // "lift" is built from LIGHT: a hairline rim (light 1px ring) + a top
        // highlight, brightening + a faint halo on hover. Redefines shadow-sm /
        // shadow-md, so every card and tile that already uses them lifts.
        // Tune the white alphas up/down for a stronger/softer edge.
        sm: "0 0 0 1px rgb(255 255 255 / 0.06), inset 0 1px 0 0 rgb(255 255 255 / 0.07)",
        md: "0 0 0 1px rgb(255 255 255 / 0.12), inset 0 1px 0 0 rgb(255 255 255 / 0.12), 0 0 22px -6px rgb(255 255 255 / 0.06)",
        // Warm halo for the primary buttons — colour from --glow-rgb (globals.css),
        // so amber/silver is a one-line swap. No negative spread, so it actually
        // shows. glow-lg is the hover state. Drop the 0.55/0.80 alphas to soften.
        glow: "0 0 18px 0 rgb(var(--glow-rgb) / 0.55), inset 0 1px 0 0 rgb(255 255 255 / 0.18)",
        "glow-lg": "0 0 30px 2px rgb(var(--glow-rgb) / 0.80), inset 0 1px 0 0 rgb(255 255 255 / 0.22)",
      },
    },
  },
  plugins: [typography],
}

export default config
