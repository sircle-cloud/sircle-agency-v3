# CLAUDE.md — sircle-agency-v3

## Project Overview

**sircle.agency** is a premium creative agency website based in The Hague, Netherlands. The site is a static HTML/CSS/JS website with sophisticated scroll-based animations, showcasing the agency's SIRCLE Model (Strategy → Production → Growth → Care).

All content is in **Dutch (Nederlands)**.

## Tech Stack

- **No build tools or package manager** — plain static files, no Node.js
- **HTML5** — semantic markup, one HTML file per page
- **CSS3** — custom design system with CSS variables, no CSS framework
- **Vanilla JavaScript** — no frameworks (no React, Vue, etc.)
- **GSAP 3.12.5** + ScrollTrigger — animation engine (loaded via jsDelivr CDN)
- **Lenis 1.1.18** — smooth scroll library (loaded via jsDelivr CDN)
- **Google Fonts** — Kulim Park (weights 300, 400, 600, 700)

## Directory Structure

```
├── index.html              # Homepage
├── diensten.html           # Services page
├── over-ons.html           # About page
├── contact.html            # Contact page
├── werk.html               # Portfolio overview
├── wireframes.html         # Internal design token documentation
├── werk/                   # Case study detail pages (7 cases)
│   ├── casper-bouman.html
│   ├── vlijt-tandartsen.html
│   ├── kanslokaal.html
│   ├── dudok-consulting.html
│   ├── 22qminded.html
│   ├── breinwijzers.html
│   └── stoneborn.html
├── css/
│   ├── style.css           # Global styles + design tokens (~2,800 lines)
│   ├── nav-bold.css        # Fullscreen navigation overlay
│   ├── sticky-steps.css    # Sticky scroll animation for SIRCLE model
│   ├── diensten.css        # Services page styles
│   ├── over-ons.css        # About page styles
│   ├── contact.css         # Contact page styles
│   └── case.css            # Case detail page styles
├── js/
│   ├── main.js             # Core animations, nav, loader (~1,400 lines)
│   ├── diensten.js         # Services page interactions
│   ├── contact.js          # Contact form validation & animations
│   └── over-ons.js         # About page animations
└── assets/
    ├── cases/              # Portfolio images (JPG)
    ├── images/             # General page images (Unsplash JPGs)
    ├── sircle-model/       # SIRCLE model diagrams (PNG)
    │   └── cropped/
    └── svg/                # Logo variants (SVG, black & white)
```

## Design System (CSS Variables)

Defined in `css/style.css` `:root`.

**Colors:**
- Dark backgrounds: `--dark-green: #082412` (primary), `--dark-grey: #1C1E1D`, `--black: #000`
- Light backgrounds: `--cream: #F3EFE8`, `--warm-white: #FFF8EE`, `--white: #FFF`
- Brand greens: `--mid-green: #3F6F45`, `--sage-green: #8FAF8A`, `--soft-green: #D0DFB9`
- Accents: `--gold: #F2E2A4` (primary accent), `--bronze: #C4A854`, `--copper: #B89A5A`

**Spacing scale:** `--space-xs` (8px) through `--space-3xl` (128px)

**Easing:** `--ease-out-expo`, `--ease-out-quint`

**Section patterns:** `.section-dark` / `.section-cream` for alternating background contrast

## Key Coding Conventions

### HTML
- Semantic elements (`<section>`, `<nav>`, `<footer>`, `<address>`)
- Major sections separated by comment blocks (`<!-- ======= SECTION NAME ======= -->`)
- `data-*` attributes for JS hooks
- Inline SVG for icons (stroke-based, not filled)
- `loading="lazy"` on images
- Query string cache busting on CSS/JS (`?v=2`)

### CSS
- BEM-inspired class naming (`.phase-section`, `.case-card`, `.hero-title`)
- Utility classes for animations: `.reveal-up`, `.reveal-clip`
- Button variants: `.btn-primary`, `.btn-secondary`, `.btn-ghost`
- Layout: `.container`, `.container-wide`
- Mobile-first responsive design (breakpoint at 768px)
- No CSS framework — custom flexbox/grid layouts

### JavaScript
- Vanilla JS only — no jQuery or frameworks
- IIFE patterns for page-specific scripts (contact.js, over-ons.js)
- Custom `splitTextIntoWords()` / `splitTextIntoChars()` helpers (no SplitText plugin)
- Mobile detection via `window.innerWidth < 768`
- Null-check DOM elements before manipulation
- GSAP ScrollTrigger for all scroll-based animations
- Lenis integrated with GSAP ticker for unified animation loop

### Animation Patterns
- `gsap.from()` / `gsap.to()` with ScrollTrigger
- Stagger: 0.1–0.15s between items
- Standard easing: `power2.out`, `power3.out`, `elastic.out`
- Hero animations: text split into words/chars → staggered reveal
- Section reveals: fade + translateY via `.reveal-up` class
- Page loader: animated counter 0→100 with fallback timeout (4s)

## Development Workflow

### Running locally
No build step. Serve files with any static server:
```bash
python3 -m http.server 8000
# or
npx serve .
```

### Deployment
Static hosting — ready for Vercel, Netlify, GitHub Pages, or any web server. All asset paths are relative.

### Git Conventions
- Commit format: `v{N}: {description}` (e.g., `v5: CSS cleanup, emoji→SVG icons`)
- Descriptive messages focused on user-facing changes
- Current version: v5

## Important Notes for AI Assistants

1. **No build tools** — never add package.json, webpack, or similar unless explicitly asked
2. **Keep it vanilla** — do not introduce frameworks (React, Tailwind, etc.)
3. **Animation quality is critical** — GSAP/ScrollTrigger animations are a core feature, not decoration. Preserve smooth easing, stagger timing, and scroll-driven triggers
4. **Dutch content** — all user-facing text must be in Dutch
5. **Design tokens** — use CSS variables from `style.css` for colors, spacing, and easing. Do not hardcode values
6. **Page-specific files** — each page has its own CSS and (where needed) JS file. Keep this separation
7. **SVG icons** — use inline SVG with stroke-based icons, not emoji or icon fonts
8. **Case study pages** live in `werk/` and share `css/case.css`
9. **Lenis + GSAP integration** — smooth scroll is tied to the GSAP ticker in `main.js`. Do not replace Lenis with native scroll-behavior or break this coupling
10. **No external dependencies beyond GSAP and Lenis** — keep the CDN-only approach
