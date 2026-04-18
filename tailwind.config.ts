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
        meal: {
          cream: "#FFFAF5",
          warm: "#F5E6D3",
          sage: "#7C9A6E",
          sageHover: "#6B8A5D",
          coral: "#E8836B",
          amber: "#D4A843",
          sky: "#6BA3BE",
          plum: "#8B5E83",
          charcoal: "#2D2D2D",
          muted: "#8B8178",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [typography],
}

export default config
