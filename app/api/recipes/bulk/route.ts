import { NextRequest, NextResponse } from "next/server"
import { updateRecipe } from "@/lib/db"
import { NON_MAIN_CATEGORIES } from "@/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

const VALID_CATEGORIES = new Set<string>(["main", ...NON_MAIN_CATEGORIES])

/**
 * Re-file a batch of recipes in one request.
 *
 * Only course and cuisine tags can be changed here — this exists for the
 * organise screen, not as a general back door into the recipe table.
 */
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const updates = Array.isArray(body?.updates) ? body.updates : null
  if (!updates?.length) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 })
  }
  if (updates.length > 500) {
    return NextResponse.json({ error: "Too many at once." }, { status: 413 })
  }

  let changed = 0
  const failed: number[] = []

  for (const u of updates) {
    const id = Number(u?.id)
    if (!Number.isInteger(id) || id <= 0) continue

    const patch: { category?: string; tags?: string[] } = {}
    if (typeof u.category === "string" && VALID_CATEGORIES.has(u.category)) {
      patch.category = u.category
    }
    if (Array.isArray(u.tags)) {
      patch.tags = u.tags
        .filter((t: unknown): t is string => typeof t === "string" && t.trim().length > 0)
        .map((t: string) => t.trim())
        .slice(0, 30)
    }
    if (!Object.keys(patch).length) continue

    const result = await updateRecipe(id, patch)
    if (result) changed++
    else failed.push(id)
  }

  return NextResponse.json({ changed, failed })
}
