import { NextRequest, NextResponse } from "next/server"
import { put } from "@vercel/blob"
import { setTakeawayImageOverride, deleteTakeawayImageOverride } from "@/lib/db"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 30

const ALLOWED_TYPES = new Set(["sushi", "pizza", "thai", "indian", "burgers", "other"])
const MAX_BYTES = 5 * 1024 * 1024 // 5MB

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ type: string }> },
) {
  const { type: rawType } = await params
  const type = rawType.toLowerCase()
  if (!ALLOWED_TYPES.has(type)) {
    return NextResponse.json({ error: "unknown_type" }, { status: 400 })
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "blob_not_configured", message: "BLOB_READ_WRITE_TOKEN missing — create a Blob store in Vercel project settings." },
      { status: 503 },
    )
  }

  const form = await req.formData()
  const file = form.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "no_file" }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file_too_large", maxBytes: MAX_BYTES }, { status: 413 })
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "not_an_image" }, { status: 400 })
  }

  // Pathname includes a timestamp to bust caches when the user replaces a photo.
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "")
  const pathname = `takeaway/${type}-${Date.now()}.${ext || "jpg"}`

  const blob = await put(pathname, file, {
    access: "public",
    contentType: file.type,
  })

  await setTakeawayImageOverride(type, blob.url)
  return NextResponse.json({ type, url: blob.url })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ type: string }> },
) {
  const { type: rawType } = await params
  const type = rawType.toLowerCase()
  if (!ALLOWED_TYPES.has(type)) {
    return NextResponse.json({ error: "unknown_type" }, { status: 400 })
  }
  await deleteTakeawayImageOverride(type)
  return NextResponse.json({ type, cleared: true })
}
