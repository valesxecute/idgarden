# Phase 1: feedback round 1 ✅ (code) · ⚠️ sync untested

Source: user test of v0 (2026-10-05).

| Feedback | Change | Where |
|---|---|---|
| No account / no Google login | Account chip (sidebar), avatar (mobile garden header), Account card in Settings; Google + email magic link; "Start as guest" vs "Continue with Google" on welcome; gentle nudge after ≥3 ideas | `sync.js`, `accountCard()`, `nudges()` |
| Sync between devices | Supabase, local-first, merge by id | `sync.js` → [sync.md](sync.md) |
| Guest now, sync later | Guest garden merges into the account on first sign-in | `Sync.pull()` merge branch |
| Incubator = terrarium + drag-drop | Glass jar view on Ideas → Terrarium tab; drag seeds in/out; drop row: garden / seed vault / compost; 🫙 button as tap/keyboard alternative | `viewTerrarium()`, drag block in app.js |
| AI relates ideas/inspirations there | "Growing together" panel: idea pairs (Link), saved inspirations (Connect), Discover items (Save & connect), Think shortcut for the idea untouched longest | `terrariumSuggestions()` |
| Vault vs archive unclear | Renamed: 🌰 Seed vault (rest, resurfaces) / 🍂 Compost (done, never deleted); hint under status buttons; toasts w/ Undo | `STATUS_INFO`, `moveIdea()` |
| Milestones counterintuitive | Gray until done → green check; timeline bars gray with green fill = task progress; 🍎 badge kept | CSS `.ms-ic`, `.tl-bar i`, `timeline()` |
| More cute | Nunito, rounder radius, hover lift, smiling sun, grass tufts + tiny flowers, birds, shine on seeds/fruit | `garden.js`, `app.css` v0.2 block |
| Middle more 3D (later) | Interim depth: layered hills, shaded canopy (radial gradient), soft shadows, perspective rows | `garden.js` · full 3D → [phase_7](phase_7.md) |
| (spec gap) "Inspire" mode | Think With Me → 🦋 Inspire me: 2 close Discover picks + 1 deliberately different | `AI.think('inspire')` |

## Not verified
- Real Google sign-in + 2-device sync: needs a Supabase project (Phase 4)
- Drag on real touch devices (tested with synthetic pointer events + mouse)
