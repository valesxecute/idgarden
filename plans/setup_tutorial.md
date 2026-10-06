# Tutorial: GitHub hosting + Supabase backend + Google sign-in

How Idea Garden was put online. Same recipe works for any static web app that needs accounts.

```
Browser (your app, static files)  ──hosted on──▶  GitHub Pages   (free; deploys on every push)
        │ sign in / save garden
        ▼
     Supabase  (Auth + Postgres database)  ◀── Google sign-in (OAuth client from Google Cloud)
```

| Piece | What it does | Cost |
|---|---|---|
| GitHub | stores the code; GitHub Actions builds + deploys; GitHub Pages serves the site | free (public repo) |
| Supabase | user accounts (Auth) + database (Postgres) with row-level security | free tier |
| Google Cloud | issues the OAuth client so "Log in with Google" works | free |

---

## Part 1: GitHub (code + hosting)

### 1.1 Create the repo
1. github.com → **+** (top right) → **New repository**
2. Name it (`idgarden`), **Public** (free Pages hosting needs public on the free plan), no README → **Create**

### 1.2 Push the code from your computer
In the project folder:
```bash
git init -b main
git add -A
git commit -m "First version"
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```
- First push opens a GitHub login window (Git Credential Manager)
- **Gotcha we hit:** if your computer is logged in as a *different* GitHub account you'll get `403 Permission denied`. Force the right account by putting your username in the URL:
  `git remote set-url origin https://<you>@github.com/<you>/<repo>.git` → push again → log in as `<you>`

### 1.3 Auto-deploy with GitHub Actions
- The file `.github/workflows/deploy.yml` tells GitHub what to do on every push:
  1. check out the code
  2. run `node scripts/build-discover.mjs` (fetches fresh articles)
  3. copy the site files into `_site/`
  4. publish `_site/` to GitHub Pages
- It also runs on a timer (`cron: '17 */6 * * *'` = every 6 hours) so Discover stays fresh

### 1.4 Turn on Pages
1. Repo → **Settings** → **Pages**
2. **Source: GitHub Actions** (not "Deploy from a branch")
3. Repo → **Actions** tab → watch the run go green (~1 min)
4. Site is at `https://<you>.github.io/<repo>/`

From now on: **edit → commit → push → live in ~1 minute.**

---

## Part 2: Supabase (accounts + database)

### 2.1 Create the project
1. supabase.com → sign in (GitHub login works) → **New project**
2. Pick a name, a strong database password (save it in a password manager), nearest region → **Create**
3. The **Project URL** looks like `https://<project-ref>.supabase.co`

### 2.2 Get the browser key
1. **Project Settings → API Keys**
2. Copy a **Publishable key** (`sb_publishable_…`)
3. Put URL + key in `src/config.js`
- ✅ The publishable key is *meant* to be public (it ships inside the website)
- ❌ **Never** put a **secret** key (`sb_secret_…`) in website code: it bypasses all security

### 2.3 Create the table (SQL Editor)
1. **SQL Editor → New query** → paste `supabase/schema.sql` → **Run**
2. What it does:
   - `create table gardens (user_id, state jsonb, updated_at)`: one row per user holding their garden
   - `enable row level security` + 4 policies `auth.uid() = user_id`: **each user can only read/write their own row**. This is what makes the public key safe
   - `alter publication supabase_realtime add table gardens`: live updates to other open devices
- Supabase warns "destructive operation" because of `drop policy if exists`. Fine here: it only replaces this script's own policies so it can be re-run

### 2.4 Tell Supabase where your site lives
**Authentication → URL Configuration**
- **Site URL:** `https://<you>.github.io/<repo>/`
- **Redirect URLs** (Add URL):
  - `https://<you>.github.io/<repo>/**` (live site)
  - `http://localhost:5173/**` (testing on your computer)
- Why: after login, Supabase only sends users back to addresses on this list (stops attackers redirecting logins to their own sites)

---

## Part 3: Google sign-in

Google needs to know your app exists before it lets users log in with it. You create an **OAuth client** in Google Cloud and give its ID + secret to Supabase.

### 3.1 Google Cloud project
1. console.cloud.google.com → project picker (top left) → **New project** → name `Idea Garden` → **Create** → select it

### 3.2 Consent screen (what users see: "Idea Garden wants to sign you in")
1. Menu → **APIs & Services → OAuth consent screen** (newer console: **Google Auth Platform → Get started**)
2. **App name:** Idea Garden · **User support email:** yours → Next
3. **Audience: External** → Next
4. **Contact email:** yours → agree → **Create**
5. **Audience** page:
   - While in **Testing**, only listed **test users** can log in → **Add users** → your Gmail(s)
   - Or **Publish app** → anyone with Google can log in. Basic scopes (email, profile) need no Google review

### 3.3 Create the OAuth client
1. **Clients** (or **Credentials → + Create credentials → OAuth client ID**)
2. **Application type: Web application** · Name: `Idea Garden web`
3. **Authorized JavaScript origins:**
   - `https://<you>.github.io`
   - `http://localhost:5173`
4. **Authorized redirect URIs:** (the important one: Google sends the login result to Supabase, not to your app)
   - `https://<project-ref>.supabase.co/auth/v1/callback`
5. **Create** → copy **Client ID** and **Client secret**
   - The client secret is a password: paste it only into Supabase, never into code or chat

### 3.4 Connect Google to Supabase
1. Supabase → **Authentication → Sign In / Providers → Google**
2. **Enable** · paste **Client ID** + **Client secret** → **Save**
3. (That page also shows the Callback URL: it must match step 3.3.4 exactly)

### 3.5 Test
1. Open the live site → **Log in with Google** → pick your account → you're back in the app, signed in
2. Capture an idea → open the site on your phone → sign in → the idea is there

### Common errors
| Error | Fix |
|---|---|
| `redirect_uri_mismatch` (Google) | redirect URI in 3.3.4 doesn't exactly match the Supabase callback |
| `Access blocked: app not verified` / not allowed | add yourself as a test user (3.2.5) or publish the app |
| Back on the site but not signed in | site URL missing from Supabase Redirect URLs (2.4) |
| `Unsupported provider: provider is not enabled` | Google toggle not saved in Supabase (3.4) |

---

## How the login flow works (big picture)
```
1. You click "Log in with Google" on <you>.github.io
2. App → Supabase → Google login page
3. Google → https://<ref>.supabase.co/auth/v1/callback   (Google trusts this because of 3.3.4)
4. Supabase creates/finds your user → back to <you>.github.io/<repo>/?code=…   (allowed by 2.4)
5. The app exchanges the code for a session, then sync.js loads your garden row (only yours, thanks to RLS)
```
