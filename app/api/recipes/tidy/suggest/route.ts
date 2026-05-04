import { NextResponse } from "next/server"
import { getRecipes } from "@/lib/db"
import { getAnthropicClient, cleanJson } from "@/lib/anthropic"
import type { Ingredient } from "@/types"

export const dynamic = "force-dynamic"
export const maxDuration = 60

interface Suggestion {
  id: number
  current: string
  suggested: string
  changed: boolean
}

const SYSTEM_PROMPT = `You're a short, clean recipe-title generator.

Rules:
- Strip filler words like "Easy", "The Best", "Quick", "Delicious", "Amazing", "Perfect", and trailing " Recipe".
- Keep the dish identifiable. Preserve protein/main ingredient names.
- Don't add information not present in the original.
- Don't remove distinctive cooking methods (Slow Cooker, Oven Baked, Air Fryer) unless they're clearly fluff.
- Aim for ~30 chars or less, but never truncate to the point of ambiguity.

Return ONLY valid JSON (no markdown fences): {"title": "..."}.`

async function suggestOne(client: ReturnType<typeof getAnthropicClient>, current: string, ingredients: Ingredient[]): Promise<string> {
  if (!client) return current
  const topIngredients = ingredients.slice(0, 5).map((i) => i.name).filter(Boolean).join(", ")
  const userMsg = `Original: "${current}"${topIngredients ? `\nIngredients (top 5): ${topIngredients}` : ""}`

  try {
    const res = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMsg }],
    })
    const block = res.content.find((b) => b.type === "text")
    if (!block || block.type !== "text") return current
    const parsed = JSON.parse(cleanJson(block.text)) as { title?: string }
    const suggested = (parsed.title ?? "").trim()
    return suggested || current
  } catch (err) {
    console.error("[tidy/suggest] failed for:", current, err)
    return current
  }
}

export async function POST(req: Request) {
  const client = getAnthropicClient()
  if (!client) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 })
  }

  const body = await req.json().catch(() => ({}))
  const requestedIds: number[] | undefined = Array.isArray(body.recipe_ids) ? body.recipe_ids : undefined

  const all = await getRecipes()
  const targets = requestedIds
    ? all.filter((r) => requestedIds.includes(r.id))
    : all

  // Run all suggestions in parallel — Haiku is fast and cheap.
  const suggestions: Suggestion[] = await Promise.all(
    targets.map(async (r) => {
      const suggested = await suggestOne(client, r.title, r.ingredients ?? [])
      return {
        id: r.id,
        current: r.title,
        suggested,
        changed: suggested.trim().toLowerCase() !== r.title.trim().toLowerCase(),
      }
    })
  )

  return NextResponse.json({ suggestions })
}
