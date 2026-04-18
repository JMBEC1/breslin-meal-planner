import Database from "better-sqlite3"
import path from "path"

// ── Mode detection ─────────────────────────────────────────────────────────
const USE_NEON = !!process.env.DATABASE_URL

// ── SQLite (local dev) ─────────────────────────────────────────────────────

let _sqlite: Database.Database | null = null

function getSqlite(): Database.Database {
  if (_sqlite) return _sqlite
  const DB_PATH = path.join(process.cwd(), "data", "meals.db")
  _sqlite = new Database(DB_PATH)
  _sqlite.exec(`
    CREATE TABLE IF NOT EXISTS recipes (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      title           TEXT    NOT NULL,
      slug            TEXT    UNIQUE NOT NULL,
      category        TEXT    NOT NULL DEFAULT 'dinner',
      is_gluten_free  INTEGER NOT NULL DEFAULT 1,
      prep_time_mins  INTEGER DEFAULT NULL,
      cook_time_mins  INTEGER DEFAULT NULL,
      servings        INTEGER DEFAULT NULL,
      description     TEXT    NOT NULL DEFAULT '',
      ingredients     TEXT    NOT NULL DEFAULT '[]',
      instructions    TEXT    NOT NULL DEFAULT '',
      tags            TEXT    NOT NULL DEFAULT '[]',
      source_url      TEXT    DEFAULT NULL,
      image_url       TEXT    DEFAULT NULL,
      notes           TEXT    DEFAULT NULL,
      times_planned   INTEGER NOT NULL DEFAULT 0,
      created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
    CREATE TABLE IF NOT EXISTS meal_plans (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      week_start      TEXT    UNIQUE NOT NULL,
      meals           TEXT    NOT NULL DEFAULT '[]',
      created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
    CREATE TABLE IF NOT EXISTS shopping_lists (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      meal_plan_id    INTEGER NOT NULL,
      items           TEXT    NOT NULL DEFAULT '[]',
      created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
    CREATE TABLE IF NOT EXISTS staples (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      name            TEXT    NOT NULL,
      aisle           TEXT    NOT NULL DEFAULT 'other',
      default_quantity TEXT   NOT NULL DEFAULT '1',
      default_unit    TEXT    NOT NULL DEFAULT '',
      frequency       INTEGER NOT NULL DEFAULT 0,
      active          INTEGER NOT NULL DEFAULT 1,
      created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `)
  return _sqlite
}

// ── Neon (Vercel) ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _neon: any = null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getNeon(): Promise<any> {
  if (_neon) return _neon
  const { neon } = await import("@neondatabase/serverless")
  const sql = neon(process.env.DATABASE_URL!)
  await sql`
    CREATE TABLE IF NOT EXISTS recipes (
      id              SERIAL PRIMARY KEY,
      title           TEXT NOT NULL,
      slug            TEXT UNIQUE NOT NULL,
      category        TEXT NOT NULL DEFAULT 'dinner',
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
  _neon = sql
  return sql
}

// ── Exported helpers ───────────────────────────────────────────────────────

export function isUsingNeon(): boolean {
  return USE_NEON
}

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

export async function getRecipes(category?: string, gfOnly?: boolean) {
  if (USE_NEON) {
    const sql = await getNeon()
    let rows
    if (category && gfOnly) {
      rows = await sql`SELECT * FROM recipes WHERE category = ${category} AND is_gluten_free = 1 ORDER BY title ASC`
    } else if (category) {
      rows = await sql`SELECT * FROM recipes WHERE category = ${category} ORDER BY title ASC`
    } else if (gfOnly) {
      rows = await sql`SELECT * FROM recipes WHERE is_gluten_free = 1 ORDER BY title ASC`
    } else {
      rows = await sql`SELECT * FROM recipes ORDER BY title ASC`
    }
    return (rows as RecipeRow[]).map(parseRecipe)
  }
  const db = getSqlite()
  let query = "SELECT * FROM recipes"
  const conditions: string[] = []
  const params: (string | number)[] = []
  if (category) { conditions.push("category = ?"); params.push(category) }
  if (gfOnly) { conditions.push("is_gluten_free = 1") }
  if (conditions.length) query += " WHERE " + conditions.join(" AND ")
  query += " ORDER BY title ASC"
  return (db.prepare(query).all(...params) as RecipeRow[]).map(parseRecipe)
}

export async function getRecipe(id: number) {
  if (USE_NEON) {
    const sql = await getNeon()
    const rows = await sql`SELECT * FROM recipes WHERE id = ${id} LIMIT 1`
    return rows.length ? parseRecipe(rows[0] as RecipeRow) : null
  }
  const db = getSqlite()
  const row = db.prepare("SELECT * FROM recipes WHERE id = ?").get(id) as RecipeRow | undefined
  return row ? parseRecipe(row) : null
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

  if (USE_NEON) {
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
  const db = getSqlite()
  const result = db.prepare(`
    INSERT INTO recipes (title, slug, category, is_gluten_free, prep_time_mins, cook_time_mins,
      servings, description, ingredients, instructions, tags, source_url, image_url, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(data.title, slug, data.category, gf,
    data.prep_time_mins ?? null, data.cook_time_mins ?? null, data.servings ?? null,
    data.description, ingredients, data.instructions, tags,
    data.source_url ?? null, data.image_url ?? null, data.notes ?? null)
  return parseRecipe(db.prepare("SELECT * FROM recipes WHERE id = ?").get(result.lastInsertRowid) as RecipeRow)
}

export async function updateRecipe(id: number, data: {
  title?: string; category?: string; is_gluten_free?: boolean
  prep_time_mins?: number | null; cook_time_mins?: number | null
  servings?: number | null; description?: string
  ingredients?: unknown[]; instructions?: string; tags?: string[]
  source_url?: string | null; image_url?: string | null; notes?: string | null
}) {
  if (USE_NEON) {
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
  const db = getSqlite()
  const row = db.prepare("SELECT * FROM recipes WHERE id = ?").get(id) as RecipeRow | undefined
  if (!row) return null
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
  db.prepare(`
    UPDATE recipes SET
      title = ?, slug = ?, category = ?, is_gluten_free = ?, prep_time_mins = ?,
      cook_time_mins = ?, servings = ?, description = ?, ingredients = ?,
      instructions = ?, tags = ?, source_url = ?, image_url = ?, notes = ?,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = ?
  `).run(updated.title, updated.slug, updated.category, updated.is_gluten_free,
    updated.prep_time_mins, updated.cook_time_mins, updated.servings, updated.description,
    updated.ingredients, updated.instructions, updated.tags, updated.source_url,
    updated.image_url, updated.notes, id)
  return parseRecipe(db.prepare("SELECT * FROM recipes WHERE id = ?").get(id) as RecipeRow)
}

export async function deleteRecipe(id: number): Promise<boolean> {
  if (USE_NEON) {
    const sql = await getNeon()
    const rows = await sql`DELETE FROM recipes WHERE id = ${id} RETURNING id`
    return rows.length > 0
  }
  const db = getSqlite()
  const result = db.prepare("DELETE FROM recipes WHERE id = ?").run(id)
  return result.changes > 0
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
  if (USE_NEON) {
    const sql = await getNeon()
    const rows = await sql`SELECT * FROM meal_plans WHERE week_start = ${weekStart} LIMIT 1`
    return rows.length ? parsePlan(rows[0] as MealPlanRow) : null
  }
  const db = getSqlite()
  const row = db.prepare("SELECT * FROM meal_plans WHERE week_start = ?").get(weekStart) as MealPlanRow | undefined
  return row ? parsePlan(row) : null
}

export async function upsertMealPlan(weekStart: string, meals: unknown[]) {
  const mealsJson = JSON.stringify(meals)
  if (USE_NEON) {
    const sql = await getNeon()
    const rows = await sql`
      INSERT INTO meal_plans (week_start, meals)
      VALUES (${weekStart}, ${mealsJson})
      ON CONFLICT (week_start) DO UPDATE SET meals = EXCLUDED.meals, updated_at = NOW()
      RETURNING *
    `
    return parsePlan(rows[0] as MealPlanRow)
  }
  const db = getSqlite()
  db.prepare(`
    INSERT INTO meal_plans (week_start, meals) VALUES (?, ?)
    ON CONFLICT(week_start) DO UPDATE SET meals = excluded.meals,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  `).run(weekStart, mealsJson)
  return parsePlan(db.prepare("SELECT * FROM meal_plans WHERE week_start = ?").get(weekStart) as MealPlanRow)
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
  if (USE_NEON) {
    const sql = await getNeon()
    const rows = await sql`SELECT * FROM shopping_lists WHERE meal_plan_id = ${mealPlanId} ORDER BY id DESC LIMIT 1`
    return rows.length ? parseShoppingList(rows[0] as ShoppingListRow) : null
  }
  const db = getSqlite()
  const row = db.prepare("SELECT * FROM shopping_lists WHERE meal_plan_id = ? ORDER BY id DESC LIMIT 1").get(mealPlanId) as ShoppingListRow | undefined
  return row ? parseShoppingList(row) : null
}

export async function upsertShoppingList(mealPlanId: number, items: unknown[]) {
  const itemsJson = JSON.stringify(items)
  if (USE_NEON) {
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
  const db = getSqlite()
  const existing = db.prepare("SELECT id FROM shopping_lists WHERE meal_plan_id = ?").get(mealPlanId)
  if (existing) {
    db.prepare(`UPDATE shopping_lists SET items = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE meal_plan_id = ?`).run(itemsJson, mealPlanId)
  } else {
    db.prepare("INSERT INTO shopping_lists (meal_plan_id, items) VALUES (?, ?)").run(mealPlanId, itemsJson)
  }
  return parseShoppingList(db.prepare("SELECT * FROM shopping_lists WHERE meal_plan_id = ? ORDER BY id DESC LIMIT 1").get(mealPlanId) as ShoppingListRow)
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
  if (USE_NEON) {
    const sql = await getNeon()
    const rows = await sql`SELECT * FROM staples ORDER BY frequency DESC, name ASC`
    return (rows as StapleRow[]).map(parseStaple)
  }
  const db = getSqlite()
  return (db.prepare("SELECT * FROM staples ORDER BY frequency DESC, name ASC").all() as StapleRow[]).map(parseStaple)
}

export async function upsertStaple(data: {
  id?: number; name: string; aisle: string
  default_quantity: string; default_unit: string; active: boolean
}) {
  if (data.id) {
    if (USE_NEON) {
      const sql = await getNeon()
      await sql`
        UPDATE staples SET name = ${data.name}, aisle = ${data.aisle},
          default_quantity = ${data.default_quantity}, default_unit = ${data.default_unit},
          active = ${data.active ? 1 : 0}
        WHERE id = ${data.id}
      `
    } else {
      const db = getSqlite()
      db.prepare("UPDATE staples SET name = ?, aisle = ?, default_quantity = ?, default_unit = ?, active = ? WHERE id = ?")
        .run(data.name, data.aisle, data.default_quantity, data.default_unit, data.active ? 1 : 0, data.id)
    }
  } else {
    if (USE_NEON) {
      const sql = await getNeon()
      await sql`
        INSERT INTO staples (name, aisle, default_quantity, default_unit, active)
        VALUES (${data.name}, ${data.aisle}, ${data.default_quantity}, ${data.default_unit}, ${data.active ? 1 : 0})
      `
    } else {
      const db = getSqlite()
      db.prepare("INSERT INTO staples (name, aisle, default_quantity, default_unit, active) VALUES (?, ?, ?, ?, ?)")
        .run(data.name, data.aisle, data.default_quantity, data.default_unit, data.active ? 1 : 0)
    }
  }
}

export async function incrementStapleFrequency(name: string) {
  if (USE_NEON) {
    const sql = await getNeon()
    await sql`UPDATE staples SET frequency = frequency + 1 WHERE name = ${name}`
  } else {
    const db = getSqlite()
    db.prepare("UPDATE staples SET frequency = frequency + 1 WHERE name = ?").run(name)
  }
}
