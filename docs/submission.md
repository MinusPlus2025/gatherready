# Devpost submission draft

> Status: draft written from the actual implementation. The project owner fills the links, confirms the
> licence and eligibility, and performs the submission. Nothing here should be submitted until the
> verification table in [`testing.md`](testing.md) reflects the final commit.

**Project name:** GatherReady
**Tagline:** Turn conditional interest into a workshop people actually agree to fund.

## Inspiration

Small workshop organizers do not lose classes because nobody wants them. They lose them because the
interest is conditional: "Saturday morning only", "I prefer the afternoon, but if materials are included
the morning could work". A chat thread cannot be counted, so the organizer books optimistically and
cancels late — or refunds everyone and starts over. Public merchant policies document the cost: minimum
enrolment thresholds with reschedules and refunds ([POT Studio][pot]), pay-up-front with email-based
cancellations ([Rain City Clay][rcc]), minimum-six decisions 30 days ahead ([Sarah Pike][spk]).

Minimum-participant charging already exists ([TrekkSoft][trekk]) and interest-first collection exists
([CountToGo][count]). So the honest question is not "can we hold a card until a group forms" — it is:
**can AI remove the ambiguity before checkout, so the group that forms is the exact group that agreed?**

## What it does

GatherReady is a small web product for one independent pottery workshop with three candidate times, a
fixed all-inclusive price (USD 45.00) and a 4–6 person minimum.

1. A participant writes one messy sentence. The AI returns a schema-validated card — must have,
   preferred, needs clarification — quoting the participant's own words. **Nothing counts until the
   participant confirms it**, and the model never confirms for them.
2. A deterministic solver counts only confirmed constraints across the three slots and identifies the
   one gap worth asking about. At most one question per person, generated from a confirmed merchant
   fact and the participant's own quote. A refusal is final: no re-asking, no discount, no
   majority-overrides-minority.
3. When four confirmed people fit one slot, the organizer publishes **one immutable offer**: canonical
   JSON, sha256 hash, frozen price/time/timezone/venue/inclusions/minimum/deadline/cancellation terms.
4. Each included participant sees the full summary and ticks an unchecked consent box before going to
   PayPal. The server enforces the checkbox and creates the order with `intent=AUTHORIZE` from
   server-side amounts.
5. The organizer collects in a separate action. The server re-validates every rule, locks a batch,
   captures serially, queries every capture, and marks the workshop **CONFIRMED only when all captures
   completed and the minimum is met**. Otherwise it releases holds (void) and refunds completed charges.

## How we built it

TypeScript, Fastify 5, React 19 + Vite, zod, SQLite (`node:sqlite`) — one process, no external services
beyond PayPal and the model. The AI boundary is a JSON schema plus a verbatim-quote verifier; the
solver, state machines, amounts and payment calls are pure deterministic code. The PayPal integration
uses Orders v2 (`intent=AUTHORIZE`) and Payments v2 (authorize, void, capture, refund, queries) with
`PayPal-Request-Id` idempotency, webhook signature verification with event-id dedupe, an operations table
for crash recovery, and a scheduled reconciliation job.

A **simulated PayPal adapter** exists so the product can be demonstrated and tested without credentials.
It is labelled on every screen and every row — it is never presented as a real sandbox transaction.

## Challenges we ran into

- Cross-buyer payments are not atomic. We made the batch all-or-nothing **by compensation**: void
  uncaptured authorizations, refund captured amounts, reconcile unknown outcomes before retrying, and
  never display "refunded" for "refund requested".
- AI "understanding" is easy to fake. We constrained the model to slot ids and verbatim quotes, added a
  bounded retry then a visible structured fallback, and kept a form-based path that works with no model
  at all.
- The consent problem is the actual product risk: an AI must not be able to change what a person agreed
  to. Hence immutable offers, hashed terms, versioned consents, and no model access to any payment call.

## What is measured (and what is not)

- Deterministic unit and integration tests cover the money rules and failure paths; the end-to-end
  verification script walks the whole loop over HTTP.
- 20+ synthetic language cases (negation, contradiction, date ambiguity, injection) are evaluated
  against means of a form baseline — see [`ai-evaluation.md`](ai-evaluation.md).
- **Not validated:** real demand, willingness to pay, organiser interviews, conversion lift, or any
  claim that AI outperforms a form in the field. The project is a sandbox prototype.
- **Not yet verified in this snapshot:** real PayPal sandbox transactions (credentials were unavailable
  on the build machine). The simulated path is labelled; the real path is code-complete and gated.

## What's next

Real sandbox evidence on the provided accounts, a 3–5 person usability test of the consent screen, and
organiser interviews before any platform expansion. If the AI mostly adds correction work compared with
ticking three boxes, we drop the AI claim and keep a small, honest coordination tool.

## Built with

`typescript` · `fastify` · `react` · `vite` · `zod` · `node:sqlite` · `vitest` · PayPal Orders v2 ·
Payments v2 · webhooks

[pot]: https://www.potstudiola.com/a/faq
[rcc]: https://raincityclay.com/registration-policies
[spk]: https://www.sarahpikepottery.com/workshop-cancelation-policies
[trekk]: https://support.trekksoft.com/confirm-booking-before-charging-minimum-number-of-participants
[count]: https://counttogo.com/classes-workshops
