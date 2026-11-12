/* ==========================================================================
   Landing. Says what the product does in one sentence, who it is for, and what
   the prototype explicitly does not do (no real money, synthetic data). Links a
   reviewer straight to the two real surfaces.
   ========================================================================== */

import { Link } from 'react-router-dom';
import { formatCents } from '../lib/format';
import { useApp } from '../lib/store';
import { StatusBadge } from '../components/ui';

export default function Landing() {
  const { state } = useApp();
  const workshop = state?.workshop ?? null;

  return (
    <div className="landing">
      <section className="hero" aria-labelledby="hero-title">
        <p className="eyebrow">Consensus workshops · PayPal sandbox</p>
        <h1 id="hero-title">A workshop happens only when enough people actually say yes.</h1>
        <p className="hero__lede">
          GatherReady turns conditional interest — “Saturday morning, if materials are included” — into one
          fixed offer everyone can read, one optional question, and a PayPal authorization that is captured
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
        <p className="hero__fineprint">
          Sandbox prototype · no real money · synthetic demo data. No accounts, no emails, nothing to install.
        </p>
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

      <section className="steps" aria-labelledby="how-it-works">
        <h2 id="how-it-works">How the loop works</h2>
        <ol className="steps__list">
          <li className="step">
            <span className="step__number" aria-hidden="true">
              1
            </span>
            <h3>Collect conditional interest</h3>
            <p>
              People tick the times that work and write, in their own words, what has to be true. The result is
              a reviewable card — nothing counts until they press <strong>Confirm my preferences</strong>.
            </p>
          </li>
          <li className="step">
            <span className="step__number" aria-hidden="true">
              2
            </span>
            <h3>Ask one question, publish one offer</h3>
            <p>
              If a single merchant fact would close the gap, the organizer sends at most one yes/no question. Then
              they publish one fixed offer with an immutable fingerprint.
            </p>
          </li>
          <li className="step">
            <span className="step__number" aria-hidden="true">
              3
            </span>
            <h3>Authorize, then capture only if it is real</h3>
            <p>
              Each participant sees the whole offer, agrees in their own name, and authorizes the exact total
              with PayPal. The organizer captures only after the minimum is authorized.
            </p>
          </li>
        </ol>
      </section>

      <section className="panel honest" aria-labelledby="limits">
        <h2 id="limits">What this prototype does not do</h2>
        <ul className="check-list">
          <li>It does not move real money. It uses the PayPal sandbox or a simulated adapter, labelled everywhere.</li>
          <li>It does not create accounts or send email; participant links are opaque tokens.</li>
          <li>It does not let a model decide who attends, move money, or confirm on anyone’s behalf.</li>
          <li>It does not treat a clicked button as a payment. Every money state is read back from the server.</li>
        </ul>
      </section>
    </div>
  );
}
