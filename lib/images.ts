/**
 * Fetch a food image from Unsplash based on the recipe title.
 * Uses Unsplash Source (no API key needed) — redirects to a random
 * relevant photo. Falls back gracefully if unavailable.
 */
export async function fetchRecipeImage(title: string): Promise<string | null> {
  // Clean up the title for a search query
  const query = title
    .replace(/\(.*?\)/g, "")  // Remove parenthetical notes like "(GF)"
    .replace(/GF|gluten.free/gi, "")
    .trim()
    .split(/\s+/)
    .slice(0, 4) // Max 4 words for better results
    .join(" ")

  if (!query) return null

  try {
    // Unsplash Source URL — returns a random photo matching the query
    // The 800x600 size is good for recipe cards
    const url = `https://source.unsplash.com/800x600/?${encodeURIComponent(query + " food")}`

    // Follow the redirect to get the actual image URL
    const res = await fetch(url, { redirect: "follow" })
    if (res.ok && res.url && !res.url.includes("source.unsplash.com")) {
      return res.url
    }

    // Fallback: try Unsplash search API (no key needed for small usage)
    const searchUrl = `https://unsplash.com/napi/search/photos?query=${encodeURIComponent(query + " food")}&per_page=1`
    const searchRes = await fetch(searchUrl, {
      headers: { "Accept": "application/json" },
    })
    if (searchRes.ok) {
      const data = await searchRes.json()
      if (data.results?.[0]?.urls?.regular) {
        return data.results[0].urls.regular
      }
    }
  } catch {
    // Silently fail — recipe just won't have an image
  }

  return null
}
