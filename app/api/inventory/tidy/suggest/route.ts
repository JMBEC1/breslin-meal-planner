import { NextResponse } from "next/server"
import { getInventory } from "@/lib/db"
import { getAnthropicClient, cleanJson } from "@/lib/anthropic"

export const dynamic = "force-dynamic"
export const maxDuration = 60

interface Suggestion {
  id: number
  current: string
  suggested: string
  changed: boolean
}

const SYSTEM_PROMPT = `You're a strict brand-stripper for pantry / fridge / freezer item names.

Your only job is to remove brand names and marketing fluff so the result is the GENERIC item name.

Rules:
- Remove every brand name (Annalisa, Kikkoman, Barilla, Heinz, Coles, Woolworths, Home Brand, Aldi, IGA, Master Foods, Chefs' Cupboard, Continental, Maggi, McKenzie's, Old El Paso, San Remo, Latina, Praise, Cobram Estate, Helga's, Tip Top, Western Star, Devondale, etc.). Any proper noun before the food noun is a brand — strip it.
- Remove marketing words: "Premium", "Classic", "Original", "Authentic", "All-Natural", "Finest", "Pure" — unless they're genuinely descriptive (e.g. "Wholemeal" stays).
- Keep the part of the name that actually describes the food. Variety / cut / form stays (e.g. "Penne", "Wholemeal Bread", "Sushi Nori").
- Don't make the name shorter than necessary. "Beef Stroganoff Recipe Base" is good; trimming to "Beef Stroganoff" loses meaning.
- Preserve the original capitalisation style (Title Case in / Title Case out).

Examples:
  "Annalisa Borlotti Beans" → "Borlotti Beans"
  "Chefs' Cupboard Beef Stroganoff Recipe Base" → "Beef Stroganoff Recipe Base"
  "Kikkoman Soy Sauce" → "Soy Sauce"
  "Master Foods Garam Masala" → "Garam Masala"
  "Cobram Estate Extra Virgin Olive Oil" → "Extra Virgin Olive Oil"
  "Helga's Wholemeal Bread" → "Wholemeal Bread"
  "Bay Leaves" → "Bay Leaves"            (already clean)
  "Basmati Rice" → "Basmati Rice"        (already clean)
  "GF Bread" → "GF Bread"                (acronym is descriptive)

Return ONLY valid JSON (no markdown fences): {"name": "..."}.`

async function suggestOne(client: ReturnType<typeof getAnthropicClient>, current: string): Promise<string> {
  if (!client) return current
  try {
    const res = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 100,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Original: "${current}"` }],
    })
    const block = res.content.find((b) => b.type === "text")
    if (!block || block.type !== "text") return current
    const parsed = JSON.parse(cleanJson(block.text)) as { name?: string }
    const suggested = (parsed.name ?? "").trim()
    return suggested || current
  } catch (err) {
    console.error("[inventory tidy] failed for:", current, err)
    return current
  }
}

export async function POST(req: Request) {
  const client = getAnthropicClient()
  if (!client) return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 })

  const body = await req.json().catch(() => ({}))
  const requestedIds: number[] | undefined = Array.isArray(body.ids) ? body.ids : undefined

  // No location filter — admin tidies the whole inventory in one pass.
  const all = await getInventory()
  const targets = requestedIds ? all.filter((i) => requestedIds.includes(i.id)) : all

  // Run all suggestions in parallel — Haiku is fast and cheap. Inventory is
  // usually a few hundred items max so this is fine to fan out.
  const suggestions: Suggestion[] = await Promise.all(
    targets.map(async (item) => {
      const suggested = await suggestOne(client, item.name)
      return {
        id: item.id,
        current: item.name,
        suggested,
        changed: suggested.trim().toLowerCase() !== item.name.trim().toLowerCase(),
      }
    })
  )

  return NextResponse.json({ suggestions })
}
