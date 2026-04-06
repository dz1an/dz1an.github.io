# CLAUDE.md — //kent.dev Portfolio

## Project Overview
Personal portfolio for John Kent Evangelista — Senior Software Developer. Two modes:
- **Code Mode** (default dark): Xcode/IDE-themed portfolio with all sections
- **Creative Mode** (Frieren-inspired journey): Scroll-driven Three.js 3D experience — ancient ruins + forest with purple magic accents, programmatic mage + companion figures, fantasy narrative

## Tech Stack
- **No frameworks** — vanilla HTML/CSS/JS
- **Three.js** (v0.160, CDN, lazy-loaded only when creative mode activates)
- **Bootstrap 5** (grid + navbar collapse only)
- **Font Awesome 6** (icons)
- **Typed.js** (hero terminal typing effect)
- **No build tools** — no webpack, no npm, no bundler

## File Structure
```
index.html          — Single page, all sections
css/style.css       — All styles (IDE hero, creative mode, responsive)
js/theme.js         — Code mode interactions, toggles, animations, easter eggs
js/creative.js      — Three.js journey scene (lazy-loaded)
sw.js               — Service worker for PWA/offline
404.html            — Custom 404 page (Xcode Build Failed theme)
vendor/             — Bootstrap, Font Awesome, Typed.js (minified)
images/             — Profile photo, project screenshots (PNG)
cv/                 — Resume PDF
```

## Key Architecture Decisions
- **Lazy loading**: Three.js + creative.js only load when user activates creative mode
- **No build step**: Deploy directly to GitHub Pages by pushing to main
- **Shared materials**: Forest trees use shared material pools (4 trunk + 6 canopy)
- **LOD system**: Near trees get full detail, far trees get trunk + 1 canopy
- **Mobile detection**: `isMobile` flag reduces trees (35 vs 120), disables lights, lowers segments
- **Programmatic characters**: Frieren + Fern built from Three.js primitives (no external 3D models)

## Brand Palette
**Code Mode (Sage Green)** — CSS custom properties in `:root`:
```
Deep:    #344E41    Dark:    #3A5A40
Primary: #5C7650    Accent:  #A3B18A
Light:   #DAD7CD    Muted:   #6B8F71
```

**Creative Mode (Sage + Purple Magic)** — Three.js hex values:
```
Forest base: same sage greens as Code Mode
Magic purple: #8B7EC8    Lavender:  #C4B5E0
Deep purple:  #4A3F6B    Gold:      #D4A855
Silver:       #D4D4DC    Bg:        #0C1210
```

## Creative Mode — Frieren-Inspired Journey

**Scene elements:**
- Ancient ruins (stone pillars with glowing runes, archway, magic circle with hexagonal pattern)
- Frieren-inspired mage (white/green robe, silver hair, pointed hat, staff with purple orb)
- Fern companion (sleeping near shelter, purple hair, blanket)
- Flower fields (purple/white, clearing + meadow)
- Floating grimoire pages drifting through air
- Mana motes (purple particles throughout forest)
- Ruined stone shelter (replaces tent)
- Grimoire on stone altar (replaces laptop)

**Layout:**
```
z: 44   Entrance (tree-lined path, stone archway at z:-8)
z: 14   Camp clearing (radius 14, stone pillars, magic circle)
z: 0    Campsite (shelter, campfire, Frieren + Fern, grimoire)
z:-10   Crystal grove (5 waypoints on stone pedestals, zigzag)
z:-36   Mana meadow (12 tech labels as lavender particles)
z:-55   Deep woods + billboard trees
```

**Chapter narrative** (journey-focused, Frieren philosophy):
- "The Road Ahead" → "A Mage's Origin" → "The Resting Place" → "The Grimoire"
- → "First Waypoints" → "More Light in the Dark" → "What I Carry With Me"
- → "A Mark Left Behind" → "Rising Above" → "The Journey Continues"

## Code Mode — IDE Hero
- Titlebar (dots + filename + Build & Run button → triggers creative mode)
- Sidebar (project navigator, profile, links, CV)
- Editor (4 tabs: README.md, skills.json, forest.js, debug.js)
- Inspector (stats, award, frameworks)
- Console (interactive — type `help` for commands)
- Status bar + breadcrumb

## Easter Eggs
- **Konami code** (up up down down left right left right B A)
- **DevTools detection** (desktop only)
- **Console commands**: help, ls, whoami, cat about.md, git log, tree, solve, I am [name]
- **Debug puzzle**: debug.js tab — fix the missing `!`
- **Visitor name carving**: `I am [name]` → tree reads "Kent + [name]"
- **Journey remembers**: Ember marks persist via localStorage
- **Canopy reveal**: All crystals flash at ch8
- **Command palette**: Cmd+K
- **Keyboard shortcuts**: 1-6 sections, Cmd+/ creative mode

## Important Patterns
- **Theme switching**: `data-theme="creative"` on `<html>` hides portfolio, shows 3D
- **Cinematic transitions**: Dark overlay + Xcode build terminal
- **Sound system**: `window.playSound(type)` — click, build, success, konami
- **Toast system**: `window.showToast(title, sub, icon)`
- **Return visitors**: Fast boot preloader, cached assets

## Things to NOT Do
- Don't add CSS/JS frameworks — intentionally vanilla
- Don't add `scroll-behavior: smooth` globally — fights Safari momentum
- Don't enable Three.js shadows — removed for performance
- Don't create new materials inside loops — use shared pools
- Don't change Code Mode when modifying Creative Mode — independent
- Don't make purple overwhelm the scene — sage green is the base

## Testing
1. Code Mode: all sections render, typed.js, console commands, debug puzzle
2. Creative Mode: toggle via tree icon, scroll 10 chapters
3. Characters: Frieren visible with spotlight, Fern sleeping near shelter
4. Ruins: pillars, archway, magic circle visible
5. Mobile: hamburger on scroll, reduced geometry, throttled touch
6. Safari: theme-color, preloader, no devtools false positive
7. Offline: service worker caches, fast return visits
8. 404: custom page at /404.html
