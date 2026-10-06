# Phase 4: publish for a 1-week trial

Goal: live URL, Google sign-in, same garden on phone + laptop.

## Steps
| # | Who | Step |
|---|---|---|
| 1 | user | supabase.com → New project (free tier, nearest region) |
| 2 | user/Claude | SQL Editor → run `supabase/schema.sql` |
| 3 | user | Google Cloud Console → OAuth client (Web). Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback` |
| 4 | user | Supabase → Auth → Providers → Google: paste client ID + secret, enable |
| 5 | user | Supabase → Auth → URL config: Site URL = live URL; redirect URLs += `http://localhost:5173/**`, live URL |
| 6 | Claude | put Project URL + anon/publishable key in `src/config.js` (public by design; RLS protects data) |
| 7 | user | create empty GitHub repo `idea-garden` (no `gh` CLI here) |
| 8 | Claude | `git init`, commit, push; add `.github/workflows/pages.yml` (deploy static root) + `.nojekyll` |
| 9 | user | repo Settings → Pages → Source: GitHub Actions. Note: Pages on a **private** repo needs a paid plan; alternatives = Netlify / Cloudflare Pages / Vercel (free, private OK) |
| 10 | Claude | smoke test: sign in, capture on device A → appears on B; offline edit → merges |

## Decisions needed
- Repo public or private? → decides the host
- Email magic link as well, or Google only?
