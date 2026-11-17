// Mifflin-St Jeor BMR + TDEE + macro split

export const ACTIVITY_LEVELS = [
  { id: 'sedentary', label: 'Sedentary (office, no exercise)', factor: 1.2 },
  { id: 'light', label: 'Light (1-3 workouts/week)', factor: 1.375 },
  { id: 'moderate', label: 'Moderate (3-5 workouts/week)', factor: 1.55 },
  { id: 'active', label: 'Active (6-7 workouts/week)', factor: 1.725 },
  { id: 'athlete', label: 'Very active (physical job + training)', factor: 1.9 }
]

export const GOALS = [
  { id: 'lose', label: 'Lose weight', adjust: -0.2 },
  { id: 'maintain', label: 'Maintain', adjust: 0 },
  { id: 'gain', label: 'Gain muscle', adjust: 0.1 }
]

export function bmr({ sex, age, heightCm, weightKg }) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return Math.round(sex === 'male' ? base + 5 : base - 161)
}

export function tdee(profile) {
  const level = ACTIVITY_LEVELS.find(a => a.id === profile.activity) || ACTIVITY_LEVELS[0]
  return Math.round(bmr(profile) * level.factor)
}

export const MIN_AGE = 16 // matches the Terms and the Privacy Policy
// Lowest unsupervised daily intake (Academy of Nutrition and Dietetics): 1,200 kcal for women, 1,500 for men.
export const kcalFloor = profile => (profile.sex === 'male' ? 1500 : 1200)
// Under 18 the app plans to maintain: growing bodies are not put on a deficit.
export const noDeficit = profile => (profile.age < 18 ? 'teen' : null)
// Lowest weight the app will aim for: a BMI of 18.5.
export const minTargetKg = heightCm => Math.ceil(18.5 * (heightCm / 100) ** 2 * 10) / 10

// 1 kg of body weight ≈ 7,700 kcal, so 1 kg a week ≈ 1,100 kcal a day.
export const KCAL_PER_KG_WEEK = 1100
export const MAX_DEFICIT = 0.25 // of daily burn
export const MAX_SURPLUS = 0.15
// Safe weekly pace: 1% of body weight down, 0.5% up.
export const maxRate = (profile, goal = profile.goal) => +(profile.weightKg * (goal === 'gain' ? 0.005 : 0.01)).toFixed(2)

// What the body burns in a day. The formula is a population average; once the app has measured the person
// (lib/adapt.js: food logged against the weight trend) the difference is kept in profile.burnAdj.
export function burn(profile) {
  const f = tdee(profile)
  const adj = Math.max(-0.3 * f, Math.min(0.3 * f, +profile.burnAdj || 0))
  return Math.round(f + adj)
}

// profile.rateKg = planned kg a week (set from target and timeframe at onboarding, editable in Settings).
// Profiles from before it existed keep the old flat −20% / +10%.
export function targetCalories(profile) {
  const goal = GOALS.find(g => g.id === profile.goal) || GOALS[1]
  const T = burn(profile), floor = kcalFloor(profile)
  if (goal.adjust < 0 && noDeficit(profile)) return Math.max(floor, T)
  if (profile.rateKg > 0 && goal.adjust !== 0) {
    const d = profile.rateKg * KCAL_PER_KG_WEEK
    const kcal = goal.adjust < 0 ? T - Math.min(d, T * MAX_DEFICIT) : T + Math.min(d, T * MAX_SURPLUS)
    return Math.max(floor, Math.round(kcal / 10) * 10)
  }
  return Math.max(floor, Math.round(T * (1 + goal.adjust)))
}

// The pace the calorie target really delivers (kg a week, signed: negative = losing), after the caps and the floor.
export const realRate = profile => +((targetCalories(profile) - burn(profile)) / KCAL_PER_KG_WEEK).toFixed(2)

// When the target weight arrives at that pace: { weeks, date } or null (maintaining, or the pace is ~0).
export function eta(profile, fromKg = profile.weightKg, from = new Date()) {
  const diff = profile.targetKg - fromKg, r = realRate(profile)
  if (Math.abs(diff) < 0.3 || Math.abs(r) < 0.03 || Math.sign(diff) !== Math.sign(r)) return null
  const weeks = diff / r
  const date = new Date(from); date.setDate(date.getDate() + Math.round(weeks * 7))
  return { weeks: Math.round(weeks), date }
}

// Why the number isn't the plain 20% deficit, if it isn't. Shown next to the target.
export function targetNote(profile) {
  const goal = GOALS.find(g => g.id === profile.goal) || GOALS[1]
  if (goal.adjust >= 0) return null
  if (noDeficit(profile)) return 'Under 18 the plan keeps you at maintenance. Growing bodies are not put on a deficit.'
  const T = burn(profile)
  const plain = profile.rateKg > 0 ? Math.round(T - Math.min(profile.rateKg * KCAL_PER_KG_WEEK, T * MAX_DEFICIT)) : Math.round(T * (1 + goal.adjust))
  if (profile.rateKg > 0 && plain >= kcalFloor(profile) && profile.rateKg * KCAL_PER_KG_WEEK > T * MAX_DEFICIT + 5) return `Capped at a ${Math.round(MAX_DEFICIT * 100)}% deficit: faster than that costs muscle. Expect about ${Math.abs(realRate(profile))} kg a week.`
  if (plain < kcalFloor(profile)) return `Raised to ${kcalFloor(profile)} kcal, the lowest safe daily intake without a clinician. Weight will move slower.`
  return null
}

// protein 1.8 g/kg, fat 25% kcal, carbs = rest
export function macros(profile) {
  const kcal = targetCalories(profile)
  const protein = Math.round(profile.weightKg * 1.8)
  const fat = Math.round((kcal * 0.25) / 9)
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4))
  return { kcal, protein, fat, carbs }
}

export function bmi({ heightCm, weightKg }) {
  const h = heightCm / 100
  return +(weightKg / (h * h)).toFixed(1)
}

export function bmiCategory(v) {
  if (v < 18.5) return 'Underweight'
  if (v < 25) return 'Normal'
  if (v < 30) return 'Overweight'
  return 'Obese'
}
