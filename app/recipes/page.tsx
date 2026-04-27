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

  // Cheat meals
  const [cheatMeals, setCheatMeals] = useState<{ id: number; name: string; category: string; is_gluten_free: boolean }[]>([])
  const [showCheats, setShowCheats] = useState(false)
  const [newCheat, setNewCheat] = useState("")
  const [newCheatGF, setNewCheatGF] = useState(true)
  const [newCheatCat, setNewCheatCat] = useState("protein")

  // Cheat meal modal
  const [cheatModalOpen, setCheatModalOpen] = useState(false)
  const [cheatName, setCheatName] = useState("")
  const [cheatServings, setCheatServings] = useState("4")
  const [cheatGF, setCheatGF] = useState(true)
  const [cheatCategory, setCheatCategory] = useState<"dinner" | "school-lunch">("dinner")
  const [cheatIngredients, setCheatIngredients] = useState("")
  const [savingCheat, setSavingCheat] = useState(false)

  async function saveCheatMeal() {
    if (!cheatName.trim()) return
    setSavingCheat(true)

    // Parse ingredients from comma/newline separated text
    const ingNames = cheatIngredients.split(/[,\n]/).map((s) => s.trim()).filter(Boolean)
    const ingredients = ingNames.map((name) => ({
      name,
      quantity: "1",
      unit: "",
      aisle: "other", // server will auto-categorise
      is_gluten_free: true,
    }))

    const res = await fetch("/api/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: cheatName.trim(),
        category: cheatCategory,
        is_gluten_free: cheatGF,
        servings: parseInt(cheatServings) || 4,
        description: "Quick meal — no recipe needed",
        ingredients,
        instructions: "",
        tags: ["cheat-meal"],
      }),
    })
    if (res.ok) {
      setCheatModalOpen(false)
      setCheatName("")
      setCheatServings("4")
      setCheatIngredients("")
      fetchRecipes()
    }
    setSavingCheat(false)
  }

  // Lunch box
  const [showLunchBox, setShowLunchBox] = useState(false)
  const [newLunchItem, setNewLunchItem] = useState("")
  const [newLunchGF, setNewLunchGF] = useState(true)

  useEffect(() => {
    fetch("/api/cheat-meals").then((r) => r.ok ? r.json() : []).then(setCheatMeals)
  }, [])

  async function addCheat() {
    if (!newCheat.trim()) return
    const res = await fetch("/api/cheat-meals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCheat.trim(), is_gluten_free: newCheatGF, category: newCheatCat }),
    })
    if (res.ok) {
      const cm = await res.json()
      setCheatMeals((prev) => [...prev, cm])
    }
    setNewCheat("")
  }

  async function removeCheat(id: number) {
    await fetch(`/api/cheat-meals/${id}`, { method: "DELETE" })
    setCheatMeals((prev) => prev.filter((c) => c.id !== id))
  }

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
          <button
            onClick={() => setCheatModalOpen(true)}
            className="px-4 py-2 rounded-lg bg-meal-coral text-white text-sm font-medium hover:bg-meal-coral/80 transition-colors"
          >
            + Cheat Meal
          </button>
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

      {/* Lunch Box Items */}
      <div className="mb-6">
        <button
          onClick={() => setShowLunchBox(!showLunchBox)}
          className="flex items-center gap-2 text-sm font-semibold text-meal-charcoal"
        >
          <span>🍱</span>
          <span>Lunch Box Items</span>
          {cheatMeals.filter((cm) => cm.category.startsWith("lunch-")).length > 0 && (
            <span className="bg-meal-sky text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
              {cheatMeals.filter((cm) => cm.category.startsWith("lunch-")).length}
            </span>
          )}
          <svg className={`w-4 h-4 text-meal-muted transition-transform ${showLunchBox ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
        {showLunchBox && (
          <div className="mt-3 bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs text-meal-muted mb-3">Fruit, veg and snacks are pulled from your inventory automatically. Add the mains your kids like below — GF ones go to Etta, others to Jude.</p>
            {(() => {
              const mainItems = cheatMeals.filter((cm) => cm.category === "lunch-main")
              return (
                <div className="mb-3">
                  <h4 className="text-xs font-semibold text-meal-muted uppercase tracking-wider mb-1.5">🥪 Lunch Mains</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {mainItems.map((cm) => (
                      <span key={cm.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-meal-cream text-xs text-meal-charcoal group">
                        {cm.name}
                        <span className={`text-[8px] font-bold ${cm.is_gluten_free ? "text-meal-sage" : "text-meal-amber"}`}>
                          {cm.is_gluten_free ? "GF" : "GL"}
                        </span>
                        <button onClick={() => removeCheat(cm.id)}
                          className="text-meal-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    ))}
                    {mainItems.length === 0 && <span className="text-xs text-meal-muted">None yet — add some below</span>}
                  </div>
                </div>
              )
            })()}
            <div className="flex gap-1.5 mt-2">
              <input
                type="text"
                value={newLunchItem}
                onChange={(e) => setNewLunchItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newLunchItem.trim()) {
                    fetch("/api/cheat-meals", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ name: newLunchItem.trim(), is_gluten_free: newLunchGF, category: "lunch-main" }),
                    }).then((r) => r.json()).then((cm) => { setCheatMeals((prev) => [...prev, cm]); setNewLunchItem("") })
                  }
                }}
                placeholder="e.g. Chicken roll, Pie, Vegemite sandwich..."
                className="flex-1 px-3 py-2 rounded-lg bg-meal-cream border border-meal-warm focus:outline-none focus:ring-2 focus:ring-meal-sage/30 text-sm"
              />
              <button
                onClick={() => setNewLunchGF(!newLunchGF)}
                className={`px-2 py-2 rounded-lg text-[10px] font-semibold shrink-0 ${newLunchGF ? "bg-meal-sage/10 text-meal-sage" : "bg-meal-amber/10 text-meal-amber"}`}
              >
                {newLunchGF ? "GF" : "Gluten"}
              </button>
              <button
                onClick={() => {
                  if (!newLunchItem.trim()) return
                  fetch("/api/cheat-meals", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: newLunchItem.trim(), is_gluten_free: newLunchGF, category: "lunch-main" }),
                  }).then((r) => r.json()).then((cm) => { setCheatMeals((prev) => [...prev, cm]); setNewLunchItem("") })
                }}
                disabled={!newLunchItem.trim()}
                className="px-3 py-2 rounded-lg bg-meal-sage text-white text-sm font-medium disabled:opacity-50 shrink-0"
              >
                Add
              </button>
            </div>
          </div>
        )}
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

      {/* Cheat Meal Modal */}
      {cheatModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center"
          onClick={() => setCheatModalOpen(false)}>
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-sm p-5"
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-meal-charcoal mb-1">Add Cheat Meal</h3>
            <p className="text-sm text-meal-muted mb-4">Quick meals with no recipe — just a name and servings.</p>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-meal-muted uppercase mb-1">Meal name</label>
                <input
                  type="text"
                  value={cheatName}
                  onChange={(e) => setCheatName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveCheatMeal()}
                  placeholder="e.g. Sausages, chips & beans"
                  className="w-full px-3 py-2 rounded-lg bg-meal-cream border border-meal-warm text-sm focus:outline-none focus:ring-2 focus:ring-meal-sage/30"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-meal-muted uppercase mb-1">Servings</label>
                  <input
                    type="number"
                    value={cheatServings}
                    onChange={(e) => setCheatServings(e.target.value)}
                    min="1"
                    className="w-full px-3 py-2 rounded-lg bg-meal-cream border border-meal-warm text-sm text-center focus:outline-none focus:ring-2 focus:ring-meal-sage/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-meal-muted uppercase mb-1">Type</label>
                  <button
                    onClick={() => setCheatCategory(cheatCategory === "dinner" ? "school-lunch" : "dinner")}
                    className={`w-full px-3 py-2 rounded-lg text-sm font-medium ${
                      cheatCategory === "dinner" ? "bg-meal-coral/10 text-meal-coral" : "bg-meal-sky/10 text-meal-sky"
                    }`}
                  >
                    {cheatCategory === "dinner" ? "Dinner" : "Lunch"}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-meal-muted uppercase mb-1">Ingredients</label>
                <textarea
                  value={cheatIngredients}
                  onChange={(e) => setCheatIngredients(e.target.value)}
                  placeholder={"Sausages\nChips\nBaked beans"}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-meal-cream border border-meal-warm text-sm focus:outline-none focus:ring-2 focus:ring-meal-sage/30 resize-none"
                />
                <p className="text-[10px] text-meal-muted mt-1">One per line or comma-separated. These go on the shopping list.</p>
              </div>
              <button
                onClick={() => setCheatGF(!cheatGF)}
                className={`w-full px-3 py-2 rounded-lg text-sm font-medium ${
                  cheatGF ? "bg-meal-sage/10 text-meal-sage" : "bg-meal-amber/10 text-meal-amber"
                }`}
              >
                {cheatGF ? "✓ Gluten Free" : "Contains Gluten"}
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setCheatModalOpen(false)}
                className="flex-1 py-2.5 rounded-lg bg-meal-warm text-meal-charcoal text-sm font-medium">
                Cancel
              </button>
              <button
                onClick={saveCheatMeal}
                disabled={savingCheat || !cheatName.trim()}
                className="flex-1 py-2.5 rounded-lg bg-meal-sage text-white text-sm font-medium hover:bg-meal-sageHover transition-colors disabled:opacity-50"
              >
                {savingCheat ? "Saving..." : "Add Meal"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
