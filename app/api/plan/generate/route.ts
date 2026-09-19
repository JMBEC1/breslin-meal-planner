import { NextRequest, NextResponse } from "next/server"
import { getAnthropicClient } from "@/lib/anthropic"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { z } from "zod"
import { getRecipes } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * NOTE: this is the pre-strip-back planner and it still fills lunch slots as
 * well as dinners. The app is dinner-only now, so the lunches it returns have
 * nowhere to render. It is reached from the "AI Fill All" button on the plan
 * page; /api/plan/generate-dinners is the current path.
 */

const SuggestionsSchema = z.object({
  suggestions: z.array(
    z.object({
      day: z.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]),
      meal_type: z.enum(["lunch", "dinner"]),
      recipe_id: z.number().int().nullable().describe("An ID from the list, or null for a new suggestion"),
      title: z.string(),
      description: z.string().nullable(),
      is_gluten_free: z.boolean(),
    })
  ),
})

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

  const message = await client.messages.parse({
    model: "claude-haiku-4-5",
    max_tokens: 2048,
    messages: [{
      role: "user",
      content: `You are a family meal planner. A family with a gluten-free daughter needs meal suggestions for the week.

Current recipes in the database:
${recipeList || "No recipes saved yet."}

Already planned: ${filledSlots || "Nothing yet."}
${preferences ? `Preferences: ${preferences}` : ""}

Fill in the EMPTY slots for a week (Monday-Sunday, lunch and dinner). For lunch, suggest healthy school-friendly packed lunches. For dinner, suggest family dinners. Prefer gluten-free recipes where possible.

If suitable recipes exist in the database, reference them by ID. Otherwise set recipe_id to null and suggest a new recipe.

Only fill empty slots. Skip days that are already planned.`,
    }],
    output_config: { format: zodOutputFormat(SuggestionsSchema) },
  })

  if (!message.parsed_output) {
    return NextResponse.json({ error: "Could not generate plan" }, { status: 422 })
  }
  return NextResponse.json(message.parsed_output)
}
