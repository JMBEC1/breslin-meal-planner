import { NextRequest, NextResponse } from "next/server"
import { deleteCheatMeal } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await deleteCheatMeal(Number(id))
  return NextResponse.json({ ok: true })
}
