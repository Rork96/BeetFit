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
