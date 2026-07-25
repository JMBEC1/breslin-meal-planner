import type { Metadata, Viewport } from "next"
import localFont from "next/font/local"
import "./globals.css"
import { Nav } from "@/components/Nav"

const jost = localFont({
  src: [
    { path: "./fonts/jost-latin-300-normal.woff2", weight: "300" },
    { path: "./fonts/jost-latin-400-normal.woff2", weight: "400" },
    { path: "./fonts/jost-latin-500-normal.woff2", weight: "500" },
    { path: "./fonts/jost-latin-600-normal.woff2", weight: "600" },
    { path: "./fonts/jost-latin-700-normal.woff2", weight: "700" },
  ],
  variable: "--font-jost",
})

const spaceGrotesk = localFont({
  src: [
    { path: "./fonts/space-grotesk-latin-500-normal.woff2", weight: "500" },
    { path: "./fonts/space-grotesk-latin-700-normal.woff2", weight: "700" },
  ],
  variable: "--font-space-grotesk",
})

export const metadata: Metadata = {
  title: "Scran",
  description: "The Breslin family dinner planner",
  manifest: "/manifest.json",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#121211",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${jost.variable} ${spaceGrotesk.variable} font-sans`}>
        <Nav />
        <main className="min-h-screen pb-20 md:pb-6 pt-4 md:pt-0">
          {children}
        </main>
      </body>
    </html>
  )
}
