import { NextRequest, NextResponse } from "next/server"
import { getInventory, insertInventoryItem } from "@/lib/db"
import { categoriseIngredient } from "@/lib/shopping"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const location = searchParams.get("location") || undefined
  const items = await getInventory(location)
  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const data = await req.json()
  if (!data.name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 })

  const item = await insertInventoryItem({
    name: data.name.trim(),
    location: data.location || "pantry",
    item_type: data.item_type || "ingredient",
    quantity: data.quantity || "1",
    unit: data.unit || "",
    aisle: data.aisle || categoriseIngredient(data.name.trim()),
    recipe_id: data.recipe_id || null,
    servings: data.servings || null,
    is_gluten_free: data.is_gluten_free ?? true,
    notes: data.notes || null,
    expires_at: data.expires_at || null,
  })
  return NextResponse.json(item, { status: 201 })
}
