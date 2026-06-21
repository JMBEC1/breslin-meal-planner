// Takeaway type → background image. Two layers:
//
//   1. STATIC fallback: files dropped in public/takeaway/. Always there as
//      a baseline so things look right out of the box.
//   2. OVERRIDES: URLs uploaded by the user (Vercel Blob, persisted in
//      Neon `takeaway_images`). Loaded on the home page mount and passed
//      to slot renderers as a small map.
//
// The slot custom_text "Takeaway: Sushi" → /takeaway/sushi.jpg unless
// the user has uploaded their own — then that URL wins.

const STATIC_TAKEAWAY_IMAGE_MAP: Record<string, string> = {
  sushi: "/takeaway/sushi.jpg",
  pizza: "/takeaway/pizza.jpg",
  thai: "/takeaway/thai.jpg",
  indian: "/takeaway/indian.jpg",
}

export const TAKEAWAY_TYPE_KEYS = ["sushi", "pizza", "thai", "indian", "burgers", "other"] as const
export type TakeawayKey = (typeof TAKEAWAY_TYPE_KEYS)[number]

// Match "Takeaway: <type>" (case-insensitive) and return the matching image
// URL. Override map wins over the static fallback. Returns null when no
// match (generic "Takeaway" with no type, or an unknown type with no upload).
export function getTakeawayImage(
  customText: string | null | undefined,
  overrides?: Record<string, string>,
): string | null {
  if (!customText) return null
  const match = customText.match(/^Takeaway:\s*(.+?)\s*$/i)
  if (!match) return null
  const key = match[1].toLowerCase()
  return overrides?.[key] ?? STATIC_TAKEAWAY_IMAGE_MAP[key] ?? null
}

// Used by the manager modal — returns the URL for a specific type, override
// first, then static, then null.
export function getTakeawayImageForType(
  type: string,
  overrides?: Record<string, string>,
): string | null {
  const key = type.toLowerCase()
  return overrides?.[key] ?? STATIC_TAKEAWAY_IMAGE_MAP[key] ?? null
}
