"use client"

import { useState } from "react"
import { suggestRecipeImages } from "@/lib/images"
import type { Recipe } from "@/types"

interface Props {
  recipe: Recipe
  onSaved: (updated: Recipe) => void
  onClose: () => void
}

export function ImagePickerModal({ recipe, onSaved, onClose }: Props) {
  const [urlInput, setUrlInput] = useState("")
  const [saving, setSaving] = useState(false)

  async function apply(url: string) {
    if (!url.trim()) return
    setSaving(true)
    const res = await fetch(`/api/recipes/${recipe.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: url.trim() }),
    })
    if (res.ok) {
      const updated = await res.json()
      onSaved(updated)
      onClose()
    }
    setSaving(false)
  }

  function close() {
    if (!saving) onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-4"
      onClick={close}
    >
      <div
        className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 pb-3 border-b border-meal-cream">
          <h3 className="text-lg font-semibold text-meal-charcoal">Change image</h3>
          <p className="text-xs text-meal-muted mt-0.5 truncate">{recipe.title}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {recipe.image_url && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-meal-muted mb-1.5">Current</p>
              <div className="relative aspect-video rounded-lg overflow-hidden bg-meal-cream">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={recipe.image_url} alt="" className="w-full h-full object-cover" />
              </div>
            </div>
          )}

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-meal-muted mb-1.5">Suggestions</p>
            <div className="grid grid-cols-2 gap-2">
              {suggestRecipeImages(recipe.title, recipe.image_url ?? undefined, 8).map((url) => (
                <button
                  key={url}
                  onClick={() => apply(url)}
                  disabled={saving}
                  className="relative aspect-video rounded-lg overflow-hidden hover:ring-2 hover:ring-meal-sage transition-all disabled:opacity-50"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-meal-muted mb-1.5">Paste an image URL</p>
            <div className="flex gap-2">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://..."
                className="flex-1 px-3 py-2 rounded-lg bg-meal-cream border border-meal-warm focus:outline-none focus:ring-2 focus:ring-meal-sage/30 text-sm"
              />
              <button
                onClick={() => apply(urlInput)}
                disabled={saving || !urlInput.trim()}
                className="px-3 py-2 rounded-lg bg-meal-sage text-white text-sm font-medium hover:bg-meal-sageHover disabled:opacity-50"
              >
                {saving ? "..." : "Use"}
              </button>
            </div>
          </div>
        </div>

        <div className="p-5 pt-3 border-t border-meal-cream">
          <button
            onClick={close}
            disabled={saving}
            className="w-full py-2.5 rounded-lg bg-meal-warm text-meal-charcoal text-sm font-medium hover:bg-meal-warm/80 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
