import { describe, it, expect } from 'vitest'
import { recentFoods, lastMeal, kcalRange, toCSV, fatItem } from './foods.js'
import { targets, foodCycle, addDays, weekday } from './day.js'

const T = '2026-11-02' // Monday
const yog = { name: 'Greek yogurt', grams: 170, kcal: 150, p: 17, c: 6, f: 4, slot: 'breakfast' }
const oats = { name: 'Oats', grams: 60, kcal: 230, p: 8, c: 40, f: 4, slot: 'breakfast' }
const rice = { name: 'Rice', grams: 200, kcal: 260, p: 5, c: 56, f: 1, slot: 'lunch' }

describe('quick re-log', () => {
  const state = { foodLog: { [addDays(T, -1)]: [yog, rice], [addDays(T, -2)]: [yog, oats], [addDays(T, -5)]: [{ ...yog, grams: 200 }] } }
  it('ranks by how often you eat it, with your last portion', () => {
    const r = recentFoods(state, T)
    expect(r[0]).toMatchObject({ name: 'Greek yogurt', grams: 170, count: 3 })
    expect(r.map(x => x.name)).toEqual(['Greek yogurt', 'Rice', 'Oats'])
  })
  it('finds the last meal in a slot', () => {
    expect(lastMeal(state, T, 'breakfast')).toMatchObject({ date: addDays(T, -1), kcal: 150 })
    expect(lastMeal(state, T, 'dinner')).toBeNull()
  })
})

describe('honest photo estimate', () => {
  it('range widens when unsure', () => {
    expect(kcalRange(500, 0.9)).toEqual([430, 580])
    expect(kcalRange(500, 0.3)).toEqual([330, 680])
  })
  it('cooking fat item', () => {
    expect(fatItem(14)).toMatchObject({ kcal: 124, f: 14 })
    expect(fatItem(0)).toBeNull()
  })
})

describe('training-day targets', () => {
  const profile = { sex: 'male', age: 30, heightCm: 180, weightKg: 80, targetKg: 75, goal: 'maintain', activity: 'moderate' }
  // Mon, Wed, Fri weekly
  const mk = d => ({ id: 'w' + d, kind: 'workout', date: addDays(T, d), repeat: 'weekly', auto: 'week' })
  const state = { profile, plans: [mk(0), mk(2), mk(4)] }
  it('no plan → plain target', () => {
    expect(targets({ profile }, T).dayType).toBeNull()
  })
  it('training days up, rest days down, week average unchanged', () => {
    const plain = targets({ profile }, T).kcal
    const week = Array.from({ length: 7 }, (_, i) => targets(state, addDays(T, i)))
    expect(week.map(t => t.dayType)).toEqual(['train', 'rest', 'train', 'rest', 'train', 'rest', 'rest'])
    const avg = week.reduce((a, t) => a + t.kcal, 0) / 7
    expect(Math.abs(avg - plain)).toBeLessThan(15)
    expect(week[0].protein).toBe(week[1].protein)
    expect(week[0].kcal).toBeGreaterThan(week[1].kcal)
  })
  it('switch off in settings', () => {
    expect(targets({ ...state, settings: { cycleFood: false } }, T).dayType).toBeNull()
  })
  it('a logged session on a rest day counts as training', () => {
    const s = { ...state, workoutLog: { [addDays(T, 1)]: { Squat: { sets: [{ reps: 5 }] } } } }
    expect(foodCycle(s, addDays(T, 1)).type).toBe('train')
    expect(weekday(T)).toBe(0)
  })
})

describe('CSV export', () => {
  it('has food, sets, weight and quotes commas', () => {
    const csv = toCSV({ foodLog: { [T]: [{ ...rice, name: 'Rice, white' }] }, workoutLog: { [T]: { Squat: { sets: [{ reps: 5, w: 60 }] }, __warmup: 'done' } }, weightLog: [{ date: T, kg: 80 }] })
    const lines = csv.trim().split('\n')
    expect(lines[0]).toMatch(/^date,type,item/)
    expect(lines).toContain(`${T},food,"Rice, white",200,g,260,5,56,1,,,,lunch`)
    expect(lines).toContain(`${T},set,Squat,5,reps,,,,,1,60,,`)
    expect(lines.some(l => l.includes('__warmup'))).toBe(false)
    expect(lines).toContain(`${T},weight,body weight,80,kg,,,,,,,,`)
  })
})
