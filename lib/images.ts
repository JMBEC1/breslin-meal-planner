/**
 * Generate a food image URL for a recipe.
 * Uses Unsplash with a fallback to a deterministic placeholder.
 */
export async function fetchRecipeImage(title: string): Promise<string | null> {
  const query = title
    .replace(/\(.*?\)/g, "")
    .replace(/GF|gluten.free/gi, "")
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join("+")

  if (!query) return null

  // Try Unsplash napi
  try {
    const url = `https://unsplash.com/napi/search/photos?query=${encodeURIComponent(query + " food")}&per_page=1&orientation=landscape`
    const res = await fetch(url, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok) {
      const data = await res.json()
      const photo = data.results?.[0]
      if (photo?.urls?.small) {
        return photo.urls.small
      }
    }
  } catch { /* fallback */ }

  // Deterministic fallback — picsum with seed from title
  let hash = 0
  for (let i = 0; i < title.length; i++) {
    hash = ((hash << 5) - hash) + title.charCodeAt(i)
    hash |= 0
  }
  return `https://picsum.photos/seed/${Math.abs(hash) % 1000}/800/600`
}
