# Phase 5: Discover from credible sources ✅

## Pipeline
`scripts/sources.json` → `node scripts/build-discover.mjs` → `data/discover.json` → app (`src/data/discover.js`)
- CI: `.github/workflows/deploy.yml` rebuilds daily (05:17 UTC) + on every push. If the build fails, the committed json is deployed
- Per source: newest 8 within 60 days; retry once on an empty/failed fetch; dedupe by URL hash
- Stored per item: id, title, url, date, ≤220-char excerpt, source, group, kind. Links out, never copies articles
- Nature feed split by URL: `/articles/s41586…` = paper → group research; `d41586…` = news → science
- OpenAlex: per query in `sources.json → openalex.queries`: open-access articles from the last 12 months, most cited, with abstract

## Groups (= interests)
| Group | Sources |
|---|---|
| science | Quanta, Science News, Knowable, Nature (news), Scientific American, SciTechDaily, ScienceDaily, NASA |
| research (journal articles) | Cell, Bioinformatics, PLOS Comp Bio, eLife, PLOS ONE, Nature (papers), OpenAlex |
| health | WHO*, STAT, Healthline, ScienceDaily Health |
| psychology | Psyche, Behavioral Scientist, Wondermind*, ScienceDaily Mind & Brain |
| tech | MIT Technology Review, MIT News, Ars Technica, Wired |
| design | Nielsen Norman Group, Smashing Magazine, Design Observer |
| architecture | Dezeen, ArchDaily |
| business | MIT Sloan Management Review, Knowledge at Wharton, Inc., Business Insider |
| education | Hechinger Report, The Conversation, Harvard Gazette |
| culture | Aeon, Noema, Big Think, Smithsonian, Public Domain Review, History of Yesterday |
| writing | Literary Hub, The Marginalian |
| food | ScienceDaily Nutrition |
| news (opt-in) | BBC, NPR, The Guardian, Vox, The Straits Times |

\* feed currently stale (nothing in 60 days)

Not possible: CNN (feed frozen 2023), National Geographic (no feed), Wiley topic page (bot wall; individual journals have feeds). arXiv dropped by the user.

## App
- Tabs: For you · Something different · For your project · Browse (group chips) · My inspirations
- Cards: group · source · age, 🔬 Journal article badge, excerpt, 🦋 Save (→ optional reflection → connection suggestions)
- Saved journal articles get type `research`
- "Where this comes from" lists all sources + last update

## Later
- Per-topic tagging for multi-topic sources (The Conversation, MIT News)
- Food sources beyond nutrition; user-chosen sources
