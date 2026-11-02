// Sauces, dressings and spreads. Photos can't see them well and models guess their calories badly, so we
// keep a reference table: per-100 g macros, a typical serving, and the names the model / people use.
// per100 = [kcal, protein, carbs, fat]; tbsp = grams in a typical tablespoon.
const S = (id, label, tbsp, per100, names) => ({ id, label, tbsp, per100, names })

export const SAUCES = [
  S('mayo', 'Mayo', 14, [680, 1, 0.6, 75], ['mayo', 'mayonnaise', 'aioli', 'garlic mayo']),
  S('ranch', 'Ranch', 15, [430, 1, 6, 45], ['ranch', 'ranch dressing']),
  S('caesar', 'Caesar', 15, [450, 2, 4, 48], ['caesar', 'caesar dressing']),
  S('vinaigrette', 'Oil dressing', 15, [450, 0, 5, 50], ['vinaigrette', 'olive oil dressing', 'italian dressing', 'salad dressing', 'dressing', 'oil dressing']),
  S('ketchup', 'Ketchup', 17, [100, 1, 26, 0.1], ['ketchup', 'tomato ketchup']),
  S('bbq', 'BBQ', 17, [170, 1, 40, 0.5], ['bbq', 'bbq sauce', 'barbecue', 'barbecue sauce']),
  S('sourcream', 'Sour cream', 15, [200, 3, 4, 20], ['sour cream', 'smetana']),
  S('cream', 'Creamy sauce', 15, [180, 3, 6, 16], ['cream sauce', 'creamy sauce', 'alfredo', 'alfredo sauce', 'cheese sauce', 'garlic sauce', 'white sauce']),
  S('tartar', 'Tartar', 15, [400, 1, 8, 40], ['tartar', 'tartar sauce']),
  S('pesto', 'Pesto', 16, [460, 5, 5, 46], ['pesto']),
  S('hummus', 'Hummus', 15, [230, 8, 20, 15], ['hummus']),
  S('tzatziki', 'Tzatziki', 15, [120, 4, 5, 9], ['tzatziki', 'yogurt sauce']),
  S('soy', 'Soy sauce', 16, [55, 8, 5, 0], ['soy sauce', 'soy']),
  S('teriyaki', 'Teriyaki', 17, [90, 6, 16, 0], ['teriyaki', 'teriyaki sauce']),
  S('sweetchili', 'Sweet chili', 17, [200, 0, 50, 0], ['sweet chili', 'sweet chilli', 'sweet chili sauce']),
  S('sriracha', 'Sriracha', 6, [93, 2, 19, 1], ['sriracha', 'hot sauce', 'chili sauce']),
  S('mustard', 'Mustard', 5, [66, 4, 6, 4], ['mustard']),
  S('tomato', 'Tomato sauce', 60, [50, 2, 8, 1.5], ['tomato sauce', 'marinara', 'marinara sauce', 'pasta sauce']),
  S('gravy', 'Gravy', 60, [60, 2, 5, 3.5], ['gravy']),
  S('butter', 'Butter', 14, [717, 0.9, 0.1, 81], ['butter']),
  S('oil', 'Olive oil', 14, [884, 0, 0, 100], ['olive oil', 'oil']),
  S('cheese', 'Cheese', 28, [400, 25, 2, 33], ['cheese', 'melted cheese', 'shredded cheese', 'grated cheese', 'parmesan']),
  S('peanut', 'Peanut sauce', 16, [260, 10, 14, 19], ['peanut sauce', 'satay', 'satay sauce'])
]

// Words that only describe how it is served: "ranch dressing (drizzled)" is still ranch.
const clean = name => String(name || '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/\b(a little|some|extra|side of|on the side|drizzle of|drizzled|dollop of|visible|light|heavy)\b/g, ' ').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim()

// The reference entry when `name` is a sauce on its own ("Ranch dressing"), never a dish ("chicken in teriyaki").
export function findSauce(name) {
  const n = clean(name)
  if (!n) return null
  return SAUCES.find(s => s.names.some(a => n === a || n === a + ' sauce' || n === a + ' dressing')) || null
}

export const sauceItem = (s, grams = s.tbsp) => {
  const k = grams / 100
  const r = v => Math.round(v * k * 10) / 10
  return { name: s.label, grams, kcal: Math.round(s.per100[0] * k), p: r(s.per100[1]), c: r(s.per100[2]), f: r(s.per100[3]) }
}

// Replace the model's guess for a standalone sauce with the reference values for the same grams.
export function fixSauce(item) {
  const s = findSauce(item.name)
  if (!s) return item
  return { ...item, ...sauceItem(s, item.grams), name: item.name, sauce: s.id }
}
