import { NextResponse } from "next/server"
import { getRecipes, updateRecipe } from "@/lib/db"
import { fetchRecipeImage } from "@/lib/images"

export const dynamic = "force-dynamic"

// Curated food images for common recipe types (Unsplash direct links)
const CURATED: Record<string, string> = {
  "stir fry": "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&h=600&fit=crop",
  "sushi": "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800&h=600&fit=crop",
  "lamb": "https://images.unsplash.com/photo-1514516345957-556ca7d90a29?w=800&h=600&fit=crop",
  "rice paper": "https://images.unsplash.com/photo-1609501676725-7186f017a4b7?w=800&h=600&fit=crop",
  "bolognese": "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=800&h=600&fit=crop",
  "pancake": "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&h=600&fit=crop",
  "salmon": "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&h=600&fit=crop",
  "taco": "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&h=600&fit=crop",
  "carbonara": "https://images.unsplash.com/photo-1612874742237-6526221588e3?w=800&h=600&fit=crop",
  "nugget": "https://images.unsplash.com/photo-1562967914-608f82629710?w=800&h=600&fit=crop",
  "chicken": "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800&h=600&fit=crop",
  "curry": "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&h=600&fit=crop",
  "pasta": "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&h=600&fit=crop",
  "salad": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=600&fit=crop",
  "soup": "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&h=600&fit=crop",
  "fish": "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&h=600&fit=crop",
  "steak": "https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800&h=600&fit=crop",
  "pizza": "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&h=600&fit=crop",
  "burger": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&h=600&fit=crop",
}

function findCuratedImage(title: string): string | null {
  const lower = title.toLowerCase()
  for (const [keyword, url] of Object.entries(CURATED)) {
    if (lower.includes(keyword)) return url
  }
  return null
}

export async function POST() {
  const recipes = await getRecipes()
  const updated: string[] = []

  for (const recipe of recipes) {
    // Skip if already has a real (non-picsum) image
    if (recipe.image_url && !recipe.image_url.includes("picsum.photos")) continue

    // Try curated match first, then keyword match
    const imageUrl = findCuratedImage(recipe.title) || fetchRecipeImage(recipe.title)
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
