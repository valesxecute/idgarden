# Phase 6: real AI

Details per function → [ai.md](ai.md).

- Edge Function proxy (key stays server side); per-user rate limit
- Embeddings (pgvector) for related ideas/inspirations; the LLM writes the "why"
- Keep the rule-based version as offline/AI-off fallback
- Depends on: normalized tables (see [sync.md](sync.md) "later") or embedding the JSON doc per item

## Open
- Provider + cost per active user
- Privacy copy: what is sent, when; settings toggle
