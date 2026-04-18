import { NextRequest, NextResponse } from "next/server"
import { getAnthropicClient, cleanJson } from "@/lib/anthropic"
import { getRecipes, getAllRatings } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const { mode, inspiration, swapIndex } = await req.json()

  const client = getAnthropicClient()
  if (!client && mode !== "stored") {
    return NextResponse.json({ error: "AI not configured — set ANTHROPIC_API_KEY" }, { status: 500 })
  }

  const recipes = await getRecipes("school-lunch")
  const ratings = await getAllRatings()

  const recipeContext = recipes.map((r) => {
    const recipeRatings = ratings.filter((rt) => rt.recipe_id === r.id)
    const avgEnjoyment = recipeRatings.length > 0
      ? (recipeRatings.reduce((sum, rt) => sum + rt.enjoyment, 0) / recipeRatings.length).toFixed(1)
      : "unrated"
    return `ID:${r.id} "${r.title}" ${r.is_gluten_free ? "GF" : "GLUTEN"} enjoyment:${avgEnjoyment} tags:${r.tags?.join(",") || "none"}`
  }).join("\n")

  const inspirationNote = inspiration?.trim()
    ? `\n\nIMPORTANT THEME/INSPIRATION: The family wants lunches inspired by "${inspiration.trim()}". Focus suggestions around this theme.`
    : ""

  // Stored mode — random pick from saved school-lunch recipes
  if (mode === "stored") {
    if (recipes.length === 0) {
      return NextResponse.json({ error: "No school lunch recipes saved yet. Add some first, or try 'internet' or 'mix' mode." }, { status: 400 })
    }

    // If inspiration + AI available, use AI to pick best matches
    if (inspiration?.trim() && client) {
      const message = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: `Pick ${swapIndex !== undefined ? "1" : "5"} school packed lunches from this list that best match the theme "${inspiration.trim()}".

Recipes:
${recipeContext}

Return ONLY valid JSON (no markdown fences):
{ "lunches": [{ "recipe_id": <id>, "title": "name", "is_gluten_free": true }] }`,
        }],
      })
      const content = message.content[0]
      if (content.type === "text") {
        try {
          const result = JSON.parse(cleanJson(content.text))
          result.mode = "stored"
          return NextResponse.json(result)
        } catch { /* fall through */ }
      }
    }

    const weighted = recipes.map((r) => {
      const recipeRatings = ratings.filter((rt) => rt.recipe_id === r.id && rt.enjoyment > 0)
      const avgEnjoyment = recipeRatings.length > 0
        ? recipeRatings.reduce((sum, rt) => sum + rt.enjoyment, 0) / recipeRatings.length
        : 3
      return { recipe: r, weight: avgEnjoyment }
    })

    const shuffled = weighted.sort(() => Math.random() - 0.5)
      .sort((a, b) => b.weight - a.weight)

    if (swapIndex !== undefined) {
      const pick = shuffled[0]
      return NextResponse.json({
        lunches: [{
          recipe_id: pick.recipe.id,
          title: pick.recipe.title,
          is_gluten_free: pick.recipe.is_gluten_free,
        }],
        mode: "stored",
      })
    }

    const selected = shuffled.slice(0, 5).map((item) => ({
      recipe_id: item.recipe.id,
      title: item.recipe.title,
      is_gluten_free: item.recipe.is_gluten_free,
    }))

    return NextResponse.json({ lunches: selected, mode: "stored" })
  }

  // Internet or mix mode — use AI
  const count = swapIndex !== undefined ? "1 school lunch" : "5 school packed lunches (Monday to Friday)"

  const modeInstruction = mode === "internet"
    ? `Suggest ${count} that are NEW creative ideas for kids' packed school lunches. Focus on healthy, easy-to-pack, kid-approved options that travel well in a lunchbox.`
    : `Suggest ${count} using a MIX of stored recipes and new ideas. Stored lunch recipes:\n${recipeContext || "None saved yet."}`

  const message = await client!.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    messages: [{
      role: "user",
      content: `You are a school lunch planner for an Australian family. One daughter is gluten-free, so prefer GF lunches. These are packed lunches for school — they need to be practical, kid-friendly, and not require reheating.

${modeInstruction}${inspirationNote}

Return ONLY valid JSON (no markdown fences):
{
  "lunches": [
    {
      "recipe_id": null,
      "title": "Lunch Name",
      "description": "Brief description — what's in it and why kids love it",
      "is_gluten_free": true,
      "source_hint": "e.g. stored, new idea, Kidspot"
    }
  ]
}

For stored recipes, use their actual recipe_id. For new ideas, set recipe_id to null.`,
    }],
  })

  const content = message.content[0]
  if (content.type !== "text") return NextResponse.json({ error: "Unexpected response" }, { status: 500 })

  try {
    const result = JSON.parse(cleanJson(content.text))
    result.mode = mode
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: "Could not generate lunch plan" }, { status: 422 })
  }
}
