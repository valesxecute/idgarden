# Phase 2: feedback round 2: home redesign (sketch) + quiet suggestions ✅ · 🗳️ pick a home style

Source: user test of v0.2 + paper sketch (login screen + home).

| Feedback | Change | Where |
|---|---|---|
| "Noticed in your garden" doesn't belong on the garden | Removed from home. Split by context, max 3 each, all dismissible (×) | `ideaSuggestions()`, `revisitList()`, `projectNudges()`, `sugBox()` |
| Suggestions inside the idea, subtle | Quiet "✨ Suggestions" box on the idea page: related ideas, saved inspirations, 1 Discover pick (stricter match, score ≥3) | `viewIdea` |
| Related ideas need a delete/cross | × on every suggestion (dismissed key `sug:idea:other`); linked ideas keep × to unlink | `sugRow()` |
| Revisit → Ideas part | "🌰 Worth a revisit" box on Ideas → All / Seed vault | `viewIdeas` |
| Main + side projects | Main = `isMain` flag or newest active; "Make it the main project" on the project page; Main/Side pills in the list; side projects listed under the current project card | `Store.activeProjects()`, `make-main` |
| Account in the home buttons | Tab bar: 6th item "Account" (avatar + sync dot) after Learn; sidebar nav "Account"; header avatar removed | `shell()` |
| Sketch: login | "Start blooming your ideas" · big LOG IN (Google) · "Don't have an account yet? Create account" · guest · sample · sprout drawing | `viewOnboarding` step 0 |
| Sketch: home | top: current project · 🌸 Add idea · last inspiration; stats: 🫙 Incubator count · 🌿 Level; center: 3D scene | `viewGarden` |
| Try versions | Style switcher (saved in `user.gardenStyle`): 🪴 Planter box (sketch) · 🏝️ Floating island · 🌄 Meadow (v0.2) | `Garden.renderBox/renderIsland/render` |

## Level
`Store.gardenLevel()`: points = idea stage (1/2/3/5) + inspirations + projects (5 + 4/milestone + 15 done) + learning items; 12 pts/level. Calm signal only, no streaks.

## Iso scenes
- Box: 6×6 grid, iso projection `x'=(x−y)·0.866·s`, `y'=(x+y)·0.5·s−z`; reserved cells for trees (back) and sunflowers (right edge); ideas hash into free cells; sprites sorted back→front
- Island: grass ellipse + dirt underside; golden-angle spiral spots; pond; gentle float animation
- Same sprites as the meadow → one art style

## To decide
- Which home style stays (then remove the switcher + the other two)
- Is Level wanted on the home? (the spec says gamification is secondary)
