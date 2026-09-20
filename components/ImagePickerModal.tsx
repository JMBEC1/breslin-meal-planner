"use client"

import { useRef, useState } from "react"
import { suggestRecipeImages } from "@/lib/images"
import { downscaleImage } from "@/lib/downscale"
import type { Recipe } from "@/types"

interface Props {
  recipe: Recipe
  onSaved: (updated: Recipe) => void
  onClose: () => void
}

export function ImagePickerModal({ recipe, onSaved, onClose }: Props) {
  const [urlInput, setUrlInput] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Two inputs, not one: `capture` sends a phone straight to the camera, and
  // without it the same control opens the photo library. Desktop ignores
  // `capture` and shows a file dialog either way.
  const cameraRef = useRef<HTMLInputElement>(null)
  const libraryRef = useRef<HTMLInputElement>(null)

  async function upload(file: File) {
    setError(null)
    setSaving(true)
    try {
      const body = new FormData()
      body.append("file", await downscaleImage(file))
      const res = await fetch(`/api/recipes/${recipe.id}/image`, { method: "POST", body })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error ?? "That photo wouldn't upload.")
        return
      }
      onSaved(await res.json())
      onClose()
    } catch {
      setError("That photo wouldn't upload.")
    } finally {
      setSaving(false)
    }
  }

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
        className="bg-meal-card rounded-t-2xl md:rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col"
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
            <p className="text-[10px] font-bold uppercase tracking-wider text-meal-muted mb-1.5">Your own photo</p>
            <div className="flex gap-2">
              <button
                onClick={() => cameraRef.current?.click()}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-meal-sage text-white text-sm font-medium hover:bg-meal-sageHover disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                </svg>
                Take a photo
              </button>
              <button
                onClick={() => libraryRef.current?.click()}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-meal-warm text-meal-charcoal text-sm font-medium hover:bg-meal-warm/80 disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
                Choose photo
              </button>
            </div>
            <input
              ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = "" }}
            />
            <input
              ref={libraryRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = "" }}
            />
            {saving && <p className="text-xs text-meal-muted mt-2">Uploading…</p>}
            {error && <p className="text-xs text-meal-coral mt-2">{error}</p>}
          </div>

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
