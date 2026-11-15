# deq pulse

**Most contact apps nag you that it's been 30 days. deq pulse waits until their company opens the role they told you about, then hands you the opening line.**

## What it is
deq is a contact app I'd already built: scan a business card, badge or LinkedIn QR, and the person becomes a Wallet-style card. **deq pulse** adds a research agent on top. For every card it runs a grounded Gemini search over *their company and what they told you they need*, diffs it against the last check, and only speaks up when something actually changed: a role opened, they moved, the company shipped or raised. Then it drafts an opening line built from what changed plus what *you* can offer.

## Built at sunhacks (new today)
- `api/_pulse.js`: one Gemini 2.5 Flash call with **Grounding with Google Search**, returning structured JSON plus the real source links from `groundingMetadata`. No source, no news.
- Diff + history (`src/pulse.js`): the first check is a baseline; later checks look only at what's new since the last one. Every empty check is logged, because the quiet is what makes a hit believable.
- Pulse panel (`src/PulsePanel.jsx`): what changed, with sources, openings, an opening line, and a **With context / Generic** toggle that shows what the agent adds.
- "About you" context: your projects and goals, so the draft has something real to offer.
- Pulse badge on the card, and a news-first deck.

## Already existed before the event
The deq app itself: scanning, cards, deck, sync, Wallet passes, design system.

## Privacy by design
- It **searches the work, never the bare name**: the company plus the need they told you. Person-level results only when a source names both the person and the company; if several people share the name, it returns nothing.
- Never infers anything personal (location, family, social).
- Nothing is ever sent for you. Every fact links to its source; you approve.

## Does it scale?
40 contacts on a 5-day cycle is 8 grounded Flash calls a day: cents per user per month.

## Honest limitations
Today a check runs when you tap "Check now". The every-5-days schedule (a cron job/Lambda) and the Gmail reply-tracking layer are designed, not built.

## Stack
React 19, Vite, Dexie (on-device), Supabase sync, Vercel functions, **Gemini API (Grounding with Google Search)**.
