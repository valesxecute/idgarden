# Phase 6: real AI

Details per function → [ai.md](ai.md).

- Edge Function proxy (key stays server side); per-user rate limit
- Embeddings (pgvector) for related ideas/inspirations; the LLM writes the "why"
- Keep the rule-based version as offline/AI-off fallback
- Depends on: normalized tables (see [sync.md](sync.md) "later") or embedding the JSON doc per item

## Done (2026-10-06)
- Provider: OpenAI, Responses API, strict JSON schema
- garden-ai Edge Function deployed; signed-in only; 60/day per user (ai_usage.sql)
- Think With Me + project plan use AI; rule-based fallback on any error / AI off / key missing
- Account: AI on/off toggle + privacy copy (current idea + ≤5 related per kind)
- `cfg.ai = true`

## Open
- `OPENAI_API_KEY` secret (user adds) → then live test think + plan
- organize + related via embeddings (pgvector)
