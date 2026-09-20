// ── Aisle Categories ────────────────────────────────────────────────────────

export type AisleCategory =
  | "fruit-veg"
  | "meat-seafood"
  | "dairy-eggs"
  | "bakery"
  | "pantry"
  | "frozen"
  | "condiments-sauces"
  | "drinks"
  | "snacks"
  | "international"
  | "health-foods"
  | "household"
  | "other"

export const AISLE_LABELS: Record<AisleCategory, string> = {
  "fruit-veg": "Fruit & Veg",
  "meat-seafood": "Meat & Seafood",
  "dairy-eggs": "Dairy & Eggs",
  "bakery": "Bakery",
  "pantry": "Pantry",
  "frozen": "Frozen",
  "condiments-sauces": "Condiments & Sauces",
  "drinks": "Drinks",
  "snacks": "Snacks",
  "international": "International",
  "health-foods": "Health Foods",
  "household": "Household",
  "other": "Other",
}

// ── Recipe ──────────────────────────────────────────────────────────────────

/**
 * What a dish *is* — its course. One per recipe.
 *
 * Deliberately not the same axis as cuisine. A Mexican side salad is a side
 * and it is Mexican; forcing one field to carry both would mean filtering
 * "Sides" couldn't find it. Cuisine lives in `tags` (see CUISINES below), so
 * the two combine.
 */
export type RecipeCategory = "main" | "salad" | "side" | "tapas" | "takeaway"

export const CATEGORY_LABELS: Record<RecipeCategory, string> = {
  "main": "Mains",
  "salad": "Salads",
  "side": "Sides",
  "tapas": "Tapas",
  "takeaway": "Takeaway",
}

export const CATEGORY_COLOURS: Record<RecipeCategory, string> = {
  "main": "bg-meal-coral",
  "salad": "bg-meal-sage",
  "side": "bg-meal-plum",
  "tapas": "bg-meal-amber",
  "takeaway": "bg-meal-muted",
}

/**
 * Courses that are not the centre of the plate. Everything else is a main —
 * derived rather than declared, so a new recipe is a main without anyone
 * having to remember to say so, and the pre-course values ("dinner", "fancy")
 * still behave correctly until they are re-filed.
 */
export const NON_MAIN_CATEGORIES: RecipeCategory[] = ["salad", "side", "tapas", "takeaway"]

export function toCategory(raw: string | null | undefined): RecipeCategory {
  return (NON_MAIN_CATEGORIES as string[]).includes(raw ?? "")
    ? (raw as RecipeCategory)
    : "main"
}

/**
 * Cuisines are tags, not categories, so a dish can be Mexican *and* a side.
 * Matching against a recipe's tags is case-insensitive — the importer and the
 * family both write them however they like.
 */
export const CUISINES = ["Mexican", "Asian", "Indian", "Spanish", "Western"] as const
export type Cuisine = (typeof CUISINES)[number]

/** Cuisines and bases both live in tags, so one case-insensitive matcher does both. */
export function hasTag(tags: string[] | null | undefined, wanted: string): boolean {
  const want = wanted.toLowerCase()
  return (tags ?? []).some((t) => t.toLowerCase() === want)
}

/** @deprecated use hasTag */
export const hasCuisine = hasTag

export interface Ingredient {
  name: string
  quantity: string
  unit: string
  aisle: AisleCategory
  is_gluten_free: boolean
}

export interface Recipe {
  id: number
  title: string
  slug: string
  category: RecipeCategory
  is_gluten_free: boolean
  prep_time_mins: number | null
  cook_time_mins: number | null
  servings: number | null
  description: string
  ingredients: Ingredient[]
  instructions: string
  tags: string[]
  source_url: string | null
  image_url: string | null
  notes: string | null
  times_planned: number
  created_at: string
  updated_at: string
}

// ── Meal Plan ───────────────────────────────────────────────────────────────

export type DayOfWeek = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday"
export type MealType = "dinner"

export const DAYS: DayOfWeek[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
export const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
}

export interface MealSlot {
  day: DayOfWeek
  meal_type: MealType
  recipe_id: number | null
  custom_text: string | null
  side_ids?: number[]
}

export interface MealPlan {
  id: number
  week_start: string
  meals: MealSlot[]
  created_at: string
  updated_at: string
}

// ── Shopping List ───────────────────────────────────────────────────────────

export interface ShoppingItem {
  name: string
  quantity: string
  unit: string
  aisle: AisleCategory
  checked: boolean
  from_recipe_ids: number[]
  is_staple: boolean
}

export interface ShoppingList {
  id: number
  meal_plan_id: number
  items: ShoppingItem[]
  created_at: string
  updated_at: string
}

// ── Ratings ─────────────────────────────────────────────────────────────────

export const FAMILY_MEMBERS = ["James", "Laura", "Jude", "Etta"] as const
export type FamilyMember = (typeof FAMILY_MEMBERS)[number]

export interface Rating {
  id: number
  recipe_id: number
  person: FamilyMember
  enjoyment: number       // 1-5 stars
  ease_of_cooking: number // 1-5 stars (same for whole family, but stored per-person for simplicity)
  created_at: string
}

export interface RecipeRatingSummary {
  avg_enjoyment: Record<FamilyMember, number | null>
  avg_ease: number | null
  ratings: Rating[]
}

export interface NeedItem {
  id: number
  name: string
  added_at: string
}

// ── Staples ─────────────────────────────────────────────────────────────────

export interface Staple {
  id: number
  name: string
  aisle: AisleCategory
  default_quantity: string
  default_unit: string
  frequency: number
  active: boolean
  created_at: string
}
