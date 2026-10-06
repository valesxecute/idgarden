# Phase 3: cleanup + feedback round 3 ✅

## Code cleanup
- `js/*.js` IIFEs on `window.IG` → `src/` native ES modules (no build; works on GitHub Pages and with `node server.js`)
- `app.js` 1,300 lines → `ui/` (util, icons, state, components, router, events) + 9 view modules; each exports `{ views, actions, enter }`, merged in `main.js`
- `garden.js` → `garden/sprites.js` + `garden/scenes.js`; meadow scene deleted
- Removed: sidebar, meadow, home style switcher, level/incubator stats, Wikipedia catalog, `Store.gardenLevel`

## Feedback round 3
| Feedback | Change |
|---|---|
| Island favorite, keep planter box, customization later | Island = default; Account → Garden style (island / box); customization → Phase 7 |
| Levels later | Removed from home |
| Learning instead of level; side projects instead of incubator | Home row 2: 🌿 Side projects · 🌻 Learning (up to 3 each, "+N more") |
| Nav at the bottom, not the sides | Bottom nav on all sizes (centered, max 640px) |
| Flower-style add button per section | 🌸 Ideas → add idea · 🦋 Discover → save inspiration · 🍎 Projects → new project · 🌻 Learn → new goal (sheet) · none on Account; Garden keeps the big flower on the page. Header "＋ New …" buttons removed |
| Discover: credible sources, not Wikipedia | → [phase_5](phase_5.md) |

## Decided
- Stay vanilla (no framework) until real 3D (Phase 7) needs it
