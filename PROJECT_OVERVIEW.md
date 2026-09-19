# The Breslin Fork & Spoon — Project Overview

_A knowledge document for working on this app (e.g. as Claude Project context). Written 2026-07-25 from the current `feature/dinner-only-stripback` branch. Verify against the code before treating any detail as fixed — the app is actively changing._

---

## 1. What it is

**The Breslin Fork & Spoon** is a private family meal-planning web app for the Breslin family (James, Laura, and their kids Jude and Etta — Etta is gluten-free, which shapes a lot of the logic). It plans **dinners for the week**, keeps a **recipe database** the family rates, and turns the week's plan into a **shopping list**.

- **Live URL:** https://breslin-meal-planner.vercel.app
- **Repo:** github.com/JMBEC1/breslin-meal-planner
- **Hosting:** Vercel (JMBEC1 GitHub / jmbec1 Vercel account)
- **No login.** There is no authentication, middleware, or user model — anyone with the URL has full access. It's a single-household app secured only by the URL being unguessable/unshared. (This matters for any feature that would expose or write data.)

### Product philosophy (important context for changes)

The app has recently been **deliberately stripped back to dinners only**. Earlier versions also did school lunches and a full pantry/freezer/fridge inventory system; those were **removed** on purpose to keep it simple. When proposing features, bias toward simplicity — the recent direction is _fewer moving parts_, not more. Two concrete examples of that philosophy already in the code:

- The shopping list **does not sum ingredient quantities** ("1.2kg + 0.6kg chicken"). Recipe amounts aren't reliable or useful for a shop — you just need to know _what_ to buy. It dedupes by ingredient name and shows "×N recipes" when several dishes need the same thing.
- Meal generation collapses a rich set of per-day controls down into a **single flat list of meal slots** (see §4).

---

## 2. Tech stack

- **Next.js 15** (App Router) + **React 18** + **TypeScript**
- **Tailwind CSS 3** — custom "meal-*" colour palette (`meal-sage`, `meal-coral`, `meal-plum`, `meal-charcoal`, `meal-warm`, `meal-muted`)
- **Database:** dual-mode via a single `lib/db.ts` —
  - **Neon Postgres** in production (when `DATABASE_URL` is set) — same Neon instance as the JMBEC intranet, different tables
  - **better-sqlite3** locally (`data/meals.db`) when `DATABASE_URL` is unset
  - Every query is written twice (a Neon branch and a sqlite branch) and must stay in parity. Tables are auto-created on first connection (`CREATE TABLE IF NOT EXISTS`) — there is **no migration flag or migration system**; schema changes happen by editing the `CREATE TABLE` blocks in `lib/db.ts`.
- **AI:** Anthropic SDK (`@anthropic-ai/sdk`) — see §5
- **Image hosting:** Vercel Blob (`@vercel/blob`) for user-uploaded takeaway photos; curated Unsplash URLs for recipe images
- **Env vars (only three):** `DATABASE_URL`, `ANTHROPIC_API_KEY`, `BLOB_READ_WRITE_TOKEN`

There is no test suite and no CI beyond Vercel's build.

---

## 3. Pages (navigation)

Five tabs (`components/Nav.tsx` — top bar on desktop, bottom tab bar on mobile):

| Tab | Route | Purpose |
|---|---|---|
| **Plan** | `/` | The week's dinner plan. Today/Tomorrow hero cards + a 7-day grid. This is the app's home and its largest file (`app/page.tsx`, ~1300 lines). |
| **Recipes** | `/recipes` | Recipe database — browse, filter (GF badge, category), open a recipe. Sub-routes: `/recipes/[id]` (detail + ratings), `/recipes/new` (manual add), `/recipes/import` (URL/photo import), `/recipes/tidy` (bulk AI title cleanup). |
| **Shopping** | `/shopping` | Shopping list generated from the week's plan, grouped by supermarket aisle, plus "staples" and a "Things We Need" list. Copy-to-clipboard and Woolworths/Coles links. |
| **Favourites** | `/favourites` | Recipes ranked by family ratings. |
| **Suggest** | `/suggestions` | AI meal suggestions / inspiration. |

---

## 4. How the weekly planner works (the core mechanic)

This is the most important thing to understand before changing the planner.

### The persisted model is deliberately simple

A meal plan is one row per week (`meal_plans`, keyed by `week_start`), whose `meals` column is a JSON array of **`MealSlot`** objects:

```ts
interface MealSlot {
  day: DayOfWeek            // "monday" … "sunday"
  meal_type: "dinner"       // only dinners now
  recipe_id: number | null  // a saved recipe, OR…
  custom_text: string | null// …free text ("Takeaway: Sushi", "Leftovers: Curry", "Cheat meal")
  side_ids?: number[]       // optional combined sides (e.g. pork chops + salad)
}
```

That's the whole persisted shape. A slot is **either** a real recipe (`recipe_id`) **or** a free-text note (`custom_text`).

### Per-day overrides are a generation-time control, not stored state

On the Plan page, each day has an override cycle: **Auto → Cheat → Takeaway → Skip** (`DayOverride` type in `app/page.tsx`). These live in React state only. When the user hits "generate", the overrides are **materialised into `MealSlot`s**:

- `auto` → consumes the next AI-suggested dinner (a real `recipe_id`, or new recipe text)
- `cheat` → a `custom_text: "Cheat meal"` slot
- `takeaway` → a `custom_text: "Takeaway: <cuisine>"` slot (cuisine chosen per day: Sushi/Pizza/Thai/Indian/Burgers/Other)
- `skip` → no slot for that day
- **Leftovers:** a big meal (6+ servings) claims the _next auto day_ as `custom_text: "Leftovers: <dish>"` rather than displacing an override.

So the override UI is expressive, but what lands in the database is always just the flat `MealSlot` list. This keeps the data model trivial while the UI stays rich. **When editing generation, preserve this "rich control → flat slots" boundary.**

### Generation endpoint

`POST /api/plan/generate-dinners` (`mode: "stored" | "internet" | "mix"`, optional `inspiration` theme, `targetCount`, `swapIndex` for single-meal swaps, `excludeTitles`):

- **`stored`** — picks from saved dinner recipes, weighted by family enjoyment rating (unrated = 3). No AI call unless an `inspiration` theme is given (then Haiku filters the list to the theme). Big meals count as 2 serving-days.
- **`internet`** — Haiku suggests brand-new recipes from well-known sources (RecipeTin Eats, Donna Hay, Taste.com.au…), GF-preferred.
- **`mix`** — roughly half stored, half new.

The AI returns strict JSON (`{ "dinners": [...] }`); the code strips markdown fences (`cleanJson`) and `JSON.parse`s it.

---

## 5. AI usage

All AI goes through `lib/anthropic.ts` — a lazy Anthropic client singleton (`getAnthropicClient()`, returns `null` if `ANTHROPIC_API_KEY` is unset) plus a `cleanJson()` helper that strips ```` ```json ```` fences before `JSON.parse`.

**Models in use (as of this writing):**

| Route | Model | Purpose |
|---|---|---|
| `plan/generate-dinners`, `plan/generate`, `plan/fix-custom-text`, `plan/context`, `suggest`, `recipes/import-url`, `recipes/tidy/suggest` | `claude-haiku-4-5-20251001` | All text: dinner suggestions, theme filtering, recipe extraction from a URL, bulk title tidy, meal suggestions. |
| `recipes/import-image` | `claude-sonnet-4-20250514` | **Vision** — read a recipe from a photo (Claude Vision). |

The pattern throughout: one `client.messages.create` call, a prompt that ends with "Return ONLY valid JSON (no markdown fences)" and an inline example shape, then `JSON.parse(cleanJson(...))` with a try/catch fallback.

### AI improvement opportunities (flagged, not yet done)

- **The vision model `claude-sonnet-4-20250514` is deprecated** (Claude Sonnet 4, scheduled to retire 2026-06-15). It should be migrated to a current vision-capable model (`claude-sonnet-5`). The text model `claude-haiku-4-5` is current and fine.
- **Fragile JSON handling.** Every AI route hand-parses JSON with `cleanJson` + `JSON.parse` + a try/catch. The Anthropic API now supports **structured outputs** (`output_config.format` with a JSON schema) which would remove the fence-stripping and parse-failure paths entirely. This is the single highest-leverage reliability improvement for the AI features.
- The SDK is pinned at `^0.86.1` — recent enough for structured outputs, but confirm before relying on newer helpers.

---

## 6. Data model (`lib/db.ts`)

Seven tables, all auto-created. JSON-typed columns are stored as TEXT and parsed on read.

| Table | Key columns | Notes |
|---|---|---|
| **recipes** | `title`, `slug` (unique), `category` (`dinner`/`fancy`/`side`), `is_gluten_free`, `ingredients` (JSON array of `Ingredient`), `instructions`, `tags` (JSON), `servings`, `source_url`, `image_url`, `times_planned` | The recipe database. `Ingredient` = `{name, quantity, unit, aisle, is_gluten_free}`. |
| **meal_plans** | `week_start` (unique), `meals` (JSON array of `MealSlot`) | One row per week. |
| **shopping_lists** | `meal_plan_id`, `items` (JSON array of `ShoppingItem`) | Generated list, editable + persisted (checkboxes survive reloads). |
| **staples** | `name`, `aisle`, `default_quantity`, `default_unit`, `frequency`, `active` | Recurring items always added to a shop (milk, bread…). `frequency` increments on use for sorting. |
| **ratings** | `recipe_id`, `person`, `enjoyment` (1–5), `ease_of_cooking` (1–5), unique(`recipe_id`,`person`) | Per-family-member ratings. Family = `["James","Laura","Jude","Etta"]`. |
| **needs** | `name`, `added_at` | "Things We Need" — ad-hoc shopping additions, syncs across devices. |
| **takeaway_images** | `type` (PK, cuisine), `image_url` | Per-cuisine photo overrides for takeaway slots (uploaded to Vercel Blob). |

Types live in `types/index.ts` (`Recipe`, `Ingredient`, `MealSlot`, `ShoppingItem`, `Staple`, `Rating`, `AisleCategory`, `FAMILY_MEMBERS`, etc.). `AisleCategory` is a fixed union of 13 supermarket aisles with display labels.

---

## 7. Other subsystems

- **Shopping aggregation (`lib/shopping.ts`).** `aggregateIngredients()` collects every ingredient across the week's recipes, dedupes by normalised name, records which recipes need each (`from_recipe_ids`), and assigns an aisle. `categoriseIngredient()` maps a name to an aisle via a large built-in keyword table (`AISLE_MAP`) — no AI call for aisle assignment. Quantities are deliberately blank (see §1).
- **Recipe images (`lib/images.ts`).** A curated keyword→Unsplash-URL map (80+ entries) gives recipes an image without storing files. `ImagePickerModal` lets you change a recipe's image.
- **Takeaway images (`lib/takeaway-images.ts` + `/api/takeaway-images`).** Per-cuisine background photos for takeaway meal slots. Defaults are curated; the family can upload their own photo per cuisine (stored in Vercel Blob, override recorded in the `takeaway_images` table). `TakeawayPhotosModal` manages these; old blobs are cleaned up on replace/delete to avoid orphans.
- **Recipe import.** `/recipes/import` → `POST /api/recipes/import-url` (fetches a page, grabs `og:image`, Haiku extracts the recipe) or `POST /api/recipes/import-image` (Claude Vision reads a photo). `/recipes/tidy` bulk-cleans messy recipe titles via `POST /api/recipes/tidy/suggest` with an inline review screen.
- **Ratings** drive both the Favourites page and the weighting in `stored`-mode generation.

---

## 8. Current state (as of 2026-07-25)

- **Branch:** `feature/dinner-only-stripback`. Last commit 2026-06-21. This branch carries the whole dinner-only rework plus takeaway slots and the Auto/Cheat/Takeaway/Skip per-day overrides.
- **Uncommitted WIP** on `app/shopping/page.tsx` + `lib/shopping.ts`: the shopping simplification described in §1 (drop fabricated quantities, dedupe by name, "×N recipes" badge, single "Copy list" button). It typechecks clean and looks finished — it just hasn't been committed.
- **How to verify locally:** `npx tsc --noEmit` and `npm run build` both run (Node + node_modules present). No `DATABASE_URL` locally, so DB-backed behaviour only runs on the Vercel deploy — the same "preview on Vercel" model as the JMBEC intranet.

---

## 9. Improvement backlog / ideas (starting points, not commitments)

Grouped by theme, for a "how could we improve this?" conversation:

**Reliability**
- Migrate the deprecated vision model (`claude-sonnet-4-20250514` → `claude-sonnet-5`).
- Replace hand-rolled `cleanJson`+`JSON.parse` with structured outputs across all AI routes.
- `stored`-mode generation shuffles with `Array.sort(() => Math.random() - 0.5)` — a biased shuffle; a proper Fisher–Yates would be fairer (minor).

**Product**
- The plan is dinner-only and single-week. A "next week" / multi-week view, or a "regenerate just the rest of the week" action, could help.
- Recipe deduplication / merge (the tidy screen handles titles, not duplicate recipes).
- Nothing surfaces _why_ a recipe was suggested; showing the rating or "you haven't had this in a while" could make suggestions feel smarter (`times_planned` is tracked but underused).

**Foundational (discuss before doing)**
- **No auth.** Fine for a private family app, but any feature that makes data more exposed should reckon with the fact that the URL is the only protection.
- **No migration system.** Schema changes mean editing `CREATE TABLE` blocks in both DB branches. A heavier data model would benefit from real migrations, but that's a big step away from the current simplicity.

---

## 10. Conventions to respect

- **Dual DB parity:** every DB function has a Neon branch and a sqlite branch — change both, keep them identical in behaviour.
- **Rich UI → flat slots:** the planner's expressiveness lives in React state and is flattened to `MealSlot`s at generation time; don't push override state into the persisted model without good reason.
- **Simplicity bias:** the recent direction removed features (lunches, inventory) to simplify. New complexity should earn its place.
- **AU context:** it's an Australian family (Woolworths/Coles, `taste.com.au`), GF-aware because of Etta.
- **AI prompts** end with an explicit "Return ONLY valid JSON" instruction and an inline example shape; if you keep that pattern, match it — but prefer structured outputs.
