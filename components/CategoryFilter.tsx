"use client"

import { CATEGORY_LABELS, CUISINES } from "@/types"
import type { RecipeCategory } from "@/types"

/**
 * Course on the left, cuisine on the right, and they combine — "Sides" plus
 * "Mexican" gives Mexican sides. They are separate fields underneath
 * (`category` and `tags`) for exactly that reason: a dish is allowed to be
 * both, and picking a main then a salad then a side only works if filtering
 * by course finds every side regardless of what cuisine it belongs to.
 */
const COURSES = Object.entries(CATEGORY_LABELS) as [RecipeCategory, string][]

interface CategoryFilterProps {
  selected: string | null
  cuisine: string | null
  gfOnly: boolean
  onCategoryChange: (cat: string | null) => void
  onCuisineChange: (cuisine: string | null) => void
  onGfChange: (gf: boolean) => void
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
        on ? "bg-meal-sage text-white" : "bg-meal-warm text-meal-charcoal hover:bg-meal-sage/20"
      }`}
    >
      {children}
    </button>
  )
}

export function CategoryFilter({
  selected, cuisine, gfOnly, onCategoryChange, onCuisineChange, onGfChange,
}: CategoryFilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Chip on={selected === null} onClick={() => onCategoryChange(null)}>All</Chip>
      {COURSES.map(([value, label]) => (
        <Chip key={value} on={selected === value} onClick={() => onCategoryChange(selected === value ? null : value)}>
          {label}
        </Chip>
      ))}

      <div className="w-px h-6 bg-meal-warm mx-1" />

      {CUISINES.map((c) => (
        <Chip key={c} on={cuisine === c} onClick={() => onCuisineChange(cuisine === c ? null : c)}>
          {c}
        </Chip>
      ))}

      <div className="w-px h-6 bg-meal-warm mx-1" />

      <button
        onClick={() => onGfChange(!gfOnly)}
        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${
          gfOnly ? "bg-meal-sage text-white" : "bg-meal-warm text-meal-charcoal hover:bg-meal-sage/20"
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
