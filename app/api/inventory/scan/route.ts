import { NextRequest, NextResponse } from "next/server"
import { getAnthropicClient, cleanJson } from "@/lib/anthropic"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get("image") as File | null
  const location = (formData.get("location") as string) || "pantry"

  if (!file) return NextResponse.json({ error: "Image required" }, { status: 400 })

  const client = getAnthropicClient()
  if (!client) return NextResponse.json({ error: "AI not configured" }, { status: 500 })

  const bytes = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString("base64")
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
          text: `Look at this photo of food items, ingredients, spices, or pantry items. Identify EVERY distinct item you can see — read labels, jar labels, packet names, etc.

For each item, return:
- name: the item name (e.g. "Curry Leaves", "Chilli Powder", "Sesame Seeds")
- quantity: estimated quantity if visible (e.g. "50g", "1 bottle", "1 packet"), otherwise "1"
- unit: the unit if applicable (e.g. "g", "packet", "bottle", "jar"), otherwise ""
- aisle: categorise into one of: fruit-veg, meat-seafood, dairy-eggs, bakery, pantry, frozen, condiments-sauces, drinks, snacks, international, health-foods, other
- is_gluten_free: true or false (best guess)

Return ONLY valid JSON (no markdown fences):
{
  "items": [
    { "name": "Thyme Leaves", "quantity": "15", "unit": "g", "aisle": "pantry", "is_gluten_free": true },
    { "name": "Chilli Powder", "quantity": "50", "unit": "g", "aisle": "pantry", "is_gluten_free": true }
  ]
}

Be thorough — identify every single item visible, including partially obscured ones. Read jar labels carefully.`,
        },
      ],
    }],
  })

  const content = message.content[0]
  if (content.type !== "text") return NextResponse.json({ error: "Unexpected response" }, { status: 500 })

  try {
    const result = JSON.parse(cleanJson(content.text))
    // Add location to each item
    result.items = (result.items || []).map((item: Record<string, unknown>) => ({
      ...item,
      location,
      item_type: "ingredient",
    }))
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: "Could not identify items from that image" }, { status: 422 })
  }
}
