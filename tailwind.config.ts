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
    },
  },
  plugins: [typography],
}

export default config
