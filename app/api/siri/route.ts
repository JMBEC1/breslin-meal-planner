import { NextRequest, NextResponse } from "next/server"
import { getNeeds, insertNeed } from "@/lib/db"

export const dynamic = "force-dynamic"

// ── Siri / Apple Shortcuts endpoint ──────────────────────────────────
// Called by the family's "Add to shopping list" Shortcut (via Siri on the
// HomePod mini or the kitchen iPad). Adds an item to "Things We Need".
//
//   GET  /api/siri?key=<SIRI_SHORTCUT_KEY>&item=washing%20up%20liquid
//   POST /api/siri   { "key": "...", "item": "..." }
//
// Always responds 200 with { ok, spoken } — Shortcuts treats non-2xx as a
// hard failure and won't read the message aloud, so errors are delivered
// in `spoken` instead. The Shortcut speaks `spoken` back to the kitchen.
//
// Requires the SIRI_SHORTCUT_KEY env var to be set (Vercel → Settings →
// Environment Variables). If it's unset the endpoint is disabled.

function cleanItem(raw: string): string {
  return raw
    .trim()
    .replace(/[.!?,;:]+$/, "") // Siri dictation often appends punctuation
    .replace(/\s+/g, " ")
    .trim()
}

async function addItem(key: string, rawItem: string): Promise<NextResponse> {
  const secret = process.env.SIRI_SHORTCUT_KEY
  if (!secret) {
    return NextResponse.json({
      ok: false,
      spoken: "The shopping list link isn't set up yet.",
    })
  }
  if (key !== secret) {
    return NextResponse.json({
      ok: false,
      spoken: "Sorry, I'm not allowed to change the shopping list.",
    })
  }

  const item = cleanItem(rawItem)
  if (!item) {
    return NextResponse.json({
      ok: false,
      spoken: "I didn't catch what to add. Please try again.",
    })
  }

  // Case-insensitive dedupe against the current list
  const needs = await getNeeds()
  const existing = needs.find(
    (n) => n.name.trim().toLowerCase() === item.toLowerCase()
  )
  if (existing) {
    return NextResponse.json({
      ok: true,
      duplicate: true,
      spoken: `${item} is already on the list.`,
    })
  }

  const display = item.charAt(0).toUpperCase() + item.slice(1)
  await insertNeed(display)
  return NextResponse.json({
    ok: true,
    duplicate: false,
    spoken: `Added ${item} to the shopping list.`,
  })
}

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key") ?? ""
  const item = req.nextUrl.searchParams.get("item") ?? ""
  return addItem(key, item)
}

export async function POST(req: NextRequest) {
  let key = ""
  let item = ""
  try {
    const body = await req.json()
    key = typeof body.key === "string" ? body.key : ""
    item = typeof body.item === "string" ? body.item : ""
  } catch {
    // fall through with empty values → friendly spoken error
  }
  return addItem(key, item)
}
