import { NextRequest, NextResponse } from "next/server"
import { getAnthropicClient, cleanJson } from "@/lib/anthropic"

export const dynamic = "force-dynamic"
export const maxDuration = 30

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const location = (formData.get("location") as string) || "pantry"

  // Support multiple images
  const files: File[] = []
  const allFiles = formData.getAll("images")
  for (const f of allFiles) {
    if (f instanceof File) files.push(f)
  }
  // Also check single "image" field for backwards compat
  const singleFile = formData.get("image") as File | null
  if (singleFile && !files.length) files.push(singleFile)

  if (files.length === 0) return NextResponse.json({ error: "At least one image required" }, { status: 400 })

  const client = getAnthropicClient()
  if (!client) return NextResponse.json({ error: "AI not configured" }, { status: 500 })

  // Build content array with all images
  const contentParts: { type: "image"; source: { type: "base64"; media_type: string; data: string } }[] = []
  for (const file of files) {
    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString("base64")
    contentParts.push({
      type: "image",
      source: { type: "base64", media_type: file.type as string, data: base64 },
    })
  }

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [{
        role: "user",
        content: [
          ...contentParts,
          {
            type: "text",
            text: `Look at ${files.length > 1 ? "these photos" : "this photo"} of food items, ingredients, spices, or pantry items. Identify EVERY distinct item you can see across ALL images — read labels, jar labels, packet names carefully. Zoom in mentally on small text.

For each item, return:
- name: the item name (e.g. "Curry Leaves", "Garam Masala", "Cinnamon")
- quantity: estimated quantity if visible (e.g. "50g", "1"), otherwise "1"
- unit: the unit if applicable (e.g. "g", "jar", "packet"), otherwise ""
- aisle: one of: fruit-veg, meat-seafood, dairy-eggs, bakery, pantry, frozen, condiments-sauces, drinks, snacks, international, health-foods, other
- is_gluten_free: true or false

Return ONLY valid JSON (no markdown fences):
{ "items": [{ "name": "Garam Masala", "quantity": "1", "unit": "jar", "aisle": "international", "is_gluten_free": true }] }

Be thorough — identify every single item, even partially obscured ones.`,
          } as { type: "text"; text: string },
        ],
      }],
    })

    const content = message.content[0]
    if (content.type !== "text") return NextResponse.json({ error: "Unexpected response" }, { status: 500 })

    const result = JSON.parse(cleanJson(content.text))
    result.items = (result.items || []).map((item: Record<string, unknown>) => ({
      ...item,
      location,
      item_type: "ingredient",
    }))
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: `Scan failed: ${message}` }, { status: 422 })
  }
}
