import { NextRequest, NextResponse } from "next/server"
import { getMealPlan, upsertMealPlan } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const week = searchParams.get("week")
  if (!week) return NextResponse.json({ error: "week param required (YYYY-MM-DD)" }, { status: 400 })

  const plan = await getMealPlan(week)
  return NextResponse.json(plan)
}

export async function POST(req: NextRequest) {
  const { week_start, meals } = await req.json()
  if (!week_start || !meals) return NextResponse.json({ error: "week_start and meals required" }, { status: 400 })

  const plan = await upsertMealPlan(week_start, meals)
  return NextResponse.json(plan)
}
