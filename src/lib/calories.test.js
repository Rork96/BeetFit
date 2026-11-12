import { describe, it, expect } from 'vitest'
import { targetCalories, targetNote, tdee, minTargetKg, MIN_AGE } from './calories.js'

describe('safety limits', () => {
  const base = { sex: 'female', age: 40, heightCm: 160, weightKg: 52, activity: 'sedentary', goal: 'lose' }
  it('never goes below the unsupervised floor', () => {
    expect(targetCalories(base)).toBe(1200)
    expect(targetNote(base)).toMatch(/1200/)
    expect(targetCalories({ ...base, sex: 'male', age: 60, weightKg: 55, heightCm: 160 })).toBe(1500)
  })
  it('leaves normal targets alone', () => {
    const p = { sex: 'male', age: 30, heightCm: 180, weightKg: 90, activity: 'moderate', goal: 'lose' }
    expect(targetCalories(p)).toBe(Math.round(tdee(p) * 0.8))
    expect(targetNote(p)).toBe(null)
  })
  it('keeps under-18s at maintenance', () => {
    const t = { sex: 'male', age: 17, heightCm: 175, weightKg: 80, activity: 'moderate', goal: 'lose' }
    expect(targetCalories(t)).toBe(tdee(t))
    expect(targetNote(t)).toMatch(/Under 18/)
  })
  it('minimum target is BMI 18.5 and the age limit matches the Terms', () => {
    expect(minTargetKg(180)).toBeCloseTo(60, 0)
    expect(MIN_AGE).toBe(16)
  })
})
