-- Dinner-only strip-back migration
-- Run against the production Neon DB once the feature/dinner-only-stripback
-- branch is merged to main. Safe to run twice (everything is IF EXISTS).
--
-- Apply with:  psql "$DATABASE_URL" -f scripts/2026-06-21-dinner-only-stripback.sql

BEGIN;

-- 1. Re-categorise any recipes saved as school-lunch as plain dinners.
--    The recipe content stays; we just stop labelling it as lunch.
UPDATE recipes
   SET category = 'dinner'
 WHERE category = 'school-lunch';

-- 2. Drop the pantry/freezer/fridge tracking table. App no longer reads or writes it.
DROP TABLE IF EXISTS inventory;

-- 3. Drop the lunch-generator's quick-meal pool. App no longer reads or writes it.
DROP TABLE IF EXISTS cheat_meals;

-- Note: meal_plans.meals is JSON-encoded TEXT and may contain historic
-- meal_type='lunch' entries. The UI only renders dinner slots so they're
-- harmless data debris — leaving them in place preserves history if lunches
-- are ever brought back.

COMMIT;
