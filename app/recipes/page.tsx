"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { RecipeCard } from "@/components/RecipeCard"
import { CategoryFilter } from "@/components/CategoryFilter"
import type { Recipe } from "@/types"

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState<string | null>(null)
  const [gfOnly, setGfOnly] = useState(false)

  const fetchRecipes = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (category) params.set("category", category)
    if (gfOnly) params.set("gf", "true")
    const res = await fetch(`/api/recipes?${params}`)
    const data = await res.json()
    setRecipes(data)
    setLoading(false)
  }, [category, gfOnly])

  useEffect(() => { fetchRecipes() }, [fetchRecipes])

  const filtered = search
    ? recipes.filter((r) =>
        r.title.toLowerCase().includes(search.toLowerCase()) ||
        r.description.toLowerCase().includes(search.toLowerCase()) ||
        r.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
      )
    : recipes

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-meal-charcoal">Recipes</h1>
        <div className="flex gap-2">
          <Link
            href="/recipes/import"
            className="px-4 py-2 rounded-lg bg-meal-warm text-meal-charcoal text-sm font-medium hover:bg-meal-warm/80 transition-colors"
          >
            Import
          </Link>
          <Link
            href="/recipes/new"
            className="px-4 py-2 rounded-lg bg-meal-sage text-white text-sm font-medium hover:bg-meal-sageHover transition-colors"
          >
            + Add Recipe
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search recipes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg bg-white border border-meal-warm text-meal-charcoal placeholder:text-meal-muted focus:outline-none focus:ring-2 focus:ring-meal-sage/30 focus:border-meal-sage transition-colors"
        />
      </div>

      {/* Filters */}
      <div className="mb-6">
        <CategoryFilter
          selected={category}
          gfOnly={gfOnly}
          onCategoryChange={setCategory}
          onGfChange={setGfOnly}
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="text-center py-12 text-meal-muted">Loading recipes...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-meal-muted mb-4">
            {recipes.length === 0
              ? "No recipes yet — let's add some!"
              : "No recipes match your filters."}
          </p>
          {recipes.length === 0 && (
            <Link
              href="/recipes/new"
              className="inline-block px-6 py-3 rounded-lg bg-meal-sage text-white font-medium hover:bg-meal-sageHover transition-colors"
            >
              Add Your First Recipe
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      )}
    </div>
  )
}
