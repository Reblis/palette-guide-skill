---
name: palette-guide
description: >
  Generate a standalone color-palette guide HTML page from 1–12 hex codes. Invoke with
  /palette-guide <#hex …> — the skill takes the colors (optionally grouped as primary /
  secondary and named), and produces a single self-contained HTML file in the Reblis
  palette-guide layout: gradient header with color chips, sticky anchor nav, swatch cards
  with HEX + RGB, five-step shade ramps showing both flattened hex and rgba() notation,
  and a gradient section pairing every color combination. Trigger when the user says
  "palette guide", "color palette page", "make a palette from these colors", or invokes
  /palette-guide. Authored by Reblis.com.
---

# Palette Guide Generator — by Reblis

Generate a **standalone color-palette guide HTML file** from a list of hex colors.

Usage: `/palette-guide #FF006E #8338EC #3A86FF …` — accepts **1 to 12 hex codes**.
The user may also name the brand, name individual colors, or split them into primary /
secondary groups; honor whatever structure they give.

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
   available, fall back to a **Pacifico wordmark**: load Pacifico from Google Fonts and
   set the brand name in it, white, in the title slot.
4. **Output location:** write the file where the user asks; default `palette-guide.html`
   in the relevant project folder. Never stream the HTML into chat.

## Input handling

- Validate each color matches `#?[0-9A-Fa-f]{6}` (accept 3-digit shorthand, expand it).
  Normalize to uppercase `#RRGGBB`.
- 1–12 colors. If the user gives primary/secondary groups, render two swatch sections;
  otherwise one "Colors" section.
- **Name the colors** tastefully if the user doesn't (e.g. #FF006E → "Rose",
  #3A86FF → "Azure"). Short, evocative, one word.

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

## Generate programmatically

Don't hand-write 30 ramp steps and 66 gradient cards — build the HTML with a small
Python script (ramp math, luminance checks, `itertools.combinations` for pairs) and
write the file in one shot.

## Verify before claiming done

Screenshot headlessly and **look at the images** — header, swatches, ramps, gradients,
footer:

```bash
timeout 90 chromium --headless --disable-gpu --no-sandbox \
  --screenshot=check.png --window-size=1400,5200 --hide-scrollbars \
  "file:///path/to/palette-guide.html"
convert check.png -crop 1400x1750+0+<offset> slice.png
```

Snap-packaged chromium gotcha: private /tmp and no home-dir reads — copy the HTML into
`~/snap/chromium/common/` first and write screenshots there. Check ramp text legibility
on the lightest steps and gradient-stop chips on dark colors. Clean up temp copies.
