---
name: palette-guide
description: >
  Generate a standalone color-palette guide HTML page from either 1–12 hex codes OR a
  website URL, OR grow full contrast-solved scales from 1–4 seed colors. Invoke with
  /palette-guide <#hex …> to use explicit colors, /palette-guide <url> to scrape a site's
  brand palette (same URL handling as the font-guide and style-guide skills), or
  /palette-guide seed <#hex …> to build 12-step light + dark scales with Adobe Leonardo and
  Material HCT, with WCAG + APCA contrast printed on every step. Produces a single self-contained HTML file in the
  Reblis palette-guide layout: gradient header with color chips, sticky anchor nav, swatch
  cards with HEX + RGB, five-step shade ramps showing both flattened hex and rgba()
  notation, and a gradient section pairing every color combination. Trigger when the user
  says "palette guide", "color palette page", "make a palette from these colors", "palette
  from this site", "build a palette from this color", "seed palette", "systematic palette",
  or invokes /palette-guide. Authored by Reblis.com.
---

# Palette Guide Generator — by Reblis

Generate a **standalone color-palette guide HTML file** from explicit hex colors **or** a
website URL.

Usage — two input modes, auto-detected from the argument:
- **Hex mode:** `/palette-guide #FF006E #8338EC #3A86FF …` — accepts **1 to 12 hex codes**.
  The user may also name the brand, name individual colors, or split them into primary /
  secondary groups; honor whatever structure they give.
- **URL mode:** `/palette-guide https://example.com` — scrape the site's brand palette
  (and its logo + fonts for the header), the same way the font-guide and style-guide
  skills do.
- **Seed mode:** `/palette-guide seed #3828F4:Indigo #ED1958:Rose` — 1–4 seed colors grown
  into full 12-step light + dark scales by two science-based engines. See **Seed mode**
  below; it has its own generator and its own section list.

Detect the mode: if the argument starts with `seed`, or the user asks to *build / grow /
generate* a palette or scales *from* a color, it's seed mode. Otherwise, if it starts with `http(s)://` or looks like a bare domain
(`example.com`), it's URL mode; otherwise parse it as a hex list. A mixed argument
("these colors from this site") → scrape the URL, then keep only the hex codes the user
also named.

The canonical example is `template-example.html` in this skill directory (the Ricarte.ai
palette: 3 primaries + 3 secondaries). **Read it before generating** — it is the exact
layout, CSS architecture, and component set to reproduce with the input colors.

## Hard Rules (non-negotiable)

1. **Standalone file.** One HTML file, zero external asset dependencies. Only Google
   Fonts may be referenced externally.
2. **Sticky anchor menu** (`position: sticky; top: 0`, frosted blur) linking every
   numbered section, same as the style-guide skill.
3. **Header** reuses the style-guide header-bar: full-bleed gradient built from the two
   most vivid input colors fading into a dark anchor derived from one of them, a thin
   accent rule (`::after`) in a third color, a row of color chips previewing the whole
   palette, kicker ("Palette Guide · <year> Edition"), the brand mark in the title slot,
   lede (weight 400, max-width 770px), uppercase meta line with palette counts.
   **Brand mark:** if the brand has an SVG logo (check its site), inline it sanitized
   (`fill="currentColor"`, white) — see the template's Ricarte logo. If no SVG is
   available, fall back to a **wordmark set in the brand's own H1/display font** — the
   heaviest loaded weight, white, with the site's H1 letter-spacing. Never substitute an
   off-brand face (no Pacifico or other script fallback).
4. **No header glow.** Never add a `::before` radial-gradient glow blob (e.g.
   `radial-gradient(circle, rgba(...), transparent 68%)`) to the header band — on any
   guide, for any brand. The header is a flat color or linear gradient only.
5. **Label/sample rows are vertically centered.** Family convention across all guide
   skills: any row pairing a small label with a sample (swatch/ramp/specimen rows) uses
   `align-items: center`, never `baseline`.
6. **Output location:** write the file where the user asks; default `palette-guide.html`
   in the relevant project folder. Never stream the HTML into chat.

## Input handling

### Hex mode

- Validate each color matches `#?[0-9A-Fa-f]{6}` (accept 3-digit shorthand, expand it).
  Normalize to uppercase `#RRGGBB`.
- 1–12 colors. If the user gives primary/secondary groups, render two swatch sections;
  otherwise one "Colors" section.
- **Name the colors** tastefully if the user doesn't (e.g. #FF006E → "Rose",
  #3A86FF → "Azure"). Short, evocative, one word.
- No site to scrape, so the header **brand mark** is a wordmark in a neutral display
  font (or the brand name if the user gave one), and fonts default to the Reblis stack.
- **Radius** defaults to `--radius: 8px` (the template value) unless the user states one.

### URL mode

Fetch the page (curl with a real browser UA; fall back to scrapling stealth if blocked) —
the same scrape the style-guide skill runs. Extract the **brand palette**, not every
neutral:

- **Colors:** read CSS custom properties in the stylesheets first (e.g. `--brand`,
  `--accent`, `--pink`), then computed fills on buttons / links / headers if no tokens
  exist. Keep the **chromatic brand colors** (primary, secondary, accent) plus at most a
  couple of signature neutrals — skip the full grey/tint ramp (the guide generates ramps
  itself). Cap at 12; group as primary / secondary by role when the token names or usage
  make it obvious.
- **Names:** derive from the token names where present (`--teal` → "Teal"); otherwise name
  by hue as in hex mode.
- **Header mark + fonts:** with a URL you also have the logo and typography — inline the
  sanitized SVG logo (or the brand's H1-font wordmark fallback) and load the site's fonts,
  exactly like the style-guide and font-guide skills. This is the main reason URL mode
  produces a richer header than hex mode.
- **Radius:** scrape the site's card/surface `border-radius` into a single `--radius`
  token and drive every box off it (`border-radius: var(--radius)` on swatches, ramps,
  gradient cards, header chips; `calc(var(--radius) / 2)` on small dots/code pills). A
  flat brand (Stratomation, radius 0) must render sharp corners; a rounded brand
  (Ricarte 8px, Shalom 16px) keeps its curve. Read it from the site's actual card CSS —
  don't assume 8px.
- **Re-probe, don't assume:** verify what the live HTML actually serves before trusting a
  pattern from a previous site.

## Sections

`01 · Primary` (and `02 · Secondary` if grouped) — swatch cards: tall color block, then
name, group label, and `HEX #XXXXXX · RGB r g b` in monospace.

`0n · Shade Ramps` — one ramp card per color, five steps at **81% / 62% / 43% / 24% / 5%**
opacity over white, each step flattened to a solid hex:

```
channel = round(c × a + 255 × (1 − a))      # per R, G, B
```

**Every step shows BOTH notations** — the flattened solid hex AND the source
`rgba(r, g, b, a)` — plus the percentage. The two render identically over white, but only
rgba stays correct over imagery; the guide must teach that (callout: solid hex for
backgrounds, rgba for overlays). Pick step text color by luminance (white text under
~150, dark ink above).

`0n · Gradients` — **every two-color combination** of the palette, C(n,2) cards at 135°
(12 colors → 66 cards; the auto-fit grid handles it). Each card: gradient preview, two
hex stop chips (text colored by stop luminance), and an uppercase label *below* the card
in slate grey — "Rose × Violet" style, never labels inside the colored area.

`footer` — brand + guide title left; monospace stamp right ("6 colors · 30 shades · 15
gradients").

## Seed mode

Seed mode answers "give me a system from this color", not "document these colors". It
does not use the alpha ramps or the gradient section. It runs a shipped generator:

```bash
cd ~/.claude/skills/palette-guide && [ -d node_modules ] || npm ci
node tools/seed_guide.mjs --seed "#3828F4:Indigo" [--seed "#ED1958:Rose"] \
  --brand "Reblis" --out /path/to/palette-guide.html [--json scales.json] \
  [--font Inter] [--radius 8] [--neutral-chroma 5]
```

How it builds the scales (state this to the user; it is the point of the mode):

- **Targets come from Radix Colors.** The contrast of each Radix `blue` step against its
  own step 1 (and `slate` for the neutral, and the `*Dark` scales for dark mode) is the
  target curve. So a generated scale behaves like a Radix scale, and the role of each step
  is fixed: 1–2 backgrounds, 3–5 component fills, 6–8 borders, 9–10 solid, 11–12 text.
- **Step 9 is always the seed, exactly**, in both modes.
- **Leonardo** (`@adobe/leonardo-contrast-colors`) interpolates the seed through **OKLCH**
  and picks the color at each target ratio. Plain LCH drifts blues toward purple; don't
  switch it back.
- **HCT** (`@material/material-color-utilities`, **pinned to 0.3.0**, because the 0.4.0 npm build
  won't import in Node) holds the seed's hue + chroma and solves **tone** for each target
  with Material's `Contrast` utilities.
- **Chroma envelope:** both engines are then capped per step at the fraction of step-9
  chroma that Radix blue keeps (steps 1–2 and 12 are muted). Capping at a fixed tone never
  changes luminance, so no ratio moves. Validation: seeding `#0090FF` reproduces Radix
  blue closely, e.g. HCT light 11 `#0373CD` vs Radix `#0D74CE`, dark 3 `#0E2948` vs `#0D2847`.
- **Neutral** is the first seed's hue at low chroma (default 5), solved on the slate curve.
- **Seeds that don't fit step 9** are handled, not hidden, and a note prints under the scale:
  a faint seed (a pale signal like Volt) compresses steps 2–8 beneath it and is flagged
  fill-only; a text-strong seed (a dark anchor like Denim) pushes 10–12 darker so the scale stays in order.

Sections (all generated): header (chips = the first seed's light scale) · `01 Seeds`
(HEX/RGB, HCT, OKLCH, ratio vs white/black, which text goes on it, nearest Radix scale with
ΔE) · `02 Light Scales` and `03 Dark Scales` (Leonardo row + HCT row per seed, plus the
neutral, role bands above, **ratio vs page + AA/AAA/3:1 badge on every step**) ·
`04 Text Pairings` (text steps × background steps, WCAG ratio + APCA Lc per cell, both
engines) · `05 Tokens` (copyable CSS custom properties, light + `prefers-color-scheme`
dark, one block per engine). Example: `seed-example.html` (Reblis Indigo + Rose).

Hard rules 1–6 above still apply. When the user names a brand with a site, pass its
display font via `--font` and its card radius via `--radius`.

## Generate programmatically

Don't hand-write 30 ramp steps and 66 gradient cards — build the HTML with a small
Python script (ramp math, luminance checks, `itertools.combinations` for pairs) and
write the file in one shot.

## Verify before claiming done

Screenshot headlessly and **look at the images** — header, swatches, ramps, gradients,
footer. Fonts need a `--virtual-time-budget` so Google Fonts actually load before
capture (a wordmark or label rendering in system sans = the webfont didn't load):

```bash
timeout 90 chromium --headless --disable-gpu --no-sandbox \
  --screenshot=check.png --window-size=1400,5200 --hide-scrollbars \
  --virtual-time-budget=8000 "file:///path/to/palette-guide.html"
convert check.png -crop 1400x1750+0+<offset> slice.png
```

Snap-packaged chromium gotcha: private /tmp and no home-dir reads — copy the HTML into
`~/snap/chromium/common/` first and write screenshots there. Check ramp text legibility
on the lightest steps and gradient-stop chips on dark colors. Clean up temp copies.
