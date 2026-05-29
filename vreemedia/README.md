# Vree Media — landingspagina (vreemedia.nl)

Een simpele, self-contained "hub"-pagina die naar al onze merken doorlinkt
(Sircle Agency, Sircle Solutions + toekomstige merken). In de Sircle-huisstijl
(donkergroen / goud / Kulim Park), zodat het als één merkenfamilie aanvoelt.

Bestand: [`index.html`](./index.html) — alle CSS en JS zit in dat ene bestand.

---

## 1. In WordPress plakken

### Optie A — Aangepaste HTML-block (snelst)
1. Open `index.html` en kopieer alles tussen
   `<!-- VREE-MEDIA START -->` en `<!-- VREE-MEDIA EINDE -->`
   (dat is het `<style>`-blok + de `<div class="vm">…</div>`).
2. WordPress → **Pagina's → Nieuwe pagina** (titel: `Home`).
3. Voeg een **"Aangepaste HTML"-block** toe en plak alles erin → **Publiceren**.
4. WordPress → **Instellingen → Lezen** → "Je homepagina toont" op
   **Een statische pagina** → kies de zojuist gemaakte pagina.
5. Laad het Kulim Park-font: voeg in **Weergave → Thema-bestand bewerken**
   (of via een plugin als *Insert Headers and Footers*) deze regel toe in de
   `<head>`:
   ```html
   <link href="https://fonts.googleapis.com/css2?family=Kulim+Park:wght@300;400;600;700&display=swap" rel="stylesheet">
   ```
   (Zonder deze regel valt de pagina netjes terug op een systeemfont.)

### Optie B — Zonder WordPress (aanrader voor een simpele hub)
Upload `index.html` direct naar de webroot, of host op Vercel / Netlify /
Cloudflare Pages. Dan komen fonts + `<head>` automatisch mee en heb je geen
WordPress-onderhoud nodig voor deze ene pagina.

> **Tip:** voor alléén een doorlink-pagina is WordPress eigenlijk zwaar
> (database, updates, beveiliging). Statisch hosten is sneller en
> onderhoudsvrij. WordPress is pas zinvol als je hier ook content/blog/CMS wilt.

---

## 2. Links aanpassen

Alle merk-links zijn in `index.html` gemarkeerd met `<!-- LINK: ... -->`:

| Plek            | Huidige waarde            | Controleer / pas aan                    |
|-----------------|---------------------------|-----------------------------------------|
| Sircle Agency   | `https://sircle.agency`   | ✅ klopt                                |
| Sircle Solutions| `https://sircle.solutions`| ⚠️ **verifieer de echte URL**           |
| Contact e-mail  | `info@vreemedia.nl`       | pas aan naar je echte adres             |
| Toekomstig merk | placeholder-kaart         | dupliceer een `.vm__card` voor nieuw merk |

Een nieuw merk toevoegen = een bestaande `<a class="vm__card">` kopiëren,
de tekst/URL aanpassen en eventueel `--vm-accent:#kleur` wijzigen.

---

## 3. Domein-forward (vreemedia.nl als hoofd-WP i.p.v. sirclecreative.com)

Je vermoedt dat sirclecreative.com niet meer werkt door een forward naar
sircle.agency. Zo zet je vreemedia.nl als nieuwe basis op (dit doe je zelf
bij je domeinregistrar/hosting — ik kan hier niet bij):

1. **DNS van vreemedia.nl** → laat de `A`/`CNAME`-records naar je
   WordPress-hosting (of Vercel/Netlify) wijzen. Verwijder een eventuele
   bestaande "URL-forward/redirect" op vreemedia.nl, anders stuurt het domein
   bezoekers door en zie je je nieuwe site niet.
2. **sirclecreative.com** → check bij de registrar of er een "web forward"
   actief staat naar sircle.agency. Die forward werkt; wat waarschijnlijk
   "niet meer werkt" is dat er géén echte site meer achter zit. Laat de forward
   staan als je dat domein wilt parkeren, of wijs 'm naar vreemedia.nl.
3. **WordPress site-URL** → in WP onder *Instellingen → Algemeen* zet je
   "WordPress-adres" en "Site-adres" op `https://vreemedia.nl`.
4. Vraag een **SSL-certificaat** aan (meestal 1 klik bij de host / gratis via
   Let's Encrypt) zodat alles op `https://` draait.

> Wil je dat ik dit per stap uitwerk voor jouw specifieke hostingprovider
> (TransIP, Vimexx, Combell, …)? Geef aan welke je gebruikt.

---

## 4. "Alle sites managen vanuit één plek" — beheerdashboard

Dit is **iets anders dan deze landingspagina**. Een hub-pagina linkt door;
technisch beheer (updates, back-ups, uptime, beveiliging) regel je met een
beheertool. Opties, afhankelijk van waar je sites op draaien:

- **MainWP** (self-hosted, gratis kern) — installeer je als plugin op één
  "dashboard"-WordPress (kan prima op vreemedia.nl) en koppel daar al je
  andere WordPress-sites aan. Updates/back-ups/monitoring voor alles vanuit
  één scherm. **Beste match bij jouw idee.**
- **ManageWP** — gehoste variant (freemium), zelfde concept, minder zelf
  onderhouden.
- **Cloudflare / Vercel-dashboard** — als sites statisch zijn (zoals
  sircle.agency), beheer je die daar; geen WordPress-tool nodig.

Een realistische opzet:
- vreemedia.nl = WordPress met **MainWP** → jouw beheercentrum + publieke
  merkenpagina.
- Statische sites (sircle.agency) blijven op Vercel/Netlify/Cloudflare.
- WordPress-klantsites koppel je aan MainWP.

Zeg het als je wilt dat ik MainWP-opzet of een statusoverzicht verder uitwerk.
