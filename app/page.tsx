"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { DAYS, DAY_LABELS } from "@/types"
import type { MealSlot, DayOfWeek, MealType, Recipe } from "@/types"

function getMonday(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().split("T")[0]
}

function formatWeek(monday: string): string {
  const start = new Date(monday + "T00:00:00")
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }
  return `${start.toLocaleDateString("en-AU", opts)} — ${end.toLocaleDateString("en-AU", opts)}`
}

function shiftWeek(monday: string, delta: number): string {
  const d = new Date(monday + "T00:00:00")
  d.setDate(d.getDate() + delta * 7)
  return d.toISOString().split("T")[0]
}

export default function PlanPage() {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()))
  const [meals, setMeals] = useState<MealSlot[]>([])
  const [recipes, setRecipes] = useState<Record<number, Recipe>>({})
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [pickerOpen, setPickerOpen] = useState<{ day: DayOfWeek; meal_type: MealType } | null>(null)
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([])
  const [customText, setCustomText] = useState("")
  const [dinnerGenOpen, setDinnerGenOpen] = useState(false)
  const [dinnerMode, setDinnerMode] = useState<"stored" | "internet" | "mix">("mix")
  const [dinnerResults, setDinnerResults] = useState<{ recipe_id: number | null; title: string; is_gluten_free?: boolean; servings?: number; leftovers?: boolean; description?: string; source_hint?: string }[] | null>(null)
  const [generatingDinners, setGeneratingDinners] = useState(false)

  const fetchPlan = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/plan?week=${weekStart}`)
    const data = await res.json()
    if (data?.meals) {
      setMeals(data.meals)
      // Fetch recipe details for any assigned recipes
      const ids = data.meals
        .map((m: MealSlot) => m.recipe_id)
        .filter((id: number | null): id is number => id != null)
      if (ids.length) {
        const recipeMap: Record<number, Recipe> = {}
        await Promise.all(ids.map(async (id: number) => {
          const r = await fetch(`/api/recipes/${id}`)
          if (r.ok) recipeMap[id] = await r.json()
        }))
        setRecipes((prev) => ({ ...prev, ...recipeMap }))
      }
    } else {
      setMeals([])
    }
    setLoading(false)
  }, [weekStart])

  useEffect(() => { fetchPlan() }, [fetchPlan])

  function getSlot(day: DayOfWeek, mealType: MealType): MealSlot | undefined {
    return meals.find((m) => m.day === day && m.meal_type === mealType)
  }

  async function savePlan(updated: MealSlot[]) {
    setMeals(updated)
    await fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ week_start: weekStart, meals: updated }),
    })
  }

  function assignRecipe(day: DayOfWeek, mealType: MealType, recipeId: number | null, text: string | null) {
    const existing = meals.filter((m) => !(m.day === day && m.meal_type === mealType))
    const updated = [...existing, { day, meal_type: mealType, recipe_id: recipeId, custom_text: text }]
    savePlan(updated)
    setPickerOpen(null)
    setCustomText("")
  }

  function clearSlot(day: DayOfWeek, mealType: MealType) {
    const updated = meals.filter((m) => !(m.day === day && m.meal_type === mealType))
    savePlan(updated)
  }

  async function handleGenerate() {
    setGenerating(true)
    const res = await fetch("/api/plan/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meals }),
    })
    if (res.ok) {
      const data = await res.json()
      const updated = [...meals]
      for (const s of data.suggestions || []) {
        const exists = updated.find((m) => m.day === s.day && m.meal_type === s.meal_type)
        if (!exists) {
          updated.push({
            day: s.day,
            meal_type: s.meal_type,
            recipe_id: s.recipe_id || null,
            custom_text: s.recipe_id ? null : s.title,
          })
        }
      }
      savePlan(updated)
    }
    setGenerating(false)
  }

  async function handleGenerateDinners() {
    setGeneratingDinners(true)
    setDinnerResults(null)
    const res = await fetch("/api/plan/generate-dinners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: dinnerMode }),
    })
    if (res.ok) {
      const data = await res.json()
      setDinnerResults(data.dinners || [])
    }
    setGeneratingDinners(false)
  }

  async function applyDinnerResults() {
    if (!dinnerResults) return
    const updated = meals.filter((m) => m.meal_type !== "dinner")
    const dinnerDays = DAYS.slice() // Mon-Sun
    let dayIndex = 0
    for (const dinner of dinnerResults) {
      if (dayIndex >= 7) break
      const day = dinnerDays[dayIndex]
      updated.push({
        day,
        meal_type: "dinner" as MealType,
        recipe_id: dinner.recipe_id || null,
        custom_text: dinner.recipe_id ? null : dinner.title,
      })
      // If big meal with leftovers, mark next day too
      if (dinner.leftovers && dayIndex + 1 < 7) {
        dayIndex++
        updated.push({
          day: dinnerDays[dayIndex],
          meal_type: "dinner" as MealType,
          recipe_id: null,
          custom_text: `Leftovers: ${dinner.title}`,
        })
      }
      dayIndex++
    }
    await savePlan(updated)
    // Fetch any new recipe details
    const newIds = dinnerResults.filter((d) => d.recipe_id).map((d) => d.recipe_id!)
    for (const id of newIds) {
      if (!recipes[id]) {
        const r = await fetch(`/api/recipes/${id}`)
        if (r.ok) {
          const recipe = await r.json()
          setRecipes((prev) => ({ ...prev, [id]: recipe }))
        }
      }
    }
    setDinnerGenOpen(false)
    setDinnerResults(null)
  }

  async function openPicker(day: DayOfWeek, mealType: MealType) {
    setPickerOpen({ day, meal_type: mealType })
    if (allRecipes.length === 0) {
      const res = await fetch("/api/recipes")
      if (res.ok) setAllRecipes(await res.json())
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-meal-charcoal">Meal Plan</h1>
          <div className="flex items-center gap-3 mt-1">
            <button onClick={() => setWeekStart(shiftWeek(weekStart, -1))}
              className="p-1 text-meal-muted hover:text-meal-sage">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <span className="text-sm text-meal-muted font-medium">{formatWeek(weekStart)}</span>
            <button onClick={() => setWeekStart(shiftWeek(weekStart, 1))}
              className="p-1 text-meal-muted hover:text-meal-sage">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setDinnerGenOpen(true)}
            className="px-4 py-2 rounded-lg bg-meal-coral text-white text-sm font-medium hover:bg-meal-coral/80 transition-colors"
          >
            Generate Dinners
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-4 py-2 rounded-lg bg-meal-sage text-white text-sm font-medium hover:bg-meal-sageHover transition-colors disabled:opacity-50"
          >
            {generating ? "Generating..." : "AI Fill All"}
          </button>
          <Link
            href={`/shopping?week=${weekStart}`}
            className="px-4 py-2 rounded-lg bg-meal-warm text-meal-charcoal text-sm font-medium hover:bg-meal-warm/80 transition-colors"
          >
            Shopping List
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-meal-muted">Loading...</div>
      ) : (
        <>
          {/* Desktop grid */}
          <div className="hidden md:grid grid-cols-7 gap-3">
            {DAYS.map((day) => (
              <div key={day} className="space-y-2">
                <h3 className="text-xs font-semibold text-meal-muted uppercase tracking-wider text-center">
                  {DAY_LABELS[day]}
                </h3>
                {(["lunch", "dinner"] as MealType[]).map((mealType) => {
                  const slot = getSlot(day, mealType)
                  const recipe = slot?.recipe_id ? recipes[slot.recipe_id] : null
                  return (
                    <div
                      key={mealType}
                      className={`rounded-lg p-3 min-h-[80px] text-sm cursor-pointer transition-colors ${
                        slot?.recipe_id || slot?.custom_text
                          ? "bg-white shadow-sm hover:shadow-md"
                          : "bg-meal-warm/50 hover:bg-meal-warm border-2 border-dashed border-meal-warm"
                      }`}
                      onClick={() => slot?.recipe_id || slot?.custom_text ? undefined : openPicker(day, mealType)}
                    >
                      <span className="text-[10px] font-semibold text-meal-muted uppercase">
                        {mealType}
                      </span>
                      {recipe ? (
                        <div className="mt-1">
                          <p className="font-medium text-meal-charcoal text-xs line-clamp-2">{recipe.title}</p>
                          {!recipe.is_gluten_free && (
                            <span className="text-[8px] font-semibold text-meal-amber mt-1 inline-block">GLUTEN</span>
                          )}
                        </div>
                      ) : slot?.custom_text ? (
                        <p className="mt-1 font-medium text-meal-charcoal text-xs">{slot.custom_text}</p>
                      ) : (
                        <p className="mt-1 text-meal-muted text-xs">+ Add</p>
                      )}
                      {(slot?.recipe_id || slot?.custom_text) && (
                        <button onClick={(e) => { e.stopPropagation(); clearSlot(day, mealType) }}
                          className="text-[10px] text-meal-muted hover:text-red-500 mt-1">
                          clear
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          {/* Mobile vertical list */}
          <div className="md:hidden space-y-4">
            {DAYS.map((day) => (
              <div key={day} className="bg-white rounded-xl p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-meal-charcoal mb-3">{DAY_LABELS[day]}</h3>
                <div className="space-y-2">
                  {(["lunch", "dinner"] as MealType[]).map((mealType) => {
                    const slot = getSlot(day, mealType)
                    const recipe = slot?.recipe_id ? recipes[slot.recipe_id] : null
                    return (
                      <div
                        key={mealType}
                        className="flex items-center gap-3 p-3 rounded-lg bg-meal-cream"
                        onClick={() => !slot?.recipe_id && !slot?.custom_text ? openPicker(day, mealType) : undefined}
                      >
                        <span className={`text-[10px] font-semibold uppercase w-12 ${
                          mealType === "lunch" ? "text-meal-sky" : "text-meal-coral"
                        }`}>
                          {mealType}
                        </span>
                        <span className="flex-1 text-sm text-meal-charcoal">
                          {recipe ? recipe.title : slot?.custom_text || "Tap to add"}
                        </span>
                        {(slot?.recipe_id || slot?.custom_text) && (
                          <button onClick={(e) => { e.stopPropagation(); clearSlot(day, mealType) }}
                            className="text-xs text-meal-muted hover:text-red-500">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Dinner Generator Modal */}
      {dinnerGenOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center"
          onClick={() => { setDinnerGenOpen(false); setDinnerResults(null) }}>
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-md max-h-[85vh] overflow-auto p-5"
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-meal-charcoal mb-2">Generate 7 Dinners</h3>
            <p className="text-sm text-meal-muted mb-4">
              Pick a source and we&apos;ll fill your week with dinners. Big meals auto-add a leftovers night.
            </p>

            {/* Mode selector */}
            <div className="flex gap-1 bg-meal-warm rounded-lg p-1 mb-4">
              {([
                { value: "stored" as const, label: "Our Recipes" },
                { value: "mix" as const, label: "Mix" },
                { value: "internet" as const, label: "Internet" },
              ]).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setDinnerMode(opt.value); setDinnerResults(null) }}
                  className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                    dinnerMode === opt.value ? "bg-white text-meal-charcoal shadow-sm" : "text-meal-muted"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <p className="text-xs text-meal-muted mb-4">
              {dinnerMode === "stored" && "Picks from your saved recipes, favouring higher-rated ones."}
              {dinnerMode === "mix" && "A mix of your favourites and new AI-suggested recipes."}
              {dinnerMode === "internet" && "AI suggests top-rated recipes from popular food sites."}
            </p>

            {/* Generate button */}
            {!dinnerResults && (
              <button
                onClick={handleGenerateDinners}
                disabled={generatingDinners}
                className="w-full py-3 rounded-lg bg-meal-coral text-white font-medium hover:bg-meal-coral/80 transition-colors disabled:opacity-50"
              >
                {generatingDinners ? "Generating..." : "Generate Dinners"}
              </button>
            )}

            {/* Loading */}
            {generatingDinners && (
              <div className="text-center py-6">
                <div className="inline-block w-6 h-6 border-2 border-meal-coral border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-meal-muted mt-2">Finding the best meals...</p>
              </div>
            )}

            {/* Results */}
            {dinnerResults && !generatingDinners && (
              <div>
                <div className="space-y-2 mb-4">
                  {dinnerResults.map((d, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-meal-cream">
                      <span className="text-sm font-bold text-meal-coral w-6 shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-meal-charcoal">{d.title}</p>
                        {d.description && <p className="text-xs text-meal-muted mt-0.5">{d.description}</p>}
                        <div className="flex items-center gap-2 mt-1">
                          {d.is_gluten_free ? (
                            <span className="text-[10px] font-semibold text-meal-sage">GF</span>
                          ) : (
                            <span className="text-[10px] font-semibold text-meal-amber">Gluten</span>
                          )}
                          {d.leftovers && (
                            <span className="text-[10px] font-semibold text-meal-plum">+ Leftovers night</span>
                          )}
                          {d.source_hint && (
                            <span className="text-[10px] text-meal-muted">{d.source_hint}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => { setDinnerResults(null) }}
                    className="flex-1 py-2.5 rounded-lg bg-meal-warm text-meal-charcoal text-sm font-medium"
                  >
                    Re-roll
                  </button>
                  <button
                    onClick={applyDinnerResults}
                    className="flex-1 py-2.5 rounded-lg bg-meal-sage text-white text-sm font-medium hover:bg-meal-sageHover transition-colors"
                  >
                    Use These Dinners
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recipe Picker Modal */}
      {pickerOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center"
          onClick={() => setPickerOpen(null)}>
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-md max-h-[80vh] overflow-auto p-5"
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-meal-charcoal mb-4">
              {DAY_LABELS[pickerOpen.day]} {pickerOpen.meal_type}
            </h3>

            {/* Custom text */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Custom (e.g. Leftovers, Eating out)"
                className="flex-1 px-3 py-2 rounded-lg bg-meal-cream border border-meal-warm focus:outline-none focus:ring-2 focus:ring-meal-sage/30 text-sm"
              />
              <button
                onClick={() => customText.trim() && assignRecipe(pickerOpen.day, pickerOpen.meal_type, null, customText.trim())}
                disabled={!customText.trim()}
                className="px-3 py-2 rounded-lg bg-meal-sage text-white text-sm font-medium disabled:opacity-50"
              >
                Add
              </button>
            </div>

            <div className="border-t border-meal-warm pt-3">
              <h4 className="text-xs font-semibold text-meal-muted uppercase mb-2">Or pick a recipe</h4>
              {allRecipes.length === 0 ? (
                <p className="text-sm text-meal-muted py-4 text-center">No recipes yet. <Link href="/recipes/new" className="text-meal-sage hover:underline">Add one?</Link></p>
              ) : (
                <div className="space-y-1">
                  {allRecipes.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => {
                        assignRecipe(pickerOpen.day, pickerOpen.meal_type, r.id, null)
                        setRecipes((prev) => ({ ...prev, [r.id]: r }))
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-meal-cream transition-colors flex items-center gap-2"
                    >
                      <span className="flex-1 text-sm text-meal-charcoal">{r.title}</span>
                      {r.is_gluten_free ? (
                        <span className="text-[10px] font-semibold text-meal-sage">GF</span>
                      ) : (
                        <span className="text-[10px] font-semibold text-meal-amber">Gluten</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
