import { NextResponse } from "next/server"
import { getTakeawayImageOverrides } from "@/lib/db"

export const dynamic = "force-dynamic"

// Returns { sushi: "https://...", pizza: "...", ... } for any cuisine types
// the user has uploaded photos for. Empty object means use static fallbacks.
export async function GET() {
  const overrides = await getTakeawayImageOverrides()
  return NextResponse.json(overrides)
}
