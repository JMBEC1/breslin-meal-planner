import Anthropic from "@anthropic-ai/sdk"

let _client: Anthropic | null = null

export function getAnthropicClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return _client
}

/**
 * Turn a thrown API error into something worth reading.
 *
 * Every AI route used to funnel all failures into one message about not being
 * able to parse the recipe. When the key was revoked, that is what the app
 * said — so a dead credential looked like a bad recipe page, and every
 * importer appeared broken in a way that sent you hunting through the parsing
 * code. A wrong key and an unreadable page are not the same problem and should
 * not read the same.
 *
 * Always logs the real cause; returns what the family should see.
 */
export function aiErrorMessage(err: unknown, fallback: string, where: string): string {
  console.error(`[${where}] AI call failed:`, err)

  if (err instanceof Anthropic.AuthenticationError) {
    return "Claude rejected the API key. Check ANTHROPIC_API_KEY in the Vercel project settings."
  }
  if (err instanceof Anthropic.PermissionDeniedError) {
    return "This Claude account can't use that model. Check the plan and the model name."
  }
  if (err instanceof Anthropic.RateLimitError) {
    return "Claude is rate limiting us. Wait a minute and try again."
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return "Couldn't reach Claude. Check your connection and try again."
  }
  if (err instanceof Anthropic.APIError) {
    return `Claude returned an error (${err.status}). ${fallback}`
  }
  return fallback
}
