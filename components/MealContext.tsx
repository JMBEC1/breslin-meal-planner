"use client"

import { useState, useEffect } from "react"
import { StarRating } from "./StarRating"
import { GFBadge } from "./GFBadge"
import { RecipeRating } from "./RecipeRating"
import { AISLE_LABELS } from "@/types"
import type { Recipe, AisleCategory } from "@/types"

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

function InlineRecipe({ recipe }: { recipe: Recipe }) {
  return (
    <div className="mt-6 pt-6 border-t-2 border-meal-sage/30">
      {/* Side header with image */}
      <div className="flex items-start gap-3 mb-4">
        {recipe.image_url && (
          <img src={recipe.image_url} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" />
        )}
        <div className="flex-1">
          <p className="text-xs font-semibold text-meal-sage uppercase tracking-wider">Side</p>
          <h3 className="text-xl font-bold text-meal-charcoal">{recipe.title}</h3>
          <div className="flex items-center gap-2 mt-1">
            <GFBadge isGlutenFree={recipe.is_gluten_free} size="sm" />
            {recipe.prep_time_mins && <span className="text-xs text-meal-muted">Prep: {recipe.prep_time_mins} min</span>}
            {recipe.cook_time_mins && <span className="text-xs text-meal-muted">Cook: {recipe.cook_time_mins} min</span>}
          </div>
        </div>
      </div>

      {recipe.description && (
        <p className="text-meal-muted text-sm mb-4">{recipe.description}</p>
      )}

      {/* Ingredients */}
      {recipe.ingredients && recipe.ingredients.length > 0 && (
        <div className="bg-white rounded-xl p-5 mb-4 shadow-sm">
          <h4 className="text-base font-semibold text-meal-charcoal mb-3">Ingredients</h4>
          <ul className="space-y-2">
            {recipe.ingredients.map((ing, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-meal-sage mt-2 shrink-0" />
                <span className="text-meal-charcoal text-sm">
                  {ing.quantity && <span className="font-medium">{ing.quantity}</span>}
                  {ing.unit && <span className="font-medium"> {ing.unit}</span>}
                  {" "}{ing.name}
                  {!ing.is_gluten_free && (
                    <span className="ml-2 text-[10px] font-semibold text-meal-amber bg-meal-amber/10 px-1.5 py-0.5 rounded-full">
                      GLUTEN
                    </span>
                  )}
                </span>
                <span className="ml-auto text-xs text-meal-muted">
                  {AISLE_LABELS[ing.aisle as AisleCategory] || ing.aisle}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Instructions */}
      {recipe.instructions && (
        <div className="bg-white rounded-xl p-5 mb-4 shadow-sm">
          <h4 className="text-base font-semibold text-meal-charcoal mb-3">Instructions</h4>
          <ol className="space-y-3">
            {recipe.instructions
              .split(/(?=\d+\.\s)/)
              .map((step: string) => step.trim())
              .filter(Boolean)
              .map((step: string, i: number) => (
                <li key={i} className="flex gap-3 text-sm text-meal-charcoal">
                  <span className="text-meal-sage font-bold shrink-0 w-6 text-right">{i + 1}.</span>
                  <span>{step.replace(/^\d+\.\s*/, "")}</span>
                </li>
              ))}
          </ol>
        </div>
      )}

      {/* Individual rating for this side */}
      <RecipeRating recipeId={recipe.id} />
    </div>
  )
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

  const hasSides = mealInfo.side_recipes.length > 0
  const isSideOf = mealInfo.is_side_of

  if (!hasSides && !isSideOf) return null

  return (
    <>
      {/* Inline side recipes — full details shown on the same page */}
      {hasSides && mealInfo.side_recipes.map((side) => (
        <InlineRecipe key={side.id} recipe={side} />
      ))}

      {/* If this is a side, show the main recipe inline */}
      {isSideOf && (
        <div className="mt-6 pt-6 border-t-2 border-meal-coral/30">
          <p className="text-xs font-semibold text-meal-coral uppercase tracking-wider mb-2">Main dish</p>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-meal-cream">
            {isSideOf.recipe.image_url && (
              <img src={isSideOf.recipe.image_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
            )}
            <div className="flex-1">
              <p className="text-sm font-medium text-meal-charcoal">{isSideOf.recipe.title}</p>
            </div>
            <GFBadge isGlutenFree={isSideOf.recipe.is_gluten_free} size="sm" />
          </div>
        </div>
      )}

      {/* Overall meal rating — at the very bottom */}
      <div className="mt-6 bg-meal-warm/50 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-meal-charcoal">Overall Meal Rating</h3>
            <p className="text-xs text-meal-muted mt-0.5">How was the whole meal together?</p>
          </div>
          <StarRating value={mealRating} onChange={setMealRating} size="md" />
        </div>
      </div>
    </>
  )
}
