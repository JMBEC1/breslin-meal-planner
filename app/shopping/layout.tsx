import { Suspense } from "react"

export default function ShoppingLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className="max-w-2xl mx-auto px-4 py-12 text-center text-meal-muted">Loading...</div>}>{children}</Suspense>
}
