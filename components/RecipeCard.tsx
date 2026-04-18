import Link from "next/link"
import { GFBadge } from "./GFBadge"
import { CATEGORY_LABELS, CATEGORY_COLOURS } from "@/types"
import type { Recipe, RecipeCategory } from "@/types"

export function RecipeCard({ recipe }: { recipe: Recipe }) {
  const categoryColour = CATEGORY_COLOURS[recipe.category as RecipeCategory] || "bg-meal-muted"
  const categoryLabel = CATEGORY_LABELS[recipe.category as RecipeCategory] || recipe.category

  return (
    <Link href={`/recipes/${recipe.id}`} className="group block">
      <div className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
        {/* Image */}
        <div className="relative aspect-[4/3] bg-meal-warm">
          {recipe.image_url ? (
            <img
              src={recipe.image_url}
              alt={recipe.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-meal-muted">
              <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.871c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513M15 8.25v-1.5m-6 1.5v-1.5m12 9.75l-1.5.75a3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0L3 16.5m15-3.379a48.474 48.474 0 00-6-.371c-2.032 0-4.034.126-6 .371m12 0c.39.049.777.102 1.163.16 1.07.16 1.837 1.094 1.837 2.175v5.169c0 .621-.504 1.125-1.125 1.125H4.125A1.125 1.125 0 013 20.625v-5.17c0-1.08.768-2.014 1.837-2.174A47.78 47.78 0 016 13.12M12.265 3.11a.375.375 0 11-.53 0L12 2.845l.265.265zm-3 0a.375.375 0 11-.53 0L9 2.845l.265.265zm6 0a.375.375 0 11-.53 0L15 2.845l.265.265z" />
              </svg>
            </div>
          )}
          {/* GF badge overlay */}
          <div className="absolute top-2 right-2">
            <GFBadge isGlutenFree={recipe.is_gluten_free} />
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="font-semibold text-meal-charcoal group-hover:text-meal-sage transition-colors line-clamp-2">
            {recipe.title}
          </h3>
          {recipe.description && (
            <p className="mt-1 text-sm text-meal-muted line-clamp-2">{recipe.description}</p>
          )}
          <div className="mt-3 flex items-center gap-2">
            <span className={`${categoryColour} text-white text-[10px] font-semibold px-2 py-0.5 rounded-full`}>
              {categoryLabel}
            </span>
            {recipe.prep_time_mins && (
              <span className="text-xs text-meal-muted">
                {recipe.prep_time_mins + (recipe.cook_time_mins || 0)} min
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
