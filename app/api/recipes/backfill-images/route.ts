import { NextResponse } from "next/server"
import { getRecipes, updateRecipe } from "@/lib/db"
import { fetchRecipeImage } from "@/lib/images"

export const dynamic = "force-dynamic"

export async function POST() {
  const recipes = await getRecipes()
  const updated: string[] = []

  for (const recipe of recipes) {
    if (recipe.image_url) continue // Already has an image

    const imageUrl = await fetchRecipeImage(recipe.title)
    if (imageUrl) {
      await updateRecipe(recipe.id, { image_url: imageUrl })
      updated.push(recipe.title)
    }
  }

  return NextResponse.json({
    message: `Updated ${updated.length} recipes with images`,
    recipes: updated,
  })
}
