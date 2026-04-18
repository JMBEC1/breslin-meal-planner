import { NextRequest, NextResponse } from "next/server"
import { getAnthropicClient } from "@/lib/anthropic"
import { getRecipes } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const { message } = await req.json()
  if (!message?.trim()) return NextResponse.json({ error: "Message required" }, { status: 400 })

  const client = getAnthropicClient()
  if (!client) return NextResponse.json({ error: "AI not configured" }, { status: 500 })

  const recipes = await getRecipes()
  const recipeList = recipes.length > 0
    ? recipes.map((r) => `- "${r.title}" [${r.category}] ${r.is_gluten_free ? "GF" : ""}`).join("\n")
    : "No recipes saved yet."

  // Get current month for seasonal context
  const month = new Date().toLocaleDateString("en-AU", { month: "long" })

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    messages: [{
      role: "user",
      content: `You are a friendly Australian family meal planning assistant. The family has a daughter who is gluten-free, so always prioritise GF recipes and clearly mark if something contains gluten.

Current month: ${month} (consider what's in season in Australia)

Existing recipes in their collection:
${recipeList}

The user says: "${message}"

Respond in a warm, helpful tone. When suggesting meals, format each suggestion like this:

**Recipe Name** (GF / Contains Gluten)
Brief description, 1-2 sentences.
Prep: X min | Cook: X min | Serves: X

If the user asks for specific recipes, include a brief ingredient list and instructions.

Always suggest at least 3-5 options unless they ask for something specific. Prefer GF options. If suggesting something with gluten, always mention the GF alternative (e.g. "use tamari instead of soy sauce", "use GF pasta").`,
    }],
  })

  const content = response.content[0]
  if (content.type !== "text") return NextResponse.json({ error: "Unexpected response" }, { status: 500 })

  return NextResponse.json({ response: content.text })
}
