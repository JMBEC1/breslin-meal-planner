/**
 * Fetch a food image for a recipe title.
 * Uses multiple free image sources as fallbacks.
 */
export async function fetchRecipeImage(title: string): Promise<string | null> {
  const query = title
    .replace(/\(.*?\)/g, "")
    .replace(/GF|gluten.free/gi, "")
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join(" ")

  if (!query) return null

  // Try Pexels (free, no auth needed for their search page images)
  try {
    const searchQuery = encodeURIComponent(query + " food dish")
    // Use Unsplash's featured endpoint which still works
    const url = `https://unsplash.com/napi/search/photos?query=${searchQuery}&per_page=1&orientation=landscape`
    const res = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "BreslinMealPlanner/1.0",
      },
    })
    if (res.ok) {
      const data = await res.json()
      const photo = data.results?.[0]
      if (photo?.urls?.regular) {
        // Resize to 800px wide for performance
        return photo.urls.regular.replace(/w=\d+/, "w=800")
      }
    }
  } catch { /* try next */ }

  // Fallback: use a deterministic placeholder from picsum based on the title
  try {
    // Generate a stable seed from the title so the same recipe always gets the same image
    let hash = 0
    for (let i = 0; i < query.length; i++) {
      hash = ((hash << 5) - hash) + query.charCodeAt(i)
      hash |= 0
    }
    const seed = Math.abs(hash) % 1000
    return `https://picsum.photos/seed/${seed}/800/600`
  } catch { /* give up */ }

  return null
}
