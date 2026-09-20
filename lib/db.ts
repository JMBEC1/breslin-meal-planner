/**
 * Postgres on Neon, and only Neon.
 *
 * Every function here used to be written twice — a Neon arm and a SQLite arm —
 * with a rule that the two had to be kept identical by hand. They were not
 * identical: the SQLite arms ran only when DATABASE_URL was unset, so they were
 * the ones nobody exercised and nobody noticed drifting.
 *
 * Local development points at a Neon branch instead. Tables self-create on the
 * first connection; there is no migration system, so a schema change means
 * editing the CREATE TABLE statements below.
 */
// ── Neon (Vercel) ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _neon: any = null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getNeon(): Promise<any> {
  if (_neon) return _neon
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set. This app talks to Neon and has no local fallback — " +
      "point it at a Neon branch before running it.",
    )
  }
  const { neon } = await import("@neondatabase/serverless")
  const sql = neon(process.env.DATABASE_URL)
  await sql`
    CREATE TABLE IF NOT EXISTS recipes (
      id              SERIAL PRIMARY KEY,
      title           TEXT NOT NULL,
      slug            TEXT UNIQUE NOT NULL,
      category        TEXT NOT NULL DEFAULT 'main',
      is_gluten_free  INT  NOT NULL DEFAULT 1,
      prep_time_mins  INT  DEFAULT NULL,
      cook_time_mins  INT  DEFAULT NULL,
      servings        INT  DEFAULT NULL,
      description     TEXT NOT NULL DEFAULT '',
      ingredients     TEXT NOT NULL DEFAULT '[]',
      instructions    TEXT NOT NULL DEFAULT '',
      tags            TEXT NOT NULL DEFAULT '[]',
      source_url      TEXT DEFAULT NULL,
      image_url       TEXT DEFAULT NULL,
      notes           TEXT DEFAULT NULL,
      times_planned   INT  NOT NULL DEFAULT 0,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS meal_plans (
      id              SERIAL PRIMARY KEY,
      week_start      TEXT UNIQUE NOT NULL,
      meals           TEXT NOT NULL DEFAULT '[]',
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS shopping_lists (
      id              SERIAL PRIMARY KEY,
      meal_plan_id    INT  NOT NULL,
      items           TEXT NOT NULL DEFAULT '[]',
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS staples (
      id              SERIAL PRIMARY KEY,
      name            TEXT NOT NULL,
      aisle           TEXT NOT NULL DEFAULT 'other',
      default_quantity TEXT NOT NULL DEFAULT '1',
      default_unit    TEXT NOT NULL DEFAULT '',
      frequency       INT  NOT NULL DEFAULT 0,
      active          INT  NOT NULL DEFAULT 1,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS ratings (
      id              SERIAL PRIMARY KEY,
      recipe_id       INT  NOT NULL,
      person          TEXT NOT NULL,
      enjoyment       INT  NOT NULL DEFAULT 0,
      ease_of_cooking INT  NOT NULL DEFAULT 0,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(recipe_id, person)
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS needs (
      id              SERIAL PRIMARY KEY,
      name            TEXT NOT NULL,
      added_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS takeaway_images (
      type            TEXT PRIMARY KEY,
      image_url       TEXT NOT NULL,
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  _neon = sql
  return sql
}

// ── Exported helpers ───────────────────────────────────────────────────────

// ── Recipes ────────────────────────────────────────────────────────────────

interface RecipeRow {
  id: number; title: string; slug: string; category: string
  is_gluten_free: number; prep_time_mins: number | null
  cook_time_mins: number | null; servings: number | null
  description: string; ingredients: string; instructions: string
  tags: string; source_url: string | null; image_url: string | null
  notes: string | null; times_planned: number
  created_at: string; updated_at: string
}

function parseRecipe(row: RecipeRow) {
  return {
    ...row,
    is_gluten_free: !!row.is_gluten_free,
    ingredients: JSON.parse(row.ingredients || "[]"),
    tags: JSON.parse(row.tags || "[]"),
  }
}

/**
 * `category` is the course; `cuisine` matches against tags.
 *
 * "main" is expressed as "not one of the other courses" rather than
 * category = 'main', so recipes still carrying the pre-course values
 * ("dinner", "fancy") are treated as mains until they are re-filed.
 */
export async function getRecipes(
  category?: string,
  gfOnly?: boolean,
  cuisine?: string,
) {
  const sql = await getNeon()
  // "main" is expressed as "not one of the other courses" so recipes still
  // carrying the pre-course values ("dinner", "fancy") count as mains until
  // they are re-filed. Branches are spelled out rather than parameterised —
  // a boolean flag interpolated into a comparison is the kind of thing that
  // works until the driver sends it as a string.
  const mains = category === "main"
  let rows
  if (mains && gfOnly) {
    rows = await sql`SELECT * FROM recipes WHERE category NOT IN ('salad','side','takeaway') AND is_gluten_free = 1 ORDER BY title ASC`
  } else if (mains) {
    rows = await sql`SELECT * FROM recipes WHERE category NOT IN ('salad','side','takeaway') ORDER BY title ASC`
  } else if (category && gfOnly) {
    rows = await sql`SELECT * FROM recipes WHERE category = ${category} AND is_gluten_free = 1 ORDER BY title ASC`
  } else if (category) {
    rows = await sql`SELECT * FROM recipes WHERE category = ${category} ORDER BY title ASC`
  } else if (gfOnly) {
    rows = await sql`SELECT * FROM recipes WHERE is_gluten_free = 1 ORDER BY title ASC`
  } else {
    rows = await sql`SELECT * FROM recipes ORDER BY title ASC`
  }

  const parsed = (rows as RecipeRow[]).map(parseRecipe)
  if (!cuisine) return parsed
  // Cuisine matching happens here, not in SQL: tags are a JSON string column
  // and the family writes them in whatever case they like.
  const want = cuisine.toLowerCase()
  return parsed.filter((r) => (r.tags ?? []).some((t: string) => t.toLowerCase() === want))
}

export async function getRecipe(id: number) {
  const sql = await getNeon()
  const rows = await sql`SELECT * FROM recipes WHERE id = ${id} LIMIT 1`
  return rows.length ? parseRecipe(rows[0] as RecipeRow) : null
}

function makeSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
}

export async function insertRecipe(data: {
  title: string; category: string; is_gluten_free: boolean
  prep_time_mins?: number | null; cook_time_mins?: number | null
  servings?: number | null; description: string
  ingredients: unknown[]; instructions: string; tags: string[]
  source_url?: string | null; image_url?: string | null; notes?: string | null
}) {
  const slug = makeSlug(data.title)
  const ingredients = JSON.stringify(data.ingredients)
  const tags = JSON.stringify(data.tags)
  const gf = data.is_gluten_free ? 1 : 0

  const sql = await getNeon()
  const rows = await sql`
    INSERT INTO recipes (title, slug, category, is_gluten_free, prep_time_mins, cook_time_mins,
      servings, description, ingredients, instructions, tags, source_url, image_url, notes)
    VALUES (${data.title}, ${slug}, ${data.category}, ${gf},
      ${data.prep_time_mins ?? null}, ${data.cook_time_mins ?? null}, ${data.servings ?? null},
      ${data.description}, ${ingredients}, ${data.instructions}, ${tags},
      ${data.source_url ?? null}, ${data.image_url ?? null}, ${data.notes ?? null})
    RETURNING *
  `
  return parseRecipe(rows[0] as RecipeRow)
}

export async function updateRecipe(id: number, data: {
  title?: string; category?: string; is_gluten_free?: boolean
  prep_time_mins?: number | null; cook_time_mins?: number | null
  servings?: number | null; description?: string
  ingredients?: unknown[]; instructions?: string; tags?: string[]
  source_url?: string | null; image_url?: string | null; notes?: string | null
}) {
  const sql = await getNeon()
  const current = await sql`SELECT * FROM recipes WHERE id = ${id} LIMIT 1`
  if (!current.length) return null
  const row = current[0] as RecipeRow
  const updated = {
    title: data.title ?? row.title,
    slug: data.title ? makeSlug(data.title) : row.slug,
    category: data.category ?? row.category,
    is_gluten_free: data.is_gluten_free !== undefined ? (data.is_gluten_free ? 1 : 0) : row.is_gluten_free,
    prep_time_mins: data.prep_time_mins !== undefined ? data.prep_time_mins : row.prep_time_mins,
    cook_time_mins: data.cook_time_mins !== undefined ? data.cook_time_mins : row.cook_time_mins,
    servings: data.servings !== undefined ? data.servings : row.servings,
    description: data.description ?? row.description,
    ingredients: data.ingredients ? JSON.stringify(data.ingredients) : row.ingredients,
    instructions: data.instructions ?? row.instructions,
    tags: data.tags ? JSON.stringify(data.tags) : row.tags,
    source_url: data.source_url !== undefined ? data.source_url : row.source_url,
    image_url: data.image_url !== undefined ? data.image_url : row.image_url,
    notes: data.notes !== undefined ? data.notes : row.notes,
  }
  const rows = await sql`
    UPDATE recipes SET
      title = ${updated.title}, slug = ${updated.slug}, category = ${updated.category},
      is_gluten_free = ${updated.is_gluten_free}, prep_time_mins = ${updated.prep_time_mins},
      cook_time_mins = ${updated.cook_time_mins}, servings = ${updated.servings},
      description = ${updated.description}, ingredients = ${updated.ingredients},
      instructions = ${updated.instructions}, tags = ${updated.tags},
      source_url = ${updated.source_url}, image_url = ${updated.image_url},
      notes = ${updated.notes}, updated_at = NOW()
    WHERE id = ${id} RETURNING *
  `
  return parseRecipe(rows[0] as RecipeRow)
}

export async function deleteRecipe(id: number): Promise<boolean> {
  const sql = await getNeon()
  const rows = await sql`DELETE FROM recipes WHERE id = ${id} RETURNING id`
  return rows.length > 0
}

// ── Meal Plans ─────────────────────────────────────────────────────────────

interface MealPlanRow {
  id: number; week_start: string; meals: string
  created_at: string; updated_at: string
}

function parsePlan(row: MealPlanRow) {
  return { ...row, meals: JSON.parse(row.meals || "[]") }
}

export async function getMealPlan(weekStart: string) {
  const sql = await getNeon()
  const rows = await sql`SELECT * FROM meal_plans WHERE week_start = ${weekStart} LIMIT 1`
  return rows.length ? parsePlan(rows[0] as MealPlanRow) : null
}

export async function upsertMealPlan(weekStart: string, meals: unknown[]) {
  const mealsJson = JSON.stringify(meals)
  const sql = await getNeon()
  const rows = await sql`
    INSERT INTO meal_plans (week_start, meals)
    VALUES (${weekStart}, ${mealsJson})
    ON CONFLICT (week_start) DO UPDATE SET meals = EXCLUDED.meals, updated_at = NOW()
    RETURNING *
  `
  return parsePlan(rows[0] as MealPlanRow)
}

// ── Shopping Lists ─────────────────────────────────────────────────────────

interface ShoppingListRow {
  id: number; meal_plan_id: number; items: string
  created_at: string; updated_at: string
}

function parseShoppingList(row: ShoppingListRow) {
  return { ...row, items: JSON.parse(row.items || "[]") }
}

export async function getShoppingList(mealPlanId: number) {
  const sql = await getNeon()
  const rows = await sql`SELECT * FROM shopping_lists WHERE meal_plan_id = ${mealPlanId} ORDER BY id DESC LIMIT 1`
  return rows.length ? parseShoppingList(rows[0] as ShoppingListRow) : null
}

export async function upsertShoppingList(mealPlanId: number, items: unknown[]) {
  const itemsJson = JSON.stringify(items)
  const sql = await getNeon()
  const existing = await sql`SELECT id FROM shopping_lists WHERE meal_plan_id = ${mealPlanId} LIMIT 1`
  if (existing.length) {
    const rows = await sql`
      UPDATE shopping_lists SET items = ${itemsJson}, updated_at = NOW()
      WHERE meal_plan_id = ${mealPlanId} RETURNING *
    `
    return parseShoppingList(rows[0] as ShoppingListRow)
  }
  const rows = await sql`
    INSERT INTO shopping_lists (meal_plan_id, items) VALUES (${mealPlanId}, ${itemsJson}) RETURNING *
  `
  return parseShoppingList(rows[0] as ShoppingListRow)
}

// ── Staples ────────────────────────────────────────────────────────────────

interface StapleRow {
  id: number; name: string; aisle: string; default_quantity: string
  default_unit: string; frequency: number; active: number; created_at: string
}

function parseStaple(row: StapleRow) {
  return { ...row, active: !!row.active }
}

export async function getStaples() {
  const sql = await getNeon()
  const rows = await sql`SELECT * FROM staples ORDER BY frequency DESC, name ASC`
  return (rows as StapleRow[]).map(parseStaple)
}

export async function upsertStaple(data: {
  id?: number; name: string; aisle: string
  default_quantity: string; default_unit: string; active: boolean
}) {
  if (data.id) {
    const sql = await getNeon()
    await sql`
      UPDATE staples SET name = ${data.name}, aisle = ${data.aisle},
        default_quantity = ${data.default_quantity}, default_unit = ${data.default_unit},
        active = ${data.active ? 1 : 0}
      WHERE id = ${data.id}
    `
  } else {
    const sql = await getNeon()
    await sql`
      INSERT INTO staples (name, aisle, default_quantity, default_unit, active)
      VALUES (${data.name}, ${data.aisle}, ${data.default_quantity}, ${data.default_unit}, ${data.active ? 1 : 0})
    `
  }
}

export async function deleteStaple(id: number) {
  const sql = await getNeon()
  await sql`DELETE FROM staples WHERE id = ${id}`
  return
}

export async function incrementStapleFrequency(name: string) {
  const sql = await getNeon()
  await sql`UPDATE staples SET frequency = frequency + 1 WHERE name = ${name}`
}

// ── Ratings ───────────────────────────────────────────────────────────────

interface RatingRow {
  id: number; recipe_id: number; person: string
  enjoyment: number; ease_of_cooking: number; created_at: string
}

export async function getRatings(recipeId: number): Promise<RatingRow[]> {
  const sql = await getNeon()
  return await sql`SELECT * FROM ratings WHERE recipe_id = ${recipeId}` as RatingRow[]
}

export async function getAllRatings(): Promise<RatingRow[]> {
  const sql = await getNeon()
  return await sql`SELECT * FROM ratings` as RatingRow[]
}

export async function upsertRating(recipeId: number, person: string, enjoyment: number, easeOfCooking: number) {
  const sql = await getNeon()
  await sql`
    INSERT INTO ratings (recipe_id, person, enjoyment, ease_of_cooking)
    VALUES (${recipeId}, ${person}, ${enjoyment}, ${easeOfCooking})
    ON CONFLICT (recipe_id, person) DO UPDATE SET
      enjoyment = EXCLUDED.enjoyment, ease_of_cooking = EXCLUDED.ease_of_cooking
  `
  return getRatings(recipeId)
}

// ── Needs (Things We Need) ────────────────────────────────────────────

interface NeedRow { id: number; name: string; added_at: string }

export async function getNeeds(): Promise<NeedRow[]> {
  const sql = await getNeon()
  return await sql`SELECT * FROM needs ORDER BY added_at DESC` as NeedRow[]
}

export async function insertNeed(name: string) {
  const sql = await getNeon()
  const rows = await sql`INSERT INTO needs (name) VALUES (${name}) RETURNING *`
  return rows[0] as NeedRow
}

export async function deleteNeed(id: number): Promise<boolean> {
  const sql = await getNeon()
  const rows = await sql`DELETE FROM needs WHERE id = ${id} RETURNING id`
  return rows.length > 0
}

export async function clearNeeds(): Promise<void> {
  const sql = await getNeon()
  await sql`DELETE FROM needs`
}

// ── Takeaway photos ────────────────────────────────────────────────────────

interface TakeawayImageRow { type: string; image_url: string; updated_at: string }

export async function getTakeawayImageOverrides(): Promise<Record<string, string>> {
  const sql = await getNeon()
  const rows = await sql`SELECT type, image_url FROM takeaway_images` as TakeawayImageRow[]
  return Object.fromEntries(rows.map((r) => [r.type, r.image_url]))
}

// Returns the PREVIOUS image_url (or null if none) so the caller can clean
// up the old Vercel Blob and avoid orphaned files.
export async function setTakeawayImageOverride(type: string, imageUrl: string): Promise<string | null> {
  const sql = await getNeon()
  const prevRows = await sql`SELECT image_url FROM takeaway_images WHERE type = ${type}` as TakeawayImageRow[]
  const previous = prevRows[0]?.image_url ?? null
  await sql`
    INSERT INTO takeaway_images (type, image_url) VALUES (${type}, ${imageUrl})
    ON CONFLICT (type) DO UPDATE SET image_url = EXCLUDED.image_url, updated_at = NOW()
  `
  return previous
}

// Returns the deleted image_url so the caller can clean up the Blob.
export async function deleteTakeawayImageOverride(type: string): Promise<string | null> {
  const sql = await getNeon()
  const rows = await sql`DELETE FROM takeaway_images WHERE type = ${type} RETURNING image_url` as TakeawayImageRow[]
  return rows[0]?.image_url ?? null
}

