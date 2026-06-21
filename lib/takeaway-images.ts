// Takeaway type → background image. Files live in public/takeaway/.
// Slot custom_text "Takeaway: Sushi" → /takeaway/sushi.jpg.

const TAKEAWAY_IMAGE_MAP: Record<string, string> = {
  sushi: "/takeaway/sushi.jpg",
  pizza: "/takeaway/pizza.jpg",
  thai: "/takeaway/thai.jpg",
  indian: "/takeaway/indian.jpg",
}

// Match "Takeaway: <type>" (case-insensitive) and return the matching image path.
// Returns null for generic "Takeaway" with no type, or any unknown type.
export function getTakeawayImage(customText: string | null | undefined): string | null {
  if (!customText) return null
  const match = customText.match(/^Takeaway:\s*(.+?)\s*$/i)
  if (!match) return null
  const key = match[1].toLowerCase()
  return TAKEAWAY_IMAGE_MAP[key] ?? null
}
