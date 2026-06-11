# palette-guide — a Claude Code skill by [Reblis.com](https://reblis.com)

Turn a handful of hex codes into a polished, standalone **color-palette guide HTML page** with one command:

```
/palette-guide #FF006E #8338EC #3A86FF #C9B29F #E4D8CF #EBEBEB
```

Claude takes 1–12 colors (optionally grouped as primary / secondary, optionally named) and generates a single self-contained HTML file: gradient header previewing the palette as chips, sticky anchor navigation, swatch cards with HEX + RGB, five-step shade ramps, and a gradient section pairing **every** two-color combination.

Open [`template-example.html`](template-example.html) in a browser to see a finished guide — the Ricarte.ai palette: 6 colors, 30 shades, 15 gradients.

## Install

```bash
git clone https://github.com/Reblis/palette-guide-skill ~/.claude/skills/palette-guide
```

Restart Claude Code (or start a new session) so the skill registers, then run:

```
/palette-guide <#hex …>
```

## What you get

- **One file, zero dependencies.** Only Google Fonts is referenced externally. Email it, host it, drop it in a repo.
- **Shade ramps in two notations.** Each ramp step is the color at 81 / 62 / 43 / 24 / 5% opacity over white, flattened to a solid hex — shown alongside its `rgba()` source. Solid hex for opaque backgrounds, rgba for overlays; the guide teaches when to use which.
- **Every gradient pairing.** All C(n,2) two-color combinations at 135°, each labeled — 6 colors gives you 15 gradient cards, 12 colors gives you 66.
- **Sticky anchor menu** with frosted-glass backdrop linking every section.
- **Verified output.** The skill screenshots its own output headlessly and inspects it before calling the job done.

## Requirements

- [Claude Code](https://claude.com/claude-code)
- Optional, for the self-verification step: `chromium` + ImageMagick

## Siblings

- [style-guide](https://github.com/Reblis/style-guide-skill) — full brand style guide from any website URL
- [font-guide](https://github.com/Reblis/font-guide-skill) — typography guide from a URL or font list

## License

MIT © Reblis.com
