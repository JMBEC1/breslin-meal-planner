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
        // Dark-theme elevation. Pure black drop shadows are invisible on ink, so
        // the "lift" is sold by a hairline top highlight catching the light plus a
        // soft depth shadow. Redefines shadow-sm / shadow-md, so every card, tile
        // and raised surface that already uses them lifts automatically.
        // Tune the inset alpha (edge brightness) and the -Npx spread (depth) here.
        sm: "inset 0 1px 0 0 rgb(255 255 255 / 0.05), 0 8px 22px -14px rgb(0 0 0 / 0.85)",
        md: "inset 0 1px 0 0 rgb(255 255 255 / 0.07), 0 16px 36px -18px rgb(0 0 0 / 0.9)",
        // Warm glow for the primary buttons — colour from --glow-rgb (globals.css),
        // so amber/silver is a one-line swap. glow-lg is the hover state.
        glow: "inset 0 1px 0 0 rgb(255 255 255 / 0.14), 0 6px 16px -8px rgb(0 0 0 / 0.5), 0 0 20px -5px rgb(var(--glow-rgb) / 0.40)",
        "glow-lg": "inset 0 1px 0 0 rgb(255 255 255 / 0.18), 0 8px 20px -8px rgb(0 0 0 / 0.5), 0 0 30px -3px rgb(var(--glow-rgb) / 0.60)",
      },
    },
  },
  plugins: [typography],
}

export default config
