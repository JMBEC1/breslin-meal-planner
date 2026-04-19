import { NextRequest, NextResponse } from "next/server"
import { getCheatMeals, insertCheatMeal } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET() {
  const meals = await getCheatMeals()
  return NextResponse.json(meals)
}

export async function POST(req: NextRequest) {
  const { name, is_gluten_free } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 })
  const meal = await insertCheatMeal(name.trim(), is_gluten_free ?? true)
  return NextResponse.json(meal, { status: 201 })
}
