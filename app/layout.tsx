import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Nav } from "@/components/Nav"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
})

export const metadata: Metadata = {
  title: "The Breslin Fork & Spoon",
  description: "Weekly meal planning for the Breslin family",
  manifest: "/manifest.json",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FFFAF5",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans`}>
        {/* Desktop top nav */}
        <Nav />
        {/* Main content — padded for bottom nav on mobile */}
        <main className="min-h-screen pb-20 md:pb-6 pt-4 md:pt-0">
          {children}
        </main>
      </body>
    </html>
  )
}
