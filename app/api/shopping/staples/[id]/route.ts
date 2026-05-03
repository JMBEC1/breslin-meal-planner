import { NextResponse } from "next/server"
import { deleteStaple } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const stapleId = Number(id)
  if (!Number.isFinite(stapleId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }
  await deleteStaple(stapleId)
  return NextResponse.json({ ok: true })
}
