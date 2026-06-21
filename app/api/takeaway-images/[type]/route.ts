import { NextRequest, NextResponse } from "next/server"
import { put, del } from "@vercel/blob"
import { setTakeawayImageOverride, deleteTakeawayImageOverride } from "@/lib/db"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 30

const ALLOWED_TYPES = new Set(["sushi", "pizza", "thai", "indian", "burgers", "other"])
// Vercel functions cap request bodies at ~4.5MB (Hobby/Pro). Stay safely under
// so the friendly error message reaches the user instead of a platform 413.
const MAX_BYTES = 4 * 1024 * 1024 // 4MB

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

  const previousUrl = await setTakeawayImageOverride(type, blob.url)
  // Free the previous Blob if we replaced one. Wrapped in try/catch — an
  // orphan blob is recoverable later, but a failed del() shouldn't 500 the
  // upload the user just successfully made.
  if (previousUrl && previousUrl !== blob.url) {
    try { await del(previousUrl) } catch { /* orphan, manual cleanup if needed */ }
  }
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
  const previousUrl = await deleteTakeawayImageOverride(type)
  if (previousUrl) {
    try { await del(previousUrl) } catch { /* orphan */ }
  }
  return NextResponse.json({ type, cleared: true })
}
