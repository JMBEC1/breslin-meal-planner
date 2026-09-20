import { z } from "zod"

/**
 * One recipe shape, shared by both importers.
 *
 * The URL importer and the photo importer were each carrying their own copy of
 * this structure, written out longhand inside the prompt. They drifted apart
 * the moment either was edited, and neither could be checked against what the
 * code then did with the result. The schema is now the single definition: it
 * tells the model what to return *and* validates what comes back.
 */

export const AISLES = [
  "fruit-veg", "meat-seafood", "dairy-eggs", "bakery", "pantry", "frozen",
  "condiments-sauces", "drinks", "snacks", "international", "health-foods",
  "household", "other",
] as const

export const ExtractedRecipeSchema = z.object({
  title: z.string(),
  description: z.string().describe("One or two sentences"),
  category: z.enum(["main", "salad", "side"]).describe("The course: a main, a salad, or a side dish"),
  is_gluten_free: z.boolean(),
  prep_time_mins: z.number().int().nullable(),
  cook_time_mins: z.number().int().nullable(),
  servings: z.number().int().nullable(),
  ingredients: z.array(
    z.object({
      name: z.string(),
      quantity: z.string().describe("Just the number, as text, e.g. \"2\". Empty string if unspecified."),
      unit: z.string().describe("e.g. cups, g, tbsp. Empty string if unspecified."),
      aisle: z.enum(AISLES),
      is_gluten_free: z.boolean(),
    })
  ),
  instructions: z.string().describe("Plain text, numbered steps"),
  tags: z.array(z.string()),
  gluten_warnings: z.array(z.string()).describe("Any gluten-containing ingredients found"),
})

export type ExtractedRecipe = z.infer<typeof ExtractedRecipeSchema>

/**
 * Etta is coeliac, so the gluten check is the part of this that actually
 * matters — a wrong title is an annoyance, a missed soy sauce is a sick kid.
 */
export const RECIPE_EXTRACTION_PROMPT = `Extract the recipe.

Be thorough with the gluten check: flag flour, bread, breadcrumbs, pasta, soy
sauce, oyster sauce, stock cubes, beer and malt as containing gluten, and list
each one you find in gluten_warnings. Mark the recipe gluten free only if every
ingredient is.

Times are in whole minutes — if the source gives an ISO 8601 duration such as
PT30M, convert it. Use null for anything the source does not state; do not
estimate.`
