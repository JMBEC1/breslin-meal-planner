import { NextRequest, NextResponse } from "next/server"
import { getRecipe, getInventory, updateInventoryItem } from "@/lib/db"
export const dynamic = "force-dynamic"

const STOP_WORDS = new Set(["a", "an", "of", "the", "in", "to", "for", "and", "or", "with", "fresh", "dried", "raw", "cooked"])

function sigWords(name: string): string[] {
  return name.toLowerCase().split(/\s+/).filter((w) => w.length > 2 && !STOP_WORDS.has(w))
}

function fuzzyMatch(a: string, b: string): boolean {
  const la = a.toLowerCase(), lb = b.toLowerCase()
  if (la === lb || la.includes(lb) || lb.includes(la)) return true
  const wa = sigWords(a), wb = sigWords(b)
  if (wa.length === 0 || wb.length === 0) return false
  const shared = wa.filter((w) => wb.some((w2) => w2.includes(w) || w.includes(w2)))
  return shared.length >= 1 && shared.length >= Math.min(wa.length, wb.length) * 0.5
}

export async function POST(req: NextRequest) {
  const { recipe_ids } = await req.json()
  if (!recipe_ids || !Array.isArray(recipe_ids) || recipe_ids.length === 0) {
    return NextResponse.json({ error: "recipe_ids required" }, { status: 400 })
  }

  // Gather all ingredients from all recipes
  const allIngredients: { name: string; quantity: string; unit: string }[] = []
  for (const id of recipe_ids) {
    const recipe = await getRecipe(id)
    if (recipe) {
      for (const ing of recipe.ingredients) {
        allIngredients.push({ name: ing.name, quantity: ing.quantity, unit: ing.unit })
      }
    }
  }

  if (allIngredients.length === 0) {
    return NextResponse.json({ deducted: [], message: "No ingredients found" })
  }

  // Get all inventory items. We no longer auto-deduct quantities — under the new
  // status model, cooking a meal flips matched items to status='out' so the user
  // sees them flagged in inventory + on the next shopping list, but the items aren't
  // destroyed (the user can flip them back to in_stock if they still have some left).
  const inventory = await getInventory()
  const deducted: { name: string; from: string; removed: boolean }[] = []
  const usedInventoryIds = new Set<number>()

  for (const ing of allIngredients) {
    const match = inventory.find((inv) =>
      !usedInventoryIds.has(inv.id) && fuzzyMatch(ing.name, inv.name) && inv.status !== "out"
    )
    if (!match) continue

    await updateInventoryItem(match.id, { status: "out" })
    usedInventoryIds.add(match.id)
    // `removed: false` to mean "still in inventory, flagged" — semantic preserved.
    deducted.push({ name: match.name, from: match.location, removed: false })
  }

  return NextResponse.json({
    deducted,
    message: deducted.length > 0
      ? `Flagged ${deducted.length} item${deducted.length === 1 ? "" : "s"} as out`
      : "No matching inventory items found",
  })
}
