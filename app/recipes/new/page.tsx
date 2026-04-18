"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CATEGORY_LABELS, AISLE_LABELS } from "@/types"
import type { RecipeCategory, AisleCategory, Ingredient } from "@/types"

const emptyIngredient: Ingredient = {
  name: "", quantity: "", unit: "", aisle: "pantry", is_gluten_free: true,
}

export default function NewRecipePage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState("")
  const [category, setCategory] = useState<RecipeCategory>("dinner")
  const [isGlutenFree, setIsGlutenFree] = useState(true)
  const [prepTime, setPrepTime] = useState("")
  const [cookTime, setCookTime] = useState("")
  const [servings, setServings] = useState("")
  const [description, setDescription] = useState("")
  const [ingredients, setIngredients] = useState<Ingredient[]>([{ ...emptyIngredient }])
  const [instructions, setInstructions] = useState("")
  const [tags, setTags] = useState("")
  const [notes, setNotes] = useState("")
  const [sourceUrl, setSourceUrl] = useState("")

  function updateIngredient(index: number, field: keyof Ingredient, value: string | boolean) {
    setIngredients((prev) =>
      prev.map((ing, i) => (i === index ? { ...ing, [field]: value } : ing))
    )
  }

  function addIngredient() {
    setIngredients((prev) => [...prev, { ...emptyIngredient }])
  }

  function removeIngredient(index: number) {
    setIngredients((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)

    const res = await fetch("/api/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        category,
        is_gluten_free: isGlutenFree,
        prep_time_mins: prepTime ? Number(prepTime) : null,
        cook_time_mins: cookTime ? Number(cookTime) : null,
        servings: servings ? Number(servings) : null,
        description: description.trim(),
        ingredients: ingredients.filter((i) => i.name.trim()),
        instructions: instructions.trim(),
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        source_url: sourceUrl.trim() || null,
        notes: notes.trim() || null,
      }),
    })

    if (res.ok) {
      const recipe = await res.json()
      router.push(`/recipes/${recipe.id}`)
    } else {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-6 py-6">
      <h1 className="text-2xl font-bold text-meal-charcoal mb-6">Add Recipe</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-meal-charcoal mb-1">Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg bg-white border border-meal-warm focus:outline-none focus:ring-2 focus:ring-meal-sage/30 focus:border-meal-sage"
            placeholder="e.g. GF Chicken Stir Fry"
            required
          />
        </div>

        {/* Category + GF */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-meal-charcoal mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as RecipeCategory)}
              className="w-full px-4 py-2.5 rounded-lg bg-white border border-meal-warm focus:outline-none focus:ring-2 focus:ring-meal-sage/30 focus:border-meal-sage"
            >
              {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isGlutenFree}
                onChange={(e) => setIsGlutenFree(e.target.checked)}
                className="w-5 h-5 rounded border-meal-warm text-meal-sage focus:ring-meal-sage"
              />
              <span className="text-sm font-medium text-meal-charcoal">Gluten Free</span>
            </label>
          </div>
        </div>

        {/* Times + Servings */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-meal-charcoal mb-1">Prep (min)</label>
            <input type="number" value={prepTime} onChange={(e) => setPrepTime(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-white border border-meal-warm focus:outline-none focus:ring-2 focus:ring-meal-sage/30 focus:border-meal-sage"
              placeholder="15" />
          </div>
          <div>
            <label className="block text-sm font-medium text-meal-charcoal mb-1">Cook (min)</label>
            <input type="number" value={cookTime} onChange={(e) => setCookTime(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-white border border-meal-warm focus:outline-none focus:ring-2 focus:ring-meal-sage/30 focus:border-meal-sage"
              placeholder="30" />
          </div>
          <div>
            <label className="block text-sm font-medium text-meal-charcoal mb-1">Servings</label>
            <input type="number" value={servings} onChange={(e) => setServings(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-white border border-meal-warm focus:outline-none focus:ring-2 focus:ring-meal-sage/30 focus:border-meal-sage"
              placeholder="4" />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-meal-charcoal mb-1">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg bg-white border border-meal-warm focus:outline-none focus:ring-2 focus:ring-meal-sage/30 focus:border-meal-sage"
            rows={2} placeholder="A quick and tasty weeknight dinner..." />
        </div>

        {/* Ingredients */}
        <div>
          <label className="block text-sm font-medium text-meal-charcoal mb-2">Ingredients</label>
          <div className="space-y-2">
            {ingredients.map((ing, i) => (
              <div key={i} className="flex gap-2 items-start">
                <input
                  type="text" placeholder="Qty" value={ing.quantity}
                  onChange={(e) => updateIngredient(i, "quantity", e.target.value)}
                  className="w-16 px-2 py-2 rounded-lg bg-white border border-meal-warm focus:outline-none focus:ring-2 focus:ring-meal-sage/30 text-sm"
                />
                <input
                  type="text" placeholder="Unit" value={ing.unit}
                  onChange={(e) => updateIngredient(i, "unit", e.target.value)}
                  className="w-16 px-2 py-2 rounded-lg bg-white border border-meal-warm focus:outline-none focus:ring-2 focus:ring-meal-sage/30 text-sm"
                />
                <input
                  type="text" placeholder="Ingredient name" value={ing.name}
                  onChange={(e) => updateIngredient(i, "name", e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-white border border-meal-warm focus:outline-none focus:ring-2 focus:ring-meal-sage/30 text-sm"
                />
                <select
                  value={ing.aisle}
                  onChange={(e) => updateIngredient(i, "aisle", e.target.value)}
                  className="w-28 px-2 py-2 rounded-lg bg-white border border-meal-warm focus:outline-none focus:ring-2 focus:ring-meal-sage/30 text-sm"
                >
                  {Object.entries(AISLE_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
                {ingredients.length > 1 && (
                  <button type="button" onClick={() => removeIngredient(i)}
                    className="p-2 text-meal-muted hover:text-red-500 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
          <button type="button" onClick={addIngredient}
            className="mt-2 text-sm text-meal-sage hover:text-meal-sageHover font-medium">
            + Add ingredient
          </button>
        </div>

        {/* Instructions */}
        <div>
          <label className="block text-sm font-medium text-meal-charcoal mb-1">Instructions</label>
          <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg bg-white border border-meal-warm focus:outline-none focus:ring-2 focus:ring-meal-sage/30 focus:border-meal-sage"
            rows={6} placeholder="1. Heat oil in a pan...&#10;2. Add chicken and cook..." />
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-meal-charcoal mb-1">Tags (comma-separated)</label>
          <input type="text" value={tags} onChange={(e) => setTags(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg bg-white border border-meal-warm focus:outline-none focus:ring-2 focus:ring-meal-sage/30 focus:border-meal-sage"
            placeholder="quick, kid-friendly, asian" />
        </div>

        {/* Source URL */}
        <div>
          <label className="block text-sm font-medium text-meal-charcoal mb-1">Source URL (optional)</label>
          <input type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg bg-white border border-meal-warm focus:outline-none focus:ring-2 focus:ring-meal-sage/30 focus:border-meal-sage"
            placeholder="https://..." />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-meal-charcoal mb-1">Notes (optional)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg bg-white border border-meal-warm focus:outline-none focus:ring-2 focus:ring-meal-sage/30 focus:border-meal-sage"
            rows={2} placeholder="Kids love this! Double the sauce next time." />
        </div>

        {/* Submit */}
        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()}
            className="px-6 py-2.5 rounded-lg bg-meal-warm text-meal-charcoal font-medium hover:bg-meal-warm/80 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={saving || !title.trim()}
            className="px-6 py-2.5 rounded-lg bg-meal-sage text-white font-medium hover:bg-meal-sageHover transition-colors disabled:opacity-50">
            {saving ? "Saving..." : "Save Recipe"}
          </button>
        </div>
      </form>
    </div>
  )
}
