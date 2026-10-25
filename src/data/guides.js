// Short guides. Written for BeetFit; numbers checked against the sources listed under each guide.
// Block types: { h } heading, { p } paragraph, { ul: [] } list, { tip } highlighted line.

export const GUIDES = [
  {
    id: 'progress', cat: 'Training', mins: 3,
    title: 'How your plan gets harder',
    lead: 'Each exercise has a rep range. Fill the range, then add weight.',
    body: [
      { p: 'BeetFit uses double progression. Say the target is 3 × 8–12. Keep the same weight until every set reaches 12 good reps. Next session, add the smallest jump you have (1–2.5 kg on dumbbells, 2.5–5 kg on a barbell) and start again from around 8.' },
      { h: 'RPE: how hard was that?' },
      { p: 'After each set you pick an RPE from 6 to 10. It means how many reps you had left: RPE 8 is two more in the tank, RPE 10 is nothing left. Most working sets should land at 7–9. If you log RPE 10 often, the weight is too heavy for that rep range.' },
      { h: 'When to hold back' },
      { ul: ['Form breaks down before the last rep: keep the weight, own the range.', 'You slept badly or feel run down: do the session, skip the jump.', 'Anything hurts sharply: stop the exercise and tap Report pain. The plan swaps it out.'] },
      { tip: '“Last time” under each exercise shows what to beat. One more rep counts as progress.' }
    ]
  },
  {
    id: 'protein', cat: 'Food', mins: 3,
    title: 'Protein, simply',
    lead: 'It’s the macro that protects muscle when you lose fat and builds it when you train.',
    body: [
      { p: 'For people who lift, gains in muscle level off at around 1.6 g of protein per kg of body weight a day; some people do a bit better up to about 2.2 g/kg. Your target on Today is set in that range.' },
      { h: 'Make it easy' },
      { ul: ['Split it over 3–4 meals of roughly 25–40 g each.', 'Start with the protein when you plan a meal, then add the rest.', 'Fast options: Greek yogurt or skyr, cottage cheese, eggs, tuna, chicken, tofu, lentils, a whey shake.', 'Short at dinner? A tub of skyr is about 15–20 g.'] },
      { tip: 'Scan the barcode of anything you eat often. Next time it’s one tap.' }
    ],
    sources: [{ t: 'Morton et al., Br J Sports Med 2018 — protein and resistance training meta-analysis', u: 'https://bjsm.bmj.com/content/52/6/376' }]
  },
  {
    id: 'scale', cat: 'Progress', mins: 2,
    title: 'Why the scale jumps',
    lead: 'Day to day, weight moves with water, salt and food in your gut, not fat.',
    body: [
      { p: 'A swing of 0.5–1.5 kg overnight is normal. A salty dinner, a hard leg day, more carbs than usual or a late meal can all push it up. None of that is fat.' },
      { p: 'That’s why Progress draws a 7-day average line. Judge the trend over two weeks, not one morning.' },
      { h: 'Weigh in the same way' },
      { ul: ['Morning, after the toilet, before food or drink.', 'Same scale, same spot on the floor.', 'Log every day you can. More points make a steadier average.'] },
      { h: 'What pace is right' },
      { p: 'For fat loss, about 0.5–1% of body weight a week keeps most muscle. Faster usually costs strength and makes hunger harder to manage.' }
    ],
    sources: [{ t: 'Helms et al., J Int Soc Sports Nutr 2014 — recommendations for losing weight while keeping muscle', u: 'https://jissn.biomedcentral.com/articles/10.1186/1550-2783-11-20' }]
  },
  {
    id: 'hurts', cat: 'Training', mins: 2,
    title: 'Sore or hurt?',
    lead: 'Soreness is normal after new training. Pain is a signal to change something.',
    body: [
      { p: 'Muscle soreness usually peaks a day or two after a session and fades within about three days. It feels dull, sits in the muscle you worked, and eases as you warm up.' },
      { h: 'Stop and change the exercise if' },
      { ul: ['The pain is sharp, stabbing or in a joint.', 'It gets worse as you keep going.', 'It changes how you move, or there’s swelling, numbness or tingling.'] },
      { p: 'Tap Report pain on the exercise. BeetFit swaps it for one that doesn’t load the same area and tells your coach if you have one.' },
      { tip: 'Chest pain, dizziness or feeling faint: stop now and get medical help.' }
    ]
  },
  {
    id: 'sleep', cat: 'Recovery', mins: 2,
    title: 'Sleep is part of the plan',
    lead: 'Adults need 7 hours or more on a regular basis.',
    body: [
      { p: 'Short sleep makes sessions feel heavier and makes you hungrier the next day. A few nights of better sleep often fixes a “plateau” faster than changing the program.' },
      { ul: ['Keep the same wake-up time, weekends included.', 'Last big meal and caffeine well before bed.', 'Dark, cool room; phone away from the pillow.', 'Shift work: protect one long block of sleep and use the dark room trick by day.'] },
      { tip: 'Log sleep in the daily check-in on Progress. Your coach and Beet see it.' }
    ],
    sources: [{ t: 'Watson et al., Sleep 2015 — AASM / SRS consensus on adult sleep', u: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4434546/' }]
  },
  {
    id: 'steps', cat: 'Recovery', mins: 2,
    title: 'Steps, the easy win',
    lead: 'Walking burns more over a week than most people expect, and barely touches recovery.',
    body: [
      { p: 'In an analysis of 15 studies with about 47,000 adults, the risk of death kept falling with more daily steps until about 8,000–10,000 for people under 60 and 6,000–8,000 for people over 60.' },
      { ul: ['Add 1,000–2,000 a day to where you are now, not 10,000 overnight.', 'Walk 10 minutes after meals.', 'Calls on foot, stairs over lifts, park further away.'] }
    ],
    sources: [{ t: 'Paluch et al., Lancet Public Health 2022 — daily steps and mortality', u: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9289978/' }]
  },
  {
    id: 'eatingout', cat: 'Food', mins: 2,
    title: 'Eating out without wrecking the week',
    lead: 'One meal never ruins progress. The plan is to make it a decent one and move on.',
    body: [
      { ul: ['Pick the protein first: grilled chicken, fish, steak, a burger without the extras.', 'Ask for sauces and dressings on the side.', 'Choose one of: bread, fries, dessert, a second drink.', 'Snap a photo of the plate. The estimate is good enough.'] },
      { p: 'Next day, go back to normal. Cutting hard to “make up for it” tends to lead to the next big meal.' }
    ]
  },
  {
    id: 'camera', cat: 'App', mins: 2,
    title: 'Getting clean rep counts',
    lead: 'The camera runs on your phone. Video is never uploaded.',
    body: [
      { ul: ['Phone at hip height, about 2 m away, whole body in frame.', 'Squats, hinges, lunges: side-on works best. Push-ups and curls: front or side both work.', 'Light from in front of you, not a window behind you.', 'Do one slow warm-up rep: the counter learns your range.'] },
      { p: 'If a count looks wrong, fix it with the − / + buttons before you save the set. Turn on Accurate tracking in Settings for a bigger model if your phone can take it.' }
    ]
  },
  {
    id: 'plateau', cat: 'Progress', mins: 3,
    title: 'Stuck? Check these first',
    lead: 'Most plateaus are logging or consistency, not metabolism.',
    body: [
      { h: 'Weight not moving for 2–3 weeks' },
      { ul: ['Are you logging everything, including oil, drinks and weekends?', 'Have steps dropped?', 'Is the 7-day average flat, or just today’s number?'] },
      { p: 'If logging is honest and the average is flat for three weeks, take about 100–150 kcal off the target, or ask your coach to.' },
      { h: 'Lifts not going up' },
      { ul: ['Sleep under 7 hours most nights?', 'Protein under target?', 'RPE 10 on most sets: drop the weight 5–10% and build back.'] }
    ]
  }
]

export const guideById = id => GUIDES.find(g => g.id === id)

// Two picks for Today, based on what's going on.
export function pickGuides(state, read = []) {
  const want = []
  if ((state.painFlags || []).length) want.push('hurts')
  if ((state.weightLog || []).length >= 4) want.push('scale')
  if (Object.keys(state.workoutLog || {}).length) want.push('progress')
  want.push('protein', 'camera', 'sleep', 'steps', 'eatingout', 'plateau', 'scale', 'progress')
  const seen = new Set()
  const unread = want.filter(id => !read.includes(id) && !seen.has(id) && seen.add(id))
  return (unread.length ? unread : want).slice(0, 2).map(guideById)
}
