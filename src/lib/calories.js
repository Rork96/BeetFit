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

export function targetCalories(profile) {
  const goal = GOALS.find(g => g.id === profile.goal) || GOALS[1]
  return Math.round(tdee(profile) * (1 + goal.adjust))
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
