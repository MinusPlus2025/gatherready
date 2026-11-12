# Design: identity, interface, and the open-source toolkit behind it

This file covers the visual identity, the interface system, and exactly which open-source tools and agent
skills were used to get there (with licences). It is written so a reviewer can tell deliberate choices
from defaults.

## 1. The mark

```text
three candidate times  ──►  one agreed plan
   ●  ╲
   ●  ───►  ( ✓ )        the ring is the fixed offer; the check is the consent that makes it real
   ●  ╱
```

- **Three stems** are the three candidate sessions an organizer offers.
- They converge into **one ring**: the frozen, hashed offer.
- The **check inside the ring** is the participant's own consent — the product's whole point is that the
  plan and the payment are the same agreed object.

SVG sources: [`public/logo-mark.svg`](../public/logo-mark.svg) (mark, favicon) and
[`public/logo-lockup.svg`](../public/logo-lockup.svg) (mark + wordmark, for README / submission / video
cards). The React version lives in `src/web/components/Logo.tsx` and inherits `currentColor`, so it works
on light surfaces without a second file.

Wordmark: **Fraunces** (variable) at weight ~620, tight tracking. It reads as a small studio's
sign-painted name rather than a SaaS logotype.

## 2. Palette

Cool paper rather than the default warm cream, one deep green accent, semantic status colours only.

| Token | Hex | Used for |
|---|---|---|
| `--bg` | `#F3F4EE` | page ground |
| `--surface` | `#FFFFFF` | cards, sheets |
| `--surface-2` | `#FAFAF5` | inset panels, preview chrome |
| `--border` / `--border-strong` | `#DCDDD2` / `#C1C3B7` | hairlines, dashed empty states |
| `--ink` / `--ink-2` / `--ink-3` | `#131713` / `#434B44` / `#5B635B` | text hierarchy (all AA on the surfaces) |
| `--accent` / `--accent-strong` | `#0D5A45` / `#074433` | primary action, brand, the "fits" state |
| `--success` / `--warn` / `--danger` / `--info` | `#0F6B38` / `#8A5A00` / `#A52020` / `#2F4B7C` | status, **always with a word**, never colour alone |
| PayPal gold/blue | `#FFC439` / `#003087` | only inside the PayPal control |

No gradients, no glow, no decorative charts. The PayPal branding is the only third-party colour on the
page, which is why it reads as a payment, not as decoration.

## 3. Typography

Two open-source families, both variable, both self-hosted through Fontsource (no Google Fonts request, no
layout shift, works offline):

- **Inter Variable** — interface, forms, tables, numbers. `font-variant-numeric: tabular-nums` on counts
  and anything money-related so numbers do not jitter between states.
- **Fraunces Variable** — page titles, the landing headline, the big counts, the wordmark. One display
  family, used only where the page is making a statement; panels stay in Inter so dense screens stay
  readable.

Scale: `h1 clamp(2.4rem, 4.6vw, 3.55rem)` (display), `h2 1.3–1.6rem` (display), body 16px/1.6, small
meta 12–13px. Line length capped around 62–68ch.

## 4. Layout and interface rules

- **Three counts never collapse**: `Interested` / `Fits this plan` / `Payment authorized` are three
  different cards, and `Captured` is a fourth state shown only in the money timeline.
- **A dash, not a zero**: when no time has reached the minimum, "Fits this plan" shows `—` with a
  sentence explaining why, instead of a misleading `0`.
- **Empty states are directions, not moods**: each empty panel says what would have to happen
  ("no pending conditions…", "a question is only suggested when one participant's condition would meet
  the minimum"). No apologising, no decoration.
- **One action per screen**: publish, collect, authorize. The money-moving button is the only primary
  button on the funding screen.
- **Equal edges**: every panel sits on the same container line; the landing hero is a 2-column grid that
  stacks at 1000px.
- **Status = colour + word**: badges always carry text ("Authorized — not charged", "Below minimum").

## 5. Motion

Deliberately minimal, and all of it answers something:

- **One page-load entrance** on the landing hero (620ms rise, staggered 60ms), once, never on scroll.
- **Buttons**: lift 1px on hover, press 1px on click; no bounce, no tilt.
- **Focus**: visible 2px accent ring with 2px offset on every interactive element.
- **Reduced motion**: `prefers-reduced-motion: reduce` disables entrance animation and button transforms
  entirely — nothing rests hidden.

## 6. Accessibility

- `axe-core` WCAG 2.1 A/AA: **0 violations** on landing, setup, plan and participant preferences at 1440px
  (re-run after the redesign; earlier run covered 11 states at 1440/420).
- Real `<label>`s, field hints, error summaries under the field, skip link, one `h1` per page, visible
  focus, ≥44px targets, ≥16px body text.
- Status is never colour-only: every badge has a word, every money state has a sentence.
- Mobile verified at 390px: single column, full-width primary actions, no horizontal overflow.

## 7. Open-source tools and skills used

### Agent skills (installed with `npx skills`, catalogue at skills.sh)

| Skill | What it contributed | Source |
|---|---|---|
| `frontend-design` (Anthropic) | design-lead framing: subject-specific choices, typography, restraint, self-critique against generic AI defaults | `anthropics/skills@frontend-design` |
| `design-taste-frontend` (tasteskill) | anti-slop rules: real product UI instead of mockups, one system, equal edges, hover/press micro-interactions, no caption blocks, motion only where it earns its place | `leonxlnx/taste-skill@design-taste-frontend` |
| `web-design-guidelines` (Vercel Labs) | interface checklist used during review (labels, focus, tap targets, meta tags) | `vercel-labs/agent-skills@web-design-guidelines` |
| `emil-design-eng` | component polish philosophy: small, invisible details (press states, focus, timing) | `emilkowalski/skills@emil-design-eng` |

These are prompt-level skills, not runtime dependencies; the app does not ship them. They were installed
into `.agents/skills/` in the workspace, not into the repository.

### Runtime libraries (all permissive, all pinned in `package-lock.json`)

| Package | Licence | Why |
|---|---|---|
| `@fontsource-variable/inter` | OFL-1.1 | self-hosted UI font |
| `@fontsource-variable/fraunces` | OFL-1.1 | self-hosted display font |
| `lucide-react` | ISC | real, consistent icons (no emoji, no hand-drawn SVGs standing in for a product icon) |
| `axe-core` | MPL-2.0 | accessibility audit (dev) |
| `puppeteer-core` + system Chrome | Apache-2.0 | live screenshots, UI smoke test, recorded walkthrough (dev) |
| `vite`, `react`, `tailwind`-free custom CSS | MIT | build + UI |

Deliberately **not** added: a component kit (shadcn/Radix/Tailwind UI) or a template. The screens are
built from one small hand-written CSS system (`src/web/styles.css`, design tokens + ~40 components)
because a kit's defaults are exactly the "SaaS card kit" look the design review warns about, and because
the money states need precise semantics, not generic components. The full kit would add ~40 dependencies
for a UI this size.

### Design references that were rejected

- Warm cream + terracotta accent, serif headline over a gradient — the current AI-default look.
- Near-black page with an acid-green accent — the other AI-default look.
- Illustration set or 3D render as the hero: the product itself is the hero (live HTML preview of the
  plan screen), which is also the honest thing to show.

## 8. What changed in this pass

| Before | After |
|---|---|
| Letter "G" in a rounded square, Georgia fallback | Purpose-drawn mark (three times → one consented plan), inline SVG + favicon + lockup |
| System sans only | Inter Variable for UI, Fraunces Variable for display, both self-hosted |
| Landing: text block + three numbered text steps | Split hero with a live HTML product frame, four-state strip, three icon steps, explicit does/does-not split |
| Empty plan panels with one muted sentence | Directional empty states with icons and explanations |
| "Fits this plan: 0" when nothing was workable | Em dash + explanation sentence |
| Flat click states | Hover lift, press, visible focus ring, one hero entrance, reduced-motion respected |
| Plain flat cards | Refined depth system (`--shadow-card` / `--shadow-float`), radius scale, sticky translucent header |
