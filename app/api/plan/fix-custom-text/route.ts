import { NextResponse } from "next/server"
import { getRecipes, getMealPlan, upsertMealPlan } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function POST() {
  const recipes = await getRecipes()

  // Check recent weeks
  const now = new Date()
  const fixes: string[] = []

  for (let w = -2; w <= 2; w++) {
    const d = new Date(now)
    d.setDate(d.getDate() + w * 7)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    d.setDate(diff)
    const weekStart = d.toISOString().split("T")[0]

    const plan = await getMealPlan(weekStart)
    if (!plan?.meals?.length) continue

    let changed = false
    const updatedMeals = plan.meals.map((m: { day: string; meal_type: string; recipe_id: number | null; custom_text: string | null }) => {
      if (m.recipe_id || !m.custom_text) return m

      // Skip leftovers entries
      if (m.custom_text.startsWith("Leftovers:")) return m

      // Try to find a matching recipe by title
      const match = recipes.find((r) => r.title === m.custom_text)
      if (match) {
        changed = true
        fixes.push(`${weekStart} ${m.day} ${m.meal_type}: "${m.custom_text}" -> recipe #${match.id}`)
        return { ...m, recipe_id: match.id, custom_text: null }
      }
      return m
    })

    if (changed) {
      await upsertMealPlan(weekStart, updatedMeals)
    }
  }

  return NextResponse.json({ message: `Fixed ${fixes.length} slots`, fixes })
}
