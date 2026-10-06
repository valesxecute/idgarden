# Plan: real AI behind `IG.AI`

Keep the UI contract and swap the internals. Calls go through a server endpoint (Supabase Edge Function), never a browser API key.

| function | now (rules) | LLM version |
|---|---|---|
| `organize(idea)` | topic buckets + keywords | structured output: {tags, title, place, related_ids}. Related candidates come from embeddings |
| `relatedIdeas` / `ideasForInspiration` | token overlap | embeddings (pgvector) + similarity threshold. LLM writes the one-line "why" |
| `think(mode, idea, text)` | templates | chat with system prompt = personality (curious, concise, no hype) + context: idea, linked items, top-k related, learning |
| `plan({...})` | type templates | LLM drafts milestones/tasks as JSON. Keep the honest-estimate rule in the prompt |

## Rules to keep
- Suggestions only. Nothing changes without the user accepting it
- Context = the current item + top-k related. Never the whole garden
- Uncertainty is stated in plans ("rough estimate")
- Settings toggle: AI off → fall back to the rule-based version (keep the current code)

## Open
- Provider choice / cost per active user
- Embedding refresh on edit (debounced)
