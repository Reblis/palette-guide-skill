#!/usr/bin/env node
/**
 * Seed mode for /palette-guide — build full 12-step light + dark scales from 1–4 seed
 * colors with two science-based engines, and render them as a Reblis palette guide.
 *
 *   Leonardo (Adobe)  — solves each step to a target WCAG contrast ratio, interpolating
 *                       the seed through OKLCH (plain LCH drifts blues toward purple).
 *   HCT (Google M3)   — holds the seed's hue + chroma and solves TONE (= L*) for the same
 *                       contrast targets, via Material's Contrast utilities.
 *
 * Both engines aim at the SAME targets: the contrast curve measured off Radix Colors
 * (blue for accents, slate for the neutral), so a generated scale behaves like a Radix
 * scale — steps 1–2 backgrounds, 3–5 component fills, 6–8 borders, 9–10 solid, 11–12 text.
 * Step 9 is always the seed, exactly.
 *
 * Usage:
 *   node tools/seed_guide.mjs --seed "#3828F4:Indigo" [--seed "#ED1958:Rose"] \
 *        --brand "Reblis" --out palette-guide.html [--json scales.json] \
 *        [--font Inter] [--radius 8] [--neutral-chroma 5]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Theme, Color, BackgroundColor } from '@adobe/leonardo-contrast-colors';
// Pinned to 0.3.0: the 0.4.0 npm build ships extensionless ESM imports and won't load in Node.
import { Hct, Contrast, argbFromHex, hexFromArgb } from '@material/material-color-utilities';
import * as radix from '@radix-ui/colors';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------- CLI
function parseArgs(argv) {
  const o = { seeds: [], font: 'Inter', radius: 8, neutralChroma: 5 };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i], v = argv[i + 1];
    if (k === '--seed') { o.seeds.push(v); i++; }
    else if (k === '--brand') { o.brand = v; i++; }
    else if (k === '--out') { o.out = v; i++; }
    else if (k === '--json') { o.json = v; i++; }
    else if (k === '--font') { o.font = v; i++; }
    else if (k === '--radius') { o.radius = Number(v); i++; }
    else if (k === '--neutral-chroma') { o.neutralChroma = Number(v); i++; }
  }
  if (!o.seeds.length || o.seeds.length > 4) throw new Error('pass 1–4 --seed "#RRGGBB[:Name]"');
  o.seeds = o.seeds.map(s => {
    const [hex, name] = s.split(':');
    return { hex: normHex(hex), name: name || null };
  });
  o.brand ||= 'Seed Palette';
  return o;
}

// ---------------------------------------------------------------- color math
function normHex(h) {
  h = h.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(h)) h = h.split('').map(c => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) throw new Error(`bad hex: ${h}`);
  return '#' + h.toUpperCase();
}
const rgb = h => [0, 2, 4].map(i => parseInt(h.slice(1 + i, 3 + i), 16));
const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
function lum(h) { const [r, g, b] = rgb(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
function ratio(a, b) { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); }

// APCA-W3 0.0.98G — perceptual lightness contrast (Lc), text on background.
function apca(txt, bg) {
  const Y = h => { const [r, g, b] = rgb(h).map(c => (c / 255) ** 2.4); return 0.2126729 * r + 0.7151522 * g + 0.0721750 * b; };
  const clamp = y => (y > 0.022 ? y : y + (0.022 - y) ** 1.414);
  const yt = clamp(Y(txt)), yb = clamp(Y(bg));
  let s;
  if (yb > yt) { s = (yb ** 0.56 - yt ** 0.57) * 1.14; return s < 0.1 ? 0 : (s - 0.027) * 100; }
  s = (yb ** 0.65 - yt ** 0.62) * 1.14; return s > -0.1 ? 0 : (s + 0.027) * 100;
}

function oklab(h) {
  const [r, g, b] = rgb(h).map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
          1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
          0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
}
function oklch(h) {
  const [L, a, b] = oklab(h);
  return { L: L * 100, C: Math.hypot(a, b), h: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360 };
}
const dE = (p, q) => { const [a, b] = [oklab(p), oklab(q)]; return 100 * Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); };

const onColor = bg => (ratio(bg, '#FFFFFF') >= ratio(bg, '#111111') ? '#FFFFFF' : '#111111');

// ---------------------------------------------------------------- targets
// The contrast curve of a Radix scale: each step vs its own step 1.
const radixCurve = (scale, name) => {
  const s = Object.values(scale);
  return s.map(h => ratio(h, s[0]));
};
const CURVE = {
  light: { accent: radixCurve(radix.blue), neutral: radixCurve(radix.slate) },
  dark:  { accent: radixCurve(radix.blueDark), neutral: radixCurve(radix.slateDark) },
};

/** Fit the seed into the accent curve at step 9. Returns targets + a note when it doesn't fit. */
function accentTargets(base, S) {
  const t = base.slice();
  let note = null;
  if (S >= t[7] * 1.1 && S <= t[10] / 1.05) {
    t[8] = S; t[9] = Math.sqrt(S * t[10]);
  } else if (S < t[7] * 1.1) {
    // Faint seed (a pale signal color): compress 2–8 below it so the scale still climbs.
    const k = (S - 1) / (t[7] * 1.1 - 1);
    for (let i = 1; i <= 7; i++) t[i] = 1 + (t[i] - 1) * k;
    t[8] = S; t[9] = Math.min(S * 1.12, t[10] / 1.05);
    note = 'Seed is faint against this background: fill-only, never text. Steps 2–8 compressed beneath it.';
  } else {
    // Text-strong seed: push 10–12 past it so the scale keeps climbing toward the text end.
    t[8] = S; t[9] = Math.min(S * 1.08, 19); t[10] = Math.min(Math.max(t[10], S * 1.18), 19.5); t[11] = Math.min(Math.max(t[11], t[10] * 1.3), 20.5);
    note = 'Seed already passes as text on this background, so steps 10–12 are pushed darker to keep the scale in order. Solid fills take on-color text.';
  }
  return { t, note };
}

// ---------------------------------------------------------------- engines
function leonardoScale(key, targets, lightness, neutralKey) {
  const bg = new BackgroundColor({ name: 'bg', colorKeys: [neutralKey], ratios: [1] });
  const c = new Color({ name: 'c', colorKeys: [key], colorSpace: 'OKLCH', ratios: targets.map(r => Math.max(1, r)) });
  const th = new Theme({ colors: [bg, c], backgroundColor: bg, lightness });
  const cc = th.contrastColors;
  return { bg: cc[0].background.toUpperCase(), steps: cc[2].values.map(v => v.value.toUpperCase()) };
}

function hctScale(hue, chroma, targets, bgTone, dark) {
  return targets.map(r => {
    let tone = dark ? Contrast.lighter(bgTone, r) : Contrast.darker(bgTone, r);
    if (tone < 0) tone = dark ? Contrast.lighterUnsafe(bgTone, r) : Contrast.darkerUnsafe(bgTone, r);
    return hexFromArgb(Hct.from(hue, chroma, tone).toInt()).toUpperCase();
  });
}

const MODE = { light: { leo: 99, tone: 99 }, dark: { leo: 7, tone: 7 } };

// Chroma envelope: how much of step 9's chroma Radix blue lets each step keep. Radix
// mutes the page-level steps (1–2) and the text steps; both engines otherwise run hot
// there. Capping chroma at fixed tone leaves luminance, and so every ratio, untouched.
const envelope = scale => {
  const c = Object.values(scale).map(h => Hct.fromInt(argbFromHex(h)).chroma);
  return c.map(x => Math.min(1, x / c[8]));
};
const ENVELOPE = { light: envelope(radix.blue), dark: envelope(radix.blueDark) };

function capChroma(steps, seedChroma, mode) {
  return steps.map((h, i) => {
    const hct = Hct.fromInt(argbFromHex(h));
    const cap = seedChroma * ENVELOPE[mode][i];
    return hct.chroma <= cap ? h : hexFromArgb(Hct.from(hct.hue, cap, hct.tone).toInt()).toUpperCase();
  });
}

function buildScales(seeds, neutralChroma) {
  const first = Hct.fromInt(argbFromHex(seeds[0].hex));
  const neutralKey = hexFromArgb(Hct.from(first.hue, neutralChroma, 50).toInt());
  const out = { neutral: {}, seeds: [] };

  for (const mode of ['light', 'dark']) {
    const nT = CURVE[mode].neutral;
    const leoN = leonardoScale(neutralKey, nT, MODE[mode].leo, neutralKey);
    const hctN = hctScale(first.hue, neutralChroma, nT, MODE[mode].tone, mode === 'dark');
    out.neutral[mode] = { leonardo: leoN.steps, hct: hctN, targets: nT };
  }

  for (const s of seeds) {
    const h = Hct.fromInt(argbFromHex(s.hex));
    const ok = oklch(s.hex);
    const rec = {
      hex: s.hex, name: s.name || hueName(ok), hct: { h: h.hue, c: h.chroma, t: h.tone }, oklch: ok,
      vsWhite: ratio(s.hex, '#FFFFFF'), vsBlack: ratio(s.hex, '#000000'), on: onColor(s.hex),
      radix: nearestRadix(s.hex), modes: {},
    };
    for (const mode of ['light', 'dark']) {
      const pageLeo = out.neutral[mode].leonardo[0], pageHct = out.neutral[mode].hct[0];
      // Targets are solved per engine, against that engine's own page background.
      const tl = accentTargets(CURVE[mode].accent, ratio(s.hex, pageLeo));
      const th = accentTargets(CURVE[mode].accent, ratio(s.hex, pageHct));
      const leo = capChroma(leonardoScale(s.hex, tl.t, MODE[mode].leo, neutralKey).steps, h.chroma, mode);
      const hct = capChroma(hctScale(h.hue, h.chroma, th.t, MODE[mode].tone, mode === 'dark'), h.chroma, mode);
      leo[8] = s.hex; hct[8] = s.hex;               // step 9 is the seed, exactly
      rec.modes[mode] = { leonardo: leo, hct, note: tl.note || th.note, targets: th.t };
    }
    out.seeds.push(rec);
  }
  return out;
}

function hueName({ h, C }) {
  if (C < 0.03) return 'Neutral';
  const bands = [[20, 'Rose'], [45, 'Red'], [70, 'Orange'], [100, 'Amber'], [120, 'Yellow'], [140, 'Lime'],
    [165, 'Green'], [190, 'Teal'], [220, 'Cyan'], [250, 'Blue'], [275, 'Indigo'], [305, 'Violet'], [335, 'Purple'], [360, 'Pink']];
  return bands.find(([max]) => h <= max)[1];
}

function nearestRadix(hex) {
  let best = null;
  for (const [k, v] of Object.entries(radix)) {
    if (/Dark|A$|P3/.test(k)) continue;
    const s9 = v[`${k}9`];
    if (!s9) continue;
    const d = dE(hex, s9);
    if (!best || d < best.d) best = { name: k, d, hex: s9.toUpperCase() };
  }
  return best;
}

// ---------------------------------------------------------------- render
const ROLES = [[1, 2, 'Backgrounds'], [3, 5, 'Component'], [6, 8, 'Borders'], [9, 10, 'Solid'], [11, 12, 'Text']];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const f2 = n => n.toFixed(2);
function badge(r) {
  if (r >= 7) return ['AAA', 'b-aaa'];
  if (r >= 4.5) return ['AA', 'b-aa'];
  if (r >= 3) return ['3:1', 'b-ui'];
  return ['', ''];
}

function scaleRow(label, steps, page, sub) {
  const cells = steps.map((hx, i) => {
    const r = ratio(hx, page);
    const [b, cls] = badge(r);
    const ink = onColor(hx);
    return `<div class="st" style="background:${hx};color:${ink}">
        <span class="st-n">${i + 1}</span>
        <span class="st-hex">${hx}</span>
        <span class="st-r">${f2(r)}${b ? ` <b class="${cls}">${b}</b>` : ''}</span>
      </div>`;
  }).join('');
  return `<div class="srow"><div class="srow-l">${esc(label)}<small>${esc(sub)}</small></div><div class="strip">${cells}</div></div>`;
}

const roleBand = () => `<div class="srow srow-roles"><div class="srow-l"></div><div class="roles">${
  ROLES.map(([a, b, n]) => `<span style="grid-column:${a}/${b + 1}">${n}</span>`).join('')}</div></div>`;

function scaleCard(title, dot, rows, mode, note) {
  return `<div class="scard scard-${mode}">
    <div class="ramp-name"><span class="dot" style="background:${dot}"></span>${esc(title)}</div>
    ${roleBand()}${rows.join('')}
    ${note ? `<p class="snote">${esc(note)}</p>` : ''}
  </div>`;
}

function matrix(engine, accent, neutral) {
  const bgs = [['Page', neutral[0]], ['Subtle', neutral[1]], ['Accent 3', accent[2]], ['Accent 4', accent[3]], ['Accent 5', accent[4]]];
  const txts = [['Accent 11', accent[10]], ['Accent 12', accent[11]], ['Neutral 11', neutral[10]], ['Neutral 12', neutral[11]]];
  const head = `<tr><th></th>${bgs.map(([n, h]) => `<th><span class="mx-sw" style="background:${h}"></span>${n}</th>`).join('')}</tr>`;
  const body = txts.map(([n, t]) => `<tr><th>${n}</th>${bgs.map(([, b]) => {
    const r = ratio(t, b), lc = Math.abs(apca(t, b));
    const [bd, cls] = badge(r);
    return `<td style="background:${b};color:${t}"><strong>Aa</strong><span>${f2(r)} ${bd ? `<b class="${cls}">${bd}</b>` : ''}</span><span class="lc">Lc ${lc.toFixed(0)}</span></td>`;
  }).join('')}</tr>`).join('');
  return `<div class="mx-wrap"><div class="ramp-name">${engine}</div><table class="mx">${head}${body}</table></div>`;
}

function tokens(data, engine) {
  const lines = [];
  const emit = mode => {
    const out = [];
    for (const s of data.seeds) s.modes[mode][engine].forEach((h, i) => out.push(`  --${slug(s.name)}-${i + 1}: ${h.toLowerCase()};`));
    data.neutral[mode][engine].forEach((h, i) => out.push(`  --neutral-${i + 1}: ${h.toLowerCase()};`));
    return out.join('\n');
  };
  lines.push(`:root {\n${emit('light')}\n}`);
  lines.push(`@media (prefers-color-scheme: dark) {\n  :root {\n${emit('dark').replace(/^/gm, '  ')}\n  }\n}`);
  return lines.join('\n\n');
}
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

function render(o, data) {
  const tpl = fs.readFileSync(path.join(HERE, '..', 'template-example.html'), 'utf8');
  let css = tpl.match(/<style>([\s\S]*?)<\/style>/)[1];
  css = css.replace(/--radius:\s*[^;]+;/, `--radius: ${o.radius}px;`)
           .replace(/--sans:\s*'Inter'/, `--sans: '${o.font}'`);
  const s0 = data.seeds[0], L = s0.modes.light.hct, D = s0.modes.dark.hct;
  const accent2 = data.seeds[1] ? data.seeds[1].hex : L[6];
  const nL = data.neutral.light.hct;
  const page = nL[0];

  const seedCss = `
  :root { --dark: ${L[11]}; --page: ${nL[1]}; --ink: ${nL[11]}; --slate: ${nL[10]}; --mid: ${nL[10]}; --rule: ${nL[5]}; --rule-2: ${nL[3]}; }
  .header-bar { background-image: linear-gradient(135deg, ${s0.hex} 0%, ${L[10]} 52%, ${D[0]} 100%); }
  .header-bar::after { background: ${accent2}; }
  section > h2, .nav-brand .pf { color: ${L[10]}; }
  .nav a:hover { color: ${L[11]}; border-bottom-color: ${s0.hex}; }
  .callout { border-left-color: ${s0.hex}; background: ${L[2]}; color: ${L[11]}; }
  .callout code { background: ${L[4]}; }

  .scard > .ramp-name, .mx-wrap > .ramp-name {
    padding: 10px 14px; font-weight: 700; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase;
    color: var(--mid); border-bottom: 1px solid var(--rule); display: flex; align-items: center; gap: 8px; }
  .scard .dot { width: 12px; height: 12px; border-radius: calc(var(--radius) / 2); display: inline-block; }
  .seed-meta { font-family: var(--mono); font-size: 11px; color: var(--slate); line-height: 1.7; }
  .seed-meta b { color: var(--ink); font-weight: 600; }
  .scale-stack { display: grid; gap: 20px; }
  .scard { border: 1px solid var(--rule); border-radius: var(--radius); overflow: hidden; background: var(--paper); padding-bottom: 14px; }
  .scard-dark { background: ${data.neutral.dark.hct[0]}; border-color: ${data.neutral.dark.hct[5]}; }
  .scard-dark .ramp-name, .scard-dark .srow-l, .scard-dark .roles span, .scard-dark .snote { color: ${data.neutral.dark.hct[10]}; border-color: ${data.neutral.dark.hct[5]}; }
  .srow { display: grid; grid-template-columns: 110px 1fr; gap: 12px; align-items: center; padding: 8px 14px 0; }
  .srow-l { font-size: 12px; font-weight: 700; color: var(--ink); }
  .srow-l small { display: block; font-weight: 500; font-size: 10px; color: var(--mid); letter-spacing: .04em; text-transform: uppercase; }
  .scard-dark .srow-l small { color: ${data.neutral.dark.hct[9]}; }
  .roles { display: grid; grid-template-columns: repeat(12, 1fr); gap: 3px; }
  .roles span { font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: var(--mid); border-top: 2px solid var(--rule); padding-top: 4px; text-align: center; }
  .strip { display: grid; grid-template-columns: repeat(12, 1fr); gap: 3px; }
  .st { min-width: 0; overflow: hidden; min-height: 76px; border-radius: calc(var(--radius) / 2); padding: 7px 6px; display: flex; flex-direction: column; justify-content: space-between; font-family: var(--mono); font-size: 10px; line-height: 1.3; }
  .st-n { font-weight: 700; font-family: var(--sans); font-size: 12px; }
  .st-r b, .mx b { font-family: var(--sans); font-size: 9px; font-weight: 700; padding: 1px 4px; border-radius: 3px; letter-spacing: .04em; }
  .b-aaa { background: #1B7F3A; color: #fff; } .b-aa { background: #2F6FD6; color: #fff; } .b-ui { background: #8A6100; color: #fff; }
  .snote { margin: 12px 14px 0; font-size: 12px; color: var(--slate); }
  .mx-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(460px, 1fr)); gap: 20px; }
  .mx-wrap { border: 1px solid var(--rule); border-radius: var(--radius); overflow: hidden; background: var(--paper); }
  .mx-scroll { overflow-x: auto; }
  .mx { border-collapse: separate; border-spacing: 3px; width: 100%; padding: 8px; font-size: 11px; }
  .mx th { font-weight: 600; color: var(--slate); text-align: left; padding: 4px 6px; white-space: nowrap; font-size: 10px; letter-spacing: .06em; text-transform: uppercase; }
  .mx-sw { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 5px; border: 1px solid var(--rule); vertical-align: -1px; }
  .mx td { padding: 8px; border-radius: calc(var(--radius) / 2); font-family: var(--mono); vertical-align: middle; }
  .mx td strong { display: block; font-family: var(--sans); font-size: 18px; line-height: 1.1; }
  .mx td span { display: block; }
  .mx td .lc { opacity: .8; }
  .tok { position: relative; background: ${data.neutral.dark.hct[1]}; color: ${data.neutral.dark.hct[11]}; border-radius: var(--radius); padding: 18px 20px; font-family: var(--mono); font-size: 12px; line-height: 1.6; max-height: 360px; overflow: auto; white-space: pre; }
  .tok-head { display: flex; align-items: center; justify-content: space-between; margin: 24px 0 8px; font-weight: 700; font-size: 12px; letter-spacing: .1em; text-transform: uppercase; color: var(--mid); }
  .copy { font: 600 11px var(--sans); letter-spacing: .06em; text-transform: uppercase; border: 1px solid var(--rule); background: var(--paper); color: var(--ink); border-radius: calc(var(--radius) / 2); padding: 6px 10px; cursor: pointer; display: inline-flex; gap: 6px; align-items: center; }
  .copy svg { width: 14px; height: 14px; }
  @media (max-width: 900px) {
    .srow { grid-template-columns: 1fr; }
    .strip, .roles { grid-template-columns: repeat(6, 1fr); }
    .roles { display: none; }
    .mx-grid { grid-template-columns: 1fr; }
  }
  @media (max-width: 600px) {
    .strip { grid-template-columns: repeat(4, 1fr); }
    .st { font-size: 9px; }
  }`;

  const seedCards = data.seeds.map(s => `
    <div class="swatch">
      <div class="swatch-color" style="background:${s.hex}; color:${s.on}; display:flex; align-items:flex-end; padding:12px 14px; font-weight:700;">Aa</div>
      <div class="swatch-meta">
        <div class="name">${esc(s.name)}</div>
        <div class="role">Seed · step 9</div>
        <div class="hex">HEX ${s.hex} · RGB ${rgb(s.hex).join(' ')}</div>
        <div class="seed-meta">HCT <b>${s.hct.h.toFixed(1)}° · C${s.hct.c.toFixed(1)} · T${s.hct.t.toFixed(1)}</b><br>
        OKLCH <b>${s.oklch.L.toFixed(1)}% ${s.oklch.C.toFixed(3)} ${s.oklch.h.toFixed(1)}°</b><br>
        vs white <b>${f2(s.vsWhite)}</b> · vs black <b>${f2(s.vsBlack)}</b> · text on it <b>${s.on === '#FFFFFF' ? 'white' : 'dark'}</b><br>
        Nearest Radix <b>${s.radix.name}</b> (${s.radix.hex}, ΔE ${s.radix.d.toFixed(1)})</div>
      </div>
    </div>`).join('');

  const modeCards = mode => {
    const nb = data.neutral[mode];
    const pageLeo = nb.leonardo[0], pageHct = nb.hct[0];
    const cards = data.seeds.map(s => scaleCard(`${s.name} · ${s.hex}`, s.hex, [
      scaleRow('Leonardo', s.modes[mode].leonardo, pageLeo, 'contrast-solved'),
      scaleRow('HCT', s.modes[mode].hct, pageHct, 'tone-solved'),
    ], mode, s.modes[mode].note));
    cards.push(scaleCard(`Neutral · hue ${data.seeds[0].hct.h.toFixed(0)}°, chroma ${o.neutralChroma}`, nb.hct[8], [
      scaleRow('Leonardo', nb.leonardo, pageLeo, 'contrast-solved'),
      scaleRow('HCT', nb.hct, pageHct, 'tone-solved'),
    ], mode));
    return cards.join('');
  };

  const copyIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
  const nSteps = data.seeds.length * 2 * 2 * 12 + 2 * 2 * 12;
  const year = new Date().getFullYear();

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(o.brand)} · Seed Palette</title>
<meta name="description" content="${esc(o.brand)} seed palette — 12-step light and dark scales solved by Adobe Leonardo and Material HCT, with contrast ratios on every step.">
<meta name="robots" content="noindex, follow">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(o.font).replace(/%20/g, '+')}:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>${css}${seedCss}
</style>
</head>
<body>

<header class="header-bar">
  <div class="inner">
    <div class="kicker">Palette Guide · Seed Mode · ${year} Edition</div>
    <div class="brandmark" style="height:auto;font:800 56px/1 var(--sans);letter-spacing:-0.02em;">${esc(o.brand)}</div>
    <div class="chip-row">${L.map(h => `<div class="chip" style="background:${h};"></div>`).join('')}</div>
    <p class="lede">${data.seeds.length === 1 ? 'One seed color' : `${data.seeds.length} seed colors`}, grown into full 12-step light and dark scales by two engines aiming at the same contrast targets. Every step shows its contrast against the page, so which pairings pass is a lookup, not a judgment call.</p>
    <p class="meta">Seeds <span>${data.seeds.length}</span> &nbsp;·&nbsp; Engines <span>2</span> &nbsp;·&nbsp; Steps <span>${nSteps}</span></p>
  </div>
</header>

<nav class="nav">
  <div class="nav-inner">
    <span class="nav-brand"><span class="pf">${esc(o.brand)}</span> · Seed Palette</span>
    <a href="#seeds">Seeds</a>
    <a href="#light">Light</a>
    <a href="#dark">Dark</a>
    <a href="#pairings">Pairings</a>
    <a href="#tokens">Tokens</a>
  </div>
</nav>

<div class="page">

<section id="seeds">
  <h2>01 · Seeds</h2>
  <div class="section-title">Where the Scales Start</div>
  <p class="section-blurb">Each seed becomes step 9, the solid brand fill, in both modes. HCT and OKLCH describe it in perceptual terms; HSL hue is not shown because it misreports dark colors.</p>
  <div class="swatch-grid">${seedCards}</div>
</section>

<section id="light">
  <h2>02 · Light Scales</h2>
  <div class="section-title">Twelve Steps, Twelve Jobs</div>
  <p class="section-blurb">The number under each hex is its WCAG contrast against the page background (step 1 of the neutral). <b>3:1</b> passes for UI parts and large text, <b>AA</b> is 4.5:1 body text, <b>AAA</b> is 7:1.</p>
  <div class="scale-stack">${modeCards('light')}</div>
  <div class="callout"><strong>How these were solved.</strong> Both engines chase the same targets: the contrast curve measured off Radix Colors (<code>blue</code> for accents, <code>slate</code> for the neutral). <strong>Leonardo</strong> interpolates the seed through OKLCH and picks the color that lands on each ratio. <strong>HCT</strong> keeps the seed's hue and chroma fixed and solves only tone (tone = L*, so contrast is a function of tone distance). Where they disagree, it is in how much color each step keeps, not in how much contrast it has.</div>
</section>

<section id="dark">
  <h2>03 · Dark Scales</h2>
  <div class="section-title">Same Jobs, Inverted</div>
  <p class="section-blurb">Solved against a dark page with the dark Radix curve. Step 9 stays the seed so the brand fill is identical across modes.</p>
  <div class="scale-stack">${modeCards('dark')}</div>
</section>

<section id="pairings">
  <h2>04 · Text Pairings</h2>
  <div class="section-title">What Text Can Sit Where</div>
  <p class="section-blurb">${esc(s0.name)}'s text steps on every background step, light mode. Each cell shows the WCAG ratio and the APCA lightness contrast (Lc). APCA guides: Lc 75 for body text, 60 for content, 45 for headlines.</p>
  <div class="mx-grid">
    <div class="mx-scroll">${matrix('Leonardo', s0.modes.light.leonardo, data.neutral.light.leonardo)}</div>
    <div class="mx-scroll">${matrix('HCT', s0.modes.light.hct, data.neutral.light.hct)}</div>
  </div>
</section>

<section id="tokens">
  <h2>05 · Tokens</h2>
  <div class="section-title">Copy the Scale</div>
  <p class="section-blurb">CSS custom properties, light by default and dark under <code>prefers-color-scheme</code>. Pick one engine per project; don't mix steps between them.</p>
  <div class="tok-head">HCT <button class="copy" data-t="tok-hct">${copyIcon}Copy</button></div>
  <pre class="tok" id="tok-hct">${esc(tokens(data, 'hct'))}</pre>
  <div class="tok-head">Leonardo <button class="copy" data-t="tok-leo">${copyIcon}Copy</button></div>
  <pre class="tok" id="tok-leo">${esc(tokens(data, 'leonardo'))}</pre>
</section>

</div>

<footer>
  <div><strong style="color: var(--dark);">${esc(o.brand)}</strong> · Seed Palette · ${year} Edition</div>
  <div class="stamp">${data.seeds.length} seed${data.seeds.length > 1 ? 's' : ''} · 2 engines · ${nSteps} steps</div>
</footer>

<script>
document.querySelectorAll('.copy').forEach(b => b.addEventListener('click', () => {
  const t = document.getElementById(b.dataset.t).textContent;
  (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => {
    const o = b.lastChild.textContent; b.lastChild.textContent = 'Copied'; setTimeout(() => b.lastChild.textContent = o, 1400);
  }).catch(() => {});
}));
</script>
</body>
</html>
`;
}

// ---------------------------------------------------------------- main
export { buildScales, ratio, apca, onColor, oklch };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const o = parseArgs(process.argv.slice(2));
  const data = buildScales(o.seeds, o.neutralChroma);
  if (o.json) fs.writeFileSync(o.json, JSON.stringify(data, null, 2));
  if (o.out) fs.writeFileSync(o.out, render(o, data));
  for (const s of data.seeds) {
    console.log(`${s.name} ${s.hex}  nearest Radix: ${s.radix.name} (ΔE ${s.radix.d.toFixed(1)})`);
    for (const m of ['light', 'dark']) {
      console.log(`  ${m.padEnd(5)} leo ${s.modes[m].leonardo.join(' ')}`);
      console.log(`  ${m.padEnd(5)} hct ${s.modes[m].hct.join(' ')}`);
      if (s.modes[m].note) console.log(`        note: ${s.modes[m].note}`);
    }
  }
  if (o.out) console.log(`wrote ${o.out}`);
}
