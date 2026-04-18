import { NextRequest, NextResponse } from "next/server"
import { getMealPlan, getRecipe } from "@/lib/db"
import type { MealSlot } from "@/types"

export const dynamic = "force-dynamic"

function getMonday(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().split("T")[0]
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const recipeId = Number(searchParams.get("recipe_id"))
  if (!recipeId) return NextResponse.json(null)

  // Check current week and next week
  const now = new Date()
  const weeks = [getMonday(now)]
  const nextWeek = new Date(now)
  nextWeek.setDate(nextWeek.getDate() + 7)
  weeks.push(getMonday(nextWeek))
  const prevWeek = new Date(now)
  prevWeek.setDate(prevWeek.getDate() - 7)
  weeks.push(getMonday(prevWeek))

  for (const weekStart of weeks) {
    const plan = await getMealPlan(weekStart)
    if (!plan?.meals) continue

    const meals = plan.meals as MealSlot[]

    // Check if this recipe is a main dish with sides
    const asMain = meals.find((m) => m.recipe_id === recipeId && m.side_ids && m.side_ids.length > 0)
    if (asMain) {
      const sideRecipes = []
      for (const sideId of asMain.side_ids!) {
        const side = await getRecipe(sideId)
        if (side) sideRecipes.push(side)
      }
      return NextResponse.json({
        day: asMain.day,
        meal_type: asMain.meal_type,
        side_ids: asMain.side_ids,
        side_recipes: sideRecipes,
        is_side_of: null,
      })
    }

    // Check if this recipe is a side of another dish
    const asSide = meals.find((m) => m.side_ids?.includes(recipeId))
    if (asSide && asSide.recipe_id) {
      const mainRecipe = await getRecipe(asSide.recipe_id)
      return NextResponse.json({
        day: asSide.day,
        meal_type: asSide.meal_type,
        side_ids: [],
        side_recipes: [],
        is_side_of: mainRecipe ? {
          recipe: mainRecipe,
          day: asSide.day,
          meal_type: asSide.meal_type,
        } : null,
      })
    }

    // Check if recipe is in plan without sides
    const inPlan = meals.find((m) => m.recipe_id === recipeId)
    if (inPlan) {
      return NextResponse.json({
        day: inPlan.day,
        meal_type: inPlan.meal_type,
        side_ids: inPlan.side_ids || [],
        side_recipes: [],
        is_side_of: null,
      })
    }
  }

  return NextResponse.json(null)
}
