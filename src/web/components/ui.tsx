/* ==========================================================================
   Small, boring, accessible building blocks shared by every screen.

   Accessibility rules this file keeps:
   - every field has a real <label for>; hints and errors are linked with
     aria-describedby, invalid fields carry aria-invalid;
   - a submit failure renders an error summary that receives focus and links to
     the offending field;
   - every status colour is paired with a word (never colour-only);
   - controls are at least 44px tall and text is at least 16px.
   ========================================================================== */

import {
  useEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import type { AuditView } from '../../shared/api.js';
import { countdownFor, type Tone } from '../lib/format.js';
import { useI18n } from '../lib/i18n.js';

/* -------------------------------- badges --------------------------------- */

export function StatusBadge({ tone, word }: { tone: Tone; word: string }) {
  return (
    <span className={`badge badge--${tone}`}>
      <span className="badge__dot" aria-hidden="true" />
      {word}
    </span>
  );
}

/* ------------------------------- page header ----------------------------- */

export function PageHeader({
  eyebrow,
  title,
  intro,
  actions,
  children,
}: {
  eyebrow?: string;
  title: string;
  intro?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="page-head">
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <div className="page-head__row">
        <div>
          <h1>{title}</h1>
          {intro ? <p className="lede">{intro}</p> : null}
        </div>
        {actions ? <div className="page-head__actions">{actions}</div> : null}
      </div>
      {children}
    </header>
  );
}

/* ------------------------------ error summary ---------------------------- */

export interface SummaryError {
  field: string;
  message: string;
}

export function ErrorSummary({ errors, title }: { errors: SummaryError[]; title?: string }) {
  const { t } = useI18n();
  const resolvedTitle = title ?? t('common.errorTitle');
  const ref = useRef<HTMLDivElement>(null);
  const count = errors.length;
  useEffect(() => {
    if (count > 0) ref.current?.focus();
  }, [count]);
  if (count === 0) return null;
  return (
    <div className="error-summary" role="alert" tabIndex={-1} ref={ref}>
      <h2 className="error-summary__title">{resolvedTitle}</h2>
      <ul>
        {errors.map((error, index) => (
          <li key={`${error.field}-${index}`}>
            <a href={`#${error.field}`}>{error.message}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* --------------------------------- notices -------------------------------- */

export function InlineNotice({
  kind = 'info',
  title,
  children,
}: {
  kind?: 'info' | 'warn' | 'error' | 'success';
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className={`notice notice--${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {title ? <p className="notice__title">{title}</p> : null}
      <div className="notice__body">{children}</div>
    </div>
  );
}

/* --------------------------------- fields --------------------------------- */

interface FieldChrome {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  hideLabel?: boolean;
}

function FieldLabel({ chrome }: { chrome: FieldChrome }) {
  const { t } = useI18n();
  return (
    <label className={chrome.hideLabel ? 'field__label visually-hidden' : 'field__label'} htmlFor={chrome.id}>
      {chrome.label}
      {chrome.required ? <span className="field__required"> {t('common.required')}</span> : null}
    </label>
  );
}

function describedBy(chrome: FieldChrome): string | undefined {
  if (chrome.hint && chrome.error) return `${chrome.id}-hint ${chrome.id}-error`;
  if (chrome.hint) return `${chrome.id}-hint`;
  if (chrome.error) return `${chrome.id}-error`;
  return undefined;
}

function FieldMessages({ chrome }: { chrome: FieldChrome }) {
  return (
    <>
      {chrome.hint ? (
        <p className="field__hint" id={`${chrome.id}-hint`}>
          {chrome.hint}
        </p>
      ) : null}
      {chrome.error ? (
        <p className="field__error" id={`${chrome.id}-error`}>
          {chrome.error}
        </p>
      ) : null}
    </>
  );
}

type TextFieldProps = { chrome: FieldChrome } & Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'required'>;

export function TextField({ chrome, ...props }: TextFieldProps) {
  return (
    <div className={`field${chrome.error ? ' field--invalid' : ''}`}>
      <FieldLabel chrome={chrome} />
      <input
        {...props}
        id={chrome.id}
        className="input"
        required={chrome.required}
        aria-describedby={describedBy(chrome)}
        aria-invalid={chrome.error ? true : undefined}
      />
      <FieldMessages chrome={chrome} />
    </div>
  );
}

export function TextAreaField({
  chrome,
  ...props
}: { chrome: FieldChrome } & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id' | 'required'>) {
  return (
    <div className={`field${chrome.error ? ' field--invalid' : ''}`}>
      <FieldLabel chrome={chrome} />
      <textarea
        {...props}
        id={chrome.id}
        className="input input--textarea"
        required={chrome.required}
        aria-describedby={describedBy(chrome)}
        aria-invalid={chrome.error ? true : undefined}
      />
      <FieldMessages chrome={chrome} />
    </div>
  );
}

export function SelectField({
  chrome,
  children,
  ...props
}: { chrome: FieldChrome } & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'required'>) {
  return (
    <div className={`field${chrome.error ? ' field--invalid' : ''}`}>
      <FieldLabel chrome={chrome} />
      <select
        {...props}
        id={chrome.id}
        className="input input--select"
        required={chrome.required}
        aria-describedby={describedBy(chrome)}
        aria-invalid={chrome.error ? true : undefined}
      >
        {children}
      </select>
      <FieldMessages chrome={chrome} />
    </div>
  );
}

export function CheckboxField({
  id,
  label,
  hint,
  error,
  checked,
  onChange,
  description,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: ReactNode;
}) {
  return (
    <div className={`field field--checkbox${error ? ' field--invalid' : ''}`}>
      <div className="checkbox-row">
        <input
          id={id}
          type="checkbox"
          className="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          aria-describedby={hint ? `${id}-hint` : undefined}
          aria-invalid={error ? true : undefined}
        />
        <label className="field__label field__label--inline" htmlFor={id}>
          {label}
        </label>
      </div>
      {description ? <div className="checkbox-row__description">{description}</div> : null}
      {hint ? (
        <p className="field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
      {error ? <p className="field__error">{error}</p> : null}
    </div>
  );
}

/* ---------------------------------- quote -------------------------------- */

export function Quote({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <figure className="quote">
      {label ? <figcaption className="quote__label">{label}</figcaption> : null}
      <blockquote className="quote__text">
        <span className="quote__mark" aria-hidden="true">
          “
        </span>
        {children}
        <span className="quote__mark" aria-hidden="true">
          ”
        </span>
      </blockquote>
    </figure>
  );
}

/* --------------------------------- terms --------------------------------- */

export function TermsList({ rows }: { rows: Array<{ label: string; value: string }> }) {
  return (
    <dl className="terms-list">
      {rows.map((row) => (
        <div className="terms-list__row" key={row.label}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* --------------------------------- states -------------------------------- */

export function EmptyState({
  title,
  children,
  action,
  level = 2,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  level?: 1 | 2;
}) {
  const Heading = level === 1 ? 'h1' : 'h2';
  return (
    <section className="empty" aria-live="polite">
      <Heading className="empty__title">{title}</Heading>
      {children ? <div className="empty__body">{children}</div> : null}
      {action ? <div className="empty__action">{action}</div> : null}
    </section>
  );
}

export function LoadingState({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <div className="loading" role="status" aria-live="polite">
      <span className="loading__spinner" aria-hidden="true" />
      {label ?? t('common.loading')}
    </div>
  );
}

export function LoadErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useI18n();
  return (
    <div className="empty" role="alert">
      <h2 className="empty__title">{t('common.loadErrorTitle')}</h2>
      <p className="empty__body">{message}</p>
      {onRetry ? (
        <button type="button" className="btn btn-secondary" onClick={onRetry}>
          {t('common.tryAgain')}
        </button>
      ) : null}
    </div>
  );
}

/* ------------------------------- countdown ------------------------------- */

export function Countdown({
  deadlineUtc,
  serverNowUtc,
  fetchedAtMs,
}: {
  deadlineUtc: string | null;
  serverNowUtc: string | null;
  fetchedAtMs: number;
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((value) => value + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const { t } = useI18n();
  const view = countdownFor(deadlineUtc, serverNowUtc, fetchedAtMs);
  void tick;
  return (
    <span className={`countdown${view.expired ? ' countdown--expired' : ''}`} aria-live="polite">
      <span className="countdown__label">
        {view.expired ? t('shell.countdown.closed') : t('shell.countdown.closes')}
      </span>
      {view.expired ? null : <strong className="countdown__value">{view.label}</strong>}
    </span>
  );
}

/* ------------------------------ audit trail ------------------------------ */

export function AuditTrail({ events }: { events: AuditView[] }) {
  const { t } = useI18n();
  if (events.length === 0) return null;
  return (
    <details className="audit">
      <summary className="audit__summary">{t('common.auditSummary', { count: events.length })}</summary>
      <ol className="audit__list">
        {events.map((event) => (
          <li key={event.id} className="audit__item">
            <span className="audit__time">{event.createdAtLabel}</span>
            <span className="audit__actor">{event.actorRef}</span>
            <span className="audit__summary-text">{event.summary}</span>
          </li>
        ))}
      </ol>
    </details>
  );
}

/* ------------------------------- fingerprint ----------------------------- */

export function Fingerprint({ shortHash, fullHash }: { shortHash: string; fullHash: string }) {
  const { t } = useI18n();
  return (
    <p className="fingerprint">
      <span className="fingerprint__label">{t('common.fingerprintLabel')}</span>
      <code title={fullHash}>{shortHash}</code>
      <span className="fingerprint__hint">{t('common.fingerprintHint')}</span>
    </p>
  );
}

/* ------------------------------ helper hooks ----------------------------- */

/** Generate a stable id for a field when the page does not hand one in. */
export function useFieldId(prefix: string): string {
  return `${prefix}-${useId().replace(/:/g, '')}`;
}
