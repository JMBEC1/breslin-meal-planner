import { NextRequest, NextResponse } from "next/server"
import { getMealPlan, getRecipe, getShoppingList, upsertShoppingList, getStaples } from "@/lib/db"
import { aggregateIngredients } from "@/lib/shopping"
import type { Ingredient, MealSlot } from "@/types"

export const dynamic = "force-dynamic"

async function generateList(
  plan: { id: number; meals: MealSlot[]; updated_at: string },
  extraMeals: MealSlot[] = []
) {
  const allIds: number[] = []
  for (const m of [...plan.meals, ...extraMeals]) {
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

  const items = aggregateIngredients(allIngredients)

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

  const list = await upsertShoppingList(plan.id, items)
  return { ...list, plan_id: plan.id }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const week = searchParams.get("week")
  const refresh = searchParams.get("refresh") === "true"
  if (!week) return NextResponse.json({ error: "week param required" }, { status: 400 })

  // Optional "tail": also shop for the remaining dinners of another week
  // (e.g. shopping Saturday for next week — fold in this week's sat/sun).
  // tailWeek = that week's week_start, tailDays = comma list of day names.
  const tailWeek = searchParams.get("tailWeek")
  const tailDays = (searchParams.get("tailDays") || "").split(",").filter(Boolean)
  let extraMeals: MealSlot[] = []
  if (tailWeek && tailDays.length > 0) {
    const tailPlan = await getMealPlan(tailWeek)
    if (tailPlan) {
      extraMeals = (tailPlan.meals as MealSlot[]).filter((m) => tailDays.includes(m.day))
    }
  }

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

    const result = await generateList(plan, extraMeals)

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
      // Preserve custom items and checked state during auto-regeneration
      const oldItems = typeof existing.items === "string" ? JSON.parse(existing.items) : existing.items
      const customItems = oldItems.filter((i: { from_recipe_ids: number[] }) => !i.from_recipe_ids || i.from_recipe_ids.length === 0)
      const checkedNames = new Set(
        oldItems.filter((i: { checked: boolean }) => i.checked).map((i: { name: string }) => i.name.toLowerCase())
      )

      const result = await generateList(plan)

      for (const item of result.items || []) {
        if (checkedNames.has(item.name.toLowerCase())) item.checked = true
      }
      const generatedNames = new Set((result.items || []).map((i: { name: string }) => i.name.toLowerCase()))
      for (const custom of customItems) {
        if (!generatedNames.has(custom.name.toLowerCase())) result.items.push(custom)
      }
      await upsertShoppingList(plan.id, result.items)
      return NextResponse.json(result)
    }
    return NextResponse.json({ ...existing, plan_id: plan.id })
  }

  // No existing list — generate fresh
  const result = await generateList(plan, extraMeals)
  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const { plan_id, items } = await req.json()
  if (!plan_id || !items) return NextResponse.json({ error: "plan_id and items required" }, { status: 400 })

  const list = await upsertShoppingList(plan_id, items)
  return NextResponse.json(list)
}
