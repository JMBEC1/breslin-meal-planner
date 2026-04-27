"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
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

function getTodayDay(): DayOfWeek {
  const days: DayOfWeek[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
  return days[new Date().getDay()]
}

function getTomorrowDay(): DayOfWeek {
  const days: DayOfWeek[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
  return days[(new Date().getDay() + 1) % 7]
}

const DAY_FULL_LABELS: Record<DayOfWeek, string> = {
  monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday",
  thursday: "Thursday", friday: "Friday", saturday: "Saturday", sunday: "Sunday",
}

interface DinnerSuggestion {
  recipe_id: number | null
  title: string
  is_gluten_free?: boolean
  servings?: number
  leftovers?: boolean
  description?: string
  source_hint?: string
}

export default function PlanPage() {
  const router = useRouter()
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()))
  const [meals, setMeals] = useState<MealSlot[]>([])
  const [recipes, setRecipes] = useState<Record<number, Recipe>>({})
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [pickerOpen, setPickerOpen] = useState<{ day: DayOfWeek; meal_type: MealType; addSide?: boolean } | null>(null)
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([])
  const [customText, setCustomText] = useState("")
  const [freezerItems, setFreezerItems] = useState<{ id: number; name: string; servings: number | null; item_type: string; location: string }[]>([])
  const [cheatMeals, setCheatMeals] = useState<{ id: number; name: string; category: string; is_gluten_free: boolean }[]>([])
  const [cookToast, setCookToast] = useState<{ message: string; visible: boolean } | null>(null)
  const [cookingSlot, setCookingSlot] = useState<string | null>(null)
  const [cookModal, setCookModal] = useState<{ day: DayOfWeek; mealType: MealType; recipeIds: number[]; title: string; isGF: boolean } | null>(null)
  const [cookEating, setCookEating] = useState("1")
  const [cookFridge, setCookFridge] = useState("0")
  const [cookFreezer, setCookFreezer] = useState("0")
  const [cookSaving, setCookSaving] = useState(false)

  function markCooked(day: DayOfWeek, mealType: MealType) {
    const slot = getSlot(day, mealType)
    if (!slot) return
    const ids: number[] = []
    if (slot.recipe_id) ids.push(slot.recipe_id)
    if (slot.side_ids) ids.push(...slot.side_ids)
    if (ids.length === 0) return

    const recipe = slot.recipe_id ? recipes[slot.recipe_id] : null
    const title = recipe?.title || slot.custom_text || "Meal"
    setCookEating("1")
    setCookFridge("0")
    setCookFreezer("0")
    setCookModal({ day, mealType, recipeIds: ids, title, isGF: recipe?.is_gluten_free ?? true })
  }

  async function confirmCooked() {
    if (!cookModal) return
    setCookSaving(true)

    // 1. Deduct ingredients from inventory
    const res = await fetch("/api/inventory/cook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipe_ids: cookModal.recipeIds }),
    })
    const data = res.ok ? await res.json() : { deducted: [] }
    const count = data.deducted?.length || 0

    // 2. Save portions to fridge and/or freezer
    const fridgeCount = parseInt(cookFridge) || 0
    const freezerCount = parseInt(cookFreezer) || 0

    for (const [loc, qty] of [["fridge", fridgeCount], ["freezer", freezerCount]] as const) {
      if (qty > 0) {
        await fetch("/api/inventory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: cookModal.title,
            location: loc,
            item_type: "batch_cook",
            quantity: String(qty),
            unit: "portions",
            servings: qty,
            is_gluten_free: cookModal.isGF,
            notes: `Batch cooked from ${cookModal.title}`,
          }),
        })
      }
    }

    setCookSaving(false)
    setCookModal(null)
    const parts: string[] = []
    if (count > 0) parts.push(`Deducted ${count} item${count !== 1 ? "s" : ""}`)
    if (fridgeCount > 0) parts.push(`${fridgeCount} to fridge`)
    if (freezerCount > 0) parts.push(`${freezerCount} to freezer`)
    setCookToast({ message: parts.join(", ") || "Done!", visible: true })
    setTimeout(() => setCookToast(null), 4000)
  }

  // Dinner generator state
  const [dinnerGenOpen, setDinnerGenOpen] = useState(false)
  const [dinnerMode, setDinnerMode] = useState<"stored" | "internet" | "mix">("mix")
  const [dinnerResults, setDinnerResults] = useState<DinnerSuggestion[] | null>(null)
  const [generatingDinners, setGeneratingDinners] = useState(false)
  const [inspiration, setInspiration] = useState("")
  const [swappingIndex, setSwappingIndex] = useState<number | null>(null)
  const [dinnersSaved, setDinnersSaved] = useState(false)

  // Lunch generator state
  const [lunchGenOpen, setLunchGenOpen] = useState(false)
  const [lunchMode, setLunchMode] = useState<"stored" | "internet" | "mix" | "lunchbox">("lunchbox")
  const [lunchResults, setLunchResults] = useState<DinnerSuggestion[] | null>(null)
  const [lunchBoxResults, setLunchBoxResults] = useState<{ fruit: string[]; veg: string[]; snack: string[]; jude_main: string; etta_main: string }[] | null>(null)
  const [generatingLunches, setGeneratingLunches] = useState(false)
  const [lunchInspiration, setLunchInspiration] = useState("")
  const [swappingLunchIndex, setSwappingLunchIndex] = useState<number | null>(null)
  const [lunchesSaved, setLunchesSaved] = useState(false)
  const [schoolOrderDays, setSchoolOrderDays] = useState<Record<string, boolean>>({
    monday: false, tuesday: false, wednesday: false, thursday: false, friday: false,
  })

  const fetchPlan = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/plan?week=${weekStart}`)
    const data = await res.json()
    if (data?.meals) {
      setMeals(data.meals)
      const ids: number[] = []
      for (const m of data.meals as MealSlot[]) {
        if (m.recipe_id) ids.push(m.recipe_id)
        if (m.side_ids) ids.push(...m.side_ids)
      }
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
    if (pickerOpen?.addSide && recipeId) {
      // Adding a side to an existing slot
      const updated = meals.map((m) => {
        if (m.day === day && m.meal_type === mealType) {
          return { ...m, side_ids: [...(m.side_ids || []), recipeId] }
        }
        return m
      })
      savePlan(updated)
    } else {
      const existing = meals.filter((m) => !(m.day === day && m.meal_type === mealType))
      const updated = [...existing, { day, meal_type: mealType, recipe_id: recipeId, custom_text: text }]
      savePlan(updated)
    }
    setPickerOpen(null)
    setCustomText("")
  }

  function removeSide(day: DayOfWeek, mealType: MealType, sideId: number) {
    const updated = meals.map((m) => {
      if (m.day === day && m.meal_type === mealType) {
        return { ...m, side_ids: (m.side_ids || []).filter((id) => id !== sideId) }
      }
      return m
    })
    savePlan(updated)
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
        const exists = updated.find((m: MealSlot) => m.day === s.day && m.meal_type === s.meal_type)
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

  // ── Dinner generator ────────────────────────────────────────────

  async function handleGenerateDinners() {
    setGeneratingDinners(true)
    setDinnerResults(null)
    setDinnersSaved(false)
    const res = await fetch("/api/plan/generate-dinners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: dinnerMode, inspiration: inspiration.trim() || undefined }),
    })
    if (res.ok) {
      const data = await res.json()
      setDinnerResults(data.dinners || [])
    }
    setGeneratingDinners(false)
  }

  async function handleSwapDinner(index: number) {
    setSwappingIndex(index)
    const res = await fetch("/api/plan/generate-dinners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: dinnerMode, inspiration: inspiration.trim() || undefined, swapIndex: index }),
    })
    if (res.ok) {
      const data = await res.json()
      if (data.dinners?.length > 0) {
        setDinnerResults((prev) => {
          if (!prev) return prev
          const updated = [...prev]
          updated[index] = data.dinners[0]
          return updated
        })
      }
    }
    setSwappingIndex(null)
  }

  // Save an AI suggestion as a real recipe (with auto image) and return the new ID
  async function saveAsSuggestionRecipe(suggestion: DinnerSuggestion, category: string): Promise<number | null> {
    if (suggestion.recipe_id) return suggestion.recipe_id // Already a stored recipe
    const res = await fetch("/api/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: suggestion.title,
        category,
        is_gluten_free: suggestion.is_gluten_free ?? true,
        servings: suggestion.servings || 4,
        description: suggestion.description || "",
        ingredients: [],
        instructions: "",
        tags: ["ai-suggested"],
      }),
    })
    if (res.ok) {
      const recipe = await res.json()
      setRecipes((prev) => ({ ...prev, [recipe.id]: recipe }))
      return recipe.id
    }
    return null
  }

  async function applyDinnerResults() {
    if (!dinnerResults) return
    const updated = meals.filter((m) => m.meal_type !== "dinner")
    const dinnerDays = DAYS.slice()
    let dayIndex = 0
    for (const dinner of dinnerResults) {
      if (dayIndex >= 7) break
      const day = dinnerDays[dayIndex]
      // Auto-save AI suggestions as recipes
      const recipeId = await saveAsSuggestionRecipe(dinner, "dinner")
      updated.push({
        day,
        meal_type: "dinner" as MealType,
        recipe_id: recipeId,
        custom_text: recipeId ? null : dinner.title,
      })
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
    setDinnersSaved(true)
  }

  // ── Lunch generator ──────────────────────────────────────────

  const WEEKDAYS: DayOfWeek[] = ["monday", "tuesday", "wednesday", "thursday", "friday"]

  const packedLunchDays = WEEKDAYS.filter((d) => !schoolOrderDays[d])

  async function handleGenerateLunches() {
    setGeneratingLunches(true)
    setLunchResults(null)
    setLunchBoxResults(null)
    setLunchesSaved(false)
    const count = packedLunchDays.length
    if (count === 0) {
      applySchoolOrdersOnly()
      setGeneratingLunches(false)
      return
    }
    const res = await fetch("/api/plan/generate-lunches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: lunchMode, inspiration: lunchInspiration.trim() || undefined }),
    })
    if (res.ok) {
      const data = await res.json()
      if (data.mode === "lunchbox") {
        setLunchBoxResults((data.lunches || []).slice(0, count))
      } else {
        setLunchResults((data.lunches || []).slice(0, count))
      }
    }
    setGeneratingLunches(false)
  }

  function applySchoolOrdersOnly() {
    const updated = meals.filter((m) => !(m.meal_type === "lunch" && WEEKDAYS.includes(m.day)))
    for (const day of WEEKDAYS) {
      if (schoolOrderDays[day]) {
        updated.push({ day, meal_type: "lunch" as MealType, recipe_id: null, custom_text: "School Order" })
      }
    }
    savePlan(updated)
    setLunchesSaved(true)
  }

  async function handleSwapLunch(index: number) {
    setSwappingLunchIndex(index)
    const res = await fetch("/api/plan/generate-lunches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: lunchMode, inspiration: lunchInspiration.trim() || undefined, swapIndex: index }),
    })
    if (res.ok) {
      const data = await res.json()
      if (data.lunches?.length > 0) {
        setLunchResults((prev) => {
          if (!prev) return prev
          const updated = [...prev]
          updated[index] = data.lunches[0]
          return updated
        })
      }
    }
    setSwappingLunchIndex(null)
  }

  async function applyLunchResults() {
    if (!lunchResults) return
    // Remove existing Mon-Fri lunches only
    const updated = meals.filter((m) => !(m.meal_type === "lunch" && WEEKDAYS.includes(m.day)))
    // Add school order days first
    for (const day of WEEKDAYS) {
      if (schoolOrderDays[day]) {
        updated.push({ day, meal_type: "lunch" as MealType, recipe_id: null, custom_text: "School Order" })
      }
    }
    // Fill remaining days with generated lunches — auto-save AI suggestions as recipes
    let lunchIdx = 0
    for (const day of packedLunchDays) {
      if (lunchIdx >= lunchResults.length) break
      const lunch = lunchResults[lunchIdx]
      const recipeId = await saveAsSuggestionRecipe(lunch, "school-lunch")
      updated.push({
        day,
        meal_type: "lunch" as MealType,
        recipe_id: recipeId,
        custom_text: recipeId ? null : lunch.title,
      })
      lunchIdx++
    }
    await savePlan(updated)
    setLunchesSaved(true)
  }

  async function applyLunchBoxResults() {
    if (!lunchBoxResults) return
    const updated = meals.filter((m) => !(m.meal_type === "lunch" && WEEKDAYS.includes(m.day)))
    for (const day of WEEKDAYS) {
      if (schoolOrderDays[day]) {
        updated.push({ day, meal_type: "lunch" as MealType, recipe_id: null, custom_text: "School Order" })
      }
    }
    let idx = 0
    for (const day of packedLunchDays) {
      if (idx >= lunchBoxResults.length) break
      const box = lunchBoxResults[idx]
      const parts = [
        ...box.fruit.map((f) => `🍎 ${f}`),
        ...box.veg.map((v) => `🥕 ${v}`),
        ...box.snack.map((s) => `🍪 ${s}`),
        `Jude: ${box.jude_main}`,
        `Etta: ${box.etta_main}`,
      ]
      updated.push({
        day,
        meal_type: "lunch" as MealType,
        recipe_id: null,
        custom_text: parts.join(" | "),
      })
      idx++
    }
    await savePlan(updated)
    setLunchesSaved(true)
  }

  function closeLunchGen() {
    setLunchGenOpen(false)
    setLunchResults(null)
    setLunchBoxResults(null)
    setLunchesSaved(false)
    setLunchInspiration("")
    setSchoolOrderDays({ monday: false, tuesday: false, wednesday: false, thursday: false, friday: false })
  }

  function closeDinnerGen() {
    setDinnerGenOpen(false)
    setDinnerResults(null)
    setDinnersSaved(false)
    setInspiration("")
  }

  async function openPicker(day: DayOfWeek, mealType: MealType, addSide?: boolean) {
    setPickerOpen({ day, meal_type: mealType, addSide })
    if (allRecipes.length === 0) {
      const res = await fetch("/api/recipes")
      if (res.ok) setAllRecipes(await res.json())
    }
    if (!addSide) {
      const res = await fetch("/api/inventory")
      if (res.ok) {
        const items = await res.json()
        setFreezerItems(items.filter((i: { item_type: string; location: string }) =>
          ["batch_cook", "frozen_meal", "ready_meal"].includes(i.item_type) &&
          ["freezer", "fridge"].includes(i.location)))
      }
    }
    {
      const res = await fetch("/api/cheat-meals")
      if (res.ok) setCheatMeals(await res.json())
    }
  }

  const INSPIRATION_CHIPS = ["Indian", "Mexican", "Asian", "Italian", "Salad", "Slow Cooker", "BBQ", "One Pot", "Quick & Easy", "Comfort Food"]

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
            onClick={() => setLunchGenOpen(true)}
            className="px-4 py-2 rounded-lg bg-meal-sky text-white text-sm font-medium hover:bg-meal-sky/80 transition-colors"
          >
            Generate Lunches
          </button>
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

      {/* ── Today & Tomorrow Hero ─────────────────────────────── */}
      {!loading && (() => {
        const today = getTodayDay()
        const tomorrow = getTomorrowDay()
        const isCurrentWeek = weekStart === getMonday(new Date())

        if (!isCurrentWeek) return null

        const todayDinner = getSlot(today, "dinner")
        const todayLunch = getSlot(today, "lunch")
        const tomorrowDinner = getSlot(tomorrow, "dinner")
        const tomorrowLunch = getSlot(tomorrow, "lunch")

        const todayDinnerRecipe = todayDinner?.recipe_id ? recipes[todayDinner.recipe_id] : null
        const todayLunchRecipe = todayLunch?.recipe_id ? recipes[todayLunch.recipe_id] : null
        const tomorrowDinnerRecipe = tomorrowDinner?.recipe_id ? recipes[tomorrowDinner.recipe_id] : null
        const tomorrowLunchRecipe = tomorrowLunch?.recipe_id ? recipes[tomorrowLunch.recipe_id] : null

        function MealHeroCard({ label, sublabel, recipe, customText, colour, day, mealType, sideIds }: {
          label: string; sublabel: string; recipe: Recipe | null; customText?: string | null; colour: string; day: DayOfWeek; mealType: MealType; sideIds?: number[]
        }) {
          const title = recipe?.title || customText || "Nothing planned"
          const hasContent = recipe || customText
          return (
            <div
              className={`rounded-xl overflow-hidden shadow-sm ${hasContent ? "bg-white cursor-pointer hover:shadow-md transition-shadow" : "bg-meal-warm/50"}`}
              onClick={() => {
                if (recipe) router.push(`/recipes/${recipe.id}`)
                else openPicker(day, mealType)
              }}
            >
              {/* Image area */}
              <div className={`relative h-28 ${colour}`}>
                {recipe?.image_url ? (
                  <img src={recipe.image_url} alt={title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-10 h-10 text-white/40" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.871c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513M15 8.25v-1.5m-6 1.5v-1.5m12 9.75l-1.5.75a3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0L3 16.5m15-3.379a48.474 48.474 0 00-6-.371c-2.032 0-4.034.126-6 .371m12 0c.39.049.777.102 1.163.16 1.07.16 1.837 1.094 1.837 2.175v5.169c0 .621-.504 1.125-1.125 1.125H4.125A1.125 1.125 0 013 20.625v-5.17c0-1.08.768-2.014 1.837-2.174A47.78 47.78 0 016 13.12M12.265 3.11a.375.375 0 11-.53 0L12 2.845l.265.265zm-3 0a.375.375 0 11-.53 0L9 2.845l.265.265zm6 0a.375.375 0 11-.53 0L15 2.845l.265.265z" />
                    </svg>
                  </div>
                )}
                <div className="absolute top-2 left-2">
                  <span className="bg-black/50 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase">
                    {sublabel}
                  </span>
                </div>
                {/* Swap + Side buttons */}
                {hasContent && (
                  <div className="absolute bottom-2 right-2 flex gap-1">
                    <button
                      className="bg-white/90 hover:bg-white rounded-full p-1.5 shadow transition-colors"
                      onClick={(e) => { e.stopPropagation(); openPicker(day, mealType, true) }}
                      title="Add side"
                    >
                      <svg className="w-3.5 h-3.5 text-meal-sage" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                    </button>
                    <button
                      className="bg-white/90 hover:bg-white rounded-full p-1.5 shadow transition-colors"
                      onClick={(e) => { e.stopPropagation(); openPicker(day, mealType) }}
                      title="Swap meal"
                    >
                      <svg className="w-3.5 h-3.5 text-meal-charcoal" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.183" />
                      </svg>
                    </button>
                  </div>
                )}
                {recipe && !recipe.is_gluten_free && (
                  <div className="absolute top-2 right-2">
                    <span className="bg-meal-amber/90 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">Gluten</span>
                  </div>
                )}
              </div>
              <div className="px-3 py-2.5">
                <p className="text-xs font-semibold text-meal-muted uppercase">{label}</p>
                <p className={`text-sm font-medium mt-0.5 ${hasContent ? "text-meal-charcoal" : "text-meal-muted"}`}>
                  {title}
                </p>
                {sideIds && sideIds.length > 0 && (
                  <div className="mt-1">
                    {sideIds.map((sideId) => (
                      <span key={sideId} className="text-xs text-meal-sage mr-2">
                        + {recipes[sideId]?.title || `#${sideId}`}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        }

        const todayIsWeekend = today === "saturday" || today === "sunday"
        const tomorrowIsWeekend = tomorrow === "saturday" || tomorrow === "sunday"

        // Build hero cards — skip lunch on weekends
        const heroCards = []
        if (!todayIsWeekend) heroCards.push(<MealHeroCard key="tl" label={`Today — ${DAY_FULL_LABELS[today]}`} sublabel="Lunch" recipe={todayLunchRecipe} customText={todayLunch?.custom_text} colour="bg-meal-sky" day={today} mealType="lunch" sideIds={todayLunch?.side_ids} />)
        heroCards.push(<MealHeroCard key="td" label={`Today — ${DAY_FULL_LABELS[today]}`} sublabel="Dinner" recipe={todayDinnerRecipe} customText={todayDinner?.custom_text} colour="bg-meal-coral" day={today} mealType="dinner" sideIds={todayDinner?.side_ids} />)
        if (!tomorrowIsWeekend) heroCards.push(<MealHeroCard key="tml" label={`Tomorrow — ${DAY_FULL_LABELS[tomorrow]}`} sublabel="Lunch" recipe={tomorrowLunchRecipe} customText={tomorrowLunch?.custom_text} colour="bg-meal-sky/70" day={tomorrow} mealType="lunch" sideIds={tomorrowLunch?.side_ids} />)
        heroCards.push(<MealHeroCard key="tmd" label={`Tomorrow — ${DAY_FULL_LABELS[tomorrow]}`} sublabel="Dinner" recipe={tomorrowDinnerRecipe} customText={tomorrowDinner?.custom_text} colour="bg-meal-coral/70" day={tomorrow} mealType="dinner" sideIds={tomorrowDinner?.side_ids} />)

        return (
          <div className="mb-8">
            <div className={`grid gap-3 ${heroCards.length <= 2 ? "grid-cols-2" : heroCards.length === 3 ? "grid-cols-3" : "grid-cols-2 md:grid-cols-4"}`}>
              {heroCards}
            </div>
          </div>
        )
      })()}

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
                  const isWeekend = day === "saturday" || day === "sunday"
                  if (mealType === "lunch" && isWeekend) return null
                  const slot = getSlot(day, mealType)
                  const recipe = slot?.recipe_id ? recipes[slot.recipe_id] : null
                  return (
                    <div
                      key={mealType}
                      className={`rounded-lg overflow-hidden text-sm cursor-pointer transition-all ${
                        slot?.recipe_id || slot?.custom_text
                          ? "bg-white shadow-sm hover:shadow-md"
                          : "bg-meal-warm/50 hover:bg-meal-warm border-2 border-dashed border-meal-warm min-h-[80px] p-3"
                      }`}
                      onClick={() => {
                        if (slot?.recipe_id) router.push(`/recipes/${slot.recipe_id}`)
                        else if (!slot?.custom_text) openPicker(day, mealType)
                      }}
                    >
                      {recipe?.image_url && (
                        <div className="h-16 w-full">
                          <img src={recipe.image_url} alt="" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className={recipe?.image_url ? "p-2" : (slot?.recipe_id || slot?.custom_text) ? "p-3" : ""}>
                        <span className="text-[10px] font-semibold text-meal-muted uppercase">
                          {mealType}
                        </span>
                        {recipe ? (
                          <div className="mt-0.5">
                            <p className="font-medium text-meal-charcoal text-xs line-clamp-2 hover:text-meal-sage">{recipe.title}</p>
                            {!recipe.is_gluten_free && (
                              <span className="text-[8px] font-semibold text-meal-amber mt-0.5 inline-block">GLUTEN</span>
                            )}
                          </div>
                        ) : slot?.custom_text ? (
                          <p className="mt-0.5 font-medium text-meal-charcoal text-xs">{slot.custom_text}</p>
                        ) : (
                          <p className="mt-1 text-meal-muted text-xs">+ Add</p>
                        )}
                        {/* Sides */}
                        {slot?.side_ids && slot.side_ids.length > 0 && (
                          <div className="mt-1 pt-1 border-t border-meal-cream">
                            {slot.side_ids.map((sideId) => {
                              const side = recipes[sideId]
                              return (
                                <div key={sideId} className="flex items-center gap-1 mt-0.5">
                                  <span className="text-[9px] text-meal-sage">+</span>
                                  <span className="text-[10px] text-meal-muted truncate">{side?.title || `Recipe #${sideId}`}</span>
                                  <button onClick={(e) => { e.stopPropagation(); removeSide(day, mealType, sideId) }}
                                    className="text-meal-muted hover:text-red-500 ml-auto shrink-0">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        )}
                        {(slot?.recipe_id || slot?.custom_text) && (
                          <div className="flex gap-2 mt-0.5">
                            {slot?.recipe_id && (
                              <button onClick={(e) => { e.stopPropagation(); markCooked(day, mealType) }}
                                disabled={cookingSlot === `${day}-${mealType}`}
                                className="text-[10px] text-meal-coral hover:text-meal-coral/80 disabled:opacity-50" title="Mark as cooked">
                                {cookingSlot === `${day}-${mealType}` ? "..." : "🍳 cooked"}
                              </button>
                            )}
                            <button onClick={(e) => { e.stopPropagation(); openPicker(day, mealType) }}
                              className="text-[10px] text-meal-sage hover:text-meal-sageHover" title="Swap meal">
                              <svg className="w-3 h-3 inline mr-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.183" />
                              </svg>
                              swap
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); openPicker(day, mealType, true) }}
                              className="text-[10px] text-meal-sage hover:text-meal-sageHover">
                              + side
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); clearSlot(day, mealType) }}
                              className="text-[10px] text-meal-muted hover:text-red-500">
                              clear
                            </button>
                          </div>
                        )}
                      </div>
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
                    const isWeekend = day === "saturday" || day === "sunday"
                    if (mealType === "lunch" && isWeekend) return null
                    const slot = getSlot(day, mealType)
                    const recipe = slot?.recipe_id ? recipes[slot.recipe_id] : null
                    return (
                      <div
                        key={mealType}
                        className="flex items-center gap-3 p-3 rounded-lg bg-meal-cream cursor-pointer overflow-hidden"
                        onClick={() => {
                          if (slot?.recipe_id) router.push(`/recipes/${slot.recipe_id}`)
                          else if (!slot?.custom_text) openPicker(day, mealType)
                        }}
                      >
                        {recipe?.image_url ? (
                          <img src={recipe.image_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                        ) : (
                          <span className={`text-[10px] font-semibold uppercase w-12 text-center shrink-0 ${
                            mealType === "lunch" ? "text-meal-sky" : "text-meal-coral"
                          }`}>
                            {mealType}
                          </span>
                        )}
                        <div className="flex-1 min-w-0">
                          {recipe?.image_url && (
                            <span className={`text-[10px] font-semibold uppercase ${
                              mealType === "lunch" ? "text-meal-sky" : "text-meal-coral"
                            }`}>
                              {mealType}
                            </span>
                          )}
                          <span className="block text-sm text-meal-charcoal truncate">
                            {recipe ? recipe.title : slot?.custom_text || "Tap to add"}
                          </span>
                          {/* Sides */}
                          {slot?.side_ids && slot.side_ids.length > 0 && (
                            <div className="mt-0.5">
                              {slot.side_ids.map((sideId) => (
                                <span key={sideId} className="text-[10px] text-meal-sage mr-2">
                                  + {recipes[sideId]?.title || `#${sideId}`}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {slot?.recipe_id && (
                            <button onClick={(e) => { e.stopPropagation(); markCooked(day, mealType) }}
                              disabled={cookingSlot === `${day}-${mealType}`}
                              className="text-[10px] text-meal-coral font-medium px-1 disabled:opacity-50">
                              {cookingSlot === `${day}-${mealType}` ? "..." : "🍳"}
                            </button>
                          )}
                          {(slot?.recipe_id || slot?.custom_text) && (
                            <button onClick={(e) => { e.stopPropagation(); openPicker(day, mealType, true) }}
                              className="text-[10px] text-meal-sage font-medium px-1">
                              +side
                            </button>
                          )}
                          {(slot?.recipe_id || slot?.custom_text) && (
                            <button onClick={(e) => { e.stopPropagation(); clearSlot(day, mealType) }}
                              className="text-xs text-meal-muted hover:text-red-500">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Lunch Generator Modal ─────────────────────────────────── */}
      {lunchGenOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center"
          onClick={closeLunchGen}>
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-md max-h-[90vh] overflow-auto p-5"
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-meal-charcoal mb-2">Generate School Lunches</h3>
            <p className="text-sm text-meal-muted mb-4">
              5 packed lunches for Monday–Friday. Swap any you don&apos;t like.
            </p>

            {/* Mode selector */}
            <div className="flex gap-1 bg-meal-warm rounded-lg p-1 mb-4">
              {([
                { value: "lunchbox" as const, label: "🍱 Lunch Box" },
                { value: "stored" as const, label: "Recipes" },
                { value: "mix" as const, label: "Mix" },
                { value: "internet" as const, label: "Internet" },
              ]).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setLunchMode(opt.value); setLunchResults(null); setLunchBoxResults(null); setLunchesSaved(false) }}
                  className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                    lunchMode === opt.value ? "bg-white text-meal-charcoal shadow-sm" : "text-meal-muted"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* School order days */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-meal-muted uppercase tracking-wider mb-2">
                Ordering school lunch on:
              </label>
              <div className="flex gap-2">
                {WEEKDAYS.map((day) => (
                  <button
                    key={day}
                    onClick={() => setSchoolOrderDays((prev) => ({ ...prev, [day]: !prev[day] }))}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                      schoolOrderDays[day]
                        ? "bg-meal-plum text-white"
                        : "bg-meal-warm text-meal-charcoal hover:bg-meal-plum/20"
                    }`}
                  >
                    {DAY_LABELS[day]}
                  </button>
                ))}
              </div>
              {Object.values(schoolOrderDays).some(Boolean) && (
                <p className="text-xs text-meal-plum mt-1.5">
                  Packing lunches for {packedLunchDays.length} day{packedLunchDays.length !== 1 ? "s" : ""} this week
                </p>
              )}
            </div>

            {/* Lunchbox mode description */}
            {lunchMode === "lunchbox" && (
              <p className="text-xs text-meal-muted mb-3">Picks fruit, veg and snacks from your inventory. Mains come from your saved favourites (Recipes page → Lunch Box Items). Jude gets any main, Etta gets GF only.</p>
            )}

            {/* Inspiration — AI modes only */}
            {lunchMode !== "lunchbox" && (
              <div className="mb-3">
                <label className="block text-xs font-semibold text-meal-muted uppercase tracking-wider mb-2">
                  Inspiration (optional)
                </label>
                <input
                  type="text"
                  value={lunchInspiration}
                  onChange={(e) => setLunchInspiration(e.target.value)}
                  placeholder="e.g. Bento, wraps, no-cook, protein-packed..."
                  className="w-full px-3 py-2 rounded-lg bg-meal-cream border border-meal-warm focus:outline-none focus:ring-2 focus:ring-meal-sage/30 text-sm"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {["Bento Box", "Wraps", "No Cook", "Sandwiches", "Salads", "Protein", "Snack Box", "Thermos"].map((chip) => (
                    <button
                      key={chip}
                      onClick={() => setLunchInspiration(chip)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                        lunchInspiration === chip
                          ? "bg-meal-sky text-white"
                          : "bg-meal-warm text-meal-charcoal hover:bg-meal-sky/20"
                      }`}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Generate button */}
            {!lunchResults && !lunchBoxResults && (
              <button
                onClick={handleGenerateLunches}
                disabled={generatingLunches}
                className="w-full py-3 rounded-lg bg-meal-sky text-white font-medium hover:bg-meal-sky/80 transition-colors disabled:opacity-50 mt-3"
              >
                {generatingLunches ? "Generating..." : lunchMode === "lunchbox" ? "Build Lunch Boxes" : lunchInspiration.trim() ? `Generate "${lunchInspiration}" Lunches` : "Surprise Me!"}
              </button>
            )}

            {/* Loading */}
            {generatingLunches && (
              <div className="text-center py-6">
                <div className="inline-block w-6 h-6 border-2 border-meal-sky border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-meal-muted mt-2">Packing the lunchboxes...</p>
              </div>
            )}

            {/* Lunch Box Results */}
            {lunchBoxResults && !generatingLunches && (
              <div className="mt-4">
                <div className="space-y-3 mb-4">
                  {lunchBoxResults.map((box, i) => (
                    <div key={i} className="p-3 rounded-lg bg-meal-cream">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-bold text-meal-sky w-10">{DAY_LABELS[packedLunchDays[i]] || "?"}</span>
                        <span className="text-xs text-meal-muted">Lunch Box</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 text-xs">
                        <div><span className="text-meal-muted">🍎</span> {box.fruit.join(", ") || "—"}</div>
                        <div><span className="text-meal-muted">🥕</span> {box.veg.join(", ") || "—"}</div>
                        <div className="col-span-2"><span className="text-meal-muted">🍪</span> {box.snack.join(", ") || "—"}</div>
                      </div>
                      <div className="flex gap-3 mt-2 pt-2 border-t border-meal-warm">
                        <div className="flex-1 text-xs"><span className="font-semibold text-meal-charcoal">Jude:</span> {box.jude_main}</div>
                        <div className="flex-1 text-xs"><span className="font-semibold text-meal-sage">Etta:</span> {box.etta_main} <span className="text-[8px] text-meal-sage font-bold">GF</span></div>
                      </div>
                    </div>
                  ))}
                </div>

                {!lunchesSaved ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setLunchBoxResults(null); setLunchesSaved(false) }}
                      className="flex-1 py-2.5 rounded-lg bg-meal-warm text-meal-charcoal text-sm font-medium"
                    >
                      Re-roll
                    </button>
                    <button
                      onClick={applyLunchBoxResults}
                      className="flex-1 py-2.5 rounded-lg bg-meal-sage text-white text-sm font-medium hover:bg-meal-sageHover transition-colors"
                    >
                      Use These Lunch Boxes
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-meal-sage/10 text-meal-sage text-sm font-medium">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      Lunch boxes saved for Mon–Fri!
                    </div>
                    <button onClick={closeLunchGen}
                      className="w-full py-2.5 rounded-lg bg-meal-warm text-meal-charcoal text-sm font-medium">
                      Done
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* AI Results */}
            {lunchResults && !generatingLunches && (
              <div className="mt-4">
                <div className="space-y-2 mb-4">
                  {lunchResults.map((l, i) => (
                    <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-meal-cream group">
                      <span className="text-sm font-bold text-meal-sky w-10 shrink-0 mt-0.5">
                        {DAY_LABELS[packedLunchDays[i]] || "?"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-meal-charcoal">{l.title}</p>
                        {l.description && <p className="text-xs text-meal-muted mt-0.5">{l.description}</p>}
                        <div className="flex items-center gap-2 mt-1">
                          {l.is_gluten_free ? (
                            <span className="text-[10px] font-semibold text-meal-sage">GF</span>
                          ) : (
                            <span className="text-[10px] font-semibold text-meal-amber">Gluten</span>
                          )}
                          {l.source_hint && (
                            <span className="text-[10px] text-meal-muted">{l.source_hint}</span>
                          )}
                        </div>
                      </div>
                      {!lunchesSaved && (
                        <button
                          onClick={() => handleSwapLunch(i)}
                          disabled={swappingLunchIndex === i}
                          className="p-1.5 rounded-lg text-meal-muted hover:text-meal-sky hover:bg-white transition-colors shrink-0"
                          title="Swap this lunch"
                        >
                          {swappingLunchIndex === i ? (
                            <div className="w-4 h-4 border-2 border-meal-sky border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.183" />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {!lunchesSaved ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setLunchResults(null); setLunchesSaved(false) }}
                      className="flex-1 py-2.5 rounded-lg bg-meal-warm text-meal-charcoal text-sm font-medium"
                    >
                      Re-roll All
                    </button>
                    <button
                      onClick={applyLunchResults}
                      className="flex-1 py-2.5 rounded-lg bg-meal-sage text-white text-sm font-medium hover:bg-meal-sageHover transition-colors"
                    >
                      Use These Lunches
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-meal-sage/10 text-meal-sage text-sm font-medium">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      Lunches saved for Mon–Fri!
                    </div>
                    <button onClick={closeLunchGen}
                      className="w-full py-2.5 rounded-lg bg-meal-warm text-meal-charcoal text-sm font-medium">
                      Done
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Dinner Generator Modal ────────────────────────────────── */}
      {dinnerGenOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center"
          onClick={closeDinnerGen}>
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-md max-h-[90vh] overflow-auto p-5"
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-meal-charcoal mb-2">Generate Dinners</h3>
            <p className="text-sm text-meal-muted mb-4">
              Fill your week with dinners. Swap any you don&apos;t like, add a theme, or go with surprise.
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
                  onClick={() => { setDinnerMode(opt.value); setDinnerResults(null); setDinnersSaved(false) }}
                  className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                    dinnerMode === opt.value ? "bg-white text-meal-charcoal shadow-sm" : "text-meal-muted"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Inspiration input */}
            <div className="mb-3">
              <label className="block text-xs font-semibold text-meal-muted uppercase tracking-wider mb-2">
                Inspiration (optional)
              </label>
              <input
                type="text"
                value={inspiration}
                onChange={(e) => setInspiration(e.target.value)}
                placeholder="e.g. Indian, salads, slow cooker, comfort food..."
                className="w-full px-3 py-2 rounded-lg bg-meal-cream border border-meal-warm focus:outline-none focus:ring-2 focus:ring-meal-sage/30 text-sm"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {INSPIRATION_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => setInspiration(chip)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      inspiration === chip
                        ? "bg-meal-sage text-white"
                        : "bg-meal-warm text-meal-charcoal hover:bg-meal-sage/20"
                    }`}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* Generate button */}
            {!dinnerResults && (
              <button
                onClick={handleGenerateDinners}
                disabled={generatingDinners}
                className="w-full py-3 rounded-lg bg-meal-coral text-white font-medium hover:bg-meal-coral/80 transition-colors disabled:opacity-50 mt-3"
              >
                {generatingDinners ? "Generating..." : inspiration.trim() ? `Generate "${inspiration}" Dinners` : "Surprise Me!"}
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
              <div className="mt-4">
                <div className="space-y-2 mb-4">
                  {dinnerResults.map((d, i) => (
                    <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-meal-cream group">
                      <span className="text-sm font-bold text-meal-coral w-5 shrink-0 mt-0.5">{i + 1}</span>
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
                            <span className="text-[10px] font-semibold text-meal-plum">+ Leftovers</span>
                          )}
                          {d.source_hint && (
                            <span className="text-[10px] text-meal-muted">{d.source_hint}</span>
                          )}
                        </div>
                      </div>
                      {/* Swap button */}
                      {!dinnersSaved && (
                        <button
                          onClick={() => handleSwapDinner(i)}
                          disabled={swappingIndex === i}
                          className="p-1.5 rounded-lg text-meal-muted hover:text-meal-coral hover:bg-white transition-colors shrink-0"
                          title="Swap this meal"
                        >
                          {swappingIndex === i ? (
                            <div className="w-4 h-4 border-2 border-meal-coral border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.183" />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {!dinnersSaved ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setDinnerResults(null); setDinnersSaved(false) }}
                      className="flex-1 py-2.5 rounded-lg bg-meal-warm text-meal-charcoal text-sm font-medium"
                    >
                      Re-roll All
                    </button>
                    <button
                      onClick={applyDinnerResults}
                      className="flex-1 py-2.5 rounded-lg bg-meal-sage text-white text-sm font-medium hover:bg-meal-sageHover transition-colors"
                    >
                      Use These Dinners
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-meal-sage/10 text-meal-sage text-sm font-medium">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      Dinners saved to your plan!
                    </div>
                    <div className="flex gap-2">
                      <Link
                        href={`/shopping?week=${weekStart}`}
                        className="flex-1 py-2.5 rounded-lg bg-meal-sage text-white text-sm font-medium text-center hover:bg-meal-sageHover transition-colors"
                        onClick={closeDinnerGen}
                      >
                        Generate Shopping List
                      </Link>
                      <button
                        onClick={closeDinnerGen}
                        className="flex-1 py-2.5 rounded-lg bg-meal-warm text-meal-charcoal text-sm font-medium"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cook modal */}
      {cookModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center"
          onClick={() => setCookModal(null)}>
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-sm p-5"
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-meal-charcoal mb-1">Cooked: {cookModal.title}</h3>
            <p className="text-sm text-meal-muted mb-4">Ingredients will be deducted from inventory. Split leftovers between fridge and freezer.</p>
            <div className="space-y-3 mb-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-meal-muted uppercase mb-1">🍽️ Eating</label>
                  <input type="number" value={cookEating} onChange={(e) => setCookEating(e.target.value)}
                    min="0" className="w-full px-3 py-2 rounded-lg bg-meal-cream border border-meal-warm text-sm text-center focus:outline-none focus:ring-2 focus:ring-meal-sage/30" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-meal-muted uppercase mb-1">🥬 Fridge</label>
                  <input type="number" value={cookFridge} onChange={(e) => setCookFridge(e.target.value)}
                    min="0" className="w-full px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-green-300" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-meal-muted uppercase mb-1">❄️ Freezer</label>
                  <input type="number" value={cookFreezer} onChange={(e) => setCookFreezer(e.target.value)}
                    min="0" className="w-full px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
              </div>
              <p className="text-xs text-meal-muted text-center">
                Total: {(parseInt(cookEating) || 0) + (parseInt(cookFridge) || 0) + (parseInt(cookFreezer) || 0)} portions
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setCookModal(null)}
                className="flex-1 py-2.5 rounded-lg bg-meal-warm text-meal-charcoal text-sm font-medium">
                Cancel
              </button>
              <button onClick={confirmCooked} disabled={cookSaving}
                className="flex-1 py-2.5 rounded-lg bg-meal-sage text-white text-sm font-medium hover:bg-meal-sageHover transition-colors disabled:opacity-50">
                {cookSaving ? "Saving..." : "Done"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cook toast */}
      {cookToast?.visible && (
        <div className="fixed bottom-24 md:bottom-8 left-4 right-4 md:left-auto md:right-8 md:w-80 bg-meal-charcoal text-white rounded-xl p-4 shadow-lg z-50 flex items-center gap-3">
          <span className="text-lg">🍳</span>
          <p className="flex-1 text-sm">{cookToast.message}</p>
          <button onClick={() => setCookToast(null)} className="text-white/60 hover:text-white">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Recipe Picker Modal ───────────────────────────────────── */}
      {pickerOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center"
          onClick={() => setPickerOpen(null)}>
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-md max-h-[80vh] overflow-auto p-5"
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-meal-charcoal mb-4">
              {pickerOpen.addSide ? "Add Side — " : ""}{DAY_LABELS[pickerOpen.day]} {pickerOpen.meal_type}
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

            {/* Leftovers — from fridge & freezer */}
            {!pickerOpen.addSide && (
              <div className="border-t border-meal-warm pt-3 mb-3">
                <h4 className="text-xs font-semibold text-meal-muted uppercase mb-2">Leftovers & Frozen</h4>
                {freezerItems.length === 0 && (
                  <p className="text-xs text-meal-muted mb-2">None right now. Use 🍳 cooked on a meal to save portions here.</p>
                )}
                <div className="space-y-1">
                  {freezerItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={async () => {
                        const label = item.location === "fridge" ? "Fridge" : "Freezer"
                        assignRecipe(pickerOpen.day, pickerOpen.meal_type, null, `${label}: ${item.name}`)
                        if (item.servings && item.servings > 1) {
                          await fetch(`/api/inventory/${item.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ servings: item.servings - 1 }),
                          })
                        } else {
                          await fetch(`/api/inventory/${item.id}`, { method: "DELETE" })
                        }
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-meal-cream transition-colors flex items-center gap-2"
                    >
                      <span className="text-sm">{item.location === "fridge" ? "🥬" : "❄️"}</span>
                      <span className="flex-1 text-sm text-meal-charcoal">{item.name}</span>
                      {item.servings && (
                        <span className="text-[10px] font-medium text-meal-plum">{item.servings} left</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-meal-warm pt-3">
              <h4 className="text-xs font-semibold text-meal-muted uppercase mb-2">
                {pickerOpen.addSide ? "Pick a side" : "Or pick a recipe"}
              </h4>
              {(() => {
                const filtered = pickerOpen.addSide
                  ? allRecipes.filter((r) => r.category === "side")
                  : allRecipes
                const others = pickerOpen.addSide
                  ? allRecipes.filter((r) => r.category !== "side")
                  : []
                return filtered.length === 0 && others.length === 0 ? (
                  <p className="text-sm text-meal-muted py-4 text-center">No recipes yet. <Link href="/recipes/new" className="text-meal-sage hover:underline">Add one?</Link></p>
                ) : (
                  <div className="space-y-1">
                    {filtered.length === 0 && pickerOpen.addSide && (
                      <p className="text-sm text-meal-muted py-2 text-center">No sides yet — categorise a recipe as &quot;Side&quot; or pick from all below.</p>
                    )}
                    {filtered.map((r) => (
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
                    {pickerOpen.addSide && others.length > 0 && (
                      <>
                        <h4 className="text-xs font-semibold text-meal-muted uppercase mt-3 mb-1">All recipes</h4>
                        {others.map((r) => (
                          <button
                            key={r.id}
                            onClick={() => {
                              assignRecipe(pickerOpen.day, pickerOpen.meal_type, r.id, null)
                              setRecipes((prev) => ({ ...prev, [r.id]: r }))
                            }}
                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-meal-cream transition-colors flex items-center gap-2"
                          >
                            <span className="flex-1 text-sm text-meal-muted">{r.title}</span>
                            <span className="text-[10px] text-meal-muted">{r.category}</span>
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
