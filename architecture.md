# Idea Garden: architecture

Vanilla JS, **native ES modules, no build step**. Static site (GitHub Pages) + Supabase (auth + one JSON row per user).

```
index.html            loads supabase-js (UMD → window.supabase) + src/main.js (module)
src/
  main.js             boot: register views/actions/enter from each view module, wire events, Sync.init, Discover.load
  config.js           Supabase URL + anon key ('' = guest-only), ai flag
  core/
    store.js          state, localStorage, CRUD, derived (ideaStage, progress, activeProjects), tombstones, meta
    sync.js           Supabase auth (Google, email link) + local-first sync/merge → plans/sync.md
    taste.js          Discover reading state (state.reading): read history, reading list, not-interested, taste weights → For you ranking
    ai.js             rule-based assistant: similarity, organize, think, plan → plans/ai.md
    assistant.js      real AI: think + plan + organize via Sync.invoke('garden-ai'); falls back to ai.js on any error
    embed.js          Vec: on-device embedding cache (text hash → int8 vector), z-score similarity; ai.js rank() uses it when ready
    texts.js          ideaText / inspText / projText / learnText (shared by ai.js + embed.js)
    push.js           web push subscribe/unsubscribe → push_subs; test via garden-remind
  data/
    interests.js      interest ids = Discover groups
    discover.js       loads data/discover.json; byId, text(), inspirationType()
    sample.js         sample garden
  garden/
    sprites.js        SVG sprites: plant (4 stages), cloche, tree+fruit, sunflower, butterfly, decor, plantIcon
    scenes.js         renderIsland, renderBox (2D, iso placement, back→front); islandPlacement + DECOR shared with 3D
    garden3d.js       Three.js island (lazy CDN import), persistent canvas, diff by id, arrange drag → plans/phase_7.md
  ui/
    util.js           esc, ago, short, bar, labels (STATUS_INFO, TYPES), avatar/sync dot
    icons.js          add-button art: flower · butterfly · apple · sunflower (+ badge)
    state.js          transient UI state (wizard, onboarding, discover tab, filters)
    components.js     sheet, toast, sugRow/sugBox (≤3, × dismiss), notFound
    router.js         hash routes → views; shell = main + section add button + bottom nav
    events.js         delegated click/enter/change/input + pointer drag-and-drop
  views/              each exports { views, actions, enter }
    home · ideas (list, terrarium, idea page, moveIdea) · think · discover (+ inspiration page)
    capture (idea / inspiration sheets) · projects (+ wizard) · learn · account · onboarding
scripts/
  sources.json        Discover sources: name, feed url, group, kind
  build-discover.mjs  RSS/Atom + OpenAlex → data/discover.json (zero deps; CI runs it daily)
data/discover.json    generated feed (committed copy = fallback)
supabase/schema.sql   gardens table + RLS + realtime
.github/workflows/deploy.yml   build feed → assemble _site → stamp versions → GitHub Pages (push + every 6 h)
scripts/stamp-version.mjs      cache busting: ?v=<version> on every module import, index meta + version.json
server.js             local static server (:5173), not deployed
sw.js · manifest.webmanifest · icons/   PWA (offline, install, shortcuts, share target, push) → plans/phase_8.md
supabase/push.sql + functions/garden-remind   reminders: push_subs table, hourly pg_cron → function
```

## Flow
```
click [data-action=x] → actions[x] (from any view module) → Store mutation → commit()
  commit: meta.updatedAt → localStorage → listeners({remote:false}) → Sync debounce → push
cloud (realtime / focus / sign-in) → Sync.pull → Store.load → listeners({remote:true}) → render (deferred while typing)
hashchange → render() → router picks view(params) → shell()
```
- Field edits: `[data-bind=kind:id:field]` commit on blur, no re-render (typing never interrupted)
- Action names are global across modules. Keep them unique (main.js merges the maps)

## Key blocks
| Block | Where | Notes |
|---|---|---|
| Growth stage | `Store.ideaStage` | min(attention,4) + 2·links + 2·inspirations + reflection → seed/sprout/plant/bloom |
| Main/side projects | `Store.activeProjects` | `isMain` flag else oldest active (new projects start as side projects) |
| Similarity | `AI.similarity` | stemmed overlap ×2 + topic buckets; Discover picks need score ≥4 |
| Suggestions | `ideaSuggestions` (ideas.js), `revisitList`, `projectNudges` | contextual only, ≤3, dismiss key in `state.dismissed` |
| Terrarium | ideas.js + events.js drag | `[data-drag-idea]` → `[data-drop=status]` → `moveIdea` (Undo toast) |
| Discover mix | discover.js `pickItems` | For you: interests + ~1/4 elsewhere; ≤2 per source up front; news only if chosen |
| Scenes | scenes.js | stable hash → spot; reserved spots for trees/sunflowers; `state.garden.layout` overrides |
| 3D garden | garden3d.js ← router `onRendered` | default when `capable()`; 2D SVG = placeholder + fallback |
| Home widgets | home.js `WIDGETS`, `user.homeSlots` | 4 slots around Add idea |

## AI (Phase 6)
- `supabase/functions/garden-ai/index.ts`: Edge Function, OpenAI-compatible Chat Completions (default Gemini free tier, `openai` npm SDK + baseURL), strict JSON schema. Tasks `think` → {reply, questions}, `plan` → {estimateNote, firstSteps, milestones}, `organize` → {title, tags, place, related, inspirations}, `embed` → {vectors}
- Secrets: `GEMINI_API_KEY` (required), `AI_MODEL` (default gemini-3.8-flash), `AI_BASE_URL` (swap provider, e.g. Groq)
- Gate: signed in + `bump_ai_usage()` RPC (supabase/ai_usage.sql), 60 calls/user/day
- Client: `Assistant.available()` = cfg.ai + signed in + Account toggle on + server configured. Errors → rule-based reply + note
