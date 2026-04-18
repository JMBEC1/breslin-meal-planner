import { NextRequest, NextResponse } from "next/server"
import { getStaples, upsertStaple } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET() {
  const staples = await getStaples()
  return NextResponse.json(staples)
}

export async function PUT(req: NextRequest) {
  const data = await req.json()
  await upsertStaple({
    id: data.id || undefined,
    name: data.name,
    aisle: data.aisle || "other",
    default_quantity: data.default_quantity || "1",
    default_unit: data.default_unit || "",
    active: data.active ?? true,
  })
  const staples = await getStaples()
  return NextResponse.json(staples)
}
