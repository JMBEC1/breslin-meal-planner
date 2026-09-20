/**
 * Shrink a photo in the browser before it is uploaded.
 *
 * A photo straight off an iPhone is routinely 3-8MB, and Vercel caps request
 * bodies at about 4.5MB — so without this, "take a photo" fails on most real
 * photos and succeeds on screenshots, which is a baffling way for a feature to
 * behave. Recipe cards are never displayed larger than a phone screen, so the
 * long edge is capped and the rest is thrown away.
 *
 * `imageOrientation: "from-image"` matters: iPhones record orientation in EXIF
 * rather than rotating the pixels, so without it a portrait photo uploads
 * sideways.
 */
export async function downscaleImage(file: File, maxEdge = 1600): Promise<File> {
  if (!file.type.startsWith("image/")) return file

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
    const longest = Math.max(bitmap.width, bitmap.height)
    const scale = Math.min(1, maxEdge / longest)

    // Already small enough in both senses — don't re-encode for nothing.
    if (scale === 1 && file.size <= 3_000_000) {
      bitmap.close()
      return file
    }

    const canvas = document.createElement("canvas")
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext("2d")
    if (!ctx) { bitmap.close(); return file }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    )
    if (!blob) return file

    const name = file.name.replace(/\.[^.]+$/, "") || "photo"
    return new File([blob], `${name}.jpg`, { type: "image/jpeg" })
  } catch {
    // Any browser that can't do this gets to try the original; the route will
    // reject it politely if it's too big.
    return file
  }
}
