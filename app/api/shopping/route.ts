import { NextRequest, NextResponse } from "next/server"
import { getMealPlan, getRecipe, getShoppingList, upsertShoppingList, getStaples } from "@/lib/db"
import { aggregateIngredients } from "@/lib/shopping"
import type { Ingredient, MealSlot } from "@/types"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const week = searchParams.get("week")
  if (!week) return NextResponse.json({ error: "week param required" }, { status: 400 })

  const plan = await getMealPlan(week)
  if (!plan) return NextResponse.json({ items: [], plan_id: null })

  // Check for existing shopping list
  const existing = await getShoppingList(plan.id)
  if (existing) return NextResponse.json({ ...existing, plan_id: plan.id })

  // Generate from meal plan
  const recipeIds = (plan.meals as MealSlot[])
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

  // Save the generated list
  const list = await upsertShoppingList(plan.id, items)
  return NextResponse.json({ ...list, plan_id: plan.id })
}

export async function POST(req: NextRequest) {
  const { plan_id, items } = await req.json()
  if (!plan_id || !items) return NextResponse.json({ error: "plan_id and items required" }, { status: 400 })

  const list = await upsertShoppingList(plan_id, items)
  return NextResponse.json(list)
}
