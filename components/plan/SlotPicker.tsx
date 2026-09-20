"use client"

import { useState } from "react"
import Link from "next/link"
import { DAY_LABELS } from "@/types"
import type { DayOfWeek, MealType, Recipe } from "@/types"
import { TAKEAWAY_TYPES } from "@/lib/takeaway-images"
import { toCategory } from "@/types"

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

/**
 * Choose what goes in one slot: a saved recipe, a quick pick (takeaway,
 * leftovers, eating out) or free text.
 *
 * Its search box and free-text field were page-level state that nothing else
 * read, so they live here now and reset with the modal.
 */
export function SlotPicker({
  target, allRecipes, recipes, onAssign, onRecipeCached, onClose,
}: {
  target: { day: DayOfWeek; meal_type: MealType; addSide?: boolean; bridge?: boolean }
  allRecipes: Recipe[]
  recipes: Record<number, Recipe>
  onAssign: (
    day: DayOfWeek, mealType: MealType, recipeId: number | null, text: string | null,
    sideIds?: number[],
  ) => void
  /** Chosen recipe wasn't in the page's cache yet — hand it over so it renders. */
  onRecipeCached: (recipe: Recipe) => void
  onClose: () => void
}) {
  const [customText, setCustomText] = useState("")
  const [pickerSearch, setPickerSearch] = useState("")
  // A dinner can be more than one dish. The main is chosen rather than
  // assigned on tap, so salads and sides can be added to it before it lands
  // on the plan as a single slot.
  const [mainPick, setMainPick] = useState<Recipe | null>(null)
  const [extras, setExtras] = useState<Recipe[]>([])

  const toggleExtra = (r: Recipe) =>
    setExtras((prev) => prev.some((x) => x.id === r.id)
      ? prev.filter((x) => x.id !== r.id)
      : [...prev, r])

  function commitMeal() {
    if (!mainPick) return
    onRecipeCached(mainPick)
    extras.forEach(onRecipeCached)
    onAssign(target.day, target.meal_type, mainPick.id, null, extras.map((r) => r.id))
  }

  return (
    <>
          <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center"
            onClick={() => { onClose(); setPickerSearch("") }}>
            <div className="bg-meal-card rounded-t-2xl md:rounded-2xl w-full max-w-md max-h-[80vh] overflow-auto p-5"
              onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-meal-charcoal mb-4">
                {target.addSide ? "Add Side — " : ""}{DAY_LABELS[target.day]} {target.meal_type}
              </h3>

              {/* Quick picks — takeaway cuisines + eating out (none add to shopping) */}
              {!target.addSide && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {TAKEAWAY_TYPES.map((t) => (
                    <button
                      key={t}
                      onClick={() => onAssign(target.day, target.meal_type, null, `Takeaway: ${t}`)}
                      className="px-2.5 py-1 rounded-full bg-meal-coral/10 text-meal-coral text-xs font-medium hover:bg-meal-coral/25 transition-colors"
                    >
                      🥡 {t}
                    </button>
                  ))}
                  <button
                    onClick={() => onAssign(target.day, target.meal_type, null, "Eating out")}
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
                  onClick={() => customText.trim() && onAssign(target.day, target.meal_type, null, customText.trim())}
                  disabled={!customText.trim()}
                  className="px-3 py-2 rounded-lg bg-meal-sage text-white text-sm font-medium disabled:opacity-50"
                >
                  Add
                </button>
              </div>

              <div className="border-t border-meal-warm pt-3">
                <h4 className="text-xs font-semibold text-meal-muted uppercase mb-2">
                  {target.addSide ? "Pick a side" : "Or pick a recipe"}
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

                  const isExtra = (r: Recipe) => {
                    const c = toCategory(r.category)
                    return c === "salad" || c === "side"
                  }
                  const filtered = target.addSide
                    ? allRecipes.filter((r) => isExtra(r) && matchSearch(r))
                    : allRecipes.filter((r) => !isExtra(r) && matchSearch(r))
                  const others = target.addSide
                    ? allRecipes.filter((r) => !isExtra(r) && matchSearch(r))
                    : []
                  const extrasList = target.addSide ? [] : allRecipes.filter((r) => isExtra(r) && matchSearch(r))

                  if (filtered.length === 0 && others.length === 0) {
                    return q ? (
                      <p className="text-sm text-meal-muted py-4 text-center">No recipes match &ldquo;{pickerSearch}&rdquo;.</p>
                    ) : (
                      <p className="text-sm text-meal-muted py-4 text-center">No recipes yet. <Link href="/recipes/new" className="text-meal-sage hover:underline">Add one?</Link></p>
                    )
                  }

                  // Side picker keeps its existing two-section layout (sides first, then all).
                  if (target.addSide) {
                    return (
                      <div className="space-y-1">
                        {filtered.length === 0 && (
                          <p className="text-sm text-meal-muted py-2 text-center">No sides yet — categorise a recipe as &quot;Side&quot; or pick from all below.</p>
                        )}
                        {filtered.map((r) => (
                          <button
                            key={r.id}
                            onClick={() => {
                              onAssign(target.day, target.meal_type, r.id, null)
                              onRecipeCached(r)
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
                                  onAssign(target.day, target.meal_type, r.id, null)
                                  onRecipeCached(r)
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
                                  onClick={() => setMainPick(mainPick?.id === r.id ? null : r)}
                                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-2 group ${
                                    mainPick?.id === r.id ? "bg-meal-sage/15 ring-1 ring-meal-sage" : "hover:bg-meal-cream"
                                  }`}
                                >
                                  <span className="flex-1 text-sm text-meal-charcoal">{r.title}</span>
                                  <span
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      onAssign(target.day, target.meal_type, null, `Leftovers: ${r.title}`)
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

                      {extrasList.length > 0 && (
                        <div>
                          <h5 className="text-[10px] font-bold uppercase tracking-wider text-meal-muted mb-1 flex items-center gap-1.5">
                            <span>🥗</span>
                            <span>Salads &amp; sides</span>
                            <span className="text-meal-muted/50">(tap to add alongside)</span>
                          </h5>
                          <div className="flex flex-wrap gap-1.5">
                            {extrasList.map((r) => {
                              const on = extras.some((x) => x.id === r.id)
                              return (
                                <button
                                  key={r.id}
                                  onClick={() => toggleExtra(r)}
                                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                                    on ? "bg-meal-plum text-white" : "bg-meal-cream text-meal-charcoal hover:bg-meal-warm"
                                  }`}
                                >
                                  {on ? "✓ " : ""}{r.title}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>

              {!target.addSide && (mainPick || extras.length > 0) && (
                <div className="border-t border-meal-cream p-3 bg-meal-card">
                  <p className="text-xs text-meal-muted mb-2 truncate">
                    {mainPick ? mainPick.title : <span className="text-meal-coral">Pick a main</span>}
                    {extras.length > 0 && ` + ${extras.map((r) => r.title).join(" + ")}`}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setMainPick(null); setExtras([]) }}
                      className="px-3 py-2 rounded-lg bg-meal-warm text-meal-charcoal text-sm font-medium hover:bg-meal-warm/80"
                    >
                      Clear
                    </button>
                    <button
                      onClick={commitMeal}
                      disabled={!mainPick}
                      className="flex-1 py-2 rounded-lg bg-meal-sage text-white text-sm font-medium hover:bg-meal-sageHover disabled:opacity-40"
                    >
                      Add {extras.length > 0 ? `${extras.length + 1} dishes` : "to plan"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
    </>
  )
}
