/* ==========================================================================
   Landing. One job: say what the product does, for whom, and show the product
   itself as live HTML — the three separate counts and the one question that
   closes the gap. Everything below the fold is the real loop, then an explicit
   "what this prototype does not do".

   The preview frame is drawn from the same numbers the demo produces (3→4), so
   a reader can compare it with the running app without a screenshot.
   ========================================================================== */

import { Link } from 'react-router-dom';
import {
  BadgeCheck,
  BotOff,
  Check,
  Fingerprint,
  HelpCircle,
  MessagesSquare,
  ShieldCheck,
  X,
} from 'lucide-react';
import { formatCents } from '../lib/format';
import { useApp } from '../lib/store';
import { StatusBadge } from '../components/ui';

const FOUR_STATES = [
  { label: 'Interested', detail: 'Wrote one sentence or ticked a time. Does not count yet.' },
  { label: 'Fits this plan', detail: 'Confirmed the exact time. Only this number is counted.' },
  { label: 'Payment authorized', detail: 'A hold with PayPal. Not money received.' },
  { label: 'Captured', detail: 'PayPal confirmed the merchant was paid. Final state.' },
] as const;

const HOW_STEPS = [
  {
    icon: MessagesSquare,
    title: 'Read the condition, not the mood',
    body: 'A participant writes one messy sentence. The model returns an editable card with their own words quoted, and the participant confirms it. Nothing counts before that click.',
  },
  {
    icon: HelpCircle,
    title: 'Ask at most one question',
    body: 'The solver counts only confirmed constraints. If one merchant fact would close the gap, the organizer reviews and sends a single yes/no question. A “no” is final.',
  },
  {
    icon: BadgeCheck,
    title: 'Freeze the plan, then fund it',
    body: 'One immutable offer with a hash. Each person reads it, consents, and authorizes the exact total. The organizer captures only after the minimum is authorized.',
  },
] as const;

export default function Landing() {
  const { state } = useApp();
  const workshop = state?.workshop ?? null;

  return (
    <div className="landing">
      <section className="hero hero--split" aria-labelledby="hero-title">
        <div className="hero__copy">
          <p className="eyebrow">Consensus workshops · PayPal sandbox</p>
          <h1 id="hero-title">A workshop happens only when enough people actually say yes.</h1>
          <p className="hero__lede">
            GatherReady turns conditional interest — “Saturday morning, if materials are included” — into one
            fixed plan everyone can read, one optional question, and a PayPal authorization that is captured
            only when the whole plan is real.
          </p>
          <div className="hero__actions">
            <Link className="btn btn-primary" to="/organizer/setup">
              Set up a workshop
            </Link>
            <Link className="btn btn-secondary" to="/participant/preferences">
              See it as a participant
            </Link>
          </div>
          <ul className="hero__meta">
            <li>
              <ShieldCheck size={15} strokeWidth={2} aria-hidden="true" /> PayPal sandbox only
            </li>
            <li>
              <Fingerprint size={15} strokeWidth={2} aria-hidden="true" /> One immutable offer
            </li>
            <li>
              <BotOff size={15} strokeWidth={2} aria-hidden="true" /> AI never touches money
            </li>
          </ul>
        </div>

        <aside className="app-frame" aria-label="Preview of the organizer plan screen with synthetic demo data">
          <div className="app-frame__chrome">
            <span className="app-frame__dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className="app-frame__title">The plan</span>
            <span className="app-frame__badge">Synthetic demo</span>
          </div>
          <div className="app-frame__counts">
            <div>
              <span className="app-frame__num">6</span>
              <span className="app-frame__lbl">Interested</span>
            </div>
            <div>
              <span className="app-frame__num">3</span>
              <span className="app-frame__lbl">Fits this plan</span>
            </div>
            <div>
              <span className="app-frame__num">0</span>
              <span className="app-frame__lbl">Payment authorized</span>
            </div>
          </div>
          <div className="app-frame__times" aria-hidden="true">
            <div className="app-frame__time">
              <span>Sat 10:00–12:00</span>
              <span className="app-frame__time-meta">3 confirmed · 1 conditional</span>
            </div>
            <div className="app-frame__time">
              <span>Sat 13:00–15:00</span>
              <span className="app-frame__time-meta">2 confirmed</span>
            </div>
            <div className="app-frame__time">
              <span>Sun 10:00–12:00</span>
              <span className="app-frame__time-meta">1 confirmed</span>
            </div>
          </div>
          <div className="app-frame__question">
            <span className="app-frame__kicker">Suggested question — reviewed before sending</span>
            <p>“All materials are included. Would Saturday 10:00–12:00 work for you?”</p>
            <div className="app-frame__question-pair">
              <span>Diego’s condition: materials included</span>
              <span>
                Gap closes: <strong>3 → 4</strong>
              </span>
            </div>
          </div>
          <div className="app-frame__foot">
            <Fingerprint size={14} strokeWidth={2} aria-hidden="true" />
            Offer fingerprint 4a96… · every money state is read back from the server
          </div>
        </aside>
      </section>

      <section className="state-strip" aria-label="Four states GatherReady keeps separate">
        {FOUR_STATES.map((item) => (
          <div className="state-strip__item" key={item.label}>
            <p className="state-strip__label">
              <i aria-hidden="true" />
              {item.label}
            </p>
            <p>{item.detail}</p>
          </div>
        ))}
      </section>

      {workshop ? (
        <section className="panel panel--summary" aria-labelledby="current-workshop">
          <div className="panel__head">
            <div>
              <p className="eyebrow">Current workshop</p>
              <h2 id="current-workshop">{workshop.title}</h2>
              <p className="muted">
                {workshop.merchantName} · {workshop.slots.length} candidate times · {formatCents(workshop.priceCents)}{' '}
                per person
              </p>
            </div>
            <StatusBadge
              tone={workshop.status === 'CONFIRMED' ? 'success' : workshop.status === 'CANCELLED' ? 'neutral' : 'info'}
              word={
                workshop.status === 'CONFIRMED'
                  ? 'Workshop confirmed'
                  : workshop.status === 'CANCELLED'
                    ? 'Workshop cancelled'
                    : workshop.status === 'OFFER_OPEN'
                      ? 'Offer open for authorization'
                      : 'Collecting interest'
              }
            />
          </div>
          <div className="landing__links">
            <Link className="btn btn-primary" to="/organizer/plan">
              Open the organizer plan
            </Link>
            <Link className="btn btn-secondary" to="/participant/preferences">
              Open a participant view
            </Link>
            {workshop.status === 'CONFIRMED' || workshop.status === 'CANCELLED' ? (
              <Link className="btn btn-ghost" to="/organizer/result">
                See the result
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="how" aria-labelledby="how-it-works">
        <h2 id="how-it-works">The loop, without the group chat</h2>
        <p className="how__intro">
          Interest is easy. A number you can act on is not. These three steps are the whole product — the rest is
          the money safety underneath them.
        </p>
        <ol className="how__list">
          {HOW_STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <li className="how__step" key={step.title}>
                <span className="how__icon" aria-hidden="true">
                  <Icon size={20} strokeWidth={2} />
                </span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="panel honest honest--split" aria-labelledby="limits">
        <div className="honest__col honest__col--does">
          <h2 id="limits">What the prototype does</h2>
          <ul className="honest__list">
            <li>
              <Check size={15} strokeWidth={2.4} aria-hidden="true" /> Reads conditional interest into editable
              constraints with verbatim quotes.
            </li>
            <li>
              <Check size={15} strokeWidth={2.4} aria-hidden="true" /> Counts only confirmed preferences, and asks
              at most one question per person.
            </li>
            <li>
              <Check size={15} strokeWidth={2.4} aria-hidden="true" /> Freezes one offer and binds each consent to
              its hash before PayPal.
            </li>
            <li>
              <Check size={15} strokeWidth={2.4} aria-hidden="true" /> Captures only when every authorization is
              valid and the minimum is met.
            </li>
          </ul>
        </div>
        <div className="honest__col honest__col--doesnt">
          <h2>What it does not do</h2>
          <ul className="honest__list">
            <li>
              <X size={15} strokeWidth={2.4} aria-hidden="true" /> Move real money: sandbox, or a simulated
              adapter labelled everywhere.
            </li>
            <li>
              <X size={15} strokeWidth={2.4} aria-hidden="true" /> Email anyone, or read private chats, calendars or
              inboxes.
            </li>
            <li>
              <X size={15} strokeWidth={2.4} aria-hidden="true" /> Let a model confirm a preference, decide who
              attends, or touch a payment.
            </li>
            <li>
              <X size={15} strokeWidth={2.4} aria-hidden="true" /> Treat a returned PayPal tab or a clicked button
              as money received.
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
