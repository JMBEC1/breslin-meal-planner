"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { GFBadge } from "@/components/GFBadge"
import { MealContext } from "@/components/MealContext"
import { RecipeRating } from "@/components/RecipeRating"
import { AISLE_LABELS } from "@/types"
import type { Recipe, AisleCategory } from "@/types"

export default function RecipeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [loading, setLoading] = useState(true)
  const [batchOpen, setBatchOpen] = useState(false)
  const [batchTotal, setBatchTotal] = useState("")
  const [batchEating, setBatchEating] = useState("4")
  const [batchSaving, setBatchSaving] = useState(false)
  const [batchDone, setBatchDone] = useState(false)

  useEffect(() => {
    fetch(`/api/recipes/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { setRecipe(data); setLoading(false) })
  }, [id])

  async function handleDelete() {
    if (!confirm("Delete this recipe?")) return
    await fetch(`/api/recipes/${id}`, { method: "DELETE" })
    router.push("/recipes")
  }

  if (loading) return <div className="max-w-3xl mx-auto px-4 py-12 text-center text-meal-muted">Loading...</div>
  if (!recipe) return <div className="max-w-3xl mx-auto px-4 py-12 text-center text-meal-muted">Recipe not found.</div>

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-6">
      {/* Back */}
      <Link href="/recipes" className="inline-flex items-center gap-1 text-sm text-meal-muted hover:text-meal-sage mb-4">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back to recipes
      </Link>

      {/* Hero image */}
      {recipe.image_url && (
        <div className="relative rounded-xl overflow-hidden mb-6 aspect-video">
          <img src={recipe.image_url} alt={recipe.title} className="w-full h-full object-cover" />
          <div className="absolute top-3 right-3">
            <GFBadge isGlutenFree={recipe.is_gluten_free} size="md" />
          </div>
        </div>
      )}

      {/* Title + meta */}
      <div className="flex flex-wrap items-start gap-3 mb-4">
        <h1 className="text-3xl font-bold text-meal-charcoal flex-1">{recipe.title}</h1>
        {!recipe.image_url && <GFBadge isGlutenFree={recipe.is_gluten_free} size="md" />}
      </div>

      {recipe.description && (
        <p className="text-meal-muted mb-4">{recipe.description}</p>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-6 text-sm">
        {([
          { value: "school-lunch", label: "School Lunch", colour: "bg-meal-sky" },
          { value: "dinner", label: "Dinner", colour: "bg-meal-coral" },
          { value: "fancy", label: "Special Occasion", colour: "bg-meal-plum" },
          { value: "side", label: "Side", colour: "bg-meal-sage" },
        ] as const).map((cat) => (
          <button
            key={cat.value}
            onClick={async () => {
              if (recipe.category === cat.value) return
              const res = await fetch(`/api/recipes/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ category: cat.value }),
              })
              if (res.ok) setRecipe(await res.json())
            }}
            className={`px-3 py-1 rounded-full font-medium transition-colors ${
              recipe.category === cat.value
                ? `${cat.colour} text-white`
                : "bg-meal-warm text-meal-charcoal hover:opacity-80"
            }`}
          >
            {cat.label}
          </button>
        ))}
        <div className="w-px h-5 bg-meal-warm" />
        {recipe.prep_time_mins && <span className="text-meal-muted">Prep: {recipe.prep_time_mins} min</span>}
        {recipe.cook_time_mins && <span className="text-meal-muted">Cook: {recipe.cook_time_mins} min</span>}
        {recipe.servings && <span className="text-meal-muted">Serves: {recipe.servings}</span>}
      </div>

      {/* Tags */}
      {recipe.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {recipe.tags.map((tag) => (
            <span key={tag} className="bg-meal-cream border border-meal-warm px-2 py-0.5 rounded-full text-xs text-meal-muted">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Ingredients */}
      {recipe.ingredients.length > 0 && (
        <div className="bg-white rounded-xl p-5 mb-6 shadow-sm">
          <h2 className="text-lg font-semibold text-meal-charcoal mb-3">Ingredients</h2>
          <ul className="space-y-2">
            {recipe.ingredients.map((ing, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-meal-sage mt-2 shrink-0" />
                <span className="text-meal-charcoal">
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
        <div className="bg-white rounded-xl p-5 mb-6 shadow-sm">
          <h2 className="text-lg font-semibold text-meal-charcoal mb-3">Instructions</h2>
          <ol className="space-y-3">
            {(recipe.instructions.match(/\d{1,3}\.\s[^]*?(?=\d{1,3}\.\s|$)/g) || [recipe.instructions])
              .map((step: string) => step.trim())
              .filter(Boolean)
              .map((step: string, i: number) => (
                <li key={i} className="flex gap-3 text-sm text-meal-charcoal">
                  <span className="text-meal-sage font-bold shrink-0 w-6 text-right">{i + 1}.</span>
                  <span>{step.replace(/^\d{1,3}\.\s*/, "")}</span>
                </li>
              ))}
          </ol>
        </div>
      )}

      {/* Notes */}
      {recipe.notes && (
        <div className="bg-meal-warm/50 rounded-xl p-5 mb-6">
          <h2 className="text-lg font-semibold text-meal-charcoal mb-2">Notes</h2>
          <p className="text-meal-muted">{recipe.notes}</p>
        </div>
      )}

      {/* Individual ratings for this recipe */}
      <RecipeRating recipeId={recipe.id} />

      {/* Source */}
      {recipe.source_url && (
        <p className="text-sm text-meal-muted mb-6">
          Source: <a href={recipe.source_url} target="_blank" rel="noopener noreferrer" className="text-meal-sage hover:underline">{recipe.source_url}</a>
        </p>
      )}

      {/* Sides inline + overall meal rating at the very bottom */}
      <MealContext recipeId={recipe.id} />

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-meal-warm">
        <button
          onClick={() => { setBatchOpen(true); setBatchTotal(String(recipe.servings || 6)); setBatchDone(false) }}
          className="px-4 py-2 rounded-lg text-sm font-medium text-meal-sage bg-meal-sage/10 hover:bg-meal-sage/20 transition-colors"
        >
          I Made This
        </button>
        <button onClick={handleDelete}
          className="px-4 py-2 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 transition-colors">
          Delete
        </button>
      </div>

      {/* Batch Cook Modal */}
      {batchOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center"
          onClick={() => setBatchOpen(false)}>
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-sm p-5"
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-meal-charcoal mb-2">I Made This!</h3>
            <p className="text-sm text-meal-muted mb-4">How many portions? Freeze the leftovers for later.</p>

            {!batchDone ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-meal-charcoal mb-1">Total portions made</label>
                  <input type="number" value={batchTotal} onChange={(e) => setBatchTotal(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-meal-cream border border-meal-warm focus:outline-none focus:ring-2 focus:ring-meal-sage/30 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-meal-charcoal mb-1">Eating now</label>
                  <input type="number" value={batchEating} onChange={(e) => setBatchEating(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-meal-cream border border-meal-warm focus:outline-none focus:ring-2 focus:ring-meal-sage/30 text-sm" />
                </div>
                <div className="p-3 rounded-lg bg-meal-sage/10">
                  <p className="text-sm text-meal-sage font-medium">
                    Freezing: {Math.max(0, (Number(batchTotal) || 0) - (Number(batchEating) || 0))} portions
                  </p>
                </div>
                <button
                  disabled={batchSaving || (Number(batchTotal) || 0) - (Number(batchEating) || 0) <= 0}
                  onClick={async () => {
                    setBatchSaving(true)
                    await fetch("/api/inventory/batch-cook", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        recipe_id: recipe.id,
                        total_portions: Number(batchTotal),
                        eating_now: Number(batchEating),
                      }),
                    })
                    setBatchSaving(false)
                    setBatchDone(true)
                  }}
                  className="w-full py-2.5 rounded-lg bg-meal-sage text-white text-sm font-medium hover:bg-meal-sageHover transition-colors disabled:opacity-50"
                >
                  {batchSaving ? "Saving..." : "Save to Freezer"}
                </button>
              </div>
            ) : (
              <div className="text-center py-4">
                <div className="text-3xl mb-2">❄️</div>
                <p className="text-sm font-medium text-meal-charcoal">Saved to freezer!</p>
                <p className="text-xs text-meal-muted mt-1">Find it in Pantry → Freezer</p>
                <button onClick={() => setBatchOpen(false)}
                  className="mt-4 px-4 py-2 rounded-lg bg-meal-warm text-meal-charcoal text-sm font-medium">
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
