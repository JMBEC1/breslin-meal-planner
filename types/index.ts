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
  "other": "Other",
}

// ── Recipe ──────────────────────────────────────────────────────────────────

export type RecipeCategory = "school-lunch" | "dinner" | "fancy" | "side"

export const CATEGORY_LABELS: Record<RecipeCategory, string> = {
  "school-lunch": "School Lunch",
  "dinner": "Dinner",
  "fancy": "Special Occasion",
  "side": "Side",
}

export const CATEGORY_COLOURS: Record<RecipeCategory, string> = {
  "school-lunch": "bg-meal-sky",
  "dinner": "bg-meal-coral",
  "fancy": "bg-meal-plum",
  "side": "bg-meal-sage",
}

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
export type MealType = "lunch" | "dinner"

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
