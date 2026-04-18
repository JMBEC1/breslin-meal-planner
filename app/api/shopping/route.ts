import { NextRequest, NextResponse } from "next/server"
import { getMealPlan, getRecipe, getShoppingList, upsertShoppingList, getStaples } from "@/lib/db"
import { aggregateIngredients } from "@/lib/shopping"
import type { Ingredient, MealSlot } from "@/types"

export const dynamic = "force-dynamic"

async function generateList(plan: { id: number; meals: MealSlot[]; updated_at: string }) {
  const recipeIds = plan.meals
    .map((m) => m.recipe_id)
    .filter((id): id is number => id != null)
  const uniqueIds = [...new Set(recipeIds)]

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

  // If refresh requested, always regenerate
  if (refresh) {
    const result = await generateList(plan)
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
