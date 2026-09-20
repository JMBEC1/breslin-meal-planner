import { NextRequest, NextResponse } from "next/server"
import { getAnthropicClient, aiErrorMessage } from "@/lib/anthropic"
import { ExtractedRecipeSchema, RECIPE_EXTRACTION_PROMPT } from "@/lib/recipe-extraction"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get("image") as File | null
  if (!file) return NextResponse.json({ error: "Image is required" }, { status: 400 })

  const client = getAnthropicClient()
  if (!client) return NextResponse.json({ error: "AI not configured — set ANTHROPIC_API_KEY" }, { status: 500 })

  // Convert file to base64
  const bytes = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString("base64")

  // Determine media type
  const mediaType = file.type as "image/jpeg" | "image/png" | "image/gif" | "image/webp"

  try {
    const message = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 2048,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: base64 },
          },
          { type: "text", text: RECIPE_EXTRACTION_PROMPT },
        ],
      }],
      output_config: { format: zodOutputFormat(ExtractedRecipeSchema) },
    })

    if (!message.parsed_output) {
      return NextResponse.json({ error: "Could not extract recipe from that image" }, { status: 422 })
    }
    return NextResponse.json(message.parsed_output)
  } catch (err) {
    const message = aiErrorMessage(err, "Could not extract recipe from that image.", "import-image")
    return NextResponse.json({ error: message }, { status: 422 })
  }
}
