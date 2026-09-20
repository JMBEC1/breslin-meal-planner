"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { DAYS, DAY_LABELS } from "@/types"
import type { MealSlot, DayOfWeek, MealType, Recipe } from "@/types"
import { ImagePickerModal } from "@/components/ImagePickerModal"
import { TakeawayPhotosModal } from "@/components/TakeawayPhotosModal"
import { getTakeawayImage, TAKEAWAY_TYPES } from "@/lib/takeaway-images"
import { DinnerGenerator } from "@/components/plan/DinnerGenerator"
import { SlotPicker } from "@/components/plan/SlotPicker"

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


function PlanPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [weekStart, setWeekStart] = useState(
    () => searchParams.get("week") || getMonday(new Date())
  )
  const [meals, setMeals] = useState<MealSlot[]>([])
  const [recipes, setRecipes] = useState<Record<number, Recipe>>({})
  const [loading, setLoading] = useState(true)
  const [pickerOpen, setPickerOpen] = useState<{ day: DayOfWeek; meal_type: MealType; addSide?: boolean; bridge?: boolean } | null>(null)
  // "Still this week" bridge — when viewing a future week, the remaining days
  // of the CURRENT week are shown as plannable tiles above the grid, so
  // "plan tomorrow through Friday" works on one screen even across the
  // Mon–Sun boundary. bridgeMeals holds the current week's FULL meals array.
  const [bridgeMeals, setBridgeMeals] = useState<MealSlot[]>([])
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([])

  // Dinner generator state
  const [dinnerGenOpen, setDinnerGenOpen] = useState(false)
  // Takeaway photo overrides keyed by cuisine (lower-case). Persisted in Neon
  // via /api/takeaway-images; loaded once on mount.
  const [takeawayPhotos, setTakeawayPhotos] = useState<Record<string, string>>({})
  const [photosModalOpen, setPhotosModalOpen] = useState(false)

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

  // ── "Still this week" bridge (viewing a future week) ─────────────
  const todayMonday = getMonday(new Date())
  const isFutureView = weekStart > todayMonday
  const bridgeDays: DayOfWeek[] = isFutureView
    ? (DAYS.slice((new Date().getDay() + 6) % 7) as DayOfWeek[])
    : []

  useEffect(() => {
    if (!isFutureView) return
    fetch(`/api/plan?week=${todayMonday}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((plan) => setBridgeMeals(plan?.meals || []))
      .catch(() => setBridgeMeals([]))
    if (allRecipes.length === 0) {
      fetch("/api/recipes").then((r) => (r.ok ? r.json() : [])).then(setAllRecipes)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFutureView, todayMonday])

  function getBridgeSlot(day: DayOfWeek): MealSlot | undefined {
    return bridgeMeals.find((m) => m.day === day && m.meal_type === "dinner")
  }

  function bridgeSlotTitle(slot: MealSlot): string {
    if (slot.custom_text) return slot.custom_text
    if (slot.recipe_id) {
      return (
        allRecipes.find((r) => r.id === slot.recipe_id)?.title ||
        recipes[slot.recipe_id]?.title ||
        "Planned"
      )
    }
    return "Planned"
  }

  async function saveBridgePlan(updated: MealSlot[]) {
    setBridgeMeals(updated)
    await fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ week_start: todayMonday, meals: updated }),
    })
  }

  function clearBridgeSlot(day: DayOfWeek) {
    saveBridgePlan(bridgeMeals.filter((m) => !(m.day === day && m.meal_type === "dinner")))
  }

  function bridgeDayDate(day: DayOfWeek): string {
    const idx = DAYS.indexOf(day)
    const d = new Date(todayMonday + "T00:00:00")
    d.setDate(d.getDate() + idx)
    return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" })
  }

  async function savePlan(updated: MealSlot[]) {
    setMeals(updated)
    await fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ week_start: weekStart, meals: updated }),
    })
  }

  function assignRecipe(
    day: DayOfWeek, mealType: MealType, recipeId: number | null, text: string | null,
    sideIds?: number[],
  ) {
    if (pickerOpen?.bridge) {
      // Writing into the CURRENT week's plan from a future-week view.
      const existing = bridgeMeals.filter((m) => !(m.day === day && m.meal_type === mealType))
      saveBridgePlan([...existing, { day, meal_type: mealType, recipe_id: recipeId, custom_text: text }])
      setPickerOpen(null)
      return
    }
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
      const updated = [...existing, {
        day, meal_type: mealType, recipe_id: recipeId, custom_text: text,
        ...(sideIds?.length ? { side_ids: sideIds } : {}),
      }]
      savePlan(updated)
    }
    setPickerOpen(null)
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

  async function openPicker(day: DayOfWeek, mealType: MealType, addSide?: boolean, bridge?: boolean) {
    setPickerOpen({ day, meal_type: mealType, addSide, bridge })
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
          {/* "Still this week" bridge — plan tomorrow etc. without leaving next week's view */}
          {isFutureView && bridgeDays.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-meal-amber uppercase tracking-wider mb-2">
                Still this week
              </h3>
              <div className="grid grid-cols-2 md:flex md:flex-wrap gap-3">
                {bridgeDays.map((day) => {
                  const slot = getBridgeSlot(day)
                  return (
                    <div key={day} className="md:min-w-[160px] bg-meal-card border border-meal-warm rounded-xl px-3 py-2.5">
                      <p className="text-[10px] font-semibold text-meal-muted uppercase tracking-wider mb-1">
                        {DAY_LABELS[day]} {bridgeDayDate(day)}
                      </p>
                      {slot ? (
                        <div className="flex items-center gap-2">
                          <span className="flex-1 text-sm text-meal-charcoal">{bridgeSlotTitle(slot)}</span>
                          <button
                            onClick={() => openPicker(day, "dinner", false, true)}
                            className="text-[10px] font-medium text-meal-sage hover:underline"
                          >
                            swap
                          </button>
                          <button
                            onClick={() => clearBridgeSlot(day)}
                            className="text-[10px] font-medium text-meal-muted hover:text-red-500"
                          >
                            clear
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => openPicker(day, "dinner", false, true)}
                          className="text-sm text-meal-sage font-medium hover:underline"
                        >
                          + Add
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

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


      {dinnerGenOpen && (
        <DinnerGenerator
          weekStart={weekStart}
          meals={meals}
          takeawayPhotos={takeawayPhotos}
          onApply={savePlan}
          onRecipeCreated={(recipe) => setRecipes((prev) => ({ ...prev, [recipe.id]: recipe }))}
          onManagePhotos={() => setPhotosModalOpen(true)}
          onClose={() => setDinnerGenOpen(false)}
        />
      )}


      {pickerOpen && (
        <SlotPicker
          target={pickerOpen}
          allRecipes={allRecipes}
          recipes={recipes}
          onAssign={assignRecipe}
          onRecipeCached={(recipe) => setRecipes((prev) => ({ ...prev, [recipe.id]: recipe }))}
          onClose={() => setPickerOpen(null)}
        />
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

// useSearchParams requires a Suspense boundary for prerendering.
export default function PlanPage() {
  return (
    <Suspense fallback={null}>
      <PlanPageInner />
    </Suspense>
  )
}
