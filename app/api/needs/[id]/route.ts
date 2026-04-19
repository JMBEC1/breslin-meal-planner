import { NextRequest, NextResponse } from "next/server"
import { deleteNeed } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const deleted = await deleteNeed(Number(id))
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ success: true })
}
