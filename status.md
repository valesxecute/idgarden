# Idea Garden: status

Spec: original PRP (product prompt) + user sketches. Run: `node server.js` → http://localhost:5173
Learning: [tutorial/](tutorial/README.md) rebuilds the core as "Mini Garden" (steps 0–15; reference code `tutorial/mini-garden/`, tested 2026-10-07)

## Phases

| # | Phase | State | Plan |
|---|---|---|---|
| 0 | Prototype: core loop | ✅ | [phase_0](plans/phase_0.md) |
| 1 | Feedback 1: accounts+sync code, terrarium, milestones gray→green, cuter | ✅ (sync verified live in P4) | [phase_1](plans/phase_1.md) |
| 2 | Feedback 2: sketch login + home, suggestions moved into context, main/side projects | ✅ | [phase_2](plans/phase_2.md) |
| 3 | Cleanup: ES modules, views own their actions; feedback 3 UI (island default, bottom nav everywhere, per-section add buttons) | ✅ | [phase_3](plans/phase_3.md) |
| 5 | Discover from credible sources (51 feeds + OpenAlex, daily) | ✅ | [phase_5](plans/phase_5.md) |
| 4 | Publish: GitHub + Pages + Supabase + Google sign-in | ✅ live https://valesxecute.github.io/idgarden/ · Google login, cloud save, restore on fresh device, RLS verified (2026-10-06) | [phase_4](plans/phase_4.md) · [tutorial](plans/setup_tutorial.md) |
| 6 | Real AI behind `AI` | 🔄 think + plan live. Organize (LLM) + related (on-device embeddings) coded + tested locally; needs garden-ai redeploy | [phase_6](plans/phase_6.md) · [ai](plans/ai.md) |
| 7 | Full 3D garden + garden customization (drag to arrange, choose home widgets) | ⏸️ (2026-10-07) built: Three.js island + Arrange + decor, home widget slots (✅ in use). User compared → **2D stays default**, 3D = opt-in "beta" in Account. Focus now: functionality | [phase_7](plans/phase_7.md) |
| 8 | Mobile polish: PWA, share-sheet capture, reminders | 🔄 PWA + offline + shortcuts + share target done, verified locally. Reminders coded; need secrets + garden-remind deploy + push.sql | [phase_8](plans/phase_8.md) |
| – | Levels / gamification | 📋 later (user: “future”) | — |

## Market (2026-10-07)
- Competitor scan + differentiators → [market_research](plans/market_research.md). Takeaway: P8 mobile capture is the biggest gap. Moat = ideas grow + inspiration matched to them

## Latest (Discover v2, 2026-10-06)
- Not interested → sheet: why? (topic / source / just this one) → card fades out, weights by reason, Undo
- Read: light green “✓ Read just now” in place for 3 min → then fades grey + sinks to end. Page order frozen per visit (no reshuffle while reading)
- Tabs: 🔖 Reading list · 📖 History (everything opened, newest first)
- Taste learning: group/source/keyword weights; read +1, later +1.5, save +2. Reset in Account
- “Something different” tab removed → 1 in 10 For you cards, labeled 🌈. Architecture showing without being picked = this mix (not a bug)

## Earlier (P3 + P5, 2026-10-05)
- Home: current project · 🌸 Add idea · last inspiration / side projects · learning / scene. Floating island default, planter box in Account → Garden style; meadow + level removed
- Bottom nav on all sizes (sidebar gone). Add buttons: 🌸 idea (Ideas) · 🦋 inspiration (Discover) · 🍎 project (Projects) · 🌻 learning goal (Learn) · none on Garden (flower on page) and Account
- Discover: no Wikipedia. `scripts/sources.json` → `data/discover.json` (~390 items). Research group = journal articles (Cell, Bioinformatics, PLOS, eLife, Nature papers, OpenAlex). Tabs: For you / Something different / For your project / Browse / My inspirations; sources listed at the bottom
- Code: `js/app.js` (1,300 lines) → `src/` modules (see architecture.md)

## Known issues
- (fixed 2026-10-06) Deploy caching: CI stamps every module URL with `?v=<commit>-<run>` (scripts/stamp-version.mjs); app polls `version.json` on open/tab focus and reloads once if a newer deploy is live
- The Straits Times live feed sometimes blocks browser requests (CORS); refresh skips it safely
- Concurrent-device merge tested only in code review + single-device restore; real 2-device check = next trial week
- WHO News + Wondermind feeds stale (nothing in 60 days)

## Next (user)
- Push to deploy P6–P8 frontend. Redeploy `garden-ai`; deploy `garden-remind` (JWT off) + secrets + run `supabase/push.sql` → [phase_8](plans/phase_8.md) setup

## Known gaps
- Assistant: think/plan/organize via LLM; Discover matching still keywords (feed not embedded)
- Sync = one JSON row per user ([sync](plans/sync.md))
