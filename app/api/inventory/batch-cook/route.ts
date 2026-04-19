import { NextRequest, NextResponse } from "next/server"
import { getRecipe, insertInventoryItem } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const { recipe_id, total_portions, eating_now } = await req.json()

  if (!recipe_id) return NextResponse.json({ error: "recipe_id required" }, { status: 400 })

  const recipe = await getRecipe(recipe_id)
  if (!recipe) return NextResponse.json({ error: "Recipe not found" }, { status: 404 })

  const freezing = (total_portions || recipe.servings || 4) - (eating_now || 0)
  if (freezing <= 0) return NextResponse.json({ error: "Nothing to freeze" }, { status: 400 })

  const item = await insertInventoryItem({
    name: recipe.title,
    location: "freezer",
    item_type: "batch_cook",
    quantity: String(freezing),
    unit: "portions",
    aisle: "frozen",
    recipe_id: recipe.id,
    servings: freezing,
    is_gluten_free: recipe.is_gluten_free,
    notes: `Batch cooked from ${recipe.title}`,
  })

  return NextResponse.json(item, { status: 201 })
}
