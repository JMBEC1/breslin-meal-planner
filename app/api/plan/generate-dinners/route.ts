import { NextRequest, NextResponse } from "next/server"
import { getAnthropicClient } from "@/lib/anthropic"
import { getRecipes, getAllRatings } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const { mode, inspiration, swapIndex } = await req.json()
  // mode: "stored" | "internet" | "mix"
  // inspiration: optional string like "indian", "slow cooker", "salads"
  // swapIndex: if set, only regenerate one meal (returns a single suggestion)

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
    return `ID:${r.id} "${r.title}" ${r.is_gluten_free ? "GF" : "GLUTEN"} enjoyment:${avgEnjoyment} ease:${ease ?? "unrated"} servings:${r.servings ?? "?"} tags:${r.tags?.join(",") || "none"}`
  }).join("\n")

  const inspirationNote = inspiration?.trim()
    ? `\n\nIMPORTANT THEME/INSPIRATION: The family wants meals inspired by "${inspiration.trim()}". Focus suggestions around this theme where possible.`
    : ""

  // Mode: stored only — pick randomly from existing recipes, weighted by ratings
  if (mode === "stored") {
    if (recipes.length === 0) {
      return NextResponse.json({ error: "No dinner recipes saved yet. Add some first, or try 'internet' or 'mix' mode." }, { status: 400 })
    }

    // If there's inspiration text and we have AI, filter/sort with AI even for stored
    if (inspiration?.trim() && client) {
      const message = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: `Pick ${swapIndex !== undefined ? "1 dinner" : "5-7 dinners"} from this list that best match the theme "${inspiration.trim()}". If few match, pick the closest ones.

Recipes:
${recipeContext}

Big meals (6+ servings) can cover 2 nights with leftovers.

Return ONLY valid JSON (no markdown fences):
{ "dinners": [{ "recipe_id": <id>, "title": "name", "is_gluten_free": true, "servings": 4, "leftovers": false }] }`,
        }],
      })
      const content = message.content[0]
      if (content.type === "text") {
        try {
          const result = JSON.parse(content.text)
          result.mode = "stored"
          return NextResponse.json(result)
        } catch { /* fall through to random */ }
      }
    }

    // Weight by enjoyment rating (unrated = 3, rated = actual avg)
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
      // Just return 1 random recipe for swap
      const pick = shuffled[0]
      return NextResponse.json({
        dinners: [{
          recipe_id: pick.recipe.id,
          title: pick.recipe.title,
          is_gluten_free: pick.recipe.is_gluten_free,
          servings: pick.recipe.servings,
          leftovers: (pick.recipe.servings || 4) >= 6,
        }],
        mode: "stored",
      })
    }

    const selected: typeof recipes = []
    let totalServingDays = 0
    for (const item of shuffled) {
      if (totalServingDays >= 7) break
      selected.push(item.recipe)
      const servings = item.recipe.servings || 4
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
  const count = swapIndex !== undefined ? "1 dinner recipe" : "5-7 dinner recipes"

  const modeInstruction = mode === "internet"
    ? `Suggest ${count} that are NEW — from popular food websites and blogs (RecipeTin Eats, Donna Hay, Taste.com.au, etc). Do NOT use any from the stored list. Focus on highly-rated, well-known recipes.`
    : `Suggest ${count} using a MIX of stored recipes and new internet finds. Use about half from stored (prefer higher-rated ones) and half new. Stored recipes:\n${recipeContext}`

  const message = await client!.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    messages: [{
      role: "user",
      content: `You are a family meal planner for an Australian family. One daughter is gluten-free, so prefer GF recipes. When suggesting non-GF meals, note the GF swap.

${modeInstruction}${inspirationNote}

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
