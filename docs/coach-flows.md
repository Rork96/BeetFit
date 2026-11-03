# Coach and client flows

## Where it lives now (before this change)
- Coach mode: only in Settings → Coach mode. A coach with no way into Settings never finds it.
- Client code entry: only on the first-run welcome screen, or in Settings → Your coach.
- Today showed only an unread-message card (`CoachNote`), nothing to start or open coaching.

## Principle
Coaching is a Today-tab entry for both roles, one card, two rows. Settings keeps the same
controls for people who look there. Nothing is hidden behind a menu.

## The Today card ("Coaching")
Row 1, client:
- No coach: "Training with a coach? Enter the code they sent you" → **Connect** → sheet with the code field.
- Coach connected: "Your coach · {name}" → **Messages** (unread count on the button).

Row 2, coach:
- Not a coach: "Be a coach" → **Start** → sheet: name → invite code → Share invite / New code → Done.
- Coach: "Your clients · N need you" + invite code → **Open** → client list (the same screen as Settings).

The server decides the role: on open, the card asks for the coach account and fills in the code, so a new phone shows the right row.

## Flows
1. **Client, first run:** welcome → "I have a coach code" (unchanged).
2. **Client, later:** Today → Coaching → Connect → code → "Coach found" → connected. Messages and targets appear the same day.
3. **Coach, first time:** Today → Coach others → Start → name → code → Share. Clients enter the code on Today → Coaching (or the first screen).
4. **Coach, daily:** Today shows "N need you" (pain report or unread message). Open → client list → client view (messages, targets, last 4 weeks, plan).
5. **Leaving:** client Disconnect and coach Remove client stay in their detail screens, not on Today.

## Decisions to confirm
- Joining as a client: free, always.
- Coach mode: free for now. Client-count or message limits belong to PRO later, once billing is live. Not built here.
- No role question in onboarding yet. The card is enough for now; a "I coach people" option on the welcome screen is the next step if people miss it.

## Not in this change
- Push for "client needs you" (reminders already cover coach messages).
- Coach seeing a client's photo meals or pain text beyond the summary (depends on what the client shares).


## Limits (0.12.0)
- Free: 3 photo estimates / 5 Beet questions per device per day, 3 linked clients per coach. PRO: 30 / 60 / 200.
- Meters come from `/api/billing/status` → `usage` (read-only, spends nothing): camera idle screen, Beet chat, Clients screen.
- Coach cap blocks only NEW joins (`coach_full`, 409 on peek and join). Existing clients are never cut off. A client already linked to that coach can re-join.
- Billing off (no Stripe/RevenueCat keys) → no caps, no meters.
- Onboarding: "I coach people" chip → after the plan is built, Today opens coach setup once.
- The 3-client free cap is a pricing choice, not tested against users. Change `FREE.clients` in worker/src/billing.js.


## Navigation and first-run flow (0.13.0)
- Tabs: Today · Train · Food · Beet · Progress. Beet is a tab now (chat embedded, meter above the input); Today's Beet card opens it with the tapped question.
- Today = one "Next up" card: workout on a training day, then first meal, weigh-in if the last is 7+ days old, water, then "Today is done". `nextUp()` in src/lib/day.js, tested. The Food/Water/Train chips live inside that card.
- Coach is not on Today any more. Clients: first screen ("I have a coach code") or Settings → Your coach. Coaches: first screen ("I coach people" → Settings opens on coach setup, name field focused) or Settings → Coach mode. A coach who has set up sees one "Coach · N clients" strip on Today.
- Paywall: shown once, right after the plan is built (reason `welcome`, only rows that differ, "Continue free" visible). Not shown on web-less/native builds, to coaches mid-setup, or to restored accounts. Other triggers unchanged: photo/Beet limit hit, strength trends, coach client cap.
- Welcome screen: promise + "Build my plan" first, privacy notes below the actions.

## Time of day, plan review, email (0.14.0)

- **Next up** reads the clock: a scheduled workout wins from 90 min before; without a time, training is suggested from 10:00 and dropped after 21:00. Then food, weigh-in (7+ days), pending training, water.
- **Plan review**: the server rebuilds the allowed exercise pool from the intake. A swap is kept only if the target is in that pool, has the same movement pattern, is not already in the session; max 3. The person accepts each one. 4 reviews/day/device.
- **Email check-in**: opt-in in Settings → Reminders, accounts only. One email a day at the chosen local time, only when the synced document shows something open. Skipped if the cron runs more than 2 h late. Failed sends retry within that window. Every message carries a signed one-click unsubscribe (`List-Unsubscribe-Post`).
