import Link from "next/link"
import { GFBadge } from "./GFBadge"
import { CATEGORY_LABELS, CATEGORY_COLOURS } from "@/types"
import type { Recipe, RecipeCategory } from "@/types"

export function RecipeCard({ recipe }: { recipe: Recipe }) {
  const categoryColour = CATEGORY_COLOURS[recipe.category as RecipeCategory] || "bg-meal-muted"
  const categoryLabel = CATEGORY_LABELS[recipe.category as RecipeCategory] || recipe.category

  return (
    <Link href={`/recipes/${recipe.id}`} className="group block">
      <div className="bg-meal-card rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
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
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-3.5 0a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0Z" />
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
