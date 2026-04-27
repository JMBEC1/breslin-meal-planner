import { NextRequest, NextResponse } from "next/server"
import { getMealPlan, getRecipe, getShoppingList, upsertShoppingList, getStaples, getInventory } from "@/lib/db"
import { aggregateIngredients } from "@/lib/shopping"
import type { Ingredient, MealSlot } from "@/types"

export const dynamic = "force-dynamic"

async function generateList(plan: { id: number; meals: MealSlot[]; updated_at: string }) {
  const allIds: number[] = []
  for (const m of plan.meals) {
    if (m.recipe_id) allIds.push(m.recipe_id)
    if (m.side_ids) allIds.push(...m.side_ids)
  }
  const uniqueIds = [...new Set(allIds)]

  const allIngredients: { ingredient: Ingredient; recipeId: number }[] = []
  for (const id of uniqueIds) {
    const recipe = await getRecipe(id)
    if (recipe) {
      for (const ing of recipe.ingredients) {
        allIngredients.push({ ingredient: ing, recipeId: id })
      }
    }
  }

  let items = aggregateIngredients(allIngredients)

  // Add active staples
  const staples = await getStaples()
  for (const s of staples.filter((st) => st.active)) {
    const key = s.name.toLowerCase()
    if (!items.find((i) => i.name.toLowerCase() === key)) {
      items.push({
        name: s.name,
        quantity: s.default_quantity,
        unit: s.default_unit,
        aisle: s.aisle as Ingredient["aisle"],
        checked: false,
        from_recipe_ids: [],
        is_staple: true,
      })
    }
  }

  // Smart subtraction — flag items already in inventory
  // Strict matching: exact name, or one fully contains the other
  function fuzzyMatch(a: string, b: string): boolean {
    const la = a.toLowerCase().trim(), lb = b.toLowerCase().trim()
    return la === lb || la.includes(lb) || lb.includes(la)
  }
  // Alternative suggestions: share a key word (e.g. "chicken breast" vs "chicken thigh")
  const STOP_WORDS = new Set(["a", "an", "of", "the", "in", "to", "for", "and", "or", "with", "fresh", "dried", "raw", "cooked", "whole", "medium", "large", "small", "cup", "cups", "can", "tbsp", "tsp"])
  function sigWords(name: string): string[] {
    return name.toLowerCase().split(/\s+/).filter((w) => w.length > 3 && !STOP_WORDS.has(w))
  }
  function partialMatch(a: string, b: string): boolean {
    const wa = sigWords(a), wb = sigWords(b)
    if (wa.length === 0 || wb.length === 0) return false
    // Must share a word exactly (no substring matching like "on" in "onion")
    return wa.some((w) => wb.includes(w))
  }
  const inventory = await getInventory()
  for (const item of items) {
    const match = inventory.find((inv) => fuzzyMatch(item.name, inv.name))
    if (match) {
      item.in_inventory = true
      const loc = match.location.charAt(0).toUpperCase() + match.location.slice(1)
      item.inventory_note = `${match.quantity}${match.unit ? " " + match.unit : ""} in ${loc}`
    } else {
      // Look for alternatives — same food family but different cut/variety
      const alt = inventory.find((inv) => partialMatch(item.name, inv.name))
      if (alt) {
        const loc = alt.location.charAt(0).toUpperCase() + alt.location.slice(1)
        item.alternative_note = `You have ${alt.name} (${alt.quantity}${alt.unit ? " " + alt.unit : ""} in ${loc})`
      }
    }
  }

  const list = await upsertShoppingList(plan.id, items)
  return { ...list, plan_id: plan.id }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const week = searchParams.get("week")
  const refresh = searchParams.get("refresh") === "true"
  if (!week) return NextResponse.json({ error: "week param required" }, { status: 400 })

  const plan = await getMealPlan(week)
  if (!plan) return NextResponse.json({ items: [], plan_id: null })

  // If refresh requested, regenerate but preserve custom items and checked state
  if (refresh) {
    const existing = await getShoppingList(plan.id)
    const oldItems = existing ? (typeof existing.items === "string" ? JSON.parse(existing.items) : existing.items) : []

    // Save custom items (no recipe source) and checked state
    const customItems = oldItems.filter((i: { from_recipe_ids: number[] }) => !i.from_recipe_ids || i.from_recipe_ids.length === 0)
    const checkedNames = new Set(
      oldItems.filter((i: { checked: boolean }) => i.checked).map((i: { name: string }) => i.name.toLowerCase())
    )

    const result = await generateList(plan)

    // Restore checked state on regenerated items
    for (const item of result.items || []) {
      if (checkedNames.has(item.name.toLowerCase())) {
        item.checked = true
      }
    }

    // Re-add custom items that aren't duplicates of generated ones
    const generatedNames = new Set((result.items || []).map((i: { name: string }) => i.name.toLowerCase()))
    for (const custom of customItems) {
      if (!generatedNames.has(custom.name.toLowerCase())) {
        result.items.push(custom)
      }
    }

    // Save the merged list
    await upsertShoppingList(plan.id, result.items)
    return NextResponse.json(result)
  }

  // Check for existing shopping list
  const existing = await getShoppingList(plan.id)
  if (existing) {
    // Regenerate if the meal plan was updated after the shopping list
    const planUpdated = new Date(plan.updated_at).getTime()
    const listUpdated = new Date(existing.updated_at).getTime()
    if (planUpdated > listUpdated) {
      const result = await generateList(plan)
      return NextResponse.json(result)
    }
    return NextResponse.json({ ...existing, plan_id: plan.id })
  }

  // No existing list — generate fresh
  const result = await generateList(plan)
  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const { plan_id, items } = await req.json()
  if (!plan_id || !items) return NextResponse.json({ error: "plan_id and items required" }, { status: 400 })

  const list = await upsertShoppingList(plan_id, items)
  return NextResponse.json(list)
}
