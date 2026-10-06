# Phase 0: prototype core loop ✅

Goal: prove capture → organize → connect → develop → execute, guest-only, offline.

## Built
| Area | Detail |
|---|---|
| Onboarding | welcome → interests → first idea → organize mode (self/AI/later) → garden legend |
| Capture | FAB, sidebar button, garden bar, `n` key, Ctrl+Enter. Post-save toast: organize/terrarium/vault |
| Garden | SVG; ideas=plants (4 stages), incubator=cloche, projects=trees+fruit, learning=sunflowers, inspirations=butterflies, vault=seed box |
| Ideas | list + tabs + search + folder groups; detail: why, tags, folder, questions, notes, related ideas, inspirations |
| AI (rules) | Organize (opt-in chips), Think With Me (modes + free text, keep in notes, save questions), related detection |
| Inspirations | link/note, optional reflection, connection suggestions sheet, library |
| Discover | For you (~1/4 outside interests), Something different, For your project; 22 Wikipedia items |
| Projects | wizard: for me / together / myself; type templates (software/writing/media/venture/research/general); estimate note; timeline; tasks |
| Nudges | connection, revisit, stuck→break down, early→bring forward, learning↔project |
| Learn | goals, starter milestones, resources, notes, project links |
| Settings | interests, privacy text, export JSON, sample garden, delete all |

## Decisions
- No build step: open-and-run, easy to host statically
- Rule-based AI behind one interface (`IG.AI`) → swap later
- Attention capped in growth score: clicks can't fake growth
