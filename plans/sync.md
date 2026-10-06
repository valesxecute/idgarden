# sync.js: accounts + cross-device sync

## Model (prototype)
- Table `gardens(user_id pk, state jsonb, updated_at)`; RLS = own row only; realtime on
- Whole garden = one JSON doc. Fine for one user × a few devices × a week-long trial
- Local-first: app reads/writes localStorage; sync runs in the background

## Flow
| Trigger | Action |
|---|---|
| boot with session / sign-in | `pull()` |
| local commit | debounce 1.2s → `push()` |
| tab visible, realtime event | `pull()` |
| back online | `push()` |
All ops are serialized through `queue()` so they never interleave.

`pull()`:
- no cloud row → push local (if any content / onboarded)
- cloud == last synced and local clean → nothing
- fresh device / other account's leftovers / local clean → take cloud
- else (guest garden joining, offline edits) → `merge(local, cloud)` → push

`push()`: re-fetch cloud; if newer than `meta.syncedAt` → merge first; upsert with `updated_at = meta.updatedAt`.

`merge(a,b)`: union arrays by id; same id → newer doc wins; `deleted[]` tombstones applied after union; dismissed = union; `user.onboarded` = OR.

## Auth
- `flowType: 'pkce'` → redirect returns `?code=` (keeps the hash router clean); query stripped after the exchange
- Google OAuth + email magic link; redirect = current origin + path
- Sign out: clears this device's copy (garden stays in the account)

## Limits / later
- Per-item last-writer-wins only at the doc level (an older doc's edit to the same item is lost on conflict)
- Tombstones grow forever (tiny); prune later
- Proper model later: normalized tables + `links` table + per-row `updated_at` (old backend plan):
  profiles · ideas · inspirations · projects · milestones · tasks · learning_goals/items · links · chat_messages
