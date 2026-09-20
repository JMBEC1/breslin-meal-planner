"use client"

import { useState } from "react"
import Link from "next/link"
import { DAYS, DAY_LABELS } from "@/types"
import type { MealSlot, DayOfWeek, MealType, Recipe } from "@/types"
import { getTakeawayImage, TAKEAWAY_TYPES, type TakeawayType } from "@/lib/takeaway-images"

/**
 * Generate this week's dinners.
 *
 * Lifted whole out of the plan page, where it was roughly three hundred lines
 * of JSX and six handlers sharing one 1,300-line function with everything
 * else. It owns its own state because that state is nobody else's business:
 * the per-day Auto/Cheat/Takeaway/Skip overrides, the results list and the
 * theme box all exist only while this is open, and are thrown away on close.
 *
 * The boundary the plan page cares about is one call: `onApply` receives the
 * finished MealSlot list. Rich controls in here, flat slots out — the same
 * split the persisted model has always had.
 */

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


const OVERRIDE_CHIP_CLASS: Record<DayOverride, string> = {
  auto: "bg-meal-warm text-meal-charcoal hover:bg-meal-warm/80",
  cheat: "bg-meal-plum/15 text-meal-plum hover:bg-meal-plum/25",
  takeaway: "bg-meal-coral/15 text-meal-coral hover:bg-meal-coral/25",
  skip: "bg-meal-muted/15 text-meal-muted hover:bg-meal-muted/25",
}

export function DinnerGenerator({
  weekStart, meals, takeawayPhotos, onApply, onRecipeCreated, onManagePhotos, onClose,
}: {
  weekStart: string
  meals: MealSlot[]
  takeawayPhotos: Record<string, string>
  /** The finished week. The page persists it. */
  onApply: (updated: MealSlot[]) => Promise<void>
  /** A suggestion was saved as a real recipe, so the page can cache it. */
  onRecipeCreated: (recipe: Recipe) => void
  onManagePhotos: () => void
  onClose: () => void
}) {
  // Library-only: dinners are always chosen from recipes we've added.
  // (The Mix / Internet modes were removed — we don't suggest new/web recipes.)
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
  const autoDays = DAYS.filter((d) => dayOverrides[d] === "auto")
  const takeawayDays = DAYS.filter((d) => dayOverrides[d] === "takeaway")

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
      onRecipeCreated(recipe)
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
      const recipeId = await saveAsSuggestionRecipe(dinner, "main")
      updated.push({
        day,
        meal_type: "dinner" as MealType,
        recipe_id: recipeId,
        custom_text: recipeId ? null : dinner.title,
      })
      if (dinner.leftovers) leftoverFor = dinner.title
    }
    await onApply(updated)
    setDinnersSaved(true)
  }

  function closeDinnerGen() {
    onClose()
    setDinnerResults(null)
    setDinnersSaved(false)
    setInspiration("")
    setExpandedResultIdx(null)
    setDayOverrides(Object.fromEntries(DAYS.map((d) => [d, "auto" as const])) as Record<DayOfWeek, DayOverride>)
    setTakeawayTypes({})
  }

  const INSPIRATION_CHIPS = ["Indian", "Mexican", "Asian", "Italian", "Salad", "Slow Cooker", "BBQ", "One Pot", "Quick & Easy", "Comfort Food"]

  return (
    <>
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
                        onClick={() => onManagePhotos()}
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
    </>
  )
}
