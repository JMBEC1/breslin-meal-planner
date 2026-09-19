# Scran — project overview

_Context for anyone (or any session) picking this app up. Rewritten 2026-09-19 against the code on `feature/dinner-only-stripback`. It was last written in July and had drifted badly — it described five tabs, a Suggest page, a SQLite fallback and an older name, none of which are still true. Check the code before trusting any detail here; the app changes faster than its documentation._

---

## 1. What it is

A private family meal-planning web app for the Breslins — James, Laura, and their kids Jude and Etta. **Etta is coeliac, which is why gluten handling runs through everything.** The app plans **dinners for the week**, keeps a **recipe database the family rates**, and turns the week's plan into a **shopping list**.

- **Live:** https://breslin-meal-planner.vercel.app
- **Repo:** `JMBEC1/breslin-meal-planner` — **public**
- **App name is "Scran"** (the repo and URL still say breslin-meal-planner)
- **No login.** No auth, no middleware, no user model. Anyone with the URL has full read and write access, including the AI endpoints, which cost money to call. That is the accepted trade for a household app, but weigh it before adding anything that exposes more.

### The direction of travel is *fewer moving parts*

This app has been deliberately shrunk, repeatedly. School lunches: removed. Pantry/freezer/fridge inventory: removed. Internet and Mix recipe generation: removed. The Suggest tab: removed. A quantity-summing shopping list ("1.2kg + 0.6kg chicken"): removed, because recipe amounts are not reliable and you only need to know *what* to buy.

**When proposing changes, bias hard toward removal.** New complexity has to earn its place against a codebase whose recent history is almost entirely subtraction.

---

## 2. Stack

- **Next.js 15** (App Router) + **React 18** + **TypeScript**
- **Tailwind 3**, custom `meal-*` palette (`meal-sage`, `meal-coral`, `meal-plum`, `meal-charcoal`, `meal-warm`, `meal-muted`, `meal-card`, `meal-cream`)
- **Postgres on Neon only.** `lib/db.ts` talks to Neon and nothing else. There is no local fallback — a missing `DATABASE_URL` throws with an explanatory message rather than silently using an empty database. Tables self-create on first connection; **there is no migration system**, so a schema change means editing the `CREATE TABLE` statements in `lib/db.ts`.
- **AI:** `@anthropic-ai/sdk` — see §5
- **Images:** Vercel Blob for uploaded takeaway photos; curated Unsplash URLs for recipes
- **Env vars:** `DATABASE_URL`, `ANTHROPIC_API_KEY`, `BLOB_READ_WRITE_TOKEN`, and `SIRI_SHORTCUT_KEY` (see §7)

No test suite. Verification is `npx tsc --noEmit` and `npm run build`. **You cannot run the app meaningfully on a laptop** — there is no local database, so anything you change has to be checked on Vercel.

---

## 3. Pages

Four tabs (`components/Nav.tsx` — top bar on desktop, bottom tabs on mobile):

| Tab | Route | Purpose |
|---|---|---|
| **Plan** | `/` | The week's dinners. Today/Tomorrow hero cards, then a 7-day grid. |
| **Recipes** | `/recipes` | Browse and filter. Sub-routes: `/recipes/[id]`, `/recipes/new`, `/recipes/import`, `/recipes/tidy`. |
| **Shopping** | `/shopping` | List generated from the week, grouped by aisle, plus staples and "Things We Need". |
| **Favourites** | `/favourites` | Recipes ranked by family ratings. |

---

## 4. The planner (the core mechanic)

### What gets stored is deliberately simple

One row per week in `meal_plans`, keyed by `week_start`, whose `meals` column is a JSON array of **`MealSlot`**:

```ts
interface MealSlot {
  day: DayOfWeek            // "monday" … "sunday"
  meal_type: "dinner"       // dinners only
  recipe_id: number | null  // a saved recipe, OR…
  custom_text: string | null// …free text ("Takeaway: Sushi", "Leftovers: Curry", "Cheat meal")
  side_ids?: number[]       // optional combined sides
}
```

A slot is **either** a recipe **or** free text. That is the whole persisted shape.

### Rich controls in, flat slots out

`components/plan/DinnerGenerator.tsx` offers a per-day cycle — **Auto → Cheat → Takeaway → Skip** — plus a theme box. None of that is persisted. On apply it is flattened into `MealSlot`s: `cheat` becomes `custom_text: "Cheat meal"`, `takeaway` becomes `"Takeaway: <cuisine>"`, `skip` writes no slot, and `auto` consumes the next suggestion. A big meal (6+ servings) claims the **next auto day** as `"Leftovers: <dish>"` rather than displacing an override.

**Keep this boundary.** Expressive UI state, trivial stored shape. The generator's entire contract with the page is one callback: `onApply(meals)`.

### Generation is library-only

`POST /api/plan/generate-dinners` picks from **saved dinner recipes**, weighted by family enjoyment rating (unrated counts as 3), budgeting by serving-days so a big meal buys two nights. It makes **no AI call at all** unless a theme is typed in, in which case Haiku picks from the same saved list. It never invents recipes — the "internet" and "mix" modes are gone.

---

## 5. AI

`lib/anthropic.ts` is a lazy client singleton returning `null` when `ANTHROPIC_API_KEY` is unset.

| Route | Model | Purpose |
|---|---|---|
| `plan/generate-dinners` | `claude-haiku-4-5` | Filter saved recipes to a theme (only when one is given) |
| `recipes/import-url` | `claude-haiku-4-5` | Extract a recipe from a page |
| `recipes/tidy/suggest` | `claude-haiku-4-5` | Bulk-clean messy recipe titles |
| `recipes/import-image` | `claude-opus-5` | **Vision** — read a recipe from a photo |

**Every route uses structured outputs.** `client.messages.parse()` with `zodOutputFormat(schema)`, and `response.parsed_output` guarded for null. There is no fence-stripping, no `JSON.parse`, no "Return ONLY valid JSON" in any prompt — the schema states the shape and validates the reply. If you add an AI route, follow that; don't reintroduce hand-parsing.

Both importers share one schema and one prompt in **`lib/recipe-extraction.ts`**. The gluten rules live there once. That is the part that actually matters — a wrong title is an annoyance, a missed soy sauce is a sick child.

Model IDs are written without date suffixes (`claude-haiku-4-5`, not `claude-haiku-4-5-20251001`) so they follow the published model rather than pinning a snapshot that retires. That pinning is exactly how the photo importer sat broken for three months on a model that retired in June 2026.

---

## 6. Data model (`lib/db.ts`)

Seven tables, all auto-created, JSON columns stored as TEXT and parsed on read.

| Table | Notes |
|---|---|
| **recipes** | `title`, `slug` (unique), `category` (`dinner`/`fancy`/`side`), `is_gluten_free`, `ingredients` (JSON `Ingredient[]`), `instructions`, `tags`, `servings`, `source_url`, `image_url`, `times_planned` |
| **meal_plans** | `week_start` (unique), `meals` (JSON `MealSlot[]`) |
| **shopping_lists** | `meal_plan_id`, `items` — editable and persisted, so ticks survive a reload |
| **staples** | Recurring items always added to a shop. `frequency` increments on use, for sorting |
| **ratings** | `recipe_id` + `person`, `enjoyment` and `ease_of_cooking` 1–5, unique per pair. Family is `["James","Laura","Jude","Etta"]` |
| **needs** | "Things We Need" — ad-hoc additions, synced across devices |
| **takeaway_images** | Per-cuisine photo overrides, uploaded to Blob |

Types are in `types/index.ts`. `AisleCategory` is a fixed union of 13 supermarket aisles.

---

## 7. Other subsystems

- **Shopping (`lib/shopping.ts`).** Collects every ingredient across the week, dedupes by normalised name, records which recipes need each (shown as "×N recipes"), and assigns an aisle from a keyword table — no AI call. **Quantities are deliberately blank.**
- **Recipe images (`lib/images.ts`).** Keyword → Unsplash URL map, so a recipe gets a picture without storing a file.
- **Takeaway images (`lib/takeaway-images.ts`).** Per-cuisine backgrounds, family-overridable; old blobs are cleaned up on replace. Also the home of `TAKEAWAY_TYPES`.
- **`/api/siri`.** Nothing in the app calls this, and that is correct — it is an Apple Shortcut on the HomePod and kitchen iPad adding to "Things We Need" by voice. Guarded by `SIRI_SHORTCUT_KEY` and always returns 200, because Shortcuts won't speak a message from a non-2xx response. **Don't delete it for looking unused.**

---

## 8. Where the code is heavy

- **`app/page.tsx` — `PlanPageInner` is ~600 lines.** Down from 1,320: the dinner generator and slot picker are now `components/plan/`. What remains is the week's state, plan fetch/save, the hero cards and the day grid. The grid and hero cards are the obvious next extraction.
- **`MealHeroCard` is declared inside the render** of `PlanPageInner`, so it is a new component type on every render and remounts its subtree. Worth hoisting.
- **`app/shopping/page.tsx` is ~630 lines** and has had no equivalent tidy-up.

---

## 9. Conventions

- **Simplicity bias.** The recent history is removal. Match it.
- **Rich UI → flat slots.** Don't push override state into the persisted model.
- **Structured outputs for every AI call.** Schema first; no hand-parsed JSON.
- **Gluten is the safety-critical path.** Etta is coeliac. If a change touches ingredients, extraction or the GF flag, treat it as the important bit.
- **AU context.** Woolworths/Coles, `taste.com.au`, metric, Australian spelling.
- **No local database.** Anything you change is verified on Vercel, not on a laptop.
