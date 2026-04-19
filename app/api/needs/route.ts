import { NextRequest, NextResponse } from "next/server"
import { getNeeds, insertNeed, clearNeeds } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET() {
  const needs = await getNeeds()
  return NextResponse.json(needs)
}

export async function POST(req: NextRequest) {
  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 })
  const need = await insertNeed(name.trim())
  return NextResponse.json(need, { status: 201 })
}

export async function DELETE() {
  await clearNeeds()
  return NextResponse.json({ success: true })
}
