/**
 * Get a food image URL for a recipe based on its title.
 * Uses a curated map of Unsplash direct image URLs keyed by food terms.
 * These are stable, fast, and work from any server.
 */

// Curated food images — Unsplash direct links (no API key needed)
const FOOD_IMAGES: Record<string, string> = {
  // Proteins
  chicken: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800&h=600&fit=crop",
  beef: "https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=800&h=600&fit=crop",
  lamb: "https://images.unsplash.com/photo-1514516345957-556ca7d90a29?w=800&h=600&fit=crop",
  pork: "https://images.unsplash.com/photo-1432139509613-5c4255a1d197?w=800&h=600&fit=crop",
  salmon: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&h=600&fit=crop",
  fish: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&h=600&fit=crop",
  prawn: "https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=800&h=600&fit=crop",
  shrimp: "https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=800&h=600&fit=crop",
  tofu: "https://images.unsplash.com/photo-1628689469838-524a4a973b8e?w=800&h=600&fit=crop",
  meatball: "https://images.unsplash.com/photo-1529042410759-befb1204b468?w=800&h=600&fit=crop",
  steak: "https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800&h=600&fit=crop",
  mince: "https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=800&h=600&fit=crop",
  sausage: "https://images.unsplash.com/photo-1587536849024-daaa4a417b16?w=800&h=600&fit=crop",

  // Dishes
  stir_fry: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&h=600&fit=crop",
  curry: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&h=600&fit=crop",
  pasta: "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&h=600&fit=crop",
  spaghetti: "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&h=600&fit=crop",
  bolognese: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=800&h=600&fit=crop",
  carbonara: "https://images.unsplash.com/photo-1612874742237-6526221588e3?w=800&h=600&fit=crop",
  lasagna: "https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=800&h=600&fit=crop",
  risotto: "https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=800&h=600&fit=crop",
  soup: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&h=600&fit=crop",
  stew: "https://images.unsplash.com/photo-1534483509719-3feaee7c30da?w=800&h=600&fit=crop",
  pie: "https://images.unsplash.com/photo-1621743478914-cc8a86d7e7b5?w=800&h=600&fit=crop",
  casserole: "https://images.unsplash.com/photo-1534483509719-3feaee7c30da?w=800&h=600&fit=crop",
  roast: "https://images.unsplash.com/photo-1544025162-d76694265947?w=800&h=600&fit=crop",
  burger: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&h=600&fit=crop",
  pizza: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&h=600&fit=crop",
  taco: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&h=600&fit=crop",
  burrito: "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=800&h=600&fit=crop",
  wrap: "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=800&h=600&fit=crop",
  sandwich: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800&h=600&fit=crop",
  noodle: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800&h=600&fit=crop",
  ramen: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800&h=600&fit=crop",
  pho: "https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=800&h=600&fit=crop",
  fried_rice: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&h=600&fit=crop",
  dumpling: "https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=800&h=600&fit=crop",
  gyoza: "https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=800&h=600&fit=crop",
  schnitzel: "https://images.unsplash.com/photo-1599921841143-819065a55cc6?w=800&h=600&fit=crop",
  bbq: "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=800&h=600&fit=crop",
  grill: "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=800&h=600&fit=crop",

  // Cuisines
  thai: "https://images.unsplash.com/photo-1559314809-0d155014e29e?w=800&h=600&fit=crop",
  indian: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&h=600&fit=crop",
  mexican: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&h=600&fit=crop",
  italian: "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&h=600&fit=crop",
  japanese: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800&h=600&fit=crop",
  chinese: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&h=600&fit=crop",
  korean: "https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=800&h=600&fit=crop",
  mediterranean: "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800&h=600&fit=crop",
  greek: "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800&h=600&fit=crop",

  // Lunch items
  sushi: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800&h=600&fit=crop",
  rice_paper: "https://images.unsplash.com/photo-1609501676725-7186f017a4b7?w=800&h=600&fit=crop",
  spring_roll: "https://images.unsplash.com/photo-1609501676725-7186f017a4b7?w=800&h=600&fit=crop",
  salad: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=600&fit=crop",
  bowl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=600&fit=crop",
  bento: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800&h=600&fit=crop",
  lunchbox: "https://images.unsplash.com/photo-1547592180-85f173990554?w=800&h=600&fit=crop",
  nugget: "https://images.unsplash.com/photo-1562967914-608f82629710?w=800&h=600&fit=crop",
  omelette: "https://images.unsplash.com/photo-1510693206972-df098062cb71?w=800&h=600&fit=crop",
  egg: "https://images.unsplash.com/photo-1510693206972-df098062cb71?w=800&h=600&fit=crop",
  frittata: "https://images.unsplash.com/photo-1510693206972-df098062cb71?w=800&h=600&fit=crop",
  quesadilla: "https://images.unsplash.com/photo-1618040996337-56904b7850b9?w=800&h=600&fit=crop",
  hummus: "https://images.unsplash.com/photo-1577805947697-89e18249d767?w=800&h=600&fit=crop",

  // Breakfast / Snack
  pancake: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&h=600&fit=crop",
  waffle: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&h=600&fit=crop",
  smoothie: "https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=800&h=600&fit=crop",
  muffin: "https://images.unsplash.com/photo-1607958996333-41aef7caefaa?w=800&h=600&fit=crop",

  // Cooking methods
  slow_cook: "https://images.unsplash.com/photo-1534483509719-3feaee7c30da?w=800&h=600&fit=crop",
  bake: "https://images.unsplash.com/photo-1544025162-d76694265947?w=800&h=600&fit=crop",
  fry: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&h=600&fit=crop",

  // Generic food fallbacks
  vegetable: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&h=600&fit=crop",
  vegan: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=600&fit=crop",
  healthy: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=600&fit=crop",
}

// Generic fallback for when no keyword matches at all
const GENERIC_FOOD_IMAGES = [
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=600&fit=crop", // Beautiful food spread
  "https://images.unsplash.com/photo-1493770348161-369560ae357d?w=800&h=600&fit=crop", // Colourful meal
  "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800&h=600&fit=crop", // Fresh salad bowl
  "https://images.unsplash.com/photo-1547592180-85f173990554?w=800&h=600&fit=crop", // Home cooking
  "https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=800&h=600&fit=crop", // Warm dinner
  "https://images.unsplash.com/photo-1606787366850-de6330128bfc?w=800&h=600&fit=crop", // Food ingredients
]

export function fetchRecipeImage(title: string): string {
  const lower = title.toLowerCase()

  // Try direct keyword match
  for (const [keyword, url] of Object.entries(FOOD_IMAGES)) {
    // Handle multi-word keys (slow_cook -> "slow cook" or "slow-cook")
    const variants = [keyword, keyword.replace(/_/g, " "), keyword.replace(/_/g, "-")]
    for (const v of variants) {
      if (lower.includes(v)) return url
    }
  }

  // No match — return a deterministic generic food image based on title
  let hash = 0
  for (let i = 0; i < title.length; i++) {
    hash = ((hash << 5) - hash) + title.charCodeAt(i)
    hash |= 0
  }
  return GENERIC_FOOD_IMAGES[Math.abs(hash) % GENERIC_FOOD_IMAGES.length]
}
