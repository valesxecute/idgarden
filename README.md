# 🌱 Idea Garden

A calm place for your ideas to grow: capture ideas in seconds, collect inspiration from credible sources, grow ideas in a terrarium, and turn the good ones into projects with milestones.

- **Run locally:** `node server.js` → http://localhost:5173 (no install, no build)
- **Refresh Discover feed:** `node scripts/build-discover.mjs` (sources in `scripts/sources.json`)
- **Deploy:** push to `main` → GitHub Actions builds the feed and deploys to GitHub Pages (also daily)
- **Accounts & sync:** Supabase (Google sign-in). Setup → `plans/phase_4.md`; keys go in `src/config.js`

Docs: [status.md](status.md) (phases) → [architecture.md](architecture.md) (how it works) → `plans/` (details).
