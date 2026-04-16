# 🚀 Launch Checklist — sircle.agency

Status van het werk richting live-launch. Bijgewerkt door Claude.

---

## ✅ Al afgerond in deze sessie

### Bugs
- [x] **Mobile SIRCLE model bug gefixt** — CSS-selector `:first-child` matchte niks
  waardoor op mobiel geen model-afbeelding zichtbaar was. Elke fase-kaart heeft
  nu zijn eigen inline model-image (Strategy / Production / Growth / Care).
  (`css/sticky-steps.css` + `js/main.js`)
- [x] **Homepage "World Skate Center" kaart gefixt** — had een Stoneborn-foto
  én een kapotte `href="#"` link. Vervangen door Dudok Consulting (echte case).
- [x] **Zwakke email-validatie gefixt** — was alleen `.includes('@')`. Nu een
  strikte regex die `user@`, `@domain.com`, `user@localhost` allemaal afwijst.

### Portfolio hygiene
- [x] **"Binnenkort" cases verborgen** op `werk.html` (KONE + World Skate) zodat
  geen stockfoto's meer in het portfolio verschijnen. Comments blijven in de
  code voor wanneer de echte content klaar is.

### SEO & social sharing
- [x] **Favicon** toegevoegd (SVG) op alle 26 pagina's
- [x] **Apple touch icon** toegevoegd
- [x] **`og:image` + `twitter:card`** toegevoegd op alle pagina's
- [x] **`canonical` URLs** gecleaned-up (duplicates verwijderd, alle naar
  `sircle.agency`)
- [x] **`sitemap.xml`** aangemaakt met alle 25 publieke pagina's
- [x] **`robots.txt`** aangemaakt
- [x] **`noindex`** gezet op `wireframes.html` en `gradient-demo.html`
  (interne pagina's — zichtbaar maar niet te indexeren)

### Accessibility / HTML validatie
- [x] **Alle `<button>` elementen** hebben nu `type="button"` of `type="submit"`
- [x] **Aria-labels** toegevoegd aan hamburger, menu-close, phase dots, en
  testimonial carousel dots
- [x] Index.html was **18 validation errors** → nu **0 errors** (6 warnings resteren)

### Contact form
- [x] **Form post werkt nu echt** via Fetch API naar een configureerbaar
  endpoint (ipv alleen animatie)
- [x] **Loading state** op de submit knop (`Versturen…`)
- [x] **Error state** als de server faalt

### Testing (vorige sessie + uitgebreid)
- [x] **100 unit tests** — allemaal groen
- [x] Email regex validatie is nu gedekt door tests

---

## ⏳ Wat ik van jou nodig heb om echt live te kunnen

### 🔴 Blokkerend — zonder dit kan de site niet live

#### 1. Contactformulier endpoint
Het formulier is klaar, maar heeft een backend-endpoint nodig.
- **Waar:** `contact.html` regel ~160, attribuut `action="..."`
- **Staat nu:** `action="https://formspree.io/f/REPLACE_WITH_YOUR_FORMSPREE_ID"`
- **Wat ik nodig heb:** account op [Formspree.io](https://formspree.io) (of
  alternatief: Resend, Netlify Forms, FormKeep). Plak de form-ID in.
  - Formspree Free tier: 50 submissions/maand, prima voor start.
  - Paid €10/mnd: unlimited + spam filter.
- **Alternatief:** als jullie al een backend of Zapier/Make.com flow hebben,
  geef me die endpoint URL.

#### 2. Eigen domein (`sircle.agency`)
- **Huidige situatie:** live op `sircle-cloud.github.io/sircle-agency-v3/`
- **Actie nodig:**
  - DNS instellen bij je domain registrar (CNAME naar `sircle-cloud.github.io`)
  - In GitHub Pages settings: custom domain invullen
  - HTTPS aanzetten (GitHub geeft gratis Let's Encrypt)
- **Moet er nog:** `CNAME` bestand in de repo root met de inhoud `sircle.agency`
  — dat kan ik toevoegen zodra je zegt "ja, gebruik sircle.agency".

#### 3. Echt og-image (1200×630 px)
- **Gebruikt nu:** `https://sircle.agency/assets/og-image.jpg` — **bestand bestaat nog niet**
- **Wat ik nodig heb:** 1 PNG of JPG van 1200×630 px met je logo + tagline.
  Vaak voor agencies: donkere achtergrond + wit logo + "Every brand has a story worth telling".
  Zet hem in `assets/og-image.jpg` en ik check alle verwijzingen.
- **Tool-tip:** gebruik [bannerbear.com/og-image](https://bannerbear.com) of
  Figma als je'n snelle wilt.

#### 4. Favicon upgrade (optioneel maar aanbevolen)
- **Gebruikt nu:** `assets/svg/svg-black-S.svg` als favicon
- **Beter:** een specifiek 32×32 of 64×64 PNG-favicon werkt op alle browsers.
  SVG werkt op moderne browsers maar niet op Safari iOS en oudere versies.
- Tool: [realfavicongenerator.net](https://realfavicongenerator.net) →
  upload SVG, krijg compleet pakket terug.

#### 5. Cookie-banner + privacyverklaring (AVG/GDPR)
- **Huidige status:** geen cookie banner, geen privacypagina
- **Analytics keuze bepalen:** wil je Google Analytics (cookie-consent verplicht) of
  Plausible / Umami (privacy-first, geen consent nodig)? Ik raad **Plausible** aan:
  €9/mnd, geen banner nodig, mooie dashboards.
- **Privacyverklaring:** kort document (in Nederlands) — welke data verzamelen we,
  hoe lang bewaren. Kan ik opstellen als je wilt.
- **Cookie banner:** alleen nodig als je Google Analytics of tracking pixels
  gebruikt. Met Plausible → geen banner, geen consent-gedoe.

### 🟡 Belangrijk maar niet blokkerend

#### 5a. Stoneborn visuals vernieuwen (Figma → assets)
Ik kon de Figma-files voor Stoneborn + Casper Bouman niet direct ophalen —
Figma blokkeert screenshot-toegang vanaf deze sandbox (403 CloudFront).
**Wat ik nodig heb:** exporteer de frames die je mooi vindt als PNG/JPG uit Figma
(`File → Export → 2x PNG`), en zet ze in `assets/cases/` met namen als
`stoneborn-figma-1.jpg`, `casper-figma-1.jpg`, etc. Ik update dan de case pages.

Figma links voor referentie:
- Stoneborn: https://www.figma.com/design/npV6YTa75woG0efgAOXhrV/STONEBORN---SIRCLECREATIVE
- Casper Bouman: https://www.figma.com/design/qMaIUwcSoizZ9n3sCR22Qg/Casper-Bouman

#### 6. Marquee client check
Op de homepage staat een scrollende marquee met:
> VLIJT · Redbull · KONE · Dudok · World Skate Center · Casper Bouman · Kanslokaal · 22qMinded · Oceans of Energy · Stoneborn · Breinwijzers

**Check:** zijn Redbull, KONE, World Skate Center en Oceans of Energy **écht**
betaalde klanten geweest? Als niet, eruit halen. Als wel, top — laat ze staan
maar overweeg case-beschrijving toe te voegen (al is het kort).

#### 7. Kone + World Skate cases afmaken
Nu verborgen. Om weer te publiceren heb ik nodig:
- Real case photos (geen stock)
- Korte case-tekst in Nederlands (probleem → aanpak → resultaat)
- Evt. video embed (Vimeo/YouTube)
- Vervolgens maak ik de detailpagina + zet terug op werk.html

#### 8. Performance optimalisatie
- **Hero video `TIMELAPSE.mp4` is 11 MB** — dat is te veel voor mobiel. 4G-gebruikers
  wachten 5-10 sec. Aanbeveling:
  - Comprimeer naar <3 MB (HandBrake of ffmpeg, H.264, 1080p@24fps)
  - Of serveer via Cloudflare Stream / Mux (€5-10/mnd, adaptive streaming)
  - Voeg `poster="..."` attribuut toe met een JPG zodat er meteen iets zichtbaar is
- **Case-foto's comprimeren:** `casper-screenshot.jpg` is 1.4 MB. Converteer grote
  JPG's naar WebP (Squoosh.app), vaak 50-70% kleiner.

#### 9. Extra cases publiceren
- Op werk.html staan nu 7 live cases. Voor een creative agency is **10-12 sterker**.
- Cases die nog ongepubliceerd zijn kun je aanleveren → ik maak detailpagina's.

#### 10. Resultaten/cijfers per case toevoegen
- Cases zijn nu visueel sterk maar hebben weinig **meetbare bewijslast**.
- Per case 2-3 cijfers zou enorm helpen. Voorbeelden:
  - "Organisch verkeer +127% in 6 maanden"
  - "Leads +340% (van 3 → 13 per week)"
  - "Performance score 100/100 (Dudok heeft dit al!)"

---

## 🎬 Video-strategie — jouw belangrijkste content-gap

Ik merkte op dat de hero al een video heeft (`TIMELAPSE.mp4`). Goed. Maar verder is
er nauwelijks video. Voor een creative agency die video-productie verkoopt:

| Pagina | Idee | Prioriteit |
|---|---|---|
| Homepage hero | Heeft al video ✅ — maar groot bestand (11MB), comprimeer | Klein werk, grote impact |
| SircleStudio pagina | Reel van 30-60s met project-compilatie | 🔴 Hoog — je verkoopt video |
| SircleStrategy | Korte uitleg-video van jou aan de camera (2 min) | Medium |
| Over ons | Team-reel (office, aan het werk, beetje persoonlijk) | Medium |
| Case: KONE | De safety video zelf embedden | 🔴 Hoog (zodra af) |
| Case: World Skate | Brand film embedden | 🔴 Hoog (zodra af) |
| Journal: "Video in merkstrategie" | Artikel heeft al een titel — voeg een demo-video toe | Medium |

---

## 📋 Suggested volgorde komende weken

### Week 1 (jouw input nodig)
1. Formspree account + endpoint aanleveren → ik activeer contactform
2. Domein DNS regelen → ik voeg CNAME toe en check alle og-urls
3. Og-image ontwerpen (1200×630) → ik plaats em

### Week 2 (analytics + privacy)
4. Kies Plausible of GA4
5. Ik installeer + voeg privacyverklaring toe
6. (Als GA4) cookie-banner setup

### Week 3 (video + portfolio versterking)
7. Comprimeer TIMELAPSE.mp4
8. Lever case-content voor KONE/World Skate (of besluit ze permanent te schrappen)
9. Lever 2-3 extra cases aan

### Week 4 (polish & launch)
10. Performance audit (Lighthouse >90 alle metrics)
11. Mobile testing op echte devices
12. Go live! 🎉

---

## 🧪 Tests infrastructuur
(vorige sessie)

```bash
npm test           # 100 unit tests
npm run test:e2e   # Playwright E2E (navigation, form, links)
npm run test:html  # HTML/accessibility validator
```

Alle tests runnen lokaal. Kunnen later in GitHub Actions CI.
