import type { Ingredient, ShoppingItem, AisleCategory } from "@/types"

// Common ingredient → aisle mapping (avoids AI call for basics)
const AISLE_MAP: Record<string, AisleCategory> = {
  // Fruit & Veg
  apple: "fruit-veg", banana: "fruit-veg", carrot: "fruit-veg", onion: "fruit-veg",
  garlic: "fruit-veg", tomato: "fruit-veg", potato: "fruit-veg", lettuce: "fruit-veg",
  spinach: "fruit-veg", broccoli: "fruit-veg", capsicum: "fruit-veg", cucumber: "fruit-veg",
  avocado: "fruit-veg", lemon: "fruit-veg", lime: "fruit-veg", ginger: "fruit-veg",
  mushroom: "fruit-veg", zucchini: "fruit-veg", corn: "fruit-veg", pumpkin: "fruit-veg",
  sweet_potato: "fruit-veg", celery: "fruit-veg", beans: "fruit-veg", peas: "fruit-veg",
  // Meat & Seafood
  chicken: "meat-seafood", beef: "meat-seafood", mince: "meat-seafood", pork: "meat-seafood",
  lamb: "meat-seafood", salmon: "meat-seafood", prawns: "meat-seafood", fish: "meat-seafood",
  bacon: "meat-seafood", sausage: "meat-seafood", steak: "meat-seafood",
  // Dairy & Eggs
  milk: "dairy-eggs", cheese: "dairy-eggs", butter: "dairy-eggs", cream: "dairy-eggs",
  yogurt: "dairy-eggs", egg: "dairy-eggs", eggs: "dairy-eggs", parmesan: "dairy-eggs",
  mozzarella: "dairy-eggs", cheddar: "dairy-eggs", feta: "dairy-eggs",
  // Bakery
  bread: "bakery", rolls: "bakery", wrap: "bakery", wraps: "bakery", tortilla: "bakery",
  // Pantry
  rice: "pantry", pasta: "pantry", flour: "pantry", sugar: "pantry", salt: "pantry",
  pepper: "pantry", oil: "pantry", olive_oil: "pantry", coconut_oil: "pantry",
  vinegar: "pantry", stock: "pantry", broth: "pantry", noodles: "pantry",
  oats: "pantry", quinoa: "pantry", lentils: "pantry", chickpeas: "pantry",
  coconut_milk: "pantry", tinned_tomatoes: "pantry", tomato_paste: "pantry",
  // Condiments
  soy_sauce: "condiments-sauces", ketchup: "condiments-sauces", mustard: "condiments-sauces",
  mayonnaise: "condiments-sauces", honey: "condiments-sauces", maple_syrup: "condiments-sauces",
  worcestershire: "condiments-sauces", hot_sauce: "condiments-sauces",
  // Frozen
  frozen_peas: "frozen", frozen_corn: "frozen", ice_cream: "frozen",
  // International
  curry_paste: "international", coconut_cream: "international", fish_sauce: "international",
  sriracha: "international", miso: "international", tahini: "international",
  // Health Foods
  almond_milk: "health-foods", gluten_free_flour: "health-foods",
  gluten_free_pasta: "health-foods", tamari: "health-foods",
  // Household
  toilet_paper: "household", toilet_roll: "household", paper_towel: "household",
  shampoo: "household", conditioner: "household", soap: "household", hand_wash: "household",
  dishwashing: "household", dish_soap: "household", laundry: "household", detergent: "household",
  bin_bags: "household", garbage_bags: "household", cling_wrap: "household", foil: "household",
  sponge: "household", bleach: "household", wipes: "household", tissues: "household",
  toothpaste: "household", deodorant: "household", sunscreen: "household",
}

function normaliseKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, "_").replace(/_+/g, "_")
}

// Words that describe an amount rather than the ingredient itself.
const MEASURE_WORDS = new Set([
  "kg", "kgs", "kilo", "kilos", "kilogram", "kilograms",
  "g", "gs", "gram", "grams", "mg",
  "l", "litre", "litres", "liter", "liters", "ml", "mls",
  "cup", "cups", "tbsp", "tbs", "tablespoon", "tablespoons",
  "tsp", "teaspoon", "teaspoons",
  "bunch", "bunches", "can", "cans", "tin", "tins", "jar", "jars",
  "packet", "packets", "pack", "packs", "punnet", "punnets",
  "bag", "bags", "box", "boxes", "block", "blocks", "sheet", "sheets",
  "slice", "slices", "piece", "pieces", "clove", "cloves", "sprig", "sprigs",
  "handful", "handfuls", "pinch", "dash", "knob", "rasher", "rashers",
  "fillet", "fillets", "x", "of", "large", "small", "medium", "about", "approx",
])

// "1kg chicken thighs" / "2 x 400g tinned tomatoes" / "500 g chicken thigh"
// → "chicken thighs" / "tinned tomatoes" / "chicken thigh".
// Strips leading quantity/measure tokens so the same ingredient dedupes
// across recipes regardless of amounts. We never show amounts anyway (§ see
// aggregateIngredients) — you just need to know WHAT to buy.
export function cleanIngredientName(raw: string): string {
  const tokens = raw.trim().split(/\s+/)
  let i = 0
  while (i < tokens.length - 1) {
    // Peel a leading token if it's numeric ("2", "1.5", "1/2", "400g", "2x")
    // or a measure word ("kg", "cans", "of", "x"…).
    const t = tokens[i].toLowerCase().replace(/[().,]/g, "")
    const isNumericish = /^[\d/.,-]+$/.test(t) || /^[\d/.,-]+(kg|g|ml|l|x)$/.test(t)
    if (isNumericish || MEASURE_WORDS.has(t)) { i++; continue }
    break
  }
  const cleaned = tokens.slice(i).join(" ").trim()
  const result = cleaned || raw.trim()
  return result.charAt(0).toUpperCase() + result.slice(1)
}

// Key used for deduping: cleaned, lowercased, with a light plural fold so
// "chicken thighs" and "chicken thigh" collapse together.
function dedupeKey(name: string): string {
  let key = normaliseKey(cleanIngredientName(name))
  if (key.length > 4 && key.endsWith("s") && !key.endsWith("ss")) {
    key = key.slice(0, -1)
  }
  return key
}

export function categoriseIngredient(name: string): AisleCategory {
  const key = normaliseKey(name)
  // Direct match
  if (AISLE_MAP[key]) return AISLE_MAP[key]
  // Partial match
  for (const [mapKey, aisle] of Object.entries(AISLE_MAP)) {
    if (key.includes(mapKey) || mapKey.includes(key)) return aisle
  }
  return "other"
}

export function aggregateIngredients(
  allIngredients: { ingredient: Ingredient; recipeId: number }[]
): ShoppingItem[] {
  // We deliberately DON'T sum quantities. Recipe amounts (1.2kg chicken thigh,
  // 0.6kg…) aren't reliable or useful for a shopping run — you just need to know
  // WHAT to buy. So we dedupe by ingredient name and record which recipes call
  // for it; the UI shows the ingredient plus "×N recipes" when more than one
  // dish needs it, instead of a fabricated total.
  const map = new Map<string, ShoppingItem>()

  for (const { ingredient, recipeId } of allIngredients) {
    const cleanName = cleanIngredientName(ingredient.name)
    const key = dedupeKey(ingredient.name)
    const existing = map.get(key)

    if (existing) {
      if (!existing.from_recipe_ids.includes(recipeId)) {
        existing.from_recipe_ids.push(recipeId)
      }
    } else {
      map.set(key, {
        name: cleanName,
        quantity: "",
        unit: "",
        aisle: ingredient.aisle || categoriseIngredient(cleanName),
        checked: false,
        from_recipe_ids: [recipeId],
        is_staple: false,
      })
    }
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
}
