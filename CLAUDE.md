# CLAUDE.md — //kent.dev Portfolio

## Project Overview
Personal portfolio for John Kent Evangelista — Senior Software Developer. Two modes:
- **Code Mode** (default dark): Xcode/IDE-themed portfolio with all sections
- **Creative Mode** (forest): Scroll-driven Three.js 3D forest experience

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
js/creative.js      — Three.js forest scene (lazy-loaded)
sw.js               — Service worker for PWA/offline
vendor/             — Bootstrap, Font Awesome, Typed.js (minified)
images/             — Profile photo, project screenshots
cv/                 — Resume PDF
```

## Key Architecture Decisions
- **Lazy loading**: Three.js + creative.js only load when user activates creative mode via `window.loadCreativeMode()` in index.html
- **No build step**: Deploy directly to GitHub Pages by pushing to main
- **Shared materials**: Forest trees use shared material pools (4 trunk + 6 canopy) to reduce GPU draw calls
- **LOD system**: Trees near camera get full detail (roots, branches, ground discs). Far trees get trunk + 1 canopy only
- **Mobile detection**: `isMobile` flag reduces tree count (35 vs 120), disables firefly lights, lowers geometry segments

## Brand Palette (Sage Green)
```
Deep:    #344E41    Dark:    #3A5A40
Primary: #5C7650    Accent:  #A3B18A
Light:   #DAD7CD    Muted:   #6B8F71
```
All colors are defined as CSS custom properties in `:root`. The forest scene uses these as hex values in Three.js materials.

## Creative Mode — Forest Layout
```
z: 44   Entrance (tree-lined path)
z: 14   Camp clearing (radius 14)
z: 0    Campsite (tent, fire, Kent figure, laptop)
z:-10   Lantern grove (5 branch-hung lanterns, zigzag)
z:-30   Grove-to-meadow funnel
z:-36   Firefly meadow (12 tech labels, radius 10)
z:-55   Deep woods + billboard trees at horizon
```

Camera follows a 20-keyframe scroll-driven path through 10 chapters. Each chapter card is positioned opposite the 3D content (left card = content on right, right card = content on left).

## Code Mode — IDE Hero
The hero section is styled as an Xcode workspace with:
- Titlebar (dots + filename + Build & Run button)
- Sidebar (project navigator, profile, links, CV)
- Editor (3 tabs: README.md, skills.json, forest.js + debug.js puzzle)
- Inspector (stats, award, frameworks)
- Console (interactive — type `help` for commands)
- Status bar (branch, errors, encoding)

## Easter Eggs
- **Konami code** (up up down down left right left right B A)
- **DevTools detection** (desktop only)
- **Console commands**: `help`, `ls`, `whoami`, `cat about.md`, `git log`, `tree`, `solve`, `I am [name]`
- **Debug puzzle**: debug.js tab has a fixable bug (missing `!`)
- **Visitor name carving**: Type `I am [name]` → tree in forest reads "Kent + [name]"
- **Forest remembers**: Ember marks persist via localStorage

## Important Patterns
- **Theme switching**: `data-theme="creative"` on `<html>` hides all portfolio content via CSS, shows the creative HUD + 3D canvas
- **Cinematic transitions**: Mode switches use a dark overlay + Xcode build terminal with real progress callbacks
- **Sound system**: `window.playSound(type)` — types: click, build, success, konami
- **Toast system**: `window.showToast(title, sub, icon)`

## Things to NOT Do
- Don't add a CSS framework (Tailwind, etc.) — the site is intentionally vanilla
- Don't add React/Vue/etc. — same reason
- Don't remove the `loading="lazy"` on images
- Don't add `scroll-behavior: smooth` globally — it fights Safari's native momentum scrolling
- Don't enable Three.js shadows — they were removed for performance
- Don't create new materials inside loops — use shared material pools

## Testing
1. Code Mode: check all sections render, typed.js works, console commands work, debug puzzle works
2. Creative Mode: toggle via tree icon, verify forest loads with progress, scroll through 10 chapters
3. Mobile: navbar collapses to hamburger on scroll, creative mode reduces geometry, touch events throttled
4. Safari: theme-color meta tag updates, preloader covers viewport, no devtools false positive
5. Offline: service worker caches core assets, return visits show fast boot
