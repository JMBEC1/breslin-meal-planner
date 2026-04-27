import { NextRequest, NextResponse } from "next/server"
import { getAnthropicClient, cleanJson } from "@/lib/anthropic"

export const dynamic = "force-dynamic"
export const maxDuration = 30

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<aside[\s\S]*?<\/aside>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function getOgImage(html: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
  ]
  for (const re of patterns) {
    const m = html.match(re)
    if (m?.[1] && m[1].startsWith("http")) return m[1]
  }
  return null
}

// Try to extract JSON-LD Recipe schema (most recipe sites have this)
function extractJsonLd(html: string): Record<string, unknown> | null {
  const scriptPattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match
  while ((match = scriptPattern.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1])
      // Could be an array or single object
      const items = Array.isArray(data) ? data : data["@graph"] ? data["@graph"] : [data]
      for (const item of items) {
        if (item["@type"] === "Recipe" || (Array.isArray(item["@type"]) && item["@type"].includes("Recipe"))) {
          return item as Record<string, unknown>
        }
      }
    } catch { /* invalid JSON, skip */ }
  }
  return null
}

export async function POST(req: NextRequest) {
  const { url } = await req.json()
  if (!url) return NextResponse.json({ error: "URL is required" }, { status: 400 })

  const client = getAnthropicClient()
  if (!client) return NextResponse.json({ error: "AI not configured — set ANTHROPIC_API_KEY" }, { status: 500 })

  // Fetch the page with a realistic user agent
  let html: string
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    })
    if (!res.ok) {
      return NextResponse.json({ error: `Could not fetch URL (${res.status})` }, { status: 400 })
    }
    html = await res.text()
  } catch {
    return NextResponse.json({ error: "Could not fetch that URL — check the link" }, { status: 400 })
  }

  const pageImage = getOgImage(html)

  // Try JSON-LD first (most reliable — structured recipe data)
  const jsonLd = extractJsonLd(html)
  let textForAI: string
  if (jsonLd) {
    // Feed the structured data to AI for formatting
    textForAI = `JSON-LD Recipe data from the page:\n${JSON.stringify(jsonLd, null, 2)}`.slice(0, 12000)
  } else {
    // Fallback to stripped HTML text
    textForAI = stripHtml(html).slice(0, 12000)
  }

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [{
        role: "user",
        content: `Extract a recipe from this content. Return ONLY valid JSON (no markdown fences) with this structure:
{
  "title": "Recipe name",
  "description": "Short 1-2 sentence description",
  "category": "dinner" or "school-lunch" or "fancy",
  "is_gluten_free": true/false,
  "prep_time_mins": number or null,
  "cook_time_mins": number or null,
  "servings": number or null,
  "ingredients": [
    {"name": "ingredient", "quantity": "2", "unit": "cups", "aisle": "pantry", "is_gluten_free": true}
  ],
  "instructions": "Step-by-step instructions as plain text with numbered steps",
  "tags": ["tag1", "tag2"],
  "gluten_warnings": ["list any gluten-containing ingredients"]
}

Aisle options: fruit-veg, meat-seafood, dairy-eggs, bakery, pantry, frozen, condiments-sauces, drinks, snacks, international, health-foods, other.

Be thorough with the is_gluten_free check — flag flour, bread, pasta, soy sauce, etc. as containing gluten.

If this is ISO 8601 duration format (PT30M etc), convert to minutes.

Content:
${textForAI}`,
      }],
    })

    const content = message.content[0]
    if (content.type !== "text") {
      return NextResponse.json({ error: "Unexpected AI response" }, { status: 500 })
    }

    const recipe = JSON.parse(cleanJson(content.text))
    recipe.source_url = url
    recipe.image_url = recipe.image_url || pageImage || null
    // If JSON-LD had an image, prefer it
    if (jsonLd?.image) {
      const img = typeof jsonLd.image === "string" ? jsonLd.image
        : Array.isArray(jsonLd.image) ? jsonLd.image[0]
        : (jsonLd.image as Record<string, string>)?.url
      if (img && typeof img === "string" && img.startsWith("http")) {
        recipe.image_url = img
      }
    }
    return NextResponse.json(recipe)
  } catch {
    return NextResponse.json({ error: "Could not parse recipe from that page — try the 'From Image' tab instead" }, { status: 422 })
  }
}
