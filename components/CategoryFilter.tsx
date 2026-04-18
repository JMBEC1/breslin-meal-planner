"use client"

import { CATEGORY_LABELS } from "@/types"
import type { RecipeCategory } from "@/types"

interface CategoryFilterProps {
  selected: string | null
  gfOnly: boolean
  onCategoryChange: (cat: string | null) => void
  onGfChange: (gf: boolean) => void
}

const categories: { value: string | null; label: string }[] = [
  { value: null, label: "All" },
  ...Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
]

export function CategoryFilter({ selected, gfOnly, onCategoryChange, onGfChange }: CategoryFilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {categories.map((cat) => (
        <button
          key={cat.value ?? "all"}
          onClick={() => onCategoryChange(cat.value)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            selected === cat.value
              ? "bg-meal-sage text-white"
              : "bg-meal-warm text-meal-charcoal hover:bg-meal-sage/20"
          }`}
        >
          {cat.label}
        </button>
      ))}
      <div className="w-px h-6 bg-meal-warm mx-1" />
      <button
        onClick={() => onGfChange(!gfOnly)}
        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${
          gfOnly
            ? "bg-meal-sage text-white"
            : "bg-meal-warm text-meal-charcoal hover:bg-meal-sage/20"
        }`}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
        GF Only
      </button>
    </div>
  )
}
