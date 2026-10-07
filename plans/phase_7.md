# Phase 7: 3D garden + customization

User picks (2026-10-07): cozy low-poly diorama · auto 2D fallback · drag to arrange + home widgets + decor.

## Done (2026-10-07)
| Piece | Where | Notes |
|---|---|---|
| 3D island | `src/garden/garden3d.js` | Three.js r160 lazy-loaded from jsdelivr (only on Garden tab, cached by SW). All models from primitives: plants by stage (+ glass dome in terrarium), trees (size = progress, fruit = done milestones, gold when done), sunflowers, butterflies circling their idea, pond, clouds. Soft shadows, gentle sway/bob; reduced motion → static |
| Persistent canvas | router `onRendered` hook → `Garden3D.mount(host)` | One renderer per session; each render moves the canvas into the new host and diffs objects by id + signature (stage, progress…). 2D SVG shows until ready / if load fails |
| Controls | pointer handlers in garden3d.js | Horizontal drag = turn (vertical still scrolls page), pinch / ctrl+wheel = zoom, tap = open item, desktop hover = label |
| Fallback | `capable()` | No WebGL, deviceMemory < 3 or < 4 cores → 2D island. Account → Garden style: ✨ 3D / 🏝️ island / 🪴 box (3D on weak device → island) |
| Arrange | home.js actions + garden3d drag | ✏️ Arrange → drag plants/trees/sunflowers/decor (butterflies follow their idea). Saved as `state.garden.layout[id] = [u, v]` (island units, shared with 2D island). Reset positions keeps decor |
| Decor | `DECOR` (scenes.js) + `DECOR_BUILD` (garden3d.js) | bench, lantern (glows), mushrooms, rocks, bush, fence. Add / Turn 45° / Remove. `state.garden.decor`, removal tombstoned. 2D island shows decor as emoji |
| Home widgets | home.js `WIDGETS` + `user.homeSlots` | Sketch layout kept: 4 slots around the Add idea flower. Options: current project, last inspiration, side projects, learning, next step, terrarium, reading list. ⚙️ Customize home sheet |
| Sync | sync.js merge | garden.layout merged per key, decor union by id minus tombstones |

Verified in the local preview: renders (light + dark, desktop + 375 px), drag saves exact spot, turn/remove/tombstone, tap → idea page, canvas reused across navigation, widget slots, 2D fallback with decor, no console errors.

## Open
- Real phone check: frame rate + battery on a mid-range Android / iPhone; tune shadow map or pixel ratio if slow
- Garden levels / unlockable decor (ties into gamification "later")
- Planter box style has no arrange (2D only)
