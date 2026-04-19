import { NextRequest, NextResponse } from "next/server"
import { getRecipe, getInventory, updateInventoryItem, deleteInventoryItem } from "@/lib/db"
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

  // Get all inventory items
  const inventory = await getInventory()
  const deducted: { name: string; from: string; removed: boolean }[] = []
  const usedInventoryIds = new Set<number>()

  for (const ing of allIngredients) {
    // Find matching inventory item (not already used in this cook)
    const match = inventory.find((inv) =>
      !usedInventoryIds.has(inv.id) && fuzzyMatch(ing.name, inv.name)
    )
    if (!match) continue

    // Try numeric deduction
    const invQty = parseFloat(match.quantity)
    const ingQty = parseFloat(ing.quantity)

    if (!isNaN(invQty) && !isNaN(ingQty) && ingQty > 0) {
      const remaining = invQty - ingQty
      if (remaining <= 0) {
        await deleteInventoryItem(match.id)
        usedInventoryIds.add(match.id)
        deducted.push({ name: match.name, from: match.location, removed: true })
      } else {
        await updateInventoryItem(match.id, { quantity: String(remaining) })
        usedInventoryIds.add(match.id)
        deducted.push({ name: match.name, from: match.location, removed: false })
      }
    } else {
      // Non-numeric quantity — just remove the item
      await deleteInventoryItem(match.id)
      usedInventoryIds.add(match.id)
      deducted.push({ name: match.name, from: match.location, removed: true })
    }
  }

  return NextResponse.json({
    deducted,
    message: deducted.length > 0
      ? `Updated ${deducted.length} inventory items`
      : "No matching inventory items found",
  })
}
