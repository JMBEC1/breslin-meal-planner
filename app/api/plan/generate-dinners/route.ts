import { NextRequest, NextResponse } from "next/server"
import { getAnthropicClient } from "@/lib/anthropic"
import { getRecipes, getAllRatings } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const { mode } = await req.json() // "stored" | "internet" | "mix"

  const client = getAnthropicClient()
  if (!client && mode !== "stored") {
    return NextResponse.json({ error: "AI not configured — set ANTHROPIC_API_KEY" }, { status: 500 })
  }

  const recipes = await getRecipes("dinner")
  const ratings = await getAllRatings()

  // Build rating context for stored recipes
  const recipeContext = recipes.map((r) => {
    const recipeRatings = ratings.filter((rt) => rt.recipe_id === r.id)
    const avgEnjoyment = recipeRatings.length > 0
      ? (recipeRatings.reduce((sum, rt) => sum + rt.enjoyment, 0) / recipeRatings.length).toFixed(1)
      : "unrated"
    const ease = recipeRatings.length > 0 ? recipeRatings[0].ease_of_cooking : null
    return `ID:${r.id} "${r.title}" ${r.is_gluten_free ? "GF" : "GLUTEN"} enjoyment:${avgEnjoyment} ease:${ease ?? "unrated"} servings:${r.servings ?? "?"}`
  }).join("\n")

  // Mode: stored only — pick randomly from existing recipes, weighted by ratings
  if (mode === "stored") {
    if (recipes.length === 0) {
      return NextResponse.json({ error: "No dinner recipes saved yet. Add some first, or try 'internet' or 'mix' mode." }, { status: 400 })
    }

    // Weight by enjoyment rating (unrated = 3, rated = actual avg)
    const weighted = recipes.map((r) => {
      const recipeRatings = ratings.filter((rt) => rt.recipe_id === r.id && rt.enjoyment > 0)
      const avgEnjoyment = recipeRatings.length > 0
        ? recipeRatings.reduce((sum, rt) => sum + rt.enjoyment, 0) / recipeRatings.length
        : 3
      return { recipe: r, weight: avgEnjoyment }
    })

    // Pick 5-7 unique recipes (fewer if big servings)
    const shuffled = weighted.sort(() => Math.random() - 0.5)
      .sort((a, b) => b.weight - a.weight) // Bias towards higher rated

    const selected: typeof recipes = []
    let totalServingDays = 0

    for (const item of shuffled) {
      if (totalServingDays >= 7) break
      selected.push(item.recipe)
      const servings = item.recipe.servings || 4
      // Big meals (6+ servings) count as 2 days (leftovers)
      totalServingDays += servings >= 6 ? 2 : 1
    }

    return NextResponse.json({
      dinners: selected.map((r) => ({
        recipe_id: r.id,
        title: r.title,
        is_gluten_free: r.is_gluten_free,
        servings: r.servings,
        leftovers: (r.servings || 4) >= 6,
      })),
      mode: "stored",
    })
  }

  // Mode: internet or mix — use AI
  const modeInstruction = mode === "internet"
    ? "Suggest 5-7 NEW dinner recipes from popular food websites and blogs. Do NOT use any recipes from the stored list. Focus on highly-rated, well-known recipes."
    : `Suggest 5-7 dinners using a MIX of stored recipes and new internet finds. Use about half from the stored list (prefer higher-rated ones) and half new suggestions. Here are the stored recipes:\n${recipeContext}`

  const message = await client!.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    messages: [{
      role: "user",
      content: `You are a family meal planner for an Australian family. One daughter is gluten-free, so prefer GF recipes. When suggesting non-GF meals, note the GF swap.

${modeInstruction}

Consider that big meals (6+ servings) can cover 2 nights with leftovers, so you may suggest fewer than 7 recipes if some are large.

Return ONLY valid JSON (no markdown fences):
{
  "dinners": [
    {
      "recipe_id": null,
      "title": "Recipe Name",
      "description": "Brief description",
      "is_gluten_free": true,
      "servings": 4,
      "leftovers": false,
      "source_hint": "e.g. RecipeTin Eats, Donna Hay, stored"
    }
  ]
}

For stored recipes, use their actual recipe_id. For new recipes, set recipe_id to null.`,
    }],
  })

  const content = message.content[0]
  if (content.type !== "text") return NextResponse.json({ error: "Unexpected response" }, { status: 500 })

  try {
    const result = JSON.parse(content.text)
    result.mode = mode
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: "Could not generate dinner plan" }, { status: 422 })
  }
}
