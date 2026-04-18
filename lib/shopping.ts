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
}

function normaliseKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, "_").replace(/_+/g, "_")
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
  const map = new Map<string, ShoppingItem>()

  for (const { ingredient, recipeId } of allIngredients) {
    const key = normaliseKey(ingredient.name)
    const existing = map.get(key)

    if (existing) {
      // Try to combine quantities
      if (existing.unit === ingredient.unit && !isNaN(Number(existing.quantity)) && !isNaN(Number(ingredient.quantity))) {
        existing.quantity = String(Number(existing.quantity) + Number(ingredient.quantity))
      } else if (ingredient.quantity) {
        existing.quantity += ` + ${ingredient.quantity}${ingredient.unit ? " " + ingredient.unit : ""}`
      }
      if (!existing.from_recipe_ids.includes(recipeId)) {
        existing.from_recipe_ids.push(recipeId)
      }
    } else {
      map.set(key, {
        name: ingredient.name,
        quantity: ingredient.quantity || "",
        unit: ingredient.unit || "",
        aisle: ingredient.aisle || categoriseIngredient(ingredient.name),
        checked: false,
        from_recipe_ids: [recipeId],
        is_staple: false,
      })
    }
  }

  return Array.from(map.values())
}
