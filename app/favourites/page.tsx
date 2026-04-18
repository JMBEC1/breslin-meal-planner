"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { StarRating } from "@/components/StarRating"
import { FAMILY_MEMBERS } from "@/types"
import type { Recipe, FamilyMember, Rating } from "@/types"

interface RatedRecipe {
  recipe: Recipe
  ratings: Rating[]
  avgEnjoyment: number
  easeOfCooking: number
}

export default function FavouritesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [ratings, setRatings] = useState<Rating[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPerson, setSelectedPerson] = useState<FamilyMember | "all">("all")

  useEffect(() => {
    Promise.all([
      fetch("/api/recipes").then((r) => r.json()),
      fetch("/api/ratings").then((r) => r.json()),
    ]).then(([recipeData, ratingData]) => {
      setRecipes(recipeData)
      setRatings(ratingData)
      setLoading(false)
    })
  }, [])

  // Build rated recipes list
  const ratedRecipes: RatedRecipe[] = recipes
    .map((recipe) => {
      const recipeRatings = ratings.filter((r) => r.recipe_id === recipe.id)
      if (recipeRatings.length === 0) return null

      const relevantRatings = selectedPerson === "all"
        ? recipeRatings.filter((r) => r.enjoyment > 0)
        : recipeRatings.filter((r) => r.person === selectedPerson && r.enjoyment > 0)

      if (relevantRatings.length === 0) return null

      const avgEnjoyment = relevantRatings.reduce((sum, r) => sum + r.enjoyment, 0) / relevantRatings.length
      const easeOfCooking = recipeRatings[0]?.ease_of_cooking || 0

      return { recipe, ratings: recipeRatings, avgEnjoyment, easeOfCooking }
    })
    .filter((r): r is RatedRecipe => r !== null)
    .sort((a, b) => b.avgEnjoyment - a.avgEnjoyment)

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-6 py-6">
      <h1 className="text-2xl font-bold text-meal-charcoal mb-2">Favourites</h1>
      <p className="text-sm text-meal-muted mb-6">Recipes ranked by your family&apos;s ratings.</p>

      {/* Person filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setSelectedPerson("all")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            selectedPerson === "all" ? "bg-meal-sage text-white" : "bg-meal-warm text-meal-charcoal"
          }`}
        >
          Everyone
        </button>
        {FAMILY_MEMBERS.map((person) => (
          <button
            key={person}
            onClick={() => setSelectedPerson(person)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedPerson === person ? "bg-meal-sage text-white" : "bg-meal-warm text-meal-charcoal"
            }`}
          >
            {person}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-meal-muted">Loading...</div>
      ) : ratedRecipes.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-meal-muted mb-2">No rated recipes yet.</p>
          <p className="text-sm text-meal-muted">Rate some recipes and they&apos;ll appear here!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ratedRecipes.map(({ recipe, ratings: recipeRatings, avgEnjoyment, easeOfCooking }, i) => (
            <Link key={recipe.id} href={`/recipes/${recipe.id}`} className="block">
              <div className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3">
                  <span className="text-lg font-bold text-meal-muted/50 w-8 text-center shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-meal-charcoal">{recipe.title}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex items-center gap-1">
                        <StarRating value={Math.round(avgEnjoyment)} readonly size="sm" />
                        <span className="text-xs text-meal-muted ml-1">{avgEnjoyment.toFixed(1)}</span>
                      </div>
                      {easeOfCooking > 0 && (
                        <span className="text-xs text-meal-muted">
                          Ease: {easeOfCooking}/5
                        </span>
                      )}
                    </div>
                    {/* Per-person breakdown */}
                    {selectedPerson === "all" && (
                      <div className="flex gap-3 mt-2">
                        {FAMILY_MEMBERS.map((person) => {
                          const r = recipeRatings.find((rt) => rt.person === person)
                          if (!r || !r.enjoyment) return null
                          return (
                            <span key={person} className="text-xs text-meal-muted">
                              {person}: {r.enjoyment}/5
                            </span>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  {recipe.is_gluten_free ? (
                    <span className="text-[10px] font-semibold text-meal-sage bg-meal-sage/10 px-2 py-0.5 rounded-full">GF</span>
                  ) : (
                    <span className="text-[10px] font-semibold text-meal-amber bg-meal-amber/10 px-2 py-0.5 rounded-full">Gluten</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
