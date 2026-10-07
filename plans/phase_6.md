# Phase 6: real AI

Details per function → [ai.md](ai.md).

- Edge Function proxy (key stays server side); per-user rate limit
- Embeddings (pgvector) for related ideas/inspirations; the LLM writes the "why"
- Keep the rule-based version as offline/AI-off fallback
- Depends on: normalized tables (see [sync.md](sync.md) "later") or embedding the JSON doc per item

## Done (2026-10-06)
- Provider: Gemini free tier via OpenAI-compatible Chat Completions (2026-10-06, was OpenAI: not free). Swappable via AI_BASE_URL/AI_MODEL
- garden-ai Edge Function deployed; signed-in only; 60/day per user (ai_usage.sql)
- Think With Me + project plan use AI; rule-based fallback on any error / AI off / key missing
- Account: AI on/off toggle + privacy copy (current idea + ≤5 related per kind)
- `cfg.ai = true`

- Key added, think + plan live (2026-10-07)

## Embeddings + AI organize (2026-10-07, code done, needs function redeploy)
- No pgvector: garden is small → vectors cached on device (`core/embed.js`), never synced. Key = hash of item text → edits re-embed automatically
- garden-ai `embed`: ≤64 texts/call → 256-dim floats (gemini-embedding-001, truncated). Client int8-quantizes (~344 chars/item in localStorage)
- Related = z-score vs this garden's pairwise cosine spread (strict z≥1.5, loose z≥1). <8 vectors or missing vector → keyword rules
- Refresh: 4 s after a change, ≤3 calls × 50 texts. Stop for session on limit/not configured/unknown_task; other errors back off 5 min. Cleared on sign-out / reset
- garden-ai `organize`: idea + ≤8 candidate ideas/inspirations (picked by embeddings) + garden tags → title, tags, place, related/inspirations with a real "why". Unknown ids dropped. Panel keeps the result for the session, hides accepted items
- Verified locally with a stubbed embedder + stubbed organize (ranking, caching, no re-embed, accept/hide). Not yet live

## Open
- Redeploy garden-ai (index.ts) → live check: Organize on an idea, related suggestions after ~5 s
- Tune z thresholds on a real garden
- Discover items (~390) not embedded: For you / For your project still keywords. Option: embed in CI (needs key as GitHub secret)
