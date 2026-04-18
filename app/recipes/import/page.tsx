"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function ImportRecipePage() {
  const router = useRouter()
  const [tab, setTab] = useState<"url" | "image">("url")
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleUrlImport(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) return
    setLoading(true)
    setError("")
    setPreview(null)

    const res = await fetch("/api/recipes/import-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url.trim() }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error || "Import failed")
      return
    }
    setPreview(data)
  }

  async function handleImageImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    setError("")
    setPreview(null)

    const formData = new FormData()
    formData.append("image", file)

    const res = await fetch("/api/recipes/import-image", {
      method: "POST",
      body: formData,
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error || "Import failed")
      return
    }
    setPreview(data)
  }

  async function handleSave() {
    if (!preview) return
    setSaving(true)

    const res = await fetch("/api/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(preview),
    })

    if (res.ok) {
      const recipe = await res.json()
      router.push(`/recipes/${recipe.id}`)
    } else {
      setSaving(false)
      setError("Failed to save recipe")
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-6 py-6">
      <Link href="/recipes" className="inline-flex items-center gap-1 text-sm text-meal-muted hover:text-meal-sage mb-4">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back to recipes
      </Link>

      <h1 className="text-2xl font-bold text-meal-charcoal mb-6">Import Recipe</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-meal-warm rounded-lg p-1 mb-6">
        <button
          onClick={() => { setTab("url"); setPreview(null); setError("") }}
          className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "url" ? "bg-white text-meal-charcoal shadow-sm" : "text-meal-muted"
          }`}
        >
          From URL
        </button>
        <button
          onClick={() => { setTab("image"); setPreview(null); setError("") }}
          className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "image" ? "bg-white text-meal-charcoal shadow-sm" : "text-meal-muted"
          }`}
        >
          From Image
        </button>
      </div>

      {/* URL Import */}
      {tab === "url" && (
        <form onSubmit={handleUrlImport} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-meal-charcoal mb-1">Recipe URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.example.com/recipe/..."
              className="w-full px-4 py-2.5 rounded-lg bg-white border border-meal-warm focus:outline-none focus:ring-2 focus:ring-meal-sage/30 focus:border-meal-sage"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="px-6 py-2.5 rounded-lg bg-meal-sage text-white font-medium hover:bg-meal-sageHover transition-colors disabled:opacity-50"
          >
            {loading ? "Extracting recipe..." : "Import from URL"}
          </button>
        </form>
      )}

      {/* Image Import */}
      {tab === "image" && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-meal-charcoal mb-1">Upload Recipe Image</label>
            <p className="text-sm text-meal-muted mb-3">Take a photo of a recipe from a book, magazine, or handwritten note.</p>
            <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-meal-warm rounded-xl cursor-pointer hover:border-meal-sage transition-colors">
              <svg className="w-8 h-8 text-meal-muted mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <span className="text-sm text-meal-muted">{loading ? "Extracting recipe..." : "Tap to upload image"}</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleImageImport} disabled={loading} />
            </label>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 rounded-lg text-sm text-red-600">{error}</div>
      )}

      {/* Preview */}
      {preview && (
        <div className="mt-6 bg-white rounded-xl p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-meal-charcoal mb-4">Preview</h2>

          <div className="space-y-3 text-sm">
            <div>
              <span className="font-medium">Title:</span> {preview.title as string}
            </div>
            <div>
              <span className="font-medium block mb-1.5">Category:</span>
              <div className="flex gap-2">
                {([
                  { value: "school-lunch", label: "School Lunch", colour: "bg-meal-sky" },
                  { value: "dinner", label: "Dinner", colour: "bg-meal-coral" },
                  { value: "fancy", label: "Special Occasion", colour: "bg-meal-plum" },
                  { value: "side", label: "Side", colour: "bg-meal-sage" },
                ] as const).map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setPreview((prev) => prev ? { ...prev, category: cat.value } : prev)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      preview.category === cat.value
                        ? `${cat.colour} text-white`
                        : "bg-meal-warm text-meal-charcoal hover:opacity-80"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="font-medium">Gluten Free:</span> {(preview.is_gluten_free as boolean) ? "Yes" : "No"}
            </div>
            {(preview.gluten_warnings as string[])?.length > 0 && (
              <div className="p-3 bg-meal-amber/10 rounded-lg">
                <span className="font-medium text-meal-amber">Gluten warnings:</span>{" "}
                {(preview.gluten_warnings as string[]).join(", ")}
              </div>
            )}
            <div>
              <span className="font-medium">Ingredients:</span> {(preview.ingredients as unknown[])?.length || 0} items
            </div>
            <div>
              <span className="font-medium">Description:</span> {preview.description as string}
            </div>
          </div>

          <div className="flex gap-3 mt-5">
            <button
              onClick={() => setPreview(null)}
              className="px-4 py-2 rounded-lg bg-meal-warm text-meal-charcoal text-sm font-medium hover:bg-meal-warm/80 transition-colors"
            >
              Discard
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-meal-sage text-white text-sm font-medium hover:bg-meal-sageHover transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Recipe"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
