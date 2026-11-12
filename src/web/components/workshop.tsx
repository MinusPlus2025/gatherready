/* ==========================================================================
   Shared IA components: computed status band, three separate progress rails,
   the role-aware four-step status line, the candidate matrix (desktop table,
   phone cards), participant avatars and a disclosure wrapper for technical
   detail.

   These exist so the home screens state what is true instead of stacking cards.
   ========================================================================== */

import { useState, type ReactNode } from 'react';
import { Check, ChevronDown, Minus, X } from 'lucide-react';
import type { AppState, ClarificationView, PreferenceView } from '../../shared/api.js';
import { useI18n } from '../lib/i18n.js';
import { splitCount, useAnimatedNumber, useChangedFlag } from '../lib/motion.js';
import {
  organizerRails,
  type CellState,
  type MatrixRow,
  type OrganizerRails,
  type ParticipantStep,
  type StatusBandModel,
} from '../lib/status.js';

/* -------------------------------- status -------------------------------- */

export function StatusBand({ model }: { model: StatusBandModel }) {
  const { t } = useI18n();
  return (
    <section
      key={model.headline}
      className={`status-band status-band--${model.tone} status-band--enter`}
      aria-live="polite"
      aria-label={t('workshop.statusAria')}
    >
      <div className="status-band__body">
        <p className="status-band__headline">{model.headline}</p>
        <p className="status-band__detail">{model.detail}</p>
      </div>
    </section>
  );
}

function Rail({ label, value, detail, ok }: { label: string; value: string; detail: string; ok: boolean }) {
  const parsed = splitCount(value);
  const current = useAnimatedNumber(parsed ? parsed.current : 0);
  const display = parsed ? `${current}${parsed.total}` : value;
  const changed = useChangedFlag(value);
  return (
    <div className={`rail${ok ? ' rail--ok' : ''}${changed ? ' rail--changed' : ''}`}>
      <dt>{label}</dt>
      <dd className="rail__value">{display}</dd>
      <dd className="rail__detail">{detail}</dd>
    </div>
  );
}

export function Rails({ rails }: { rails: OrganizerRails }) {
  const { t } = useI18n();
  return (
    <dl className="rails" aria-label={t('workshop.railsAria')}>
      <Rail label={t('workshop.rail.match')} value={rails.match.value} detail={rails.match.detail} ok={rails.match.ok} />
      <Rail label={t('workshop.rail.terms')} value={rails.terms.value} detail={rails.terms.detail} ok={rails.terms.ok} />
      <Rail
        label={t('workshop.rail.authorization')}
        value={rails.authorization.value}
        detail={rails.authorization.detail}
        ok={rails.authorization.ok}
      />
    </dl>
  );
}

export function ParticipantSteps({ steps }: { steps: ParticipantStep[] }) {
  const { t } = useI18n();
  return (
    <ol className="steps-line" aria-label={t('workshop.stepsAria')}>
      {steps.map((step, index) => (
        <li key={step.key} className={`steps-line__item steps-line__item--${step.state}`}>
          <span className="steps-line__num" aria-hidden="true">
            {step.state === 'done' ? <Check size={13} strokeWidth={3} /> : index + 1}
          </span>
          <span className="steps-line__text">
            <span className="steps-line__label">{step.label}</span>
            <span className="steps-line__detail">{step.detail}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/* -------------------------------- disclosure ---------------------------- */

export function Disclosure({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="disclosure">
      <summary className="disclosure__summary">
        <span>{summary}</span>
        <ChevronDown size={16} strokeWidth={2} aria-hidden="true" />
      </summary>
      <div className="disclosure__body">{children}</div>
    </details>
  );
}

/* --------------------------------- avatars ------------------------------- */

const STATE_KEY: Record<CellState, string> = {
  accepted: 'workshop.state.accepted',
  preferred: 'workshop.state.preferred',
  conditional: 'workshop.state.conditional',
  cannot: 'workshop.state.cannot',
  unknown: 'workshop.state.unknown',
};

export function Avatar({ name, state }: { name: string; state: CellState }) {
  const { t } = useI18n();
  const changed = useChangedFlag(state);
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className={`avatar avatar--${state}${changed ? ' avatar--pulse' : ''}`} title={`${name} — ${t(STATE_KEY[state])}`}>
      <span className="avatar__initials" aria-hidden="true">
        {initials}
      </span>
      <span className="avatar__state" aria-hidden="true">
        {state === 'accepted' || state === 'preferred' ? (
          <Check size={9} strokeWidth={3.4} />
        ) : state === 'conditional' ? (
          <Minus size={9} strokeWidth={3.4} />
        ) : state === 'cannot' ? (
          <X size={9} strokeWidth={3.4} />
        ) : null}
      </span>
      <span className="visually-hidden">
        {name}: {t(STATE_KEY[state])}
      </span>
    </span>
  );
}

/* --------------------------------- matrix -------------------------------- */

export interface ExplainPanelProps {
  row: MatrixRow;
  state: AppState;
  preferences: PreferenceView[];
  clarifications: ClarificationView[];
  onAsk: (participantId: string) => void;
  asking: boolean;
  onOpenParticipant: (participantId: string) => void;
}

function ExpandDetail({ row, state, preferences, clarifications, onAsk, asking, onOpenParticipant }: ExplainPanelProps) {
  const { t } = useI18n();
  const workshop = state.workshop;
  const suggestion = state.plan?.suggestion;
  return (
    <div className="matrix-explain">
      <ul className="matrix-explain__people">
        {row.cells.map((cell) => {
          const preference = preferences.find((p) => p.participantId === cell.participantId);
          const condition = preference?.conditions.find((c) => c.slotId === row.slotId);
          const clarification = clarifications.find(
            (c) => c.participantId === cell.participantId && c.slotId === row.slotId,
          );
          const isSuggested = suggestion?.participantId === cell.participantId && suggestion?.slotId === row.slotId;
          if (cell.state === 'unknown' || cell.state === 'cannot') return null;
          return (
            <li key={cell.participantId} className={`matrix-person matrix-person--${cell.state}`}>
              <Avatar name={cell.name} state={cell.state} />
              <div className="matrix-person__body">
                <p className="matrix-person__head">
                  <strong>{cell.name}</strong>
                  <span className={`matrix-state matrix-state--${cell.state}`}>{t(STATE_KEY[cell.state])}</span>
                </p>
                {condition ? (
                  <>
                    <p className="matrix-person__condition">{t('workshop.condition')} “{condition.condition}”</p>
                    <p className="matrix-person__quote">{t('workshop.theirWords')} “{condition.sourceQuote}”</p>
                  </>
                ) : (
                  <p className="matrix-person__quote">
                    {cell.state === 'accepted' || cell.state === 'preferred'
                      ? t('workshop.noCondition')
                      : t('workshop.noConstraint')}
                  </p>
                )}
                <p className="matrix-person__meta">
                  {t('workshop.aiCard')}:{' '}
                  {preference?.extractionMode === 'live'
                    ? t('workshop.ai.live')
                    : preference?.extractionMode === 'recorded'
                      ? t('workshop.ai.recorded')
                      : t('workshop.ai.structured')}
                  {clarification ? ` · ${t('workshop.questionStatus', { status: clarification.status.replace('ANSWERED_', 'answered ') })}` : ''}
                </p>
              </div>
              <div className="matrix-person__actions">
                {isSuggested && (clarification?.status === 'PROPOSED' || clarification?.status === 'SENT') ? (
                  <span className="muted">{t('workshop.questionSent')}</span>
                ) : isSuggested ? (
                  <button type="button" className="btn btn-small btn-primary" disabled={asking} onClick={() => onAsk(cell.participantId)}>
                    {asking ? t('workshop.preparing') : t('workshop.askOne')}
                  </button>
                ) : null}
                {cell.state === 'conditional' || cell.state === 'accepted' || cell.state === 'preferred' ? (
                  <button type="button" className="btn btn-small btn-ghost" onClick={() => onOpenParticipant(cell.participantId)}>
                    {t('workshop.openTheirView')}
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      {row.meetsMinimum ? (
        <p className="matrix-explain__note">
          {t('workshop.meetsNote', { min: workshop?.minParticipants ?? 0 })}
        </p>
      ) : (
        <p className="matrix-explain__note">
          {t('workshop.fitsNote', { fits: row.fits, ceiling: row.ceiling })}
        </p>
      )}
    </div>
  );
}

export function SlotMatrix({
  rows,
  state,
  onAsk,
  asking,
  onOpenParticipant,
}: {
  rows: MatrixRow[];
  state: AppState;
  onAsk: (participantId: string) => void;
  asking: boolean;
  onOpenParticipant: (participantId: string) => void;
}) {
  const { t } = useI18n();
  const [openRow, setOpenRow] = useState<string | null>(null);
  const participants = (state.participants ?? []).slice().sort((a, b) => a.displayName.localeCompare(b.displayName));
  const preferences = state.preferences ?? [];
  const clarifications = state.clarifications ?? [];
  const toggle = (slotId: string) => setOpenRow((current) => (current === slotId ? null : slotId));

  if (rows.length === 0) return null;

  return (
    <div className="matrix">
      <div className="matrix__head">
        <h2>{t('workshop.matrix.title')}</h2>
        <p className="muted">{t('workshop.matrix.intro')}</p>
        <p className="matrix__legend">
          <span className="legend-item legend-item--accepted">✓ {t('workshop.legend.accepted')}</span>
          <span className="legend-item legend-item--preferred">✓ {t('workshop.legend.preferred')}</span>
          <span className="legend-item legend-item--conditional">◐ {t('workshop.legend.conditional')}</span>
          <span className="legend-item legend-item--unknown">{t('workshop.legend.unknown')}</span>
          <span className="legend-item legend-item--cannot">✕ {t('workshop.legend.cannot')}</span>
        </p>
      </div>

      {/* desktop: compact date × participant table */}
      <table className="matrix-table">
        <caption className="visually-hidden">{t('workshop.matrix.caption')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('workshop.matrix.time')}</th>
            {participants.map((participant) => (
              <th key={participant.id} scope="col">
                <span className="matrix-table__name">{participant.displayName}</span>
              </th>
            ))}
            <th scope="col">{t('workshop.matrix.confirmed')}</th>
            <th scope="col">{t('workshop.matrix.ceiling')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <>
              <tr
                key={row.slotId}
                className={`matrix-table__row${row.meetsMinimum ? ' matrix-table__row--ok' : ''}${openRow === row.slotId ? ' matrix-table__row--open' : ''}`}
              >
                <th scope="row">
                  <button type="button" className="matrix-row-button" aria-expanded={openRow === row.slotId} onClick={() => toggle(row.slotId)}>
                    <span className="matrix-row-button__label">{row.shortLabel}</span>
                    <ChevronDown size={14} strokeWidth={2} aria-hidden="true" className="matrix-row-button__chevron" />
                  </button>
                </th>
                {row.cells.map((cell) => (
                  <td key={cell.participantId}>
                    <Avatar name={cell.name} state={cell.state} />
                  </td>
                ))}
                <td className="matrix-table__num">
                  <strong>{row.fits}</strong>
                  {row.isSelectedOfferSlot ? <span className="matrix-chip">{t('workshop.selected')}</span> : null}
                </td>
                <td className="matrix-table__num">{row.ceiling}</td>
              </tr>
              <tr
                key={`${row.slotId}-detail`}
                className={`matrix-table__detail${openRow === row.slotId ? ' matrix-table__detail--open' : ''}`}
                aria-hidden={openRow !== row.slotId}
                inert={openRow !== row.slotId ? true : undefined}
              >
                <td colSpan={participants.length + 3}>
                  <div className="matrix-detail">
                    <div className="matrix-detail__inner">
                      <ExpandDetail
                        row={row}
                        state={state}
                        preferences={preferences}
                        clarifications={clarifications}
                        onAsk={onAsk}
                        asking={asking}
                        onOpenParticipant={onOpenParticipant}
                      />
                    </div>
                  </div>
                </td>
              </tr>
            </>
          ))}
        </tbody>
      </table>

      {/* phone: one card per candidate, expand in place */}
      <ul className="matrix-cards">
        {rows.map((row) => (
          <li key={row.slotId} className={`matrix-card${row.meetsMinimum ? ' matrix-card--ok' : ''}`}>
            <button type="button" className="matrix-card__button" aria-expanded={openRow === row.slotId} onClick={() => toggle(row.slotId)}>
              <span className="matrix-card__top">
                <span className="matrix-card__label">{row.shortLabel}</span>
                <ChevronDown size={16} strokeWidth={2} aria-hidden="true" />
              </span>
              <span className="matrix-card__avatars">
                {row.cells.map((cell) => (
                  <Avatar key={cell.participantId} name={cell.name} state={cell.state} />
                ))}
              </span>
              <span className="matrix-card__meta">
                {t('workshop.cardMeta', { fits: row.fits, ceiling: row.ceiling })}
                {row.meetsMinimum ? ` · ${t('workshop.meetsMinimum')}` : ''}
              </span>
            </button>
            <div
              className={`matrix-detail${openRow === row.slotId ? ' matrix-detail--open' : ''}`}
              aria-hidden={openRow !== row.slotId}
              inert={openRow !== row.slotId ? true : undefined}
            >
              <div className="matrix-detail__inner">
                <ExpandDetail
                  row={row}
                  state={state}
                  preferences={preferences}
                  clarifications={clarifications}
                  onAsk={onAsk}
                  asking={asking}
                  onOpenParticipant={onOpenParticipant}
                />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function railsFor(state: AppState): OrganizerRails {
  return organizerRails(state);
}
