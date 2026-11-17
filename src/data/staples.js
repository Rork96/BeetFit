// Everyday foods, on the phone: typing "egg" or "rice" gives the plain food first, instantly and offline.
// Nutrition per 100 g is copied from USDA FoodData Central (SR Legacy / Foundation; the fdc id is kept on each row).
// Portions are USDA household measures ("1 medium", "1 cup"); the gram amount stays editable when logging.
// Row: [fdc id, name, extra search words, kcal, protein, carbs, fat, portion label, portion grams]
const ROWS = [
  // Fruit
  [171688, 'Apple', 'apples fruit', 52, 0.3, 13.8, 0.2, '1 medium', 182],
  [173944, 'Banana', 'bananas fruit', 89, 1.1, 22.8, 0.3, '1 medium', 118],
  [169097, 'Orange', 'oranges fruit', 47, 0.9, 11.8, 0.1, '1 medium', 131],
  [167762, 'Strawberries', 'strawberry berries fruit', 32, 0.7, 7.7, 0.3, '1 cup', 152],
  [171711, 'Blueberries', 'blueberry berries fruit', 57, 0.7, 14.5, 0.3, '1 cup', 148],
  [174683, 'Grapes', 'grape fruit', 69, 0.7, 18.1, 0.2, '1 cup', 151],
  [171705, 'Avocado', 'avocados', 160, 2, 8.5, 14.7, '½ avocado', 100],
  [167765, 'Watermelon', 'melon fruit', 30, 0.6, 7.6, 0.2, '1 cup, diced', 152],
  [169118, 'Pear', 'pears fruit', 57, 0.4, 15.2, 0.1, '1 medium', 178],
  [169910, 'Mango', 'mangos mangoes fruit', 60, 0.8, 15, 0.4, '1 cup, pieces', 165],
  [169124, 'Pineapple', 'fruit', 50, 0.5, 13.1, 0.1, '1 cup, chunks', 165],
  [325430, 'Peach', 'peaches fruit', 42, 0.9, 10.1, 0.3, '1 medium', 150],
  [327046, 'Kiwi', 'kiwifruit fruit', 58, 1.1, 14, 0.4, '1 fruit', 69],
  [168191, 'Dates, medjool', 'date', 277, 1.8, 75, 0.2, '1 date', 24],
  [168165, 'Raisins', 'raisin dried fruit', 299, 3.3, 79.3, 0.3, 'small box', 43],
  // Vegetables
  [170440, 'Potato, boiled', 'potatoes', 86, 1.7, 20, 0.1, '1 medium', 167],
  [170093, 'Potato, baked', 'potatoes jacket', 93, 2.5, 21.2, 0.1, '1 medium', 173],
  [168483, 'Sweet potato, baked', 'yam potatoes', 90, 2, 20.7, 0.2, '1 medium', 114],
  [170698, 'French fries', 'fries chips potato fast food', 312, 3.4, 41.4, 14.7, 'medium serving', 117],
  [169967, 'Broccoli, cooked', 'vegetable', 35, 2.4, 7.2, 0.4, '1 cup', 156],
  [169986, 'Cauliflower', 'vegetable', 25, 1.9, 5, 0.3, '1 cup', 107],
  [170393, 'Carrot', 'carrots vegetable', 41, 0.9, 9.6, 0.2, '1 medium', 61],
  [170457, 'Tomato', 'tomatoes vegetable', 18, 0.9, 3.9, 0.2, '1 medium', 123],
  [168409, 'Cucumber', 'cucumbers vegetable', 15, 0.7, 3.6, 0.1, '½ cucumber', 150],
  [170000, 'Onion', 'onions vegetable', 40, 1.1, 9.3, 0.1, '1 medium', 110],
  [168462, 'Spinach', 'greens vegetable', 23, 2.9, 3.6, 0.4, '1 cup', 30],
  [169247, 'Lettuce, romaine', 'salad greens', 17, 1.2, 3.3, 0.3, '1 cup, shredded', 47],
  [170108, 'Bell pepper, red', 'peppers sweet vegetable', 26, 1, 6, 0.3, '1 medium', 119],
  [169999, 'Corn, cooked', 'sweetcorn maize', 96, 3.4, 21, 1.5, '1 ear', 90],
  [169251, 'Mushrooms', 'mushroom white', 22, 3.1, 3.3, 0.3, '1 cup, sliced', 70],
  [169975, 'Cabbage', 'vegetable', 25, 1.3, 5.8, 0.1, '1 cup, chopped', 89],
  [170420, 'Green peas, cooked', 'pea', 84, 5.4, 15.6, 0.2, '½ cup', 80],
  [169141, 'Green beans, cooked', 'bean string', 35, 1.9, 7.9, 0.3, '1 cup', 125],
  [169291, 'Zucchini', 'courgette squash', 17, 1.2, 3.1, 0.3, '1 medium', 196],
  [169146, 'Beets, cooked', 'beetroot beet', 44, 1.7, 10, 0.2, '½ cup, slices', 85],
  // Grains, bread
  [168878, 'White rice, cooked', 'rice', 130, 2.7, 28.2, 0.3, '1 cup', 158],
  [169704, 'Brown rice, cooked', 'rice', 123, 2.7, 25.6, 1, '1 cup', 202],
  [169737, 'Pasta, cooked', 'spaghetti noodles macaroni penne', 158, 5.8, 30.9, 0.9, '1 cup', 140],
  [173904, 'Oats, dry', 'oatmeal porridge rolled oats', 379, 13.2, 67.7, 6.5, '½ cup', 40],
  [173905, 'Oatmeal, cooked with water', 'porridge oats', 71, 2.5, 12, 1.5, '1 cup', 234],
  [174924, 'White bread', 'bread toast slice', 266, 8.9, 49.4, 3.3, '1 slice', 28],
  [172688, 'Whole-wheat bread', 'bread wholemeal brown toast slice', 252, 12.4, 42.7, 3.5, '1 slice', 32],
  [172684, 'Rye bread', 'bread slice', 259, 8.5, 48.3, 3.3, '1 slice', 32],
  [174899, 'Bagel, plain', 'bagels bread', 264, 10.6, 52.4, 1.3, '1 bagel', 105],
  [174987, 'Croissant, butter', 'croissants pastry', 406, 8.2, 45.8, 21, '1 medium', 57],
  [175009, 'Pancakes, plain', 'pancake', 227, 6.4, 28.3, 9.7, '1 pancake', 38],
  [168917, 'Quinoa, cooked', 'grain', 120, 4.4, 21.3, 1.9, '1 cup', 185],
  [170686, 'Buckwheat, cooked', 'kasha groats grechka grain', 92, 3.4, 19.9, 0.6, '1 cup', 168],
  [169700, 'Couscous, cooked', 'grain', 112, 3.8, 23.2, 0.2, '1 cup', 157],
  [170287, 'Bulgur, cooked', 'grain', 83, 3.1, 18.6, 0.2, '1 cup', 182],
  [170285, 'Barley, cooked', 'pearl grain', 123, 2.3, 28.2, 0.4, '1 cup', 157],
  [168871, 'Millet, cooked', 'grain', 119, 3.5, 23.7, 1, '1 cup', 174],
  [171646, 'Granola', 'cereal muesli', 489, 13.7, 53.9, 24.3, '¼ cup', 30],
  // Meat, fish, eggs, legumes
  [171477, 'Chicken breast, cooked', 'chicken grilled roasted', 165, 31, 0, 3.6, '1 small breast', 120],
  [172388, 'Chicken thigh, cooked', 'chicken roasted', 179, 24.8, 0, 8.2, '1 thigh, no bone', 85],
  [174035, 'Ground beef, 85% lean, cooked', 'beef mince minced burger patty', 240, 25.9, 0, 14.4, '1 patty', 85],
  [174054, 'Sirloin steak, cooked', 'beef steak', 178, 29.4, 0, 5.8, '1 steak', 150],
  [168285, 'Pork chop, cooked', 'pork loin', 162, 30, 0, 4.7, '1 chop', 120],
  [168322, 'Bacon, cooked', 'pork rasher', 468, 33.9, 1.7, 35.1, '1 slice', 8],
  [173864, 'Ham, sliced', 'pork deli', 164, 16.6, 3.6, 8.8, '2 slices', 56],
  [172941, 'Turkey breast, sliced', 'deli turkey', 106, 14.8, 2.2, 3.8, '2 slices', 56],
  [746780, 'Italian sausage, cooked', 'sausage pork', 322, 18.2, 2.2, 26.2, '1 link', 83],
  [175168, 'Salmon, cooked', 'fish', 206, 22.1, 0, 12.4, '1 fillet', 150],
  [171956, 'Cod, cooked', 'fish white', 105, 22.8, 0, 0.9, '1 fillet', 150],
  [334194, 'Tuna, canned in water', 'fish tin', 90, 19, 0.1, 0.9, '1 can, drained', 120],
  [171971, 'Shrimp, cooked', 'prawns seafood', 119, 22.8, 1.5, 1.7, '6 large', 85],
  [171287, 'Egg, whole', 'eggs', 143, 12.6, 0.7, 9.5, '1 large', 50],
  [173424, 'Egg, hard-boiled', 'eggs boiled', 155, 12.6, 1.1, 10.6, '1 large', 50],
  [172187, 'Egg, scrambled', 'eggs scramble', 149, 10, 1.6, 11, '1 large', 61],
  [172183, 'Egg white', 'eggs whites', 52, 10.9, 0.7, 0.2, '1 large', 33],
  [172475, 'Tofu, firm', 'soy bean curd', 144, 17.3, 2.8, 8.7, '½ cup', 126],
  [172421, 'Lentils, cooked', 'lentil dal legumes', 116, 9, 20.1, 0.4, '1 cup', 198],
  [173735, 'Black beans, cooked', 'bean legumes', 132, 8.9, 23.7, 0.5, '1 cup', 172],
  [173757, 'Chickpeas, cooked', 'garbanzo chickpea legumes', 164, 8.9, 27.4, 2.6, '1 cup', 164],
  [174289, 'Hummus', 'chickpea dip', 237, 7.8, 15, 17.8, '2 tbsp', 30],
  // Dairy
  [746782, 'Milk, whole', '3.25% dairy', 60, 3.3, 4.6, 3.2, '1 cup', 244],
  [171267, 'Milk, 2%', 'reduced fat dairy', 50, 3.3, 4.8, 2, '1 cup', 244],
  [171269, 'Milk, skim', 'nonfat fat free dairy', 34, 3.4, 5, 0.1, '1 cup', 245],
  [170904, 'Kefir, lowfat', 'dairy drink', 43, 3.8, 4.8, 1, '1 cup', 243],
  [330137, 'Greek yogurt, nonfat', 'yoghurt plain dairy', 61, 10.3, 3.6, 0.4, '1 container', 170],
  [170903, 'Greek yogurt, lowfat', 'yoghurt plain dairy', 73, 10, 3.9, 1.9, '1 container', 170],
  [171284, 'Yogurt, plain, whole milk', 'yoghurt dairy', 61, 3.5, 4.7, 3.3, '1 container', 170],
  [328841, 'Cottage cheese, 2%', 'curd tvorog dairy', 84, 11, 4.3, 2.3, '½ cup', 113],
  [328637, 'Cheddar cheese', 'cheese', 408, 23.3, 2.4, 34, '1 slice', 28],
  [170845, 'Mozzarella', 'cheese', 299, 22.2, 2.4, 22.1, '1 slice', 28],
  [173420, 'Feta', 'cheese', 265, 14.2, 3.9, 21.5, '¼ cup, crumbled', 38],
  [171247, 'Parmesan, grated', 'cheese', 420, 28.4, 13.9, 27.8, '1 tbsp', 5],
  [173418, 'Cream cheese', 'cheese spread', 350, 6.2, 5.5, 34.4, '1 tbsp', 15],
  [171257, 'Sour cream', 'cream smetana', 198, 2.4, 4.6, 19.4, '1 tbsp', 12],
  [173410, 'Butter', 'dairy fat', 717, 0.9, 0.1, 81.1, '1 tbsp', 14],
  [167575, 'Ice cream, vanilla', 'dessert', 207, 3.5, 23.6, 11, '½ cup', 66],
  // Fats, nuts, spreads
  [171413, 'Olive oil', 'oil cooking', 884, 0, 0, 100, '1 tbsp', 14],
  [171009, 'Mayonnaise', 'mayo dressing sauce', 680, 1, 0.6, 74.8, '1 tbsp', 14],
  [174266, 'Peanut butter', 'pb spread nut', 598, 22.2, 22.3, 51.4, '1 tbsp', 16],
  [170567, 'Almonds', 'nuts almond', 579, 21.2, 21.6, 49.9, 'handful', 28],
  [170187, 'Walnuts', 'nuts walnut', 654, 15.2, 13.7, 65.2, 'handful', 28],
  [174262, 'Peanuts, roasted', 'nuts peanut', 587, 24.4, 21.3, 49.7, 'handful', 28],
  [170554, 'Chia seeds', 'seeds', 486, 16.5, 42.1, 30.7, '1 tbsp', 12],
  [169640, 'Honey', 'sweetener', 304, 0.3, 82.4, 0, '1 tbsp', 21],
  [746784, 'Sugar', 'white granulated sweetener', 385, 0, 99.6, 0.3, '1 tsp', 4],
  [169641, 'Jam', 'preserves jelly spread', 278, 0.4, 68.9, 0.1, '1 tbsp', 20],
  [168556, 'Ketchup', 'catsup sauce tomato', 101, 1, 27.4, 0.1, '1 tbsp', 17],
  // Drinks, snacks
  [171890, 'Coffee, black', 'brewed', 1, 0.1, 0, 0, '1 cup', 237],
  [169100, 'Orange juice', 'juice oj', 49, 0.7, 11.5, 0.1, '1 cup', 249],
  [173933, 'Apple juice', 'juice', 46, 0.1, 11.3, 0.1, '1 cup', 248],
  [174852, 'Cola', 'coke pepsi soda pop', 42, 0, 10.4, 0.3, '1 can', 368],
  [168746, 'Beer', 'lager ale alcohol', 43, 0.5, 3.6, 0, '1 can', 356],
  [173190, 'Red wine', 'wine alcohol', 85, 0.1, 2.6, 0, '1 glass', 147],
  [173292, 'Pizza, cheese', 'pizza slice fast food', 266, 11.4, 33.3, 9.7, '1 slice', 107],
  [170273, 'Dark chocolate, 70–85%', 'chocolate cocoa', 598, 7.8, 45.9, 42.6, '1 square', 10],
  [172716, 'Chocolate chip cookie', 'cookies biscuit', 492, 5.1, 65.4, 24.7, '1 cookie', 16],
  [169677, 'Potato chips', 'crisps snack', 532, 6.4, 53.8, 34, 'small bag', 28],
  [167959, 'Popcorn, air-popped', 'snack', 387, 12.9, 77.8, 4.5, '3 cups', 24]
]

export const STAPLES = ROWS.map(([fdc, name, words, kcal, p, c, f, serving, servingG]) => ({
  source: 'staple', code: `fdc:${fdc}`, name, brand: null, image: null, per100: { kcal, p, c, f }, servingG, serving,
  _hay: `${name} ${words}`.toLowerCase().split(/[^a-z0-9%½¼]+/).filter(Boolean)
}))

// Every typed word has to start a word of the food ("chick br" → chicken breast). Best first:
// the name itself starts with the query, then shorter names (the plain food before its variants).
export function stapleMatches(q, n = 5) {
  const toks = String(q || '').toLowerCase().split(/[^a-z0-9%]+/).filter(Boolean)
  if (!toks.length || toks.join('').length < 2) return []
  const first = toks[0]
  return STAPLES
    .filter(s => toks.every(t => s._hay.some(w => w.startsWith(t))))
    .map((s, i) => ({ s, i, r: (s.name.toLowerCase().startsWith(first) ? 0 : s.name.toLowerCase().split(/[^a-z0-9]+/).some(w => w.startsWith(first)) ? 1 : 2) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .slice(0, n)
    .map(({ s }) => { const { _hay, ...item } = s; return item })
}
