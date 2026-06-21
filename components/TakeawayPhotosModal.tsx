"use client"

import { useRef, useState } from "react"
import { TAKEAWAY_TYPE_KEYS, getTakeawayImageForType, type TakeawayKey } from "@/lib/takeaway-images"

const MAX_BYTES = 4 * 1024 * 1024 // matches server cap; gives instant feedback before the upload round-trip

const LABEL: Record<TakeawayKey, string> = {
  sushi: "Sushi",
  pizza: "Pizza",
  thai: "Thai",
  indian: "Indian",
  burgers: "Burgers",
  other: "Other",
}

interface Props {
  overrides: Record<string, string>
  onChange: (next: Record<string, string>) => void
  onClose: () => void
}

export function TakeawayPhotosModal({ overrides, onChange, onClose }: Props) {
  const [busy, setBusy] = useState<TakeawayKey | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  async function upload(type: TakeawayKey, file: File) {
    setError(null)
    if (file.size > MAX_BYTES) {
      setError(`Image is ${(file.size / 1024 / 1024).toFixed(1)}MB — max is 4MB. Try a smaller file or compress it first.`)
      return
    }
    setBusy(type)
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch(`/api/takeaway-images/${type}`, { method: "POST", body: form })
      const data = await res.json()
      if (!res.ok) {
        setError(data.message || data.error || "Upload failed")
        return
      }
      onChange({ ...overrides, [type]: data.url })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setBusy(null)
    }
  }

  async function clear(type: TakeawayKey) {
    setError(null)
    setBusy(type)
    try {
      const res = await fetch(`/api/takeaway-images/${type}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.message || data.error || "Reset failed")
        return
      }
      const next = { ...overrides }
      delete next[type]
      onChange(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset failed")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-4"
      onClick={() => { if (!busy) onClose() }}
    >
      <div
        className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 pb-3 border-b border-meal-cream">
          <h3 className="text-lg font-semibold text-meal-charcoal">Takeaway photos</h3>
          <p className="text-xs text-meal-muted mt-0.5">
            Upload your own photo per cuisine. Used everywhere a takeaway slot shows up.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {error && (
            <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {TAKEAWAY_TYPE_KEYS.map((type) => {
              const url = getTakeawayImageForType(type, overrides)
              const isCustom = !!overrides[type]
              return (
                <div key={type} className="rounded-lg overflow-hidden border border-meal-warm bg-meal-cream/50">
                  <div className="relative aspect-video bg-meal-cream">
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt={LABEL[type]} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-meal-muted text-xs">
                        No photo
                      </div>
                    )}
                    {isCustom && (
                      <span className="absolute top-1.5 left-1.5 bg-meal-sage text-white text-[9px] font-bold uppercase px-1.5 py-0.5 rounded">
                        Yours
                      </span>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-sm font-semibold text-meal-charcoal mb-1.5">{LABEL[type]}</p>
                    <input
                      ref={(el) => { fileRefs.current[type] = el }}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) upload(type, file)
                        e.target.value = ""
                      }}
                    />
                    <div className="flex gap-1">
                      <button
                        onClick={() => fileRefs.current[type]?.click()}
                        disabled={busy !== null}
                        className="flex-1 px-2 py-1.5 rounded-md bg-meal-sage text-white text-xs font-medium hover:bg-meal-sageHover disabled:opacity-50"
                      >
                        {busy === type ? "..." : isCustom ? "Replace" : "Upload"}
                      </button>
                      {isCustom && (
                        <button
                          onClick={() => clear(type)}
                          disabled={busy !== null}
                          className="px-2 py-1.5 rounded-md bg-meal-warm text-meal-muted text-xs font-medium hover:text-meal-charcoal disabled:opacity-50"
                          title="Use the default photo again"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="p-5 pt-3 border-t border-meal-cream">
          <button
            onClick={onClose}
            disabled={busy !== null}
            className="w-full py-2.5 rounded-lg bg-meal-warm text-meal-charcoal text-sm font-medium hover:bg-meal-warm/80 disabled:opacity-50"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
