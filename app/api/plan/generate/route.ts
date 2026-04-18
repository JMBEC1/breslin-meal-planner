import { NextRequest, NextResponse } from "next/server"
import { getAnthropicClient, cleanJson } from "@/lib/anthropic"
import { getRecipes } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const { meals, preferences } = await req.json()

  const client = getAnthropicClient()
  if (!client) return NextResponse.json({ error: "AI not configured" }, { status: 500 })

  const recipes = await getRecipes()
  const recipeList = recipes.map((r) =>
    `ID:${r.id} "${r.title}" [${r.category}] ${r.is_gluten_free ? "GF" : "contains-gluten"}`
  ).join("\n")

  const filledSlots = (meals || [])
    .filter((m: { recipe_id: number | null; custom_text: string | null }) => m.recipe_id || m.custom_text)
    .map((m: { day: string; meal_type: string; custom_text: string | null }) => `${m.day} ${m.meal_type}: ${m.custom_text || "filled"}`)
    .join(", ")

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    messages: [{
      role: "user",
      content: `You are a family meal planner. A family with a gluten-free daughter needs meal suggestions for the week.

Current recipes in the database:
${recipeList || "No recipes saved yet."}

Already planned: ${filledSlots || "Nothing yet."}
${preferences ? `Preferences: ${preferences}` : ""}

Fill in the EMPTY slots for a week (Monday-Sunday, lunch and dinner). For lunch, suggest healthy school-friendly packed lunches. For dinner, suggest family dinners. Prefer gluten-free recipes where possible.

If suitable recipes exist in the database, reference them by ID. Otherwise suggest new recipes.

Return ONLY valid JSON (no markdown fences):
{
  "suggestions": [
    {"day": "monday", "meal_type": "lunch", "recipe_id": 5, "title": "Existing Recipe Name"},
    {"day": "monday", "meal_type": "dinner", "recipe_id": null, "title": "New Suggested Recipe", "description": "Brief description", "is_gluten_free": true}
  ]
}

Only fill empty slots. Skip days that are already planned.`,
    }],
  })

  const content = message.content[0]
  if (content.type !== "text") return NextResponse.json({ error: "Unexpected response" }, { status: 500 })

  try {
    const result = JSON.parse(cleanJson(content.text))
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: "Could not generate plan" }, { status: 422 })
  }
}
