"use client"

import { CATEGORY_LABELS, CUISINES } from "@/types"
import { BASES } from "@/lib/bases"
import type { RecipeCategory } from "@/types"

/**
 * Three axes, and they combine: course, cuisine, and what the dish is built on.
 * "Sides" + "Mexican" gives Mexican sides; "Pasta" + "Beef" gives the lasagne.
 *
 * They are separate fields underneath — course in `category`, cuisine and base
 * in `tags` — because a dish is allowed to be several of these at once. A beef
 * lasagne is beef *and* pasta, and one field would force it to lie about one.
 */
const COURSES = Object.entries(CATEGORY_LABELS) as [RecipeCategory, string][]

interface CategoryFilterProps {
  selected: string | null
  cuisine: string | null
  base: string | null
  gfOnly: boolean
  onCategoryChange: (cat: string | null) => void
  onCuisineChange: (cuisine: string | null) => void
  onBaseChange: (base: string | null) => void
  onGfChange: (gf: boolean) => void
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
        on ? "bg-meal-sage text-white" : "bg-meal-warm text-meal-charcoal hover:bg-meal-sage/20"
      }`}
    >
      {children}
    </button>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10px] font-bold uppercase tracking-wider text-meal-muted w-12 shrink-0">{label}</span>
      {children}
    </div>
  )
}

export function CategoryFilter({
  selected, cuisine, base, gfOnly,
  onCategoryChange, onCuisineChange, onBaseChange, onGfChange,
}: CategoryFilterProps) {
  const anyOn = selected || cuisine || base || gfOnly

  return (
    <div className="space-y-2">
      <Row label="Course">
        <Chip on={selected === null} onClick={() => onCategoryChange(null)}>All</Chip>
        {COURSES.map(([value, label]) => (
          <Chip key={value} on={selected === value} onClick={() => onCategoryChange(selected === value ? null : value)}>
            {label}
          </Chip>
        ))}
      </Row>

      <Row label="Cuisine">
        {CUISINES.map((c) => (
          <Chip key={c} on={cuisine === c} onClick={() => onCuisineChange(cuisine === c ? null : c)}>{c}</Chip>
        ))}
      </Row>

      <Row label="Made of">
        {BASES.map((b) => (
          <Chip key={b} on={base === b} onClick={() => onBaseChange(base === b ? null : b)}>{b}</Chip>
        ))}
        <span className="w-px h-5 bg-meal-warm mx-1" />
        <Chip on={gfOnly} onClick={() => onGfChange(!gfOnly)}>GF only</Chip>
        {anyOn && (
          <button
            onClick={() => { onCategoryChange(null); onCuisineChange(null); onBaseChange(null); onGfChange(false) }}
            className="text-[10px] text-meal-muted hover:text-meal-charcoal underline underline-offset-2 ml-1"
          >
            clear
          </button>
        )}
      </Row>
    </div>
  )
}
