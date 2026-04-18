import { NextRequest, NextResponse } from "next/server"
import { getRatings, upsertRating, getAllRatings } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const recipeId = searchParams.get("recipe_id")

  if (recipeId) {
    const ratings = await getRatings(Number(recipeId))
    return NextResponse.json(ratings)
  }

  // Return all ratings (for favourites page)
  const ratings = await getAllRatings()
  return NextResponse.json(ratings)
}

export async function POST(req: NextRequest) {
  const { recipe_id, person, enjoyment, ease_of_cooking } = await req.json()

  if (!recipe_id || !person) {
    return NextResponse.json({ error: "recipe_id and person required" }, { status: 400 })
  }
  if (enjoyment < 0 || enjoyment > 5 || ease_of_cooking < 0 || ease_of_cooking > 5) {
    return NextResponse.json({ error: "Ratings must be 0-5" }, { status: 400 })
  }

  const ratings = await upsertRating(recipe_id, person, enjoyment || 0, ease_of_cooking || 0)
  return NextResponse.json(ratings)
}
