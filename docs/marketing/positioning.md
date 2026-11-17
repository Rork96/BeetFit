# BeetFit — positioning and launch kit

Written 2026-11 after a full pass over the app. Numbers about the market come from the sources at the bottom; treat vendor reports as rough.

## One line
**Calories that follow your body.** A plan for your days and kit, a camera that counts your reps, and a weekly check-in that measures what you really burn.

## Why this angle
People leave calorie apps for three reasons more than any others: logging takes too long, the database is wrong or missing things, and the results don't show (they "lost motivation"). BeetFit now answers each one with something a user can see in the first weeks:

| Why people quit | What BeetFit shows |
|---|---|
| "Logging takes too long" | Type "egg" → "Egg, whole · 1 large · 72 kcal" at once, offline. Photo and barcode for the rest. Same-as-yesterday in one tap. |
| "The numbers are wrong" | Everyday foods carry USDA values. The weekly check-in corrects the calorie target from the person's own log and scale. |
| "I can't see results" | The weight chart draws the plan as a line from day one; after a week it says "ahead of / on / behind your plan". |

The camera (reps, habits) is the hook for a video; the weekly check-in is the reason to pay.

## Three pillars (use these words)
1. **Planned** — a week built for your days and your kit. Beginners at home start on moves they can actually do.
2. **Watched** — the camera counts reps and proves habits, on the phone. Video is never uploaded.
3. **Corrected** — every week the app measures what you really burn and offers to hold the pace or hold the calories.

## What is free, what is PRO
- Free: plan, logging, camera reps, habits, the plan chart, the **first** weekly check-in, 3 meal photos and 5 Beet answers a day.
- PRO ($6.99 a month or $49.99 a year): weekly check-ins, 30 photos and 60 answers a day, strength trends for every lift, coach tools.
- The 14 free days start by themselves when the plan is built. No card. Two days before the end there is one push and a card on Today that says what was used. Turn this off with `AUTO_TRIAL = "0"` in wrangler.toml to bring back the ask-first sheet.

## Store listing
**Short (80):** A plan, a camera that counts your reps, calories that follow your body.

**Long:**
BeetFit builds a training week for the days you can make and the kit you own, then watches it happen: the camera counts your reps and scores your form on your phone, and nothing is uploaded.

Food takes seconds. Type "rice" and the plain food is there with a real portion. Photograph a plate, scan a barcode, or repeat yesterday's breakfast in one tap.

Then it corrects itself. After about two weeks of logging, BeetFit compares what you ate with what the scale did and tells you what you really burn. Hold your pace and it moves your calories. Hold your calories and it moves the date. You choose.

Habits need proof: when the reminder rings, show the camera your toothbrush, your glass or your gym bag.

Free to start, no card. PRO adds weekly check-ins, more photo estimates and more answers from Beet.

## Screenshot order
1. Weekly check-in card — "Find out what you really burn."
2. Today — "One thing next. The rest can wait."
3. Camera rep count — "The camera counts. You lift."
4. Food search — "Type 'egg'. Done."
5. Weight chart with the plan line — "See the plan. See where you are."
6. Habit proof — "Habits that need proof."

## 15-second video (vertical)
- 0–3 s: scale shows the same weight three mornings. Text: "Eating 1,900. Scale won't move."
- 3–8 s: BeetFit check-in card slides up: "2,280 kcal a day is what you really burn." Text: "The formula was 300 off."
- 8–12 s: tap "Stay on pace". Target changes. Chart line bends back to the plan.
- 12–15 s: logo. "Calories that follow your body."

## Where to post first (no paid ads)
- A build-in-public post: the 300-kcal formula error, with the check-in screenshot. Subreddits that allow it have rules on self-promotion; read each one's rules first and post as yourself.
- Short videos of the camera counting reps and of the habit check (toothbrush). These are the two things other apps don't have.
- Coaches: the coach link is free for 3 clients. One coach brings several users.

## What to measure (already tracked by /api/stats)
- Activation: first meal logged and first session done within 48 hours of the plan.
- Week 1: logging on 5 or more days (the strongest predictor of staying in the churn data below).
- Check-in reached: share of installs that get the first weekly check-in (needs 8 food days and 4 weigh-ins).
- Trial → paid, split by whether the first check-in was seen.

## Honest limits (don't claim these)
- No wake-the-phone alarm on the web. The habit alarm rings while the app is open; otherwise it is a normal notification.
- The check-in needs honest logs. It says so, and holds still when the numbers don't add up.
- Restaurant menus are not built in; the catalog file exists and is empty until official numbers are added.

## Sources
- RevenueCat, subscription churn reasons: https://www.revenuecat.com/blog/growth/subscription-app-churn-reasons-how-to-fix
- Sahha, health app retention (vendor; secondary figures): https://sahha.ai/blog/health-app-churn-retention/
- Nutrola, why people leave their first calorie app (vendor, self-reported): https://nutrola.app/en/blog/120k-first-app-churn-90-day-data-report-2026
