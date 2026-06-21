# One Sky, Many Stories — Build Spec

> A single night sky. Click between cultures and watch the **same stars** reorganize into completely different myths. The Greeks see a hunter where the Chinese see a vermilion bird and the Polynesians see a fishhook. This is a real, shippable web app. Build it exactly as written.

**Owner:** Hamza
**Target:** deployed live on Vercel (free tier), shareable URL, no backend.
**Status of this doc:** This is the source of truth. If something here conflicts with a default you'd normally reach for, follow this doc.

---

## 0. Read this first (instructions to the build agent)

You are building a **distinctive, high-craft** interactive site, not a generic dashboard. Three rules that override your instincts:

1. **The UI section (§6) is mandatory, not suggestive.** Use the exact fonts, hex values, sizes, and motion timings given. Do not substitute "system-ui," do not invent a teal-on-dark dashboard, do not center everything in a card with a drop shadow. If a value isn't specified, derive it from the tokens in §6 — never from a generic default.
2. **Ship the smallest thing that works, then layer.** Follow the phase plan in §9. Get stars on screen first. Do not attempt 3D, do not attempt all 9 cultures at once.
3. **Build incrementally and verify each phase visually before moving on.** After each phase, the app must run with no console errors.

---

## 1. The one-sentence pitch

The same field of real stars, where switching "sky culture" redraws the constellation lines and swaps in that culture's myths — so you can literally watch different civilizations disagree about what's written in the sky.

## 2. Why it's worth building

- **Instant wow:** a glowing star field is beautiful before you do anything else.
- **The "huh" moment:** identical stars, different stories — nobody expects how *differently* cultures carved up the same sky.
- **Free, real data:** star positions and the cultural line/myth data are open-licensed (see §4). No invented content, no API keys, no backend.
- **One screen, deep:** it's a single page that rewards exploration. Perfect for a portfolio / showcase submission.

## 3. Core user experience (what it actually does)

1. Page loads to a **full-screen night sky** of real stars on near-black. Brighter stars are larger and glow more. Subtle twinkle and a very slow drift.
2. A **culture rail** sits along the bottom. The default culture (Greek/Western) is selected; its constellation lines are drawn faintly over the stars.
3. **Switch culture** → the old lines retract into their stars and fade; the new culture's lines grow outward from the shared stars. **This morph is the signature moment — it must feel deliberate and smooth.** The whole accent color of the UI shifts to that culture's palette (§6.3).
4. **Click/tap a constellation** → a story panel slides in from the right with: the native name, the English translation, the myth/meaning, the culture, and the source attribution.
5. **Compare mode (signature feature):** pin one culture as a faint "ghost," then switch to another on top of it, so you see two cultures' lines over the same stars at once and watch them disagree.
6. Pan and zoom the sky. Reset view button. Search a star/constellation (stretch).

## 4. Data sources (all open-licensed — credit them in-app)

**Stars — HYG database**
- Repo: `https://codeberg.org/astronexus/hyg` (mirror: `https://github.com/astronexus/HYG-Database`)
- File: `hygdata_v3.csv` (~120k stars). License: **CC BY-SA 4.0** — attribution + share-alike required.
- Key columns you need: `hip` (Hipparcos number — the join key), `proper` (common name e.g. "Sirius"), `ra` (hours, 0–24), `dec` (degrees, −90–90), `mag` (apparent magnitude; lower = brighter), `ci` (color index, for star tint).

**Constellation lines + myths — two compatible options, use both:**
- **Stellarium sky cultures:** `https://github.com/Stellarium/stellarium-skycultures`. Each culture is a folder with `index.json` (constellation `lines` as arrays of **Hipparcos numbers** — joins directly to HYG `hip`) and `description.md` (the cultural write-up). License: CC BY-SA, varies per culture — read each culture's stated license.
- **`doinab/constellation-lines`:** `https://github.com/doinab/constellation-lines`. CC-licensed, Stellarium-compatible JSON, and crucially it annotates each constellation with **names, descriptions, and mythological themes** across many world cultures with scholarly sources. Use this as the primary source of the *story text* per constellation.

**Join model:** A constellation = a list of line segments; each segment is a path of star IDs (Hipparcos numbers). Look each ID up in the HYG star table to get its RA/Dec, project to screen (§5), draw the polyline. The myth text comes from the culture dataset keyed by constellation ID.

> **Important:** the lines reference stars by Hipparcos number. HYG's `hip` column is your join key. Some star IDs in culture data may be missing from your filtered star set — skip missing IDs gracefully, never crash.

## 5. The astronomy/math (give the agent no room to guess)

We render a 2D projection of the celestial sphere. Use a **stereographic projection** centered on a view direction the user can pan/zoom.

**Step 1 — equatorial (RA/Dec) to a unit 3D vector:**
```
const raRad  = ra  * (Math.PI / 12);   // ra is in HOURS → radians
const decRad = dec * (Math.PI / 180);  // dec is in DEGREES → radians
const x = Math.cos(decRad) * Math.cos(raRad);
const y = Math.cos(decRad) * Math.sin(raRad);
const z = Math.sin(decRad);
```

**Step 2 — rotate by the current view center** (centerRA, centerDec), so the view direction points "into the screen." Apply a rotation about the z-axis by −centerRA, then about the y-axis by −centerDec. (Standard 3D rotation matrices.)

**Step 3 — stereographic projection of the rotated vector `(rx, ry, rz)`** where `rz` is depth toward the viewer:
```
// guard: if the point is on the far hemisphere (rz <= -0.999), cull it
const k = 1 / (1 + rz);
const px = rx * k;
const py = ry * k;
// then scale by zoom and translate to canvas center
screenX = canvasCenterX + px * zoom;
screenY = canvasCenterY - py * zoom;  // minus: screen y grows downward
```

**Star size & brightness from magnitude:**
```
// mag ~ -1.5 (brightest) up to ~6 (faint, naked-eye limit)
radius = Math.max(0.4, (6.5 - mag) * 0.45);   // tune the multiplier to taste
alpha  = Math.min(1, Math.max(0.25, (6.5 - mag) / 7));
```
Filter the catalog to `mag <= 6.0` for performance (~5,000–9,000 stars). Brighter stars get a soft radial-gradient glow; faint stars are tiny dots.

**Star tint from color index `ci`** (optional polish): high `ci` → warm/orange, low/negative `ci` → cool/blue-white. Map `ci` in roughly [−0.3, 2.0] to a hue between pale blue and amber. Keep it subtle.

## 6. UI / VISUAL DESIGN — follow exactly

> This is the part where generic builds die. The sky is the canvas; the chrome must feel like a beautifully made instrument, not an admin panel. **No cards-with-drop-shadows. No centered hero with a big number. No generic teal accent. No rounded-rectangle everything.**

### 6.1 The concept in one line
"A planetarium instrument crossed with an old star atlas." Precise, dark, quiet chrome; warm literary type for the myths; one accent color that **changes per culture** because the accent *is* the culture.

### 6.2 Typography (Google Fonts, all free)
- **Display (titles, constellation names):** `Fraunces` — variable serif, set the optical-size axis high (`opsz` ~144) and `wght` ~500–600. Use for the wordmark, constellation name in the story panel, culture name on switch. Large, confident, slightly literary.
- **Body / myth text:** `Spectral` — a calm serif made for reading. Use for the actual story/myth paragraphs. ~17–19px, line-height ~1.6, max width ~62ch.
- **Data / UI chrome (labels, coordinates, magnitudes, buttons, eyebrows):** `Space Mono` — monospace. Uppercase, letter-spacing ~0.08em for eyebrows and labels. This is where the "instrument" feeling lives: RA/Dec readouts, star magnitude, culture region tags.

Type scale (desktop): display 40–64px, section/eyebrow 12px mono uppercase, myth body 18px, captions 13px mono.

### 6.3 Color — base palette + per-culture accents
Base (the sky and chrome, constant):
```
--void:    #05060A   /* deepest background */
--ink:     #0B0E16   /* panel surfaces, slightly lifted from void */
--haze:    #161B2A   /* hairline borders, dividers */
--starlight:#EDEFF7  /* primary text on dark, star core */
--mute:    #8A91A6   /* secondary text, mono labels */
```
Each culture supplies its **own accent**, drawn from its tradition. The selected culture's accent colors the constellation lines, the active rail chip, the story-panel rule, hovers, and the focus ring. This is the key non-generic move: the accent is *meaningful*, not decorative.
```
Greek / Western     --accent: #E8D9A0  (marble + gold)        --line: #C9B66E
Chinese             --accent: #E4434B  (imperial vermilion)   --line: #D98C2B (with jade #4FB286 secondary)
Polynesian/Hawaiian --accent: #34C7C2  (lagoon teal)          --line: #F0876A (coral)
Inuit               --accent: #8FE3C8  (aurora green)         --line: #BFE9F2 (ice)
Aboriginal (Boorong)--accent: #E0792E  (ochre)                --line: #C2452B (red earth)
Norse               --accent: #B8C2E0  (cold steel)           --line: #9AA7CC
Egyptian            --accent: #E6C25A  (gold leaf)            --line: #2BA6A0 (faience)
Arabic              --accent: #DCC9A0  (parchment)            --line: #B79A5E
Māori               --accent: #6FD0E8  (Pacific sky)          --line: #E89A4F
```
Accent transitions on culture switch should **tween** (~400ms) via CSS custom properties so the whole UI shifts mood, not snaps.

### 6.4 Layout (full-bleed, instrument chrome)
Desktop wireframe:
```
┌──────────────────────────────────────────────────────────────────┐
│ ONE SKY · MANY STORIES        RA 06h32m  DEC +12°    [compare] [?] │  ← top bar: mono, thin, transparent over sky
│                                                                    │
│                                                                    │
│                    ✦   the star field fills everything             │
│              ·   ✦         ·        ✦                              │
│                       ·         ✦              ┌──────────────────┐│
│         ✦                  ·                   │ ORION            ││  ← story panel slides in from right
│                ·     ✦            ·            │ "Νεφέλη"  Greek  ││     when a constellation is clicked
│                                                │ ───────          ││     (Fraunces title, Spectral body,
│                       ·            ✦           │ The hunter who…  ││      Space Mono labels + source)
│                                                └──────────────────┘│
│                                                                    │
│  ◂  [GREEK] [CHINESE] [POLYNESIAN] [INUIT] [ABORIGINAL] …      ▸   │  ← culture rail: bottom, horiz scroll
└──────────────────────────────────────────────────────────────────┘
```
- **Top bar:** transparent, sits over the sky. Wordmark left in Space Mono (small caps, letter-spaced). Live RA/DEC readout center as the view moves. `compare` toggle + `?` help right. Hairline (`--haze`) bottom border at 40% opacity only.
- **Culture rail (bottom):** a horizontally scrollable row of chips. Each chip: Space Mono uppercase label + a 2px underline in that culture's `--line` color. Selected chip: filled faintly with its accent at ~12% alpha, full-opacity underline, label in `--starlight`. **Not** pill buttons with shadows — flat, editorial, like tabs in an atlas.
- **Story panel (right):** ~380–440px wide, surface `--ink` at ~92% opacity with a `backdrop-filter: blur(12px)`, a single 1px left border in the culture accent. Inside, top-to-bottom: eyebrow (`CONSTELLATION · {region}` in mono), constellation name (Fraunces, large), native name + romanization (mono, muted), a hairline rule in accent, the myth (Spectral), then a footer block: `SOURCE` + dataset name + license (mono, tiny, muted). Slides in over ~320ms with an ease-out; never pops.
- **Mobile:** rail becomes a bottom sheet of chips; story panel becomes a bottom drawer that slides up to ~70% height. Top bar collapses to wordmark + a single menu. Sky stays full-bleed behind everything.

### 6.5 Motion (deliberate, not scattered)
- **Page load ("ignition"):** background fades from pure black; stars fade in over ~900ms from the center outward (stagger by distance from center). Then the default culture's lines **draw themselves** stroke-by-stroke over ~700ms. One orchestrated entrance, then calm.
- **Culture switch (the signature):** outgoing lines animate their stroke back toward their origin star and fade (~350ms); ~80ms gap; incoming lines grow from the shared stars (~450ms). Simultaneously the accent custom properties tween. Total under ~900ms. Must read as "the sky reorganizing," not a hard swap.
- **Ambient:** very slow continuous drift of view center (a few arcseconds/frame) so the sky feels alive. Stars twinkle: subtle per-star alpha sine wave, low amplitude, randomized phase. Keep it understated — this is atmosphere, not a screensaver.
- **Hover a constellation:** its lines brighten + thicken ~1.5×, its name label fades in near the centroid. Other lines dim slightly to ~40%.
- **Compare mode:** the pinned "ghost" culture renders at ~25% line opacity, desaturated; the active culture renders at full accent. A small mono legend names both.
- **`prefers-reduced-motion`:** no twinkle, no drift, no draw-on animation — lines and panels appear/cross-fade instantly. Honor this fully.

### 6.6 Signature element (the one thing it's remembered for)
The **same-stars morph**: because both cultures' lines are anchored to the identical physical stars, switching makes the star field hold still while the *meaning* rearranges on top of it. Lean into this — it's the whole thesis. The compare-mode ghost overlay is its second act. Spend your craft budget here.

### 6.7 Hard "do NOT" list
- No drop-shadowed white cards. No centered single-column landing hero. No generic SaaS gradient buttons. No emoji in the UI. No default Tailwind blue/indigo. No bordered boxes around everything. No "Lorem ipsum" — use real myth text from the data. Don't round every corner; chrome here is mostly square/hairline, radius ≤ 4px except the story panel.

## 7. Tech stack (chosen for free Vercel hosting + buildability)

- **Framework:** Next.js (App Router) + TypeScript. Deploys to Vercel free tier with zero config. The app is **fully static** — no server routes, no DB, no env secrets.
- **Rendering:** **HTML Canvas 2D** for the star field and lines. (Do **not** start with WebGL/three.js — Canvas 2D handles ~8k stars at 60fps and is far easier to get right. A true 3D celestial sphere via `react-three-fiber` is a **stretch goal only**, after everything else works.)
- **Styling:** plain CSS (or CSS Modules) with CSS custom properties for the token system in §6.3 — this makes the per-culture accent tween trivial. Tailwind is allowed but the design tokens above are the source of truth; if you use Tailwind, encode these exact values, don't use its defaults.
- **State:** React state + context is enough. Add `zustand` only if state gets unwieldy.
- **Fonts:** load Fraunces, Spectral, Space Mono via `next/font/google`.
- **No analytics, no tracking, no cookies.**

## 8. Data pipeline (build-time, do this once)

Write a Node script `scripts/build-data.ts` run manually before deploy. It must:
1. Download `hygdata_v3.csv`. Parse it, filter to `mag <= 6.0`, keep only `{ hip, proper, ra, dec, mag, ci }`. Drop rows without a `hip`. Emit `public/data/stars.json` as a compact array (consider arrays-of-arrays, not objects, to shrink size).
2. For each shipped culture, pull its constellation `lines` (Hipparcos paths) + names + myth text from the Stellarium culture `index.json` / `description.md` and/or `doinab/constellation-lines`. Emit one file per culture: `public/data/cultures/{id}.json` shaped like:
```json
{
  "id": "greek",
  "label": "Greek",
  "region": "Europe",
  "accent": "#E8D9A0",
  "line": "#C9B66E",
  "license": "CC BY-SA 4.0",
  "source": "Stellarium Sky Cultures / doinab constellation-lines",
  "constellations": [
    {
      "id": "Ori",
      "name": "Orion",
      "nativeName": "Ὠρίων",
      "romanization": "Ōríōn",
      "lines": [[27989, 26727, 26311], [25336, 25930]],
      "myth": "The great hunter placed among the stars…"
    }
  ]
}
```
3. Validate: every `hip` referenced in any culture's `lines` exists in `stars.json`, or is logged and skipped. Build must not silently drop whole constellations without a warning.

The runtime app just `fetch`es these static JSON files from `/public/data`. No build-time framework coupling — data is portable.

### Ship list for v1 (don't do all nine at once)
Start with **3 visually distinct cultures**: `Greek` (familiar baseline), `Chinese` (radically different carving + vermilion/jade palette), `Polynesian/Hawaiian` (navigation-driven, totally different logic). Add `Inuit` and `Aboriginal (Boorong)` next. The rest are bonus.

## 9. Build phases (do them in order; app runs clean after each)

1. **Skeleton:** Next.js app, fonts loaded, the §6.3 base tokens in global CSS, an empty full-bleed `<canvas>` on `--void`. Deploy to Vercel now to confirm the pipeline works.
2. **Stars:** run the data script for stars only; render the star field with magnitude-based size/glow + the §5 projection. No lines yet. This alone should already look beautiful.
3. **Pan/zoom + ambient drift + twinkle** (respect reduced-motion).
4. **One culture's lines** (Greek) drawn over the stars, with the draw-on entrance animation.
5. **Culture rail + switching** with the morph transition and accent tween. Add cultures 2 and 3.
6. **Story panel:** click a constellation → slide-in panel with name/native/myth/source.
7. **Compare mode** (ghost overlay).
8. **Polish pass:** hover states, mobile layout, the ignition load sequence, reduced-motion paths, sources/about modal, favicon + share meta (OG image of the star field).
9. **Stretch (optional):** search; "tonight from your location" using device geolocation to set the view; a true 3D `react-three-fiber` sphere.

## 10. Definition of done (acceptance criteria)

- [ ] Live on a public Vercel URL, loads in under ~3s on a normal connection.
- [ ] Real star field, magnitude-scaled, on the §6.3 palette — looks striking on first paint.
- [ ] At least 3 cultures; switching triggers the same-stars morph and the accent tween.
- [ ] Clicking a constellation opens the story panel with native name, translation, myth, and **visible source + license**.
- [ ] Compare mode shows two cultures' lines over the same stars.
- [ ] Works and looks intentional on mobile (full-bleed sky, bottom sheet rail + drawer).
- [ ] `prefers-reduced-motion` fully honored.
- [ ] Keyboard accessible: rail chips and panel are focusable with a visible accent focus ring; Escape closes the panel.
- [ ] An **About / Sources** view crediting HYG (CC BY-SA 4.0) and the Stellarium / doinab sky-culture datasets with their licenses. This is required, not optional.
- [ ] No console errors. No placeholder/Lorem text. No items from the §6.7 "do NOT" list.

## 11. Copy (use this voice, not filler)

- Wordmark: `ONE SKY · MANY STORIES`
- Tagline (about view): "The stars don't move. The stories do."
- Empty state (nothing selected): "Pick a culture below. Then tap any figure in the sky to hear how they read it."
- Compare hint: "Pin a sky, then switch. Watch two civilizations disagree about the same stars."
- About intro (write ~2 short paragraphs): the same photons hit every human eye, but every culture drew its own lines between them — this is a small atlas of that disagreement. Credit the data. Keep it plain and a little wonderstruck; no marketing voice.

## 12. Stretch ideas (only after §10 is fully met)
- "Sky tonight" — geolocate and orient the view to the user's actual current sky.
- Timeline scrub — precession over millennia subtly shifts positions.
- Audio: a soft ambient drone that shifts timbre per culture.
- Share a deep link to a specific constellation+culture.
- A true 3D celestial sphere you can orbit (react-three-fiber).

---

### Attribution block to include in-app (verbatim-ish)
> Star positions: HYG Database by David Nash / astronexus (CC BY-SA 4.0). Constellation figures & myths: Stellarium Sky Cultures and the constellation-lines dataset by Doina Bucur (Creative Commons). This project is non-commercial and educational.
