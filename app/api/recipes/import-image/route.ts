import { NextRequest, NextResponse } from "next/server"
import { getAnthropicClient } from "@/lib/anthropic"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get("image") as File | null
  if (!file) return NextResponse.json({ error: "Image is required" }, { status: 400 })

  const client = getAnthropicClient()
  if (!client) return NextResponse.json({ error: "AI not configured — set ANTHROPIC_API_KEY" }, { status: 500 })

  // Convert file to base64
  const bytes = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString("base64")

  // Determine media type
  const mediaType = file.type as "image/jpeg" | "image/png" | "image/gif" | "image/webp"

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    messages: [{
      role: "user",
      content: [
        {
          type: "image",
          source: { type: "base64", media_type: mediaType, data: base64 },
        },
        {
          type: "text",
          text: `Extract the recipe from this image. Return ONLY valid JSON (no markdown fences) with this structure:
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

Be thorough with the is_gluten_free check — flag flour, bread, pasta, soy sauce, etc. as containing gluten.`,
        },
      ],
    }],
  })

  const content = message.content[0]
  if (content.type !== "text") {
    return NextResponse.json({ error: "Unexpected AI response" }, { status: 500 })
  }

  try {
    const recipe = JSON.parse(content.text)
    return NextResponse.json(recipe)
  } catch {
    return NextResponse.json({ error: "Could not extract recipe from that image" }, { status: 422 })
  }
}
