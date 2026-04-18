import { NextRequest, NextResponse } from "next/server"
import { getAnthropicClient, cleanJson } from "@/lib/anthropic"

export const dynamic = "force-dynamic"

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

export async function POST(req: NextRequest) {
  const { url } = await req.json()
  if (!url) return NextResponse.json({ error: "URL is required" }, { status: 400 })

  const client = getAnthropicClient()
  if (!client) return NextResponse.json({ error: "AI not configured — set ANTHROPIC_API_KEY" }, { status: 500 })

  // Fetch the page
  let html: string
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MealPlanner/1.0)" },
    })
    html = await res.text()
  } catch {
    return NextResponse.json({ error: "Could not fetch that URL" }, { status: 400 })
  }

  const text = stripHtml(html).slice(0, 8000)

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    messages: [{
      role: "user",
      content: `Extract a recipe from this webpage content. Return ONLY valid JSON (no markdown fences) with this structure:
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

Webpage content:
${text}`,
    }],
  })

  const content = message.content[0]
  if (content.type !== "text") {
    return NextResponse.json({ error: "Unexpected AI response" }, { status: 500 })
  }

  try {
    const recipe = JSON.parse(cleanJson(content.text))
    recipe.source_url = url
    return NextResponse.json(recipe)
  } catch {
    return NextResponse.json({ error: "Could not parse recipe from that page" }, { status: 422 })
  }
}
