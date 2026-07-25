"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { DAYS, DAY_LABELS } from "@/types"
import type { MealSlot, DayOfWeek, MealType, Recipe } from "@/types"
import { ImagePickerModal } from "@/components/ImagePickerModal"
import { TakeawayPhotosModal } from "@/components/TakeawayPhotosModal"
import { getTakeawayImage } from "@/lib/takeaway-images"

// Use LOCAL date components, not UTC, when serialising YYYY-MM-DD. toISOString()
// converts to UTC which shifts the date for non-UTC timezones at certain hours
// (Sydney mornings = still previous day in UTC), causing weekStart to land on
// Sunday instead of Monday and saving plans against the wrong week key.
function fmtLocalDate(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function getMonday(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return fmtLocalDate(d)
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
  return fmtLocalDate(d)
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

// Recipe grouping for the meal picker. Inferred from title + ingredient names
// against keyword lists. Priority order matters: a recipe with both beef and
// chicken is bucketed by whichever comes first below.
const PROTEIN_GROUPS: Array<{ key: string; label: string; emoji: string; keywords: string[] }> = [
  { key: "beef",    label: "Beef",         emoji: "🥩", keywords: ["beef", "steak", "mince", "burger", "bolognese", "lasagne", "lasagna", "meatloaf", "meatball", "brisket"] },
  { key: "chicken", label: "Chicken",      emoji: "🍗", keywords: ["chicken", "poultry"] },
  { key: "pork",    label: "Pork",         emoji: "🥓", keywords: ["pork", "bacon", "ham", "sausage", "chorizo", "prosciutto"] },
  { key: "lamb",    label: "Lamb",         emoji: "🐑", keywords: ["lamb"] },
  { key: "duck",    label: "Duck & Game",  emoji: "🦆", keywords: ["duck", "venison", "rabbit", "quail", "pheasant"] },
  { key: "turkey",  label: "Turkey",       emoji: "🦃", keywords: ["turkey"] },
  { key: "fish",    label: "Fish & Seafood", emoji: "🐟", keywords: ["fish", "salmon", "tuna", "prawn", "shrimp", "cod", "trout", "barramundi", "snapper", "calamari", "squid", "seafood", "mussel", "scallop", "anchov"] },
  { key: "veggie",  label: "Veggie",       emoji: "🥗", keywords: ["vegetarian", "vegan", "veggie", "tofu", "halloumi", "paneer", "lentil", "chickpea", "mozzarella", "feta", "ricotta", "egg "] },
]

function getProteinGroup(r: { title?: string; ingredients?: Array<{ name?: string }> }): string {
  const title = (r.title ?? "").toLowerCase()
  const ingredientText = (r.ingredients ?? []).map(i => (i.name ?? "").toLowerCase()).join(" ")
  const haystack = `${title} ${ingredientText}`
  for (const g of PROTEIN_GROUPS) {
    if (g.keywords.some(k => haystack.includes(k))) return g.key
  }
  return "other"
}

interface DinnerSuggestion {
  recipe_id: number | null
  title: string
  is_gluten_free?: boolean
  servings?: number
  leftovers?: boolean
  description?: string
  source_hint?: string
  // Set by the user in the results view when they convert an AI suggestion
  // to a takeaway/cheat slot. Skips the saveAsSuggestionRecipe step so we
  // don't pollute the recipe library with "Takeaway: Sushi" entries.
  isCustomSlot?: boolean
}

// Per-day plan override. "auto" = let AI fill; the rest become custom_text
// slots so a re-roll doesn't clobber them. "skip" leaves the day empty.
type DayOverride = "auto" | "cheat" | "takeaway" | "skip"

const OVERRIDE_CYCLE: Record<DayOverride, DayOverride> = {
  auto: "cheat",
  cheat: "takeaway",
  takeaway: "skip",
  skip: "auto",
}

const OVERRIDE_LABEL: Record<DayOverride, string> = {
  auto: "Auto",
  cheat: "Cheat",
  takeaway: "Takeaway",
  skip: "Skip",
}

const OVERRIDE_CUSTOM_TEXT: Record<Exclude<DayOverride, "auto" | "skip">, string> = {
  cheat: "Cheat meal",
  takeaway: "Takeaway",
}

const TAKEAWAY_TYPES = ["Sushi", "Pizza", "Thai", "Indian", "Burgers", "Other"] as const
type TakeawayType = (typeof TAKEAWAY_TYPES)[number]

const OVERRIDE_CHIP_CLASS: Record<DayOverride, string> = {
  auto: "bg-meal-warm text-meal-charcoal hover:bg-meal-warm/80",
  cheat: "bg-meal-plum/15 text-meal-plum hover:bg-meal-plum/25",
  takeaway: "bg-meal-coral/15 text-meal-coral hover:bg-meal-coral/25",
  skip: "bg-meal-muted/15 text-meal-muted hover:bg-meal-muted/25",
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
  const [pickerSearch, setPickerSearch] = useState("")

  // Dinner generator state
  const [dinnerGenOpen, setDinnerGenOpen] = useState(false)
  const [dinnerMode, setDinnerMode] = useState<"stored" | "internet" | "mix">("mix")
  const [dinnerResults, setDinnerResults] = useState<DinnerSuggestion[] | null>(null)
  const [generatingDinners, setGeneratingDinners] = useState(false)
  const [inspiration, setInspiration] = useState("")
  const [swappingIndex, setSwappingIndex] = useState<number | null>(null)
  const [dinnersSaved, setDinnersSaved] = useState(false)
  const [expandedResultIdx, setExpandedResultIdx] = useState<number | null>(null)
  // Per-day overrides — default all Auto so "Surprise Me!" still works in one tap.
  const [dayOverrides, setDayOverrides] = useState<Record<DayOfWeek, DayOverride>>(() =>
    Object.fromEntries(DAYS.map((d) => [d, "auto" as const])) as Record<DayOfWeek, DayOverride>,
  )
  // Takeaway type per day — only consulted when dayOverrides[day] === "takeaway".
  const [takeawayTypes, setTakeawayTypes] = useState<Partial<Record<DayOfWeek, TakeawayType>>>({})
  // Takeaway photo overrides keyed by cuisine (lower-case). Persisted in Neon
  // via /api/takeaway-images; loaded once on mount.
  const [takeawayPhotos, setTakeawayPhotos] = useState<Record<string, string>>({})
  const [photosModalOpen, setPhotosModalOpen] = useState(false)
  const autoDays = DAYS.filter((d) => dayOverrides[d] === "auto")
  const takeawayDays = DAYS.filter((d) => dayOverrides[d] === "takeaway")

  // Image picker modal state — change a recipe's image_url from a meal card.
  const [imagePickerRecipe, setImagePickerRecipe] = useState<Recipe | null>(null)

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

  // One-shot load of takeaway photo overrides. New uploads from the manager
  // modal update local state directly so we don't need to refetch.
  useEffect(() => {
    fetch("/api/takeaway-images")
      .then((r) => (r.ok ? r.json() : {}))
      .then((data) => setTakeawayPhotos(data || {}))
      .catch(() => { /* fall back to static photos */ })
  }, [])

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
    setPickerSearch("")
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
    setExpandedResultIdx(null)
    // Zero auto days = nothing for AI to fill. Skip the API and let the user
    // hit "Use These Dinners" to apply override-only slots.
    if (autoDays.length === 0) {
      setDinnerResults([])
      setGeneratingDinners(false)
      return
    }
    const res = await fetch("/api/plan/generate-dinners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: dinnerMode,
        inspiration: inspiration.trim() || undefined,
        targetCount: autoDays.length,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      setDinnerResults((data.dinners || []).slice(0, autoDays.length))
    }
    setGeneratingDinners(false)
  }

  async function handleSwapDinner(index: number) {
    setSwappingIndex(index)
    // Exclude every other current result so the swap can't hand back a
    // dinner the user is already looking at.
    const excludeTitles = (dinnerResults ?? [])
      .filter((_, i) => i !== index)
      .map((d) => d.title)
      .filter(Boolean)
    const res = await fetch("/api/plan/generate-dinners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: dinnerMode,
        inspiration: inspiration.trim() || undefined,
        swapIndex: index,
        excludeTitles,
      }),
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

  // Convert one of the AI result rows into a "Cheat meal" custom slot.
  function setResultAsCheat(index: number) {
    setDinnerResults((prev) => {
      if (!prev) return prev
      const next = [...prev]
      next[index] = {
        recipe_id: null,
        title: "Cheat meal",
        is_gluten_free: true,
        leftovers: false,
        isCustomSlot: true,
      }
      return next
    })
    setExpandedResultIdx(null)
  }

  // Convert one of the AI result rows into a "Takeaway: <type>" custom slot.
  function setResultAsTakeaway(index: number, type: TakeawayType) {
    setDinnerResults((prev) => {
      if (!prev) return prev
      const next = [...prev]
      next[index] = {
        recipe_id: null,
        title: `Takeaway: ${type}`,
        is_gluten_free: true,
        leftovers: false,
        isCustomSlot: true,
      }
      return next
    })
    setExpandedResultIdx(null)
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
    // Walk the week in order. Override days get custom_text (or no slot for
    // "skip"); auto days consume the next AI suggestion. Leftovers from an
    // AI meal claim the *next auto day* — they don't displace an override.
    let suggestionIdx = 0
    let leftoverFor: string | null = null
    for (const day of DAYS) {
      const mode = dayOverrides[day]
      if (mode === "skip") { leftoverFor = null; continue }
      if (mode === "cheat" || mode === "takeaway") {
        const customText = mode === "takeaway" && takeawayTypes[day]
          ? `Takeaway: ${takeawayTypes[day]}`
          : OVERRIDE_CUSTOM_TEXT[mode]
        updated.push({
          day,
          meal_type: "dinner" as MealType,
          recipe_id: null,
          custom_text: customText,
        })
        leftoverFor = null
        continue
      }
      // mode === "auto"
      if (leftoverFor) {
        updated.push({
          day,
          meal_type: "dinner" as MealType,
          recipe_id: null,
          custom_text: `Leftovers: ${leftoverFor}`,
        })
        leftoverFor = null
        continue
      }
      const dinner = dinnerResults[suggestionIdx]
      if (!dinner) continue
      suggestionIdx++
      // Per-result overrides (user clicked Cheat or Takeaway:X on this row)
      // bypass recipe creation entirely — they're plain custom_text slots.
      if (dinner.isCustomSlot) {
        updated.push({
          day,
          meal_type: "dinner" as MealType,
          recipe_id: null,
          custom_text: dinner.title,
        })
        leftoverFor = null
        continue
      }
      const recipeId = await saveAsSuggestionRecipe(dinner, "dinner")
      updated.push({
        day,
        meal_type: "dinner" as MealType,
        recipe_id: recipeId,
        custom_text: recipeId ? null : dinner.title,
      })
      if (dinner.leftovers) leftoverFor = dinner.title
    }
    await savePlan(updated)
    setDinnersSaved(true)
  }

  function closeDinnerGen() {
    setDinnerGenOpen(false)
    setDinnerResults(null)
    setDinnersSaved(false)
    setInspiration("")
    setExpandedResultIdx(null)
    setDayOverrides(Object.fromEntries(DAYS.map((d) => [d, "auto" as const])) as Record<DayOfWeek, DayOverride>)
    setTakeawayTypes({})
  }

  async function openPicker(day: DayOfWeek, mealType: MealType, addSide?: boolean) {
    setPickerOpen({ day, meal_type: mealType, addSide })
    if (allRecipes.length === 0) {
      const res = await fetch("/api/recipes")
      if (res.ok) setAllRecipes(await res.json())
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
          {meals.some((m) => m.meal_type === "dinner") && (
            <button
              onClick={() => {
                if (!confirm("Clear all dinners for this week?")) return
                savePlan(meals.filter((m) => m.meal_type !== "dinner"))
              }}
              className="px-3 py-2 rounded-lg text-meal-muted hover:text-red-500 text-sm font-medium transition-colors"
              title="Clear all dinners for this week"
            >
              Clear week
            </button>
          )}
        </div>
      </div>

      {/* ── Today & Tomorrow Hero ─────────────────────────────── */}
      {!loading && (() => {
        const today = getTodayDay()
        const tomorrow = getTomorrowDay()
        const isCurrentWeek = weekStart === getMonday(new Date())

        if (!isCurrentWeek) return null

        const todayDinner = getSlot(today, "dinner")
        const tomorrowDinner = getSlot(tomorrow, "dinner")

        const todayDinnerRecipe = todayDinner?.recipe_id ? recipes[todayDinner.recipe_id] : null
        const tomorrowDinnerRecipe = tomorrowDinner?.recipe_id ? recipes[tomorrowDinner.recipe_id] : null

        function MealHeroCard({ label, sublabel, recipe, customText, colour, day, mealType, sideIds }: {
          label: string; sublabel: string; recipe: Recipe | null; customText?: string | null; colour: string; day: DayOfWeek; mealType: MealType; sideIds?: number[]
        }) {
          const title = recipe?.title || customText || "Nothing planned"
          const hasContent = recipe || customText
          const takeawayImg = getTakeawayImage(customText, takeawayPhotos)
          const heroImg = recipe?.image_url || takeawayImg
          return (
            <div
              className={`rounded-xl overflow-hidden shadow-sm ${hasContent ? "bg-meal-card cursor-pointer hover:shadow-md transition-shadow" : "bg-meal-warm/50"}`}
              onClick={() => {
                if (recipe) router.push(`/recipes/${recipe.id}`)
                else openPicker(day, mealType)
              }}
            >
              {/* Image area */}
              <div className={`relative h-28 ${colour}`}>
                {heroImg ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={heroImg} alt={title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-10 h-10 text-white/40" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-3.5 0a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0Z" />
                    </svg>
                  </div>
                )}
                <div className="absolute top-2 left-2">
                  <span className="bg-black/50 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase">
                    {sublabel}
                  </span>
                </div>
                {/* Swap + Side + Image buttons */}
                {hasContent && (
                  <div className="absolute bottom-2 right-2 flex gap-1">
                    {recipe && (
                      <button
                        className="bg-black/55 hover:bg-black/70 rounded-full p-1.5 shadow transition-colors"
                        onClick={(e) => { e.stopPropagation(); setImagePickerRecipe(recipe) }}
                        title="Change image"
                      >
                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                        </svg>
                      </button>
                    )}
                    <button
                      className="bg-black/55 hover:bg-black/70 rounded-full p-1.5 shadow transition-colors"
                      onClick={(e) => { e.stopPropagation(); openPicker(day, mealType, true) }}
                      title="Add side"
                    >
                      <svg className="w-3.5 h-3.5 text-meal-sage" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                    </button>
                    <button
                      className="bg-black/55 hover:bg-black/70 rounded-full p-1.5 shadow transition-colors"
                      onClick={(e) => { e.stopPropagation(); openPicker(day, mealType) }}
                      title="Swap meal"
                    >
                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
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

        const heroCards = []
        heroCards.push(<MealHeroCard key="td" label={`Today — ${DAY_FULL_LABELS[today]}`} sublabel="Dinner" recipe={todayDinnerRecipe} customText={todayDinner?.custom_text} colour="bg-meal-coral" day={today} mealType="dinner" sideIds={todayDinner?.side_ids} />)
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
                {(["dinner"] as MealType[]).map((mealType) => {
                  const slot = getSlot(day, mealType)
                  const recipe = slot?.recipe_id ? recipes[slot.recipe_id] : null
                  const tileImg = recipe?.image_url || getTakeawayImage(slot?.custom_text, takeawayPhotos)
                  return (
                    <div
                      key={mealType}
                      className={`rounded-lg overflow-hidden text-sm cursor-pointer transition-all ${
                        slot?.recipe_id || slot?.custom_text
                          ? "bg-meal-card shadow-sm hover:shadow-md"
                          : "bg-meal-warm/50 hover:bg-meal-warm border-2 border-dashed border-meal-warm min-h-[80px] p-3"
                      }`}
                      onClick={() => {
                        if (slot?.recipe_id) router.push(`/recipes/${slot.recipe_id}`)
                        else if (!slot?.custom_text) openPicker(day, mealType)
                      }}
                    >
                      {tileImg && (
                        <div className="h-16 w-full">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={tileImg} alt="" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className={tileImg ? "p-2" : (slot?.recipe_id || slot?.custom_text) ? "p-3" : ""}>
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
              <div key={day} className="bg-meal-card rounded-xl p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-meal-charcoal mb-3">{DAY_LABELS[day]}</h3>
                <div className="space-y-2">
                  {(["dinner"] as MealType[]).map((mealType) => {
                    const slot = getSlot(day, mealType)
                    const recipe = slot?.recipe_id ? recipes[slot.recipe_id] : null
                    const rowImg = recipe?.image_url || getTakeawayImage(slot?.custom_text, takeawayPhotos)
                    return (
                      <div
                        key={mealType}
                        className="flex items-center gap-3 p-3 rounded-lg bg-meal-cream cursor-pointer overflow-hidden"
                        onClick={() => {
                          if (slot?.recipe_id) router.push(`/recipes/${slot.recipe_id}`)
                          else if (!slot?.custom_text) openPicker(day, mealType)
                        }}
                      >
                        {rowImg ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={rowImg} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                        ) : (
                          <span className="text-[10px] font-semibold uppercase w-12 text-center shrink-0 text-meal-coral">
                            {mealType}
                          </span>
                        )}
                        <div className="flex-1 min-w-0">
                          {rowImg && (
                            <span className="text-[10px] font-semibold uppercase text-meal-coral">
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

      {/* ── Dinner Generator Modal ────────────────────────────────── */}
      {dinnerGenOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center"
          onClick={closeDinnerGen}>
          <div className="bg-meal-card rounded-t-2xl md:rounded-2xl w-full max-w-md max-h-[90vh] overflow-auto p-5"
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-meal-charcoal mb-2">Generate Dinners</h3>
            <p className="text-sm text-meal-muted mb-4">
              Fill your week with dinners. Swap any you don&apos;t like, add a theme, or go with surprise.
            </p>

            {/* Plan the week — per-day override chips. Default Auto = let AI fill. */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-meal-muted uppercase tracking-wider">
                  Plan the week
                </label>
                {DAYS.some((d) => dayOverrides[d] !== "auto") && (
                  <button
                    onClick={() => {
                      setDayOverrides(Object.fromEntries(DAYS.map((d) => [d, "auto" as const])) as Record<DayOfWeek, DayOverride>)
                      setTakeawayTypes({})
                    }}
                    className="text-[10px] text-meal-muted hover:text-meal-charcoal font-medium uppercase tracking-wider"
                  >
                    Reset
                  </button>
                )}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {DAYS.map((day) => {
                  const mode = dayOverrides[day]
                  return (
                    <button
                      key={day}
                      onClick={() => {
                        setDayOverrides((prev) => ({ ...prev, [day]: OVERRIDE_CYCLE[prev[day]] }))
                        if (dinnerResults) { setDinnerResults(null); setDinnersSaved(false) }
                      }}
                      className={`flex flex-col items-center py-1.5 rounded-md text-[10px] font-semibold uppercase transition-colors ${OVERRIDE_CHIP_CLASS[mode]}`}
                      title={`${DAY_LABELS[day]} — tap to cycle: Auto → Cheat → Takeaway → Skip`}
                    >
                      <span className="text-[10px]">{DAY_LABELS[day]}</span>
                      <span className="text-[9px] font-medium tracking-normal normal-case mt-0.5 opacity-80">
                        {OVERRIDE_LABEL[mode]}
                      </span>
                    </button>
                  )
                })}
              </div>
              <p className="text-[10px] text-meal-muted mt-1.5">
                {autoDays.length === 7
                  ? "All nights set to Auto — full random."
                  : autoDays.length === 0
                    ? "Nothing for AI to fill — hit Apply Plan to lock in your overrides."
                    : `AI will fill ${autoDays.length} of 7 nights.`}
              </p>

              {/* Takeaway type pickers — one row per day in Takeaway mode */}
              {takeawayDays.length > 0 && (
                <div className="mt-3 space-y-1.5 p-2.5 rounded-lg bg-meal-coral/5 border border-meal-coral/15">
                  <div className="flex items-center justify-between -mb-0.5">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-meal-coral">Pick a cuisine</span>
                    <button
                      onClick={() => setPhotosModalOpen(true)}
                      className="text-[10px] font-medium text-meal-coral hover:text-meal-coral/70 underline-offset-2 hover:underline"
                    >
                      📷 Manage photos
                    </button>
                  </div>
                  {takeawayDays.map((day) => (
                    <div key={day} className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold text-meal-coral uppercase tracking-wider w-9 shrink-0">
                        {DAY_LABELS[day]}
                      </span>
                      <div className="flex gap-1 flex-wrap">
                        {TAKEAWAY_TYPES.map((t) => (
                          <button
                            key={t}
                            onClick={() => {
                              setTakeawayTypes((prev) => ({
                                ...prev,
                                [day]: prev[day] === t ? undefined : t,
                              }))
                              if (dinnerResults) { setDinnerResults(null); setDinnersSaved(false) }
                            }}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                              takeawayTypes[day] === t
                                ? "bg-meal-coral text-white"
                                : "bg-meal-card text-meal-charcoal hover:bg-meal-coral/15"
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

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
                    dinnerMode === opt.value ? "bg-meal-card text-meal-charcoal shadow-sm" : "text-meal-muted"
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
                {generatingDinners
                  ? "Generating..."
                  : autoDays.length === 0
                    ? "Apply Plan"
                    : inspiration.trim()
                      ? `Generate "${inspiration}" Dinners`
                      : autoDays.length === 7
                        ? "Surprise Me!"
                        : `Generate ${autoDays.length} ${autoDays.length === 1 ? "Dinner" : "Dinners"}`}
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
                {dinnerResults.length === 0 && !dinnersSaved && (
                  <div className="p-3 rounded-lg bg-meal-cream text-sm text-meal-muted mb-4">
                    No AI nights to fill — your overrides are ready to apply.
                  </div>
                )}
                <div className="space-y-2 mb-4">
                  {dinnerResults.map((d, i) => (
                    <div key={i} className="rounded-lg bg-meal-cream overflow-hidden">
                      <div className="flex items-start gap-2 p-3 group">
                        <span className="text-sm font-bold text-meal-coral w-5 shrink-0 mt-0.5">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${d.isCustomSlot ? "text-meal-plum" : "text-meal-charcoal"}`}>
                            {d.title}
                          </p>
                          {d.description && <p className="text-xs text-meal-muted mt-0.5">{d.description}</p>}
                          <div className="flex items-center gap-2 mt-1">
                            {d.isCustomSlot ? (
                              <span className="text-[10px] font-semibold text-meal-plum uppercase tracking-wider">Manual pick</span>
                            ) : d.is_gluten_free ? (
                              <span className="text-[10px] font-semibold text-meal-gf">GF</span>
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
                        {!dinnersSaved && (
                          <div className="flex items-center gap-0.5 shrink-0">
                            {/* Re-roll AI suggestion (disabled for manual picks — re-roll has nothing to swap to) */}
                            <button
                              onClick={() => handleSwapDinner(i)}
                              disabled={swappingIndex === i || d.isCustomSlot}
                              className="p-1.5 rounded-lg text-meal-muted hover:text-meal-coral hover:bg-meal-card transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-meal-muted"
                              title={d.isCustomSlot ? "Pick a new option below to swap back" : "Re-roll this meal"}
                            >
                              {swappingIndex === i ? (
                                <div className="w-4 h-4 border-2 border-meal-coral border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.183" />
                                </svg>
                              )}
                            </button>
                            {/* More options: cheat / takeaway type */}
                            <button
                              onClick={() => setExpandedResultIdx(expandedResultIdx === i ? null : i)}
                              className={`p-1.5 rounded-lg transition-colors hover:bg-meal-card ${expandedResultIdx === i ? "text-meal-coral bg-meal-card" : "text-meal-muted hover:text-meal-coral"}`}
                              title="Make takeaway or cheat meal instead"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                      {expandedResultIdx === i && !dinnersSaved && (
                        <div className="px-3 pb-3 pt-1 border-t border-meal-warm/50 bg-meal-card/5">
                          <p className="text-[10px] font-bold text-meal-muted uppercase tracking-wider mb-1.5">
                            Replace with
                          </p>
                          <div className="flex flex-wrap gap-1">
                            <button
                              onClick={() => setResultAsCheat(i)}
                              className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-meal-plum/15 text-meal-plum hover:bg-meal-plum/25"
                            >
                              🍱 Cheat meal
                            </button>
                            {(["Sushi", "Pizza", "Thai", "Indian", "Burgers", "Other"] as const).map((t) => (
                              <button
                                key={t}
                                onClick={() => setResultAsTakeaway(i, t)}
                                className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-meal-coral/15 text-meal-coral hover:bg-meal-coral/25"
                              >
                                🥡 {t}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {!dinnersSaved ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setDinnerResults(null); setDinnersSaved(false); setExpandedResultIdx(null) }}
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

      {/* ── Recipe Picker Modal ───────────────────────────────────── */}
      {pickerOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center"
          onClick={() => { setPickerOpen(null); setPickerSearch("") }}>
          <div className="bg-meal-card rounded-t-2xl md:rounded-2xl w-full max-w-md max-h-[80vh] overflow-auto p-5"
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-meal-charcoal mb-4">
              {pickerOpen.addSide ? "Add Side — " : ""}{DAY_LABELS[pickerOpen.day]} {pickerOpen.meal_type}
            </h3>

            {/* Quick picks — takeaway cuisines + eating out (none add to shopping) */}
            {!pickerOpen.addSide && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {TAKEAWAY_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => assignRecipe(pickerOpen.day, pickerOpen.meal_type, null, `Takeaway: ${t}`)}
                    className="px-2.5 py-1 rounded-full bg-meal-coral/10 text-meal-coral text-xs font-medium hover:bg-meal-coral/25 transition-colors"
                  >
                    🥡 {t}
                  </button>
                ))}
                <button
                  onClick={() => assignRecipe(pickerOpen.day, pickerOpen.meal_type, null, "Eating out")}
                  className="px-2.5 py-1 rounded-full bg-meal-plum/15 text-meal-plum text-xs font-medium hover:bg-meal-plum/30 transition-colors"
                >
                  🍽️ Eating out
                </button>
              </div>
            )}

            {/* Custom text */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Custom (e.g. Nana's for tea)"
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
              <h4 className="text-xs font-semibold text-meal-muted uppercase mb-2">
                {pickerOpen.addSide ? "Pick a side" : "Or pick a recipe"}
              </h4>

              {/* Search box — filters all sections live */}
              <input
                type="text"
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder="Search recipes..."
                className="w-full mb-3 px-3 py-2 rounded-lg bg-meal-cream border border-meal-warm focus:outline-none focus:ring-2 focus:ring-meal-sage/30 text-sm"
              />

              {(() => {
                const q = pickerSearch.trim().toLowerCase()
                const matchSearch = (r: Recipe) => !q || r.title.toLowerCase().includes(q)

                const filtered = pickerOpen.addSide
                  ? allRecipes.filter((r) => r.category === "side" && matchSearch(r))
                  : allRecipes.filter(matchSearch)
                const others = pickerOpen.addSide
                  ? allRecipes.filter((r) => r.category !== "side" && matchSearch(r))
                  : []

                if (filtered.length === 0 && others.length === 0) {
                  return q ? (
                    <p className="text-sm text-meal-muted py-4 text-center">No recipes match &ldquo;{pickerSearch}&rdquo;.</p>
                  ) : (
                    <p className="text-sm text-meal-muted py-4 text-center">No recipes yet. <Link href="/recipes/new" className="text-meal-sage hover:underline">Add one?</Link></p>
                  )
                }

                // Side picker keeps its existing two-section layout (sides first, then all).
                if (pickerOpen.addSide) {
                  return (
                    <div className="space-y-1">
                      {filtered.length === 0 && (
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
                            <span className="text-[10px] font-semibold text-meal-gf">GF</span>
                          ) : (
                            <span className="text-[10px] font-semibold text-meal-amber">Gluten</span>
                          )}
                        </button>
                      ))}
                      {others.length > 0 && (
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
                }

                // Main picker: group recipes by inferred protein, render section per group.
                const grouped: Record<string, Recipe[]> = {}
                for (const r of filtered) {
                  const key = getProteinGroup(r as { title: string; ingredients?: Array<{ name?: string }> })
                  ;(grouped[key] ??= []).push(r)
                }
                const orderedGroups: Array<{ key: string; label: string; emoji: string }> = [
                  ...PROTEIN_GROUPS.map(g => ({ key: g.key, label: g.label, emoji: g.emoji })),
                  { key: "other", label: "Other", emoji: "🍽️" },
                ]
                return (
                  <div className="space-y-3">
                    {orderedGroups.map(g => {
                      const items = grouped[g.key]
                      if (!items || items.length === 0) return null
                      return (
                        <div key={g.key}>
                          <h5 className="text-[10px] font-bold uppercase tracking-wider text-meal-muted mb-1 flex items-center gap-1.5">
                            <span>{g.emoji}</span>
                            <span>{g.label}</span>
                            <span className="text-meal-muted/50">({items.length})</span>
                          </h5>
                          <div className="space-y-1">
                            {items.map(r => (
                              <button
                                key={r.id}
                                onClick={() => {
                                  assignRecipe(pickerOpen.day, pickerOpen.meal_type, r.id, null)
                                  setRecipes((prev) => ({ ...prev, [r.id]: r }))
                                }}
                                className="w-full text-left px-3 py-2 rounded-lg hover:bg-meal-cream transition-colors flex items-center gap-2 group"
                              >
                                <span className="flex-1 text-sm text-meal-charcoal">{r.title}</span>
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    assignRecipe(pickerOpen.day, pickerOpen.meal_type, null, `Leftovers: ${r.title}`)
                                  }}
                                  title="Plan this as leftovers — nothing added to the shopping list"
                                  className="text-[10px] font-medium text-meal-plum bg-meal-plum/10 px-2 py-0.5 rounded-full hover:bg-meal-plum/25 transition-colors cursor-pointer"
                                >
                                  leftovers
                                </span>
                                {r.is_gluten_free ? (
                                  <span className="text-[10px] font-semibold text-meal-gf">GF</span>
                                ) : (
                                  <span className="text-[10px] font-semibold text-meal-amber">Gluten</span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {imagePickerRecipe && (
        <ImagePickerModal
          recipe={imagePickerRecipe}
          onSaved={(updated) => setRecipes((prev) => ({ ...prev, [updated.id]: updated }))}
          onClose={() => setImagePickerRecipe(null)}
        />
      )}
      {photosModalOpen && (
        <TakeawayPhotosModal
          overrides={takeawayPhotos}
          onChange={setTakeawayPhotos}
          onClose={() => setPhotosModalOpen(false)}
        />
      )}
    </div>
  )
}
