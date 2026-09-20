import { NextRequest, NextResponse } from "next/server"
import { getAnthropicClient } from "@/lib/anthropic"
import { getRecipes, getAllRatings } from "@/lib/db"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { z } from "zod"

export const dynamic = "force-dynamic"

/**
 * Pick this week's dinners from the recipes the family already has.
 *
 * Library-only. The "internet" and "mix" modes were taken out of the UI in
 * 64d736b but left behind here, unreachable — the page has only ever sent
 * "stored" since. They're gone now, and with them the second Claude call.
 *
 * The one remaining AI call is optional: it fires only when a theme is typed
 * in, and all it does is choose from the list below. Without a theme this
 * endpoint makes no API call at all.
 */

const DinnerPickSchema = z.object({
  dinners: z.array(
    z.object({
      recipe_id: z.number().int().describe("The ID from the list, exactly as given"),
      title: z.string(),
      is_gluten_free: z.boolean(),
      servings: z.number().int(),
      leftovers: z.boolean().describe("True if 6+ servings, so it covers a second night"),
    })
  ),
})

/** Fisher–Yates. `sort(() => Math.random() - 0.5)` is not a fair shuffle. */
function shuffle<T>(items: T[]): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export async function POST(req: NextRequest) {
  const { inspiration, swapIndex, targetCount, excludeTitles } = await req.json()
  // inspiration: optional theme like "indian", "slow cooker", "salads"
  // swapIndex: set when regenerating a single meal (returns one suggestion)
  // targetCount: how many dinners to pick — the caller's auto-day count
  // excludeTitles: what's already on screen, so a swap returns something else
  const wantCount: number | undefined =
    typeof targetCount === "number" && targetCount > 0 && targetCount <= 7 ? Math.floor(targetCount) : undefined
  const excludeSet = new Set(
    (Array.isArray(excludeTitles) ? excludeTitles : [])
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.toLowerCase().trim()),
  )

  const recipes = await getRecipes("main")
  const ratings = await getAllRatings()

  if (recipes.length === 0) {
    return NextResponse.json({ error: "No dinner recipes saved yet — add some first." }, { status: 400 })
  }

  const avgEnjoyment = (recipeId: number): number | null => {
    const rated = ratings.filter((rt) => rt.recipe_id === recipeId && rt.enjoyment > 0)
    if (rated.length === 0) return null
    return rated.reduce((sum, rt) => sum + rt.enjoyment, 0) / rated.length
  }

  // A theme narrows the list; Claude only ever chooses from what's already saved.
  const client = getAnthropicClient()
  if (inspiration?.trim() && client) {
    const recipeContext = recipes.map((r) => {
      const avg = avgEnjoyment(r.id)
      const ease = ratings.find((rt) => rt.recipe_id === r.id)?.ease_of_cooking
      return `ID:${r.id} "${r.title}" ${r.is_gluten_free ? "GF" : "GLUTEN"} enjoyment:${avg?.toFixed(1) ?? "unrated"} ease:${ease ?? "unrated"} servings:${r.servings ?? "?"} tags:${r.tags?.join(",") || "none"}`
    }).join("\n")

    const howMany = swapIndex !== undefined
      ? "1 dinner"
      : wantCount ? `exactly ${wantCount} dinner${wantCount === 1 ? "" : "s"}` : "5-7 dinners"

    try {
      const message = await client.messages.parse({
        model: "claude-haiku-4-5",
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: `Pick ${howMany} from this list that best match the theme "${inspiration.trim()}". If few match, pick the closest ones.

Recipes:
${recipeContext}
${excludeSet.size > 0 ? `\nDo not pick any of these, they are already on screen: ${[...excludeSet].join(", ")}.` : ""}

Big meals (6+ servings) can cover two nights with leftovers.`,
        }],
        output_config: { format: zodOutputFormat(DinnerPickSchema) },
      })

      if (message.parsed_output?.dinners.length) {
        return NextResponse.json({ ...message.parsed_output, mode: "stored" })
      }
    } catch (err) {
      // A theme that finds nothing shouldn't cost him his dinners — fall
      // through to the weighted pick below.
      console.error("[generate-dinners] theme filter failed:", err)
    }
  }

  // Weighted by how much the family enjoyed it. Unrated sits at 3 so a new
  // recipe isn't buried before anyone has had a chance to rate it.
  const weighted = shuffle(recipes).map((recipe) => ({
    recipe,
    weight: avgEnjoyment(recipe.id) ?? 3,
  }))
  weighted.sort((a, b) => b.weight - a.weight)

  const asDinner = (r: (typeof recipes)[number]) => ({
    recipe_id: r.id,
    title: r.title,
    is_gluten_free: r.is_gluten_free,
    servings: r.servings,
    leftovers: (r.servings || 4) >= 6,
  })

  if (swapIndex !== undefined) {
    // Pick from the top of the eligible pool so a swap actually varies rather
    // than handing back the same top-weighted recipe every press.
    const eligible = weighted.filter(({ recipe }) => !excludeSet.has(recipe.title.toLowerCase().trim()))
    const pool = eligible.length > 0 ? eligible : weighted
    const topK = pool.slice(0, Math.min(8, pool.length))
    const pick = topK[Math.floor(Math.random() * topK.length)]
    return NextResponse.json({ dinners: [asDinner(pick.recipe)], mode: "stored" })
  }

  // Fill the week by serving-days, not by recipe count: a big meal buys two.
  const dayBudget = wantCount ?? 7
  const selected: typeof recipes = []
  let servingDays = 0
  for (const { recipe } of weighted) {
    if (servingDays >= dayBudget) break
    selected.push(recipe)
    servingDays += (recipe.servings || 4) >= 6 ? 2 : 1
  }

  return NextResponse.json({ dinners: selected.map(asDinner), mode: "stored" })
}
