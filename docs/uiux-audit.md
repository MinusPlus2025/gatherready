# UI/UX audit — 2026-11-12

**Product:** GatherReady (PayPal AI Hackathon sandbox prototype)
**Scope:** landing, organizer setup/plan/offer/funding/result, participant preferences/clarify/authorize,
not-found; English + 简体中文; 1440/834/390/320 CSS px.
**Audited at:** `253b808` + the fixes in this pass. **Method:** open-source tools + two skill-based reviews.
**Honest limit:** automated measurements and heuristic review only. No screen-reader pass, no real-device
pass, no first-time-user test — so this is not a claim that "UX is validated with users".

---

## 1. Tools and what they measured

| Tool (licence) | Version | What it produced | Artifact |
|---|---|---|---|
| [axe-core](https://github.com/dequelabs/axe-core) (MPL-2.0) | 4.x via `node_modules` | WCAG 2.1 A/AA on 10 routes × desktop/phone = 20 runs | `docs/audit/axe.json` |
| [Lighthouse](https://github.com/GoogleChrome/lighthouse) (Apache-2.0) | 12.2.1 | performance / a11y / best-practices / SEO, before + after | `docs/audit/lighthouse/` |
| [ESLint](https://eslint.org) (MIT) + [eslint-plugin-jsx-a11y](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y) (MIT) + [typescript-eslint](https://typescript-eslint.io) (MIT) | 9.39.5 / 6.10.2 / 8.72.2 | static a11y lint over `src/web` | `npm run audit:lint` |
| [@fastify/compress](https://github.com/fastify/fastify-compress) (MIT) | 8 | gzip/br for text assets | `src/server/routes.ts` |
| [sharp](https://sharp.pixelplumbing.com) (Apache-2.0) | 0.33 | responsive WebP derivatives | `npm run images:build`, `public/images/*-{480,800,1600}.webp` |
| [Vercel Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines) | fetched 2026-11-12 | rule-by-rule code review | §3 below |
| `improve-animations` skill (Emil Kowalski philosophy) | local skill | 8-category motion audit + plans | `plans/` |
| `design-taste-frontend` skill | local skill | design critique | §5 below |
| Existing harnesses | — | `npm run ui-review` (axe/overflow/tap targets/CLS/motion, EN+ZH), `npm run test:motion`, `npm run test:ui`, `npm test`, `npm run verify` | `docs/ui-review.md`, `docs/motion-check.json` |

Reproduce: `npm run build && npm start` in one shell, then
`npm run audit:axe`, `npm run audit:lint`, `npm run ui-review`, `npm run test:motion`;
Lighthouse: `npx lighthouse http://localhost:5180/ --chrome-flags="--headless=new --no-sandbox"`.

---

## 2. Automated results

### 2.1 Lighthouse (landing — the public first screen)

| Run | Perf | A11y | Best-practices | SEO | LCP | TBT |
|---|---|---|---|---|---|---|
| Mobile, before | **32** | 100 | 100 | 58 | 12.4 s | 3.61 s |
| Mobile, after | **61** | 100 | 100 | **100** | **3.2 s** | 2.42 s |
| Desktop, before | **80** | 100 | 100 | 58 | 2.2 s | 0 ms |
| Desktop, after | **66–68** | 100 | 100 | **100** | **0.7 s** | 1.1–1.5 s |

Read this honestly: mobile is much better (LCP −74 %, SEO fixed), desktop LCP improved 3× but the
performance score fell because a single **unattributable ~1.5 s main-thread task** now shows up in TBT
(`Script Evaluation` is only 19 ms; the trace labels the task "Unattributable"). Two repeat runs gave
66 and 68 with the same LCP; treat the desktop perf number as noisy and the TBT as an open item, not a win.

What changed: gzip/Brotli compression, responsive WebP `srcset` (hero 286 KB JPEG → 110 KB WebP at 1600w,
45 KB at 800w), lazy route chunks, hero image preload, real `robots.txt`, `index,follow`, description/OG tags,
theme-color corrected. Remaining mobile weight is JS main-thread work, not images.

### 2.2 axe-core

**0 violations across 20 route × viewport runs** (10 routes, desktop 1440 + phone 390), respecting the
same rule set as `npm run ui-review`. This includes the new interactive preview and gallery lightbox.

### 2.3 Static a11y lint (jsx-a11y)

Initial run: **5 problems** — 4 real errors on the lightbox (click handlers on a non-interactive backdrop
and figure) and 1 config note. Fixed by rebuilding the backdrop as a real `<button>` with a focus trap;
final run: **0 problems**.

### 2.4 Existing harnesses after the fixes

`ui-review`: **0 findings** (8 states incl. EN/中文 × 4 widths; axe, overflow, tap targets, CLS, focus,
reduced motion). `test:motion`: **11/11**. `test:ui`: **14/14**. `vitest`: **232**. `verify`: **62/62**.

---

## 3. Web Interface Guidelines review (code-level)

Source: Vercel `web-interface-guidelines` (fetched). Findings were verified at file:line and fixed where
cheap and unambiguous.

| # | Finding | Status |
|---|---|---|
| 1 | Offer error summary links to `#offer-slot`, but the radiogroup had no id (dead error link) | **fixed** (`id="offer-slot"`) |
| 2 | Setup error summary links to `#slots`, but only `#slots-error` existed (dead link) | **fixed** (`id="slots"`) |
| 3 | Gallery lightbox: `role="dialog"` without focus trap, background still tabbable | **fixed** (Tab stays on close, `aria-hidden` on gallery, body scroll lock) |
| 4 | Lightbox backdrop was a `<div onClick>` with no keyboard path | **fixed** (semantic close button, lint clean) |
| 5 | Disabled "Confirm workshop and collect" carried `aria-describedby` (never announced) | **fixed** (moved to the containing section) |
| 6 | Skip link in the boot state was hardcoded English | **fixed** (`t('shell.skip')`) |
| 7 | `questionStatus` injected English enum text into the Chinese string (`问题answered yes`) | **fixed** (localised yes/no/sent/proposed) |
| 8 | `EmptyState` always rendered `h2`; NotFound/empty routes had no `h1` | **fixed** (`level` prop; NotFound uses `h1`) |
| 9 | "Screens" popover used `role="menu"`/`menuitem` without the ARIA menu keyboard model | **fixed** (plain disclosure with links; Esc/outside click already worked) |
| 10 | Countdown changed to "closed" silently | **fixed** (`aria-live="polite"`) |
| 11 | Input focus ring shown on mouse click (`:focus`) | **fixed** (`:focus-visible`) |
| 12 | Sticky header hid anchor targets / focused fields | **fixed** (`html { scroll-padding-top: 92px }`) |
| 13 | No `text-wrap: balance` on display headings (widows) | **fixed** |
| 14 | No `touch-action: manipulation` on controls (tap delay) | **fixed** |
| 15 | `theme-color` did not match the page background | **fixed** (`#f3f4ee`) |
| 16 | Lightbox lacked `overscroll-behavior` and safe-area padding | **fixed** |
| 17 | Collector action is one click with no confirmation/undo | **open** — product decision; needs a confirm step + test |
| 18 | 12-field setup and free-text preferences have no unsaved-changes guard | **open** — P1; `beforeunload` + router block |
| 19 | Form controls have no `name` attributes (autofill/analytics) | **open** — P2 |
| 20 | Fonts are not preloaded (hero image is) | **open** — P2; add `preload` for the two variable latin files |
| 21 | Hero tilt / scroll-reveals contradict the taste-skill's "no tilt, no scroll fades" rule | **deliberate** — the user explicitly asked for visible interaction motion; documented in §5 |

---

## 4. Motion audit (improve-animations skill)

Full findings and self-contained implementation plans: `plans/README.md`.

| # | Severity | Finding | Status |
|---|---|---|---|
| 1 | HIGH | Hero tilt was dead code (filled `gr-rise` pinned `transform: none`); would have lagged if alive | **fixed** (plan 001) |
| 2 | MEDIUM | Intended `scale(0.97)` press lost the CSS cascade; hover lift fired on touch; 10 pressables had no press state | **fixed** (plan 002) |
| 3 | MEDIUM | Two `useCountUp` rAF loops re-rendered the landing ~100× for numbers never rendered | **fixed** (plan 003) |
| 4–11 | LOW | Disclosure chevron snap; `.slot-choice` no transition; asymmetric selected-badge transition; `useAnimatedNumber` mid-tween jump; unused `--ease-in-out`/hand-typed curves; permanent `will-change`; four competing reduced-motion blocks | **partly fixed** (token/curve clean-up); detail in `docs/ui-review.md` + plan backlog |
| — | Open | Lightbox exit teleport; PlanPreview phase swap; funding timeline stage; gallery stagger | **open** — plan 004 |

Deliberately kept: reduced motion keeps 180 ms opacity fades and drops movement; the expand/collapse uses a
retargetable `grid-template-rows` transition; money amounts are never tweened; the Simulated PayPal button
never borrows PayPal branding.

---

## 5. Design critique (design-taste-frontend skill)

**What works.**
- The product's subject is on screen: warm colour pottery photography, a mounted hero, a live plan preview
  that performs ask → yes → 3→4 instead of a screenshot.
- Identity is coherent: Fraunces display + Inter UI, one deep-green accent, semantic status words paired
  with colour, a single G monogram that survives 38 px.
- The status system is the best part of the product UI: one computed sentence, three separate rails,
  candidate matrix, explicit "availability is not payment".
- Bilingual page is real, not a translated screenshot; English stays the default and data keeps its language.

**What still reads below the bar.**
1. **The landing is too long for one idea.** Hero + preview ≈ 1.4 screens; then 4-state strip, five-image
   bento, three-step cards, and a 2-column "does / doesn't" panel. Four consecutive boxed sections dilute the
   one thing the page sells. Cut one of the state strip / honest panel (the honest panel belongs on the
   submission page), and let the gallery carry more of the second screen.
2. **Box rhythm.** Almost every block is the same bordered, 12–14 px-radius panel; status band, rails,
   matrix and question card compete at equal weight. Differentiate by removing borders from quiet text blocks
   and reserving the bordered panel for things that hold a decision.
3. **Hero composition.** Copy is top-aligned now, but the preview card is taller than the copy and pushes the
   fold; at 1440x900 the first screen ends inside the preview. Either reduce preview rows (collapse times
   into one line) or place the preview lower/right at a smaller width so hero copy + preview top fit one screen.
4. **Gallery** is the strongest visual, but the wide texture strip at the bottom reads as filler; drop it or
   use it as a full-bleed section divider instead of a bento cell. Labels only on hover are fine for pointers,
   but Chinese labels are longer — check truncation at 320 px.
5. **Interior screens are trustworthy but utilitarian.** The organizer plan has excellent information design,
   yet the funding/result screens fall back to rows of identical panels; a stronger single money-summary would
   read more premium than four equal cards.
6. **Mobile chrome.** "VIEW AS" + participant chips + language switch + sandbox chip all live above the page;
   for a judge this is tooling, but it costs the first screen ~120 px. Consider collapsing participant chips
   into a select on phones while keeping one-tap role switching on desktop.

**Two alternative art directions (same product structure).**
- **A · Editorial print.** Photography at 60 % of the hero, copy in a narrow measure, no preview card above
  the fold (move it to screen two), three image-led chapters, one type moment; motion only on hero entrance and
  lightbox. Raises perceived quality, lowers feature visibility.
- **B · Tool-first.** The live preview becomes the hero (two-column with a short promise), all marketing
  sections move below one screen, gallery becomes a 3-image inline strip. Reads as a serious product, less as a
  marketing site; best for judges who will click.

**Verdict.** **Hackathon-good, close to startup-good on the landing; interior flows are solid but generic.**
The photography, monogram and live preview carry the first impression; the remaining gap is editorial
discipline (fewer boxes, one idea per screen) and mobile main-thread cost, not missing features.

---

## 6. Prioritised backlog

| Priority | Item | Effort |
|---|---|---|
| P0 | Keep the current green checks green: `ui-review`, `test:motion`, `test:ui`, `verify`, axe, lint | — |
| P1 | Confirm step / undo for "Confirm workshop and collect" (money action) | S |
| P1 | Unsaved-changes guards for setup + preference free text | S |
| P1 | Mobile TBT: split i18n dictionaries (zh/flow/money/onboard) out of the initial chunk; defer gallery JS | M |
| P2 | Lightbox exit, PlanPreview phase crossfade, funding timeline transition, gallery stagger (`plans/004`) | S |
| P2 | Landing editorial cut (remove one boxed section, reduce preview height) | M |
| P2 | Field `name` attributes, font preloads, latin-only font faces | S |
| P2 | Real-device and screen-reader pass before submission | S |
