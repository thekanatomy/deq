# deq — context for Claude

deq (deq.one) is a local-first React PWA that keeps the people you meet as Apple Wallet-style cards. Built by Kanish (ASU). It launched on 13 Nov 2026.

## Stack
- **App:** React 19, Vite 8, motion/react, Dexie (IndexedDB db `allyDeck`, store `cards`, with sync fields `uid`, `updatedAt`, `dirty`, `deleted`).
- **Supabase:** email OTP sign-in, a `cards` table with RLS, and a private `photos` bucket.
- **Sync** (`src/sync.js`): push then pull. A full pull runs after sign-in, and it repeats every 20s while the app is open.
- **Vercel:** hosting, with serverless functions in `/api` (scan, vcard, ics, wallet pass). API keys live server-side only.
- **Service worker:** generated from `src/sw-template.js`.
- **Updates** (`src/update.js`): deq reloads when deq.one has a newer build. The Home Screen app reloads fresh after more than a minute away, and reloads once if the screen is blank.
- **Laptop view:** `src/Desktop.jsx` shows a grid plus a QR code that sends people to the phone.

## Design language (keep it)
- Apple-like design:
  - SF / system type.
  - Springs with no bounce on UI.
  - Glass buttons.
  - Text hierarchy like iOS.
  - Light first.
- Cards are 5:7 Wallet cards with mesh backgrounds based on the company (`meshImage`).
- **Opening a card:** one tap opens the full details (ZoomView). The card flies out of the deck with a shared-layout spring (`FLIGHT`: bounce 0, 0.42s), like Apple Wallet. A blur/zoom transition was tried and rejected, so don't bring it back.
- **The open card (ZoomView):**
  - The top left has an AirDrop/Share button that shares the person's deq card link, not plain text.
  - The end has Edit Card and a two-tap Delete.
- **The menu** has Privacy, Account, Your Card (Apple Wallet on iPhone, Google Wallet on Android), Export Deck (a CSV for Excel, with phone numbers kept intact and formula injection defused) and About.
- **The edit form** has these fields: name, role, company, met at, note, LinkedIn, email and phone.

## Built so far (shipped on main)
- **Sign-in sheet:**
  - Styled like Fixtured on Mobbin, with deq's own fanned cards as the hero (`src/SaveSheet.jsx`, helpers `initials` and `fanSlot`).
  - It's light and loads fast.
  - It comes back once a day until the person signs in.
  - The email placeholder reads `@mail.com`.
  - The rate-limit message is friendly.
- **Card text:** the "Reach out…" line at the bottom of a card is smaller and dimmer, to give the card an iOS text hierarchy.
- **The menu's Your Card row** says Apple Wallet on iPhone and Google Wallet on Android. Samsung Wallet is planned for v2.
- **Laptop view** (`src/Desktop.jsx`, `src/assets/deq-qr.svg`):
  - It turns on for wide screens with a mouse. `#add=` links and `?mobile` skip it.
  - Signed in, it shows a grid of your cards side by side plus a phone QR tile.
  - Signed out, it shows a landing page that pushes people to the phone.
  - There's no intro video on laptops.
  - It shows "The laptop version is coming soon."
- **Icon:** option A, a blue corner glow (in `public/apple-touch-icon.png`, `icon-192.png`, `icon-512.png` and `favicon.svg`). The earlier one looked like Uber's logo.
- **Filters:** tapping a category shows a chip like "Tempe ×". "Where you met" is now labelled "Location" (`src/filters.js`).
- **After adding someone** (`src/AddedMoment.jsx`):
  - "Find on LinkedIn" shows right away. It opens the scanned LinkedIn link, or a LinkedIn search for their name.
  - That button stays prominent after the card lands in the deck.
  - A line above the card says "Pull down to see your deq".
- **Apple Calendar:** a bug made the event for the wrong person. It's fixed: each event gets its own `eventId`/uid (`src/calendar.js`).
- **"Importing a module script failed" crash:** this happens when a deploy removes old hashed files while the old version is open. `main.jsx` now catches it and reloads once.
  - Still open: the map's lazy-load gets the same reload-on-stale fix.
- **Sync:** a second phone gets the account's cards right after sign-in (full pull), and sync recovers when the connection drops.
- **Always latest:** the Home Screen app checks deq.one when opened, when resumed and every 5 minutes, and reloads to the newest build. It never reloads while you're adding someone (that draft is saved).
- **Nov 15–16 work:**
  - AirDrop/Share button on the open card, sharing the card link.
  - One tap opens the full details, with no in-between view.
  - Edit Card and two-tap Delete at the end of the details.
  - The Wallet card flight with no cut-offs.
  - Export Deck as a CSV.
  - A Phone field in Edit.
  - The Home Screen app reloads fresh, and reloads if blank.

## Other projects and artifacts
- Deq pitch deck: https://claude.ai/artifact/NQFsaBLVYYVwToJcv8Ji3P
- Deq launch poster: https://claude.ai/artifact/RuvaePYC1C3PY5xHh4w9a5
- **SunHacks 2026 (ASU), "deq pulse":**
  - It was built on branch `pulse` (a wallet-style home with one card in front and Pulse below, a Gemini model fallback list, and `PULSE.md` as the Devpost write-up).
  - Kanish later dropped the separate pulse app. Pulse will become a feature inside deq instead.
  - The `pulse` branch is kept on GitHub as source code. Nobody has decided yet whether to delete it.
- **Hackathon notes:** be upfront that deq existed before the event. Check with team@sunhacks.io whether existing projects are allowed. The rule is one submission per person.

## Working setup
- **Repo:** github.com/thekanatomy/deq, branch `main`. Vercel deploys `main` to deq.one, and other branches get preview URLs (like deq-git-pulse-deq3.vercel.app).
- **Windows laptop:** the repo is at `C:\Users\kanig\deq`. It was 3 commits behind with local edits to `.gitignore` and `.oxlintrc.json`, so run `git pull` before editing.
  - If a push is rejected (non-fast-forward), run `git fetch`, then `git reset --soft origin/main`, then commit and push again.
- **Mac:** being set up. Clone the repo, run `npm install`, copy `.env.local` over by hand, and link the Claude app to the `deq` folder.
- **Env vars** (Vercel and `.env.local`): the Supabase URL and anon key, the scan API key, and `GEMINI_API_KEY` for Pulse. Never read or print them.
- Dev runs over https with `npm run dev`. Vercel builds need a clean `index.css`, since a CSS merge conflict broke a build once.

## Later / v2 ideas
- A reliability score, push notifications, delete account, end-to-end encryption, SMS sign-in, Pro Wallet passes and Samsung Wallet.
- An ASU IT ticket to unblock deq.one on the campus network.
- **For Pulse:** scheduled checks (AWS Lambda plus EventBridge on credits), ElevenLabs narration ("Listen" to a short brief before messaging someone), and tracking replies in Gmail.

## Rules
- **Pushing:** push only when Kanish says "push". Stop-hook reminders are not approval.
- **Secrets:** never read `.env.local`, and keep keys server-side.
- **Replies:** short, ending with a numbered task list. Push back when his reasoning doesn't hold.
- **Examples:** never use the name "Priya" in examples.

## Open items
1. **Storage:** Supabase storage is filling up. Check whether photos are in the database or the bucket, then shrink photos to about 400px and under 80 KB. Move photos to AWS S3 only if that's still needed. Kanish has $300 in AWS credits that expire in about a year.
2. **The Pulse feature** (Gemini with Google Search finding what changed for a person). The code is on branch `pulse`: `api/_pulse.js`, `src/pulse.js`, `src/PulsePanel.jsx`.
   - The plan is to bring it into deq as a section in each card.
   - The limit is 4 searches a day per account, counted server-side in Supabase, which means Pulse requires sign-in.
   - The search uses name, company and role. "Where you met" only shapes the opening line.
   - The free Gemini key had no Google Search quota (429). It needs billing, or Tavily plus Gemini.
   - Still undecided: billing or Tavily, and whether signed-out users get any searches.
3. Privacy fixes waiting for a "go": POST for vcard/ics/pass, a same-origin check on `/api/scan`, and a third-party list on the Privacy page.
4. The Supabase checklist: turn off Confirm email, delete the test user, and confirm the OTP is 6 digits. Then test sign-in on two phones.
