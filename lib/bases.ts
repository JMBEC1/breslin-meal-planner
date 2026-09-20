/**
 * What a dish is built on — chicken, beef, pasta, and so on.
 *
 * A third axis, separate from course and cuisine, and multi-select: Spaghetti
 * Bolognese is beef *and* pasta, and forcing a choice would make one of those
 * filters lie.
 *
 * Stored in `tags` alongside cuisines, so nothing new is needed in the schema
 * and a recipe can carry as many as apply.
 */

export const BASES = [
  "Chicken", "Beef", "Pork", "Lamb", "Fish", "Veggie", "Pasta", "Rice",
] as const
export type Base = (typeof BASES)[number]

/**
 * Guessing the base from the recipe.
 *
 * The previous version of this lived in the plan page, matched bare substrings
 * against title *and* ingredients with equal weight, and tested beef first. The
 * result was that "minced garlic" made a dish beef — Butter Chicken, Pork Chops
 * and Slow Cooker Chicken Stew were all filed under beef — and "chicken stock"
 * made a prawn bake chicken.
 *
 * Two rules fix most of it. The title is checked first and on its own, because
 * a dish is usually named after what it is; ingredients are only consulted when
 * the title says nothing. And ingredient keywords must be specific enough to
 * mean the thing itself ("beef mince", not "mince"), since an ingredient list
 * is full of seasonings that share words with proteins.
 */
type Rule = { base: Base; title: string[]; ingredients: string[] }

const RULES: Rule[] = [
  { base: "Chicken",
    title: ["chicken", "chook", "poussin"],
    ingredients: ["chicken breast", "chicken thigh", "chicken mince", "whole chicken", "chicken drumstick", "chicken wing"] },
  { base: "Beef",
    title: ["beef", "steak", "bolognese", "lasagne", "lasagna", "meatloaf", "brisket", "ragu", "cottage pie"],
    ingredients: ["beef mince", "minced beef", "beef steak", "chuck steak", "braising steak", "beef brisket", "stewing beef"] },
  { base: "Pork",
    title: ["pork", "bacon", "ham ", "sausage", "chorizo", "carbonara", "gammon"],
    ingredients: ["pork mince", "pork belly", "pork shoulder", "pork chop", "streaky bacon", "chorizo"] },
  { base: "Lamb",
    title: ["lamb", "shank", "kofta"],
    ingredients: ["lamb mince", "lamb shoulder", "lamb shank", "leg of lamb"] },
  { base: "Fish",
    title: ["fish", "salmon", "tuna", "prawn", "shrimp", "cod", "trout", "barramundi", "snapper",
            "calamari", "squid", "seafood", "mussel", "scallop", "marinara"],
    ingredients: ["salmon fillet", "white fish", "tuna steak", "raw prawn", "king prawn", "fish fillet"] },
  { base: "Pasta",
    title: ["pasta", "spaghetti", "lasagne", "lasagna", "penne", "rigatoni", "tagliatelle",
            "fettuccine", "linguine", "macaroni", "gnocchi", "noodle", "vermicelli", "ravioli", "tortellini"],
    ingredients: ["spaghetti", "penne", "rigatoni", "tagliatelle", "lasagne sheet", "egg noodle", "rice noodle"] },
  { base: "Rice",
    title: ["rice", "risotto", "paella", "pilaf", "biryani", "jambalaya"],
    ingredients: ["arborio rice", "basmati rice", "jasmine rice", "sushi rice", "long grain rice"] },
  { base: "Veggie",
    title: ["vegetarian", "vegan", "veggie", "tofu", "halloumi", "paneer", "falafel",
            "cauliflower", "mushroom", "omelette", "frittata"],
    ingredients: ["firm tofu", "halloumi", "paneer", "red lentil", "green lentil"] },
]

/**
 * Every base the recipe looks like it uses. Multi-select by design — a beef
 * lasagne comes back as both.
 */
export function guessBases(recipe: {
  title?: string
  ingredients?: Array<{ name?: string }> | null
}): Base[] {
  const title = (recipe.title ?? "").toLowerCase()
  const ingredients = (recipe.ingredients ?? [])
    .map((i) => (i?.name ?? "").toLowerCase())
    .join(" | ")

  const found: Base[] = []
  for (const rule of RULES) {
    const inTitle = rule.title.some((k) => title.includes(k))
    const inIngredients = rule.ingredients.some((k) => ingredients.includes(k))
    if (inTitle || inIngredients) found.push(rule.base)
  }

  // A dish named after its protein is not also "veggie" because it has lentils
  // in it. Only call something veggie when nothing else turned up.
  const meaty = found.filter((b) => b !== "Veggie")
  if (meaty.length && found.includes("Veggie")) {
    return meaty
  }
  return found
}
