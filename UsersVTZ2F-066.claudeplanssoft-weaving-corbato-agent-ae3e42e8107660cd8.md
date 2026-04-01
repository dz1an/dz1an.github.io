# Portfolio Modernization Plan -- dz1an.github.io

## Executive Summary
Modernize the portfolio from a dated 2020-era Bootstrap template into a clean, contemporary static site. Update all content to match the current resume. Fix existing bugs. Improve mobile. Retain vendor stack.

## Part 1: Critical Bug Fixes
1.1 Fix BS5 navbar toggle (data-toggle -> data-bs-toggle) in index.html line 72
1.2 Fix Font Awesome path (vendor/font-awsome -> vendor/font-awesome) or fix HTML reference
1.3 Fix email typo (gmaill -> gmail) in index.html line 453
1.4 Fix CV download path in js/theme.js line 163

## Part 2: CSS Variables Design System
2.1 Add :root block with color, spacing, radius, shadow, transition tokens
2.2 Add Inter font via Google Fonts
2.3 Update body base styles
2.4 Replace all hardcoded colors with variables

## Part 3: Hero Section Redesign
3.1 Remove d-none d-md-block, make visible on all devices
3.2 Replace anime bg with text-focused layout + gradient mesh
3.3 Add professional summary, CTA buttons, social links
3.4 Update Typed.js strings to match resume titles

## Part 4: Navbar Modernization
4.1 Add brand, fix BS5 attrs, add CTA button
4.2 Transparent-to-white scroll behavior via JS
4.3 Refined typography (16px, medium weight)

## Part 5: About Section Update
5.1 Rewrite with actual professional summary
5.2 Update stat cards (5+ projects, 636+ businesses, award)
5.3 Remove dated 3+ years badge, add profile photo

## Part 6: Skills Overhaul
6.1 Replace services with real expertise areas
6.2 Replace progress bars with categorized tag/chip layout
6.3 Extract nested skills section into standalone section

## Part 7: Experience Section Rewrite
7.1 Add all 5 work entries from resume
7.2 Add 2 education entries + certification + award
7.3 Vertical timeline design
7.4 Remove fake Diploma in Web Development entry

## Part 8: Projects Section Rewrite
8.1 Replace with 5 resume projects (Vintech, ZamGo, Academy, BarangayConnect, Inventa)
8.2 New card design with visible content (not hover-only)
8.3 CSS Grid layout, placeholder cards for missing screenshots

## Part 9-14: Contact, Footer, Mobile, JS, Preloader, Nav Order
See full conversation for detailed breakdown.

## Implementation Phases
Phase 1: Bug fixes (zero risk)
Phase 2: CSS variables (low risk)
Phase 3: Hero + nav (biggest impact)
Phase 4: Content sections (one at a time)
Phase 5: Polish + mobile audit

## Key Files
- index.html
- css/style.css
- js/theme.js
- vendor/font-awsome/ (rename to font-awesome)
- cv/ (rename PDF for web-safe path)