import { NextRequest, NextResponse } from "next/server"
import { put, del } from "@vercel/blob"
import { getRecipe, updateRecipe } from "@/lib/db"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 30

// Vercel caps request bodies at ~4.5MB, so stay under it and return a message
// the family can read rather than a platform 413. Phone photos routinely
// exceed this — the picker downscales before it uploads.
const MAX_BYTES = 4 * 1024 * 1024

/** Our own uploads live in the Blob store; Unsplash suggestions don't. */
const isOurBlob = (url: string | null) => Boolean(url && url.includes(".blob.vercel-storage.com"))

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params
  const id = Number(rawId)
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Bad recipe id." }, { status: 400 })
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Photo storage isn't set up — BLOB_READ_WRITE_TOKEN is missing in Vercel." },
      { status: 503 },
    )
  }

  const recipe = await getRecipe(id)
  if (!recipe) return NextResponse.json({ error: "No such recipe." }, { status: 404 })

  // A request with no multipart body makes formData() throw; that is a bad
  // request, not a server fault.
  const form = await req.formData().catch(() => null)
  const file = form?.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No photo was sent." }, { status: 400 })
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "That isn't an image." }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "That photo is too big — try a smaller one." }, { status: 413 })
  }

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg"
  const blob = await put(`recipes/${id}-${Date.now()}.${ext}`, file, {
    access: "public",
    contentType: file.type,
  })

  const previous = recipe.image_url
  const updated = await updateRecipe(id, { image_url: blob.url })

  // Only bin the old file if it was one of ours. A curated Unsplash URL isn't
  // ours to delete, and other recipes may be using the same one.
  if (isOurBlob(previous) && previous !== blob.url) {
    try { await del(previous as string) } catch { /* orphan; harmless */ }
  }

  return NextResponse.json(updated)
}
