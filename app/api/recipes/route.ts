import { NextRequest, NextResponse } from "next/server"
import { getRecipes, insertRecipe } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const category = searchParams.get("category") || undefined
  const gfOnly = searchParams.get("gf") === "true"
  const recipes = await getRecipes(category, gfOnly)
  return NextResponse.json(recipes)
}

export async function POST(req: NextRequest) {
  const data = await req.json()

  if (!data.title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 })
  }

  const recipe = await insertRecipe({
    title: data.title.trim(),
    category: data.category || "dinner",
    is_gluten_free: data.is_gluten_free ?? true,
    prep_time_mins: data.prep_time_mins || null,
    cook_time_mins: data.cook_time_mins || null,
    servings: data.servings || null,
    description: data.description?.trim() || "",
    ingredients: data.ingredients || [],
    instructions: data.instructions?.trim() || "",
    tags: data.tags || [],
    source_url: data.source_url || null,
    image_url: data.image_url || null,
    notes: data.notes?.trim() || null,
  })

  return NextResponse.json(recipe, { status: 201 })
}
