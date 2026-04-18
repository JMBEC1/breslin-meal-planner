"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { StarRating } from "./StarRating"
import { GFBadge } from "./GFBadge"
import type { Recipe } from "@/types"

interface MealContextProps {
  recipeId: number
}

interface MealInfo {
  day: string
  meal_type: string
  side_ids: number[]
  side_recipes: Recipe[]
  is_side_of: { recipe: Recipe; day: string; meal_type: string } | null
}

export function MealContext({ recipeId }: MealContextProps) {
  const [mealInfo, setMealInfo] = useState<MealInfo | null>(null)
  const [mealRating, setMealRating] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/plan/context?recipe_id=${recipeId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        setMealInfo(data)
        setLoading(false)
      })
  }, [recipeId])

  if (loading || !mealInfo) return null
  if (mealInfo.side_ids.length === 0 && !mealInfo.is_side_of) return null

  const DAY_LABELS: Record<string, string> = {
    monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday",
    thursday: "Thursday", friday: "Friday", saturday: "Saturday", sunday: "Sunday",
  }

  return (
    <div className="bg-white rounded-xl p-5 mb-6 shadow-sm">
      <h2 className="text-lg font-semibold text-meal-charcoal mb-1">This Meal</h2>
      <p className="text-xs text-meal-muted mb-4">
        {DAY_LABELS[mealInfo.day] || mealInfo.day} {mealInfo.meal_type}
      </p>

      {/* If this is the main and has sides */}
      {mealInfo.side_ids.length > 0 && (
        <div className="space-y-2 mb-4">
          <p className="text-xs font-semibold text-meal-muted uppercase tracking-wider">Served with</p>
          {mealInfo.side_recipes.map((side) => (
            <Link key={side.id} href={`/recipes/${side.id}`}
              className="flex items-center gap-3 p-3 rounded-lg bg-meal-cream hover:bg-meal-warm transition-colors">
              {side.image_url ? (
                <img src={side.image_url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-meal-sage/20 flex items-center justify-center shrink-0">
                  <span className="text-meal-sage text-xs font-bold">+</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-meal-charcoal truncate">{side.title}</p>
              </div>
              <GFBadge isGlutenFree={side.is_gluten_free} size="sm" />
            </Link>
          ))}
        </div>
      )}

      {/* If this is a side, show what it's served with */}
      {mealInfo.is_side_of && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-meal-muted uppercase tracking-wider mb-2">Side for</p>
          <Link href={`/recipes/${mealInfo.is_side_of.recipe.id}`}
            className="flex items-center gap-3 p-3 rounded-lg bg-meal-cream hover:bg-meal-warm transition-colors">
            {mealInfo.is_side_of.recipe.image_url ? (
              <img src={mealInfo.is_side_of.recipe.image_url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-meal-coral/20 flex items-center justify-center shrink-0">
                <span className="text-meal-coral text-xs font-bold">M</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-meal-charcoal truncate">{mealInfo.is_side_of.recipe.title}</p>
            </div>
            <GFBadge isGlutenFree={mealInfo.is_side_of.recipe.is_gluten_free} size="sm" />
          </Link>
        </div>
      )}

      {/* Overall meal rating */}
      <div className="pt-3 border-t border-meal-cream">
        <div className="flex items-center justify-between">
          <span className="text-sm text-meal-muted">Overall meal</span>
          <StarRating value={mealRating} onChange={setMealRating} />
        </div>
      </div>
    </div>
  )
}
