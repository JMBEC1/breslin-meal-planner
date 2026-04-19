import { NextRequest, NextResponse } from "next/server"
import { getAnthropicClient, cleanJson } from "@/lib/anthropic"
import { getRecipes, getAllRatings, getInventory, getCheatMeals } from "@/lib/db"

export const dynamic = "force-dynamic"

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pickRandom<T>(arr: T[], count: number): T[] {
  if (arr.length === 0) return []
  const shuffled = shuffle(arr)
  const result: T[] = []
  for (let i = 0; i < count; i++) {
    result.push(shuffled[i % shuffled.length])
  }
  return result
}

export async function POST(req: NextRequest) {
  const { mode, inspiration, swapIndex } = await req.json()

  // ── Lunch Box mode — build structured boxes from inventory + saved mains ──
  if (mode === "lunchbox") {
    // Pull fruit/veg/snacks from actual inventory
    const inventory = await getInventory()
    const fruits = inventory.filter((i) => i.aisle === "fruit-veg" && /apple|banana|grape|mandarin|orange|pear|strawberr|blueberr|kiwi|watermelon|mango|plum|peach|cherry|nectarine/i.test(i.name))
    const vegs = inventory.filter((i) => i.aisle === "fruit-veg" && /carrot|cucumber|celery|capsicum|tomato|pepper|broccoli|corn|pea|bean|lettuce|spinach|avocado/i.test(i.name))
    const snacks = inventory.filter((i) => ["snacks", "bakery", "health-foods"].includes(i.aisle))

    // Pull mains from saved favourites (cheat_meals with lunch-main category)
    const allFavs = await getCheatMeals()
    const mains = allFavs.filter((i) => i.category === "lunch-main")
    const judeOptions = mains // Jude can eat anything
    const ettaOptions = mains.filter((i) => i.is_gluten_free) // Etta GF only

    const count = swapIndex !== undefined ? 1 : 5
    const boxes = []

    for (let i = 0; i < count; i++) {
      const fruit = pickRandom(fruits, 1).map((f) => f.name)
      const veg = pickRandom(vegs, 1).map((v) => v.name)
      const snack = pickRandom(snacks, 2).map((s) => s.name)
      const judeMain = pickRandom(judeOptions, 1)[0]
      const ettaMain = pickRandom(ettaOptions, 1)[0]

      boxes.push({
        fruit,
        veg,
        snack,
        jude_main: judeMain?.name || "Sandwich",
        etta_main: ettaMain?.name || "GF Sandwich",
      })
    }

    return NextResponse.json({ lunches: boxes, mode: "lunchbox" })
  }

  // ── Legacy AI modes (stored/internet/mix) ──
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

  const inventory = await getInventory()
  const inventoryContext = inventory.length > 0
    ? inventory.map((item) => `${item.name} (${item.quantity}${item.unit ? " " + item.unit : ""} in ${item.location})`).join(", ")
    : ""
  const inventoryNote = inventoryContext
    ? `\n\nINVENTORY — the family currently has these items in stock. Where possible, suggest lunches that use these up:\n${inventoryContext}`
    : ""

  if (mode === "stored") {
    if (recipes.length === 0) {
      return NextResponse.json({ error: "No school lunch recipes saved yet. Try 'lunchbox' mode instead." }, { status: 400 })
    }

    if (inspiration?.trim() && client) {
      const message = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: `Pick ${swapIndex !== undefined ? "1" : "5"} school packed lunches from this list that best match the theme "${inspiration.trim()}".

Recipes:
${recipeContext}
${inventoryNote}

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
        lunches: [{ recipe_id: pick.recipe.id, title: pick.recipe.title, is_gluten_free: pick.recipe.is_gluten_free }],
        mode: "stored",
      })
    }

    return NextResponse.json({
      lunches: shuffled.slice(0, 5).map((item) => ({
        recipe_id: item.recipe.id, title: item.recipe.title, is_gluten_free: item.recipe.is_gluten_free,
      })),
      mode: "stored",
    })
  }

  // Internet or mix mode
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

${modeInstruction}${inspirationNote}${inventoryNote}

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
