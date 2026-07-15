# Handoff: BeetFit Full UI Redesign

## Overview
Complete redesign of the BeetFit Telegram Mini App around a daily-program model: onboarding → generated plan → "Today" execution screen → visible progress. Replaces the current Profile/Meals/Workout-only tab structure with 5 tabs (Today / Meals / Workouts / Progress / Read) plus stacked sub-screens (workout session, camera tracker, article, log-today).

## About the Design Files
`BeetFit.dc.html` (+ its runtime `support.js`) is a **design reference built in HTML** — a working prototype showing the intended look, behavior, and state model. It is NOT production code to copy. The task is to **recreate it in the existing React 18 + Vite codebase** (plain JS, no router, single CSS file mapped to `--tg-theme-*` vars), replacing prototype mocks with the app's real modules where noted below.

How to read the prototype file: the markup lives between `<x-dc>…</x-dc>` (template with `{{ hole }}` bindings, `<sc-if>`/`<sc-for>` = conditional/loop); the logic lives in the `class Component` script at the bottom — `state`, data constants (`DISHES`, `EXS`, `ARTS`), helpers (`calc`, `eaten`, `r1`, `wNow`, `push`/`goBack`), and `renderVals()` which maps state → template values. Translate `renderVals()` into React components/hooks; do not run the DC runtime in production.

## Fidelity
**High-fidelity.** Recreate pixel-faithfully: exact colors, typography, spacing, radii, and copy are in the inline styles of the template. All styling is inline in the HTML — every value you need is on the element.

## State Model (port as-is — it is already debugged)
Single top-level state object (Context + useReducer, or a small store hook):

- `phase`: `'onb' | 'app'`; `obStep`: 0–2
- `prof`: `{sex, age, height, weight, target, act (0–4), goal ('lose'|'maintain'|'gain')}`
- `nav`: **array used as a navigation stack** — e.g. `['session','tracker']`. `push(name)` appends; single `goBack()` pops, and is the ONLY back handler: onboarding back-steps, sub-screen close, and Telegram `BackButton.onClick` all route through it. BackButton shown iff `nav.length>0 || (onb && obStep>0)`. Overlay visible iff `nav.includes(name)`; tracker stacks on top of session so closing it returns to the session with sets intact.
- `tab`: `'today'|'meals'|'workouts'|'progress'|'read'` — preserve each tab's scroll position on switch (prototype keeps a `_scroll` map keyed by tab, restored via ref).
- `meals`: 4 slots `[{di (dish index), por (0.6–1.6 step 0.2), log (bool)}]`
- `sets`: `boolean[exercise][set]`; `sessionDone`, `rest` (seconds), `reps`, `manual`, `trackerName`
- `water` (glasses, 0.25 L each), `loggedW`, `meas`, `photos`, `artId`, `q` (search), `toast`

**Number discipline (critical — this fixed real bugs):**
- `r1(v) = Math.round(v*10)/10` at EVERY numeric mutation (steppers, weight log). Display kg/cm with `.toFixed(1)`, kcal/g with `Math.round`.
- ONE `calc()` (calorie/macro targets) and ONE `eaten()` (consumed totals) function, called from every screen. Never re-derive per screen.
- `wNow() = loggedW ?? prof.weight` is the single current-weight source (chart, avatar, %-to-goal, summary).

## Replace Prototype Mocks with Real Code
1. **Camera tracker**: prototype simulates reps with `setInterval` (2.6 s) and an animated SVG stick figure. Replace entirely with `src/components/PoseTracker.jsx` (MediaPipe pose_landmarker_lite, existing angle-threshold state machine for squat/curl/press). KEEP the prototype's full-screen UI: exercise name top-left, Stop pill top-right, 104px rep counter bottom-center, persistent "Count manually instead" underlined link (→ 170px circular tap-per-rep button). Haptic per rep. On camera error → keep manual mode reachable, never a dead end.
2. **Calorie engine**: use `src/lib/calories.js` for `calc()`; delete the inline Mifflin-St Jeor duplication in the prototype.
3. **Persistence**: `src/lib/store.js` (localStorage `fittrack_state_v1` + CloudStorage chunking) persists the full state object.

## Additional Requirements (not in prototype — build during port)
- **Streak**: compute from persisted per-date task-completion history; a day counts as complete at 3-of-4 daily tasks (matches the "Why streaks beat willpower" article copy). Replace the hardcoded `streak:12`.
- **dateStr**: derive from the real current date (prototype hardcodes 'Monday, July 13'). Also the weight-chart x-axis labels ('Jun 1'/'Jul 13') and 'Week 3 of 8' badge — derive from program start date.
- **Avatar transition**: when a new weight is logged, animate silhouette between old and new BMI over ~500 ms (interpolate the width parameters `sh/ch/wa/hp/aw/lw` — see `mkAvatar()`'s `layer()` fn — with an eased tween, same pattern as the calorie `tw()` tween). Keep the `breathe` idle animation (4.5 s, transform-origin 60px 140px).
- **Settings screen**: new — edit age/height/target/goal post-onboarding (same stepper rows as onboarding, 38px ± buttons), kg/lb toggle (display-only conversion, store kg), reset app data via `tg.showConfirm` (window.confirm is blocked in Telegram).
- **Weight-log history**: prototype fakes history as offsets from current weight (`WDELTAS`). Real app: one entry per date, same-day overwrite (existing app rule); chart renders the real log.

## Screens
All screens 390×844 reference, content area `inset:0 0 72px 0`, padding `max(18px, env(safe-area-inset-top)) 16px 20px`, scrollable.

### 1. Onboarding (3 steps, back arrow on every step, values persist through back/forward)
- **Step 0 — Goal**: logo row (22px accent circle + "BeetFit" 700 19px) with "Skip"; H1 "What's your goal?" 700 32px; 3 option cards (18px padding, radius 18, 1.5px border — selected: accent border + accent-14% bg + filled 22px radio dot) with title 600 17px + desc 13px hint; full-width Continue button (17px padding, radius 16, accent bg, white 600 17px).
- **Step 1 — About you**: sex segmented pair; 4 stepper rows (radius 14, secondary-bg; − / value+unit / + with 38×38 radius-12 buttons): Age yrs 14–80 ×1, Height cm 130–220 ×1, Weight kg 40–200 ×0.5, Target kg 40–200 ×0.5; activity list (5 cards: Sedentary/Light/Moderate/Active/Athlete with descriptions); "Build my plan" CTA.
- **Step 2 — Plan ready**: back link; eyebrow "YOUR PLAN IS READY" (accent, 600 13px, letter-spacing .1em); kcal numeral 700 64px; 3 macro chips (radius 12, secondary bg); "N workouts / week · 8-week program"; 280px avatar (current + target ghost) with legend dots; "Start Day 1" CTA.

### 2. Today (bento grid, 2 columns, 10px gap)
- Header: date 13px hint + "Today" 700 26px; streak pill right (accent-14% bg, accent text, 8px dot, "12-day streak").
- **Calories card** (span 2): label uppercase 12px; numeral 700 58px animated count-up (~900 ms cubic ease-out — see `tw()`; re-tween on every eaten-total change) + "/ TARGET kcal"; 6px progress bar (accent, width transition .5s); carbs/fat sub-row.
- **Protein tile** + **Water tile** (water is a button: tap adds a 0.25 L glass; value in #7cc3ff).
- **Workout card** (span 2, 150px): photo bg at .55 opacity + left gradient; eyebrow "TODAY'S WORKOUT" accent; name 700 21px; CTA pill — label is stateful: "Start session" / "Continue" (any set done) / "Done ✓".
- **Body tile**: 120px avatar, "Progress →" link (navigates to Progress tab).
- **Week ring tile**: SVG ring (r 26, stroke 6, dasharray from weekly %), % text centered.
- **Daily tasks card** (span 2): 4 rows, 26px radius-9 checkboxes (checked = accent fill + white check). Tasks derive from real state: meals logged x/4, workout done, water 2 L, habit. Checked rows at .55 opacity.
- **Article card** (span 2): 76px thumb, category eyebrow, title 600 16px.

### 3. Meals
- Search field (radius 14, secondary bg) + 48px barcode button (accent barcode icon; mock → toast "coming with Open Food Facts"). Typing shows a live results panel over all 12 dishes; no matches → centered empty state "No foods found — try another name".
- **Macro donut** (r 45, stroke 10): protein arc accent, carbs white .75, fat white .3, sequential rotation offsets; center = animated eaten kcal / target; legend right + "N kcal left today".
- **4 slot cards** (Breakfast 25% / Lunch 35% / Dinner 30% / Snack 10% of target): "budget N kcal" caption; 62px dish photo; name + "kcal · g protein" (scaled by portion); 44×44 log checkbox (accent when logged); portion stepper ×0.6–1.6; "Swap dish" button cycles 3 dishes per slot at ~same budget. Donut + Today tiles must stay consistent at all times (same `eaten()`).

### 4. Workouts
- 3 program chips (Lose · 3d / Maintain · 3d / Gain · 4d) — selected = accent border/text.
- "WEEK 3 OF 8" caption; day cards: done (green ✓ circle), today (accent-tinted border + Start pill), upcoming. Session complete flips today's card to Done.
- Camera-tracking promo banner (photo bg, 110px).
- **Session sub-screen** (nav push): back button; "N of M sets done" + progress bar; per-exercise card: name + rep scheme, 50×50 set squares (tap toggles; done = accent fill + ✓; completing a set starts a 45 s rest), camera-enabled exercises get an accent "Camera" button; floating rest pill (fixed bottom, count-down + Skip); "Finish session" CTA (logs, clears rest, pops nav, toast).
- **Tracker sub-screen** (nav push on top of session): see mock-replacement §1.

### 5. Progress
- Header + "+ Log today" pill button (accent).
- **Avatar hero card** (radius 24): now-kg / 300px avatar / goal-kg columns; legend; gradient progress bar accent→#6fd39a; "N% of the way to your goal" (clamped 0–100, never NaN); optional measurements caption when logged.
- **Weight chart**: SVG polyline (accent, 2.5), dashed green target line + "goal N" label, end-point dot; delta label derived from log (e.g. "−2.3 kg in 6 weeks"); date range labels.
- **Weekly completion bars**: 7 bars M–S; 100% = accent, partial = accent 45%, zero = white 7%.
- **Progress photos grid** (3 cols, 3:4, radius 14): placeholder tiles with week label + × remove; dashed + tile appends next week. Real app: capture via camera/file input.
- **Log-today sub-screen** (nav push): stepper rows — Weight kg (required, ×0.1) + optional Waist/Chest/Hips cm; note "Logging again today overwrites this entry."; Save → updates chart + avatar (animated) + %-to-goal immediately, pops nav, toast.

### 6. Read
- Feed of 4 article cards: 150px cover photo, category + "N min read" eyebrow (accent), title 600 18px.
- **Article sub-screen**: 230px cover with bottom gradient into bg, floating back button; eyebrow; title 700 27px; body paragraphs 16.5px/1.65 at 88% text color. 4 articles with full body copy are in `ARTS` in the prototype — reuse verbatim.

### Tab bar
64px + safe-area, `rgba(15,16,21,.92)` + `backdrop-filter: blur(16px)`, 1px top hairline; 5 items, 22px stroke icons (inline SVG, see template) + 10.5px 600 labels; active = accent, inactive = hint color.

## Interactions & Behavior
- Toast: pill fixed above tab bar, `popIn` .2s, auto-dismiss 2 s (single timeout, replaced on new toast).
- Haptics (`tg.HapticFeedback.impactOccurred('light')`): rep count, set toggle, meal log, water add, task check.
- Timers: rest interval and any tracker loop MUST be cleared on `goBack()`, on finish, and on unmount (prototype bugs found & fixed here — keep the discipline).
- Sub-screens animate in with `fadeUp` .25 s; onboarding steps `fadeUp` .4 s.
- No `window.confirm` anywhere — `tg.showConfirm`.
- Empty states everywhere; never render NaN/undefined.

## Design Tokens
- Background: `var(--tg-theme-bg-color, #0c0d11)`; cards: `var(--tg-theme-secondary-bg-color, #16181f)`; text: `var(--tg-theme-text-color, #f1f2f6)`; hint: `var(--tg-theme-hint-color, #8a8f9c)`.
- Accent: `#FF4D6D` (single accent; tint = same at 14% alpha). Success/target green: `#6fd39a`. Water blue: `#7cc3ff`.
- Type: 'Space Grotesk' (Google Fonts, 400–700) for headings/numerals/buttons; system-ui for body/captions. Numerals: 64/58/36/30px, letter-spacing −.02 to −.04em. Uppercase eyebrows: 600 11–13px, letter-spacing .06–.1em.
- Radii: cards 20 (hero 24), inputs/buttons 14–16, chips/pills 999, checkboxes 9–15. Hairlines: `rgba(255,255,255,.07–.12)`.
- Hit targets ≥ 44px on all primary controls.

## Avatar (port `mkAvatar()` faithfully)
Inline SVG, viewBox `0 0 120 256`. BMI → t = clamp((bmi−17)/23, 0, 1); linear-interpolate widths: shoulders 24→34, chest 20→33, waist 13→31, hips 17→33, arm stroke 8→16, leg stroke 11→20. Two layers: target ghost (green `#6fd39a`, dashed `4 5`, opacity .5, no fill) under current (accent stroke, `rgba(accent,.14)` fill, `breathe` animation). Torso is a single cubic-bezier path; limbs are round-capped lines. Height from profile; weight from `wNow()`.

## Assets
Food/workout photos are Unsplash URLs (`img()` helper builds them) — placeholders only; replace with licensed/own photography for production. All icons are inline SVG in the template (copy directly). No other assets.

## Files
- `BeetFit.dc.html` — the complete prototype (template + logic + data)
- `support.js` — prototype runtime only; do not port

## Definition of Done
- All 6 screens + Settings, pixel-faithful; nav stack + Telegram BackButton; real PoseTracker/calories/store wired; streak & dates real; avatar tween; kg/lb toggle; reset via showConfirm; fully offline; `npm run build` passes.
