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
