# Lumi — NeuroBridge.SI Baku 2026 · Track: AI Enterprise Solutions

**Workflow automated:** restaurant order-taking → kitchen. A restaurant chats with Lumi about its menu, AI builds an editable table (with optional own dish photos), guests order in natural language (AZ/EN/RU), deterministic code validates everything, the kitchen gets a structured ticket with a live ETA.
**Metric to adopt:** waiter time per order, order errors (price/availability), time from "decided" to "order recorded". *Measure these in a pilot — we have NOT measured them yet.*

## Run locally
```
node -v          # needs >= 20
cp .env.example .env   # paste GEMINI_API_KEY (free: aistudio.google.com/apikey)
npm start        # http://localhost:3000
npm test         # writes TEST_RESULTS.md (real results)
```
Without a key the app still works in **fallback mode** (regex parser + template replies) — this is also our "AI/API failure" test scenario.
**Single demo link for judges: `/demo`** (guest + kitchen side by side). Pages: `/` landing + Add restaurant wizard · `/r/demo` guest · `/k/demo` kitchen · `/api/metrics` latency/errors.

## Deploy (free, backend + frontend in one service)
1. GitHub: `git init && git add . && git commit -m init` — `.env` is git-ignored. **Never paste the key in code/chat/issues.**
2. render.com → New Web Service → connect repo → Build: *(empty)* · Start: `node server.js` · Env var `GEMINI_API_KEY`. Free tier sleeps after idle: **open the URL a few minutes before judging** (and before the 20:00 deadline).
3. Data is stored in a local JSON file (ephemeral on free hosting; the demo restaurant is re-seeded on every start).
4. Free-tier rate limits: if Gemini returns 429 the app silently falls back; the UI says "AI is busy".

## Dish photos (Supabase Storage)
1. supabase.com → New project → Storage → **New bucket** `dish-images` → turn **Public bucket** ON.
2. Project Settings → API → copy **Project URL** and the **secret / service_role** key.
3. Locally put in `.env`, on Render add as Environment variables: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_BUCKET=dish-images`. The key is used only by `server.js` (never sent to the browser).
Without these, small photos (≤200 KB after in-browser resize) are stored inline in the restaurant JSON, so the demo still works. Check `/api/health` → `storage: "supabase"`.

## AI providers
Chain: Gemini → OpenAI-compatible (Groq, free) → built-in rule-based parser. A failure or 429 on one moves to the next, so the demo never dies. Check the current model name at aistudio.google.com and set `GEMINI_MODEL` if needed (2.5 models are scheduled to shut down 16 Oct 2026).

## Architecture (for the deck)
Customer UI → Node API → **LLM only for**: menu import, constraint extraction, 2-sentence explanation → **deterministic code for**: filtering, combination search, budget/time/diet checks, price totals, quantity/availability validation, ETA → Kitchen dashboard.
The AI cannot invent dishes or prices: it never outputs menu data that reaches the order. Unknown allergen data is treated as unsafe.

## Pitch ↔ scoring card
- **Value (25):** waiter overload, slow ordering, guests unsure about dishes/budget/allergies.
- **Prototype & AI (30):** live end-to-end demo: wizard → guest chat → order → kitchen → status/ETA back to guest. AI = import + multilingual constraint understanding.
- **Testing (20):** `TEST_RESULTS.md` (21 deterministic tests). Add: failures you saw, and comparison "today: waiter walks to table, writes order by hand".
- **Feasibility (15):** one Node process, free-tier LLM, no hardware; cost ≈ 2 LLM calls per guest request. Next step: pilot in 1 café, add auth + real DB + POS export.
- **Originality (10):** competitors exist (Ordder, chatQR.ai, MenuTura…). Ours: solver-verified recommendations under budget+time+diet+allergy constraints; ETA-aware; publishes its own test results.

## Disclosure (required by rules)
Models: Google Gemini free tier via REST (`GEMINI_MODEL`, default `gemini-flash-latest`, `gemini-flash-lite-latest`, `gemini-3.1-flash-lite`); optional second provider via any OpenAI-compatible API (Groq `llama-3.3-70b-versatile` by default). Images: the restaurant's own uploaded photos (Supabase Storage); dishes without one fall back to Wikipedia/Wikimedia Commons thumbnails or an emoji tile. Libraries: none (Node built-ins only; Supabase via REST). Data: invented sample menu "Qala Bistro". Code written with AI assistance (Claude) during the hackathon.

## Known limits (be honest with judges)
No auth, no payments, no real DB, single-restaurant admin editing is only in the setup wizard, no LLM-quality eval yet (only deterministic logic tests), ETA formula is a heuristic, "Call waiter" is a demo stub.
