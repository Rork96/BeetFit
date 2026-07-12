// Per-serving values. kcal / protein / fat / carbs (g).
// slot: breakfast | lunch | dinner | snack
const M = (name, slot, kcal, p, f, c) => ({ name, slot, kcal, p, f, c })

export const MEALS = [
  // Breakfast
  M('Oatmeal with banana & peanut butter', 'breakfast', 420, 14, 14, 62),
  M('Scrambled eggs (3) with toast', 'breakfast', 390, 24, 20, 28),
  M('Greek yogurt with berries & granola', 'breakfast', 340, 22, 9, 42),
  M('Cottage cheese with honey & walnuts', 'breakfast', 360, 28, 16, 24),
  M('Protein pancakes with syrup', 'breakfast', 450, 30, 12, 55),
  M('Avocado toast with poached egg', 'breakfast', 410, 16, 24, 33),
  M('Omelette with cheese & vegetables', 'breakfast', 380, 26, 26, 8),
  M('Buckwheat porridge with milk', 'breakfast', 330, 12, 8, 52),
  M('Smoothie bowl (banana, oats, whey)', 'breakfast', 400, 28, 8, 56),
  M('Syrnyky with sour cream', 'breakfast', 430, 24, 18, 44),
  M('Muesli with kefir', 'breakfast', 310, 12, 7, 50),
  M('Egg & cheese breakfast burrito', 'breakfast', 470, 25, 22, 42),
  // Lunch
  M('Grilled chicken breast, rice & salad', 'lunch', 550, 45, 12, 62),
  M('Beef stew with buckwheat', 'lunch', 620, 42, 24, 55),
  M('Salmon with quinoa & broccoli', 'lunch', 580, 40, 26, 44),
  M('Turkey meatballs with pasta', 'lunch', 600, 38, 18, 66),
  M('Chicken burrito bowl', 'lunch', 630, 40, 20, 68),
  M('Tuna salad with beans & egg', 'lunch', 480, 38, 22, 30),
  M('Borshch with bread & sour cream', 'lunch', 450, 18, 16, 58),
  M('Pork chop with mashed potatoes', 'lunch', 650, 40, 30, 52),
  M('Chicken Caesar salad wrap', 'lunch', 520, 35, 20, 48),
  M('Lentil curry with rice', 'lunch', 540, 22, 12, 86),
  M('Baked cod with potatoes & veg', 'lunch', 470, 38, 10, 56),
  M('Chicken stir-fry with noodles', 'lunch', 590, 36, 16, 72),
  M('Varenyky with potato & onion', 'lunch', 560, 14, 18, 84),
  M('Beef & vegetable rice bowl', 'lunch', 610, 38, 20, 64),
  // Dinner
  M('Baked chicken thighs with vegetables', 'dinner', 520, 38, 26, 30),
  M('Grilled fish with green salad', 'dinner', 420, 40, 20, 14),
  M('Turkey steak with sweet potato', 'dinner', 500, 42, 14, 48),
  M('Shrimp pasta with garlic', 'dinner', 550, 32, 16, 66),
  M('Beef stroganoff with rice', 'dinner', 590, 34, 24, 58),
  M('Stuffed peppers with mince & rice', 'dinner', 480, 30, 18, 46),
  M('Chicken soup with noodles', 'dinner', 380, 28, 10, 42),
  M('Baked salmon with asparagus', 'dinner', 460, 38, 26, 12),
  M('Tofu vegetable curry with rice', 'dinner', 490, 22, 16, 66),
  M('Omelette with mushrooms & salad', 'dinner', 360, 24, 24, 10),
  M('Grilled chicken quesadilla', 'dinner', 560, 36, 24, 48),
  M('Cottage cheese casserole', 'dinner', 400, 30, 14, 38),
  M('Chili con carne', 'dinner', 530, 34, 20, 48),
  M('Baked potato with tuna & yogurt', 'dinner', 440, 30, 8, 60),
  // Snacks
  M('Apple with peanut butter', 'snack', 220, 6, 12, 24),
  M('Protein bar', 'snack', 210, 20, 7, 20),
  M('Handful of almonds (30g)', 'snack', 180, 6, 15, 6),
  M('Banana & glass of milk', 'snack', 200, 8, 4, 34),
  M('Cottage cheese (150g)', 'snack', 150, 22, 4, 6),
  M('Whey shake with water', 'snack', 130, 25, 2, 4),
  M('Rice cakes with hummus', 'snack', 190, 6, 7, 26),
  M('Boiled eggs (2)', 'snack', 155, 12, 10, 1),
  M('Greek yogurt (170g)', 'snack', 120, 17, 2, 8),
  M('Dark chocolate (30g) & orange', 'snack', 230, 3, 12, 28),
  M('Kefir (250ml) with bran', 'snack', 160, 9, 5, 20),
  M('Trail mix (40g)', 'snack', 200, 5, 12, 18)
]

// slot share of daily kcal
export const SLOT_SPLIT = { breakfast: 0.25, lunch: 0.35, dinner: 0.3, snack: 0.1 }
export const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack']

const rand = arr => arr[Math.floor(Math.random() * arr.length)]

// Pick a meal for slot; portion factor scales to hit slot target within 0.6–1.6x
export function pickMeal(slot, targetKcal, excludeName) {
  const pool = MEALS.filter(m => m.slot === slot && m.name !== excludeName)
  const scored = pool
    .map(m => ({ m, factor: Math.min(1.6, Math.max(0.6, targetKcal / m.kcal)) }))
    .map(x => ({ ...x, err: Math.abs(x.m.kcal * x.factor - targetKcal) }))
    .sort((a, b) => a.err - b.err)
  const best = scored.slice(0, 4) // randomness among top matches
  const { m, factor } = rand(best)
  const f = +factor.toFixed(2)
  return {
    name: m.name,
    slot,
    factor: f,
    kcal: Math.round(m.kcal * f),
    p: Math.round(m.p * f),
    f_: Math.round(m.f * f),
    c: Math.round(m.c * f)
  }
}

export function generateDayPlan(dailyKcal) {
  return SLOTS.map(slot => pickMeal(slot, Math.round(dailyKcal * SLOT_SPLIT[slot])))
}

export function swapMeal(plan, index, dailyKcal) {
  const slot = plan[index].slot
  const next = [...plan]
  next[index] = pickMeal(slot, Math.round(dailyKcal * SLOT_SPLIT[slot]), plan[index].name)
  return next
}
