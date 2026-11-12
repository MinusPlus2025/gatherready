/* ==========================================================================
   Presence of the PayPall wordmark/button.

   Two visually distinct modes, on purpose:
   - sandbox: the official PayPal checkout button look (gold pill, two-tone
     wordmark) — we are about to hand the participant to PayPal.
   - simulated: a neutral, dashed stand-in. It never uses PayPal branding,
     because no PayPal account is contacted and pretending otherwise would be a
     fake money claim.
   ========================================================================== */

import { useI18n } from '../lib/i18n.js';

export function PaypalButton({
  simulated,
  amountLabel,
  disabled,
  busy,
  onClick,
}: {
  simulated: boolean;
  amountLabel: string;
  disabled: boolean;
  busy: boolean;
  onClick: () => void;
}) {
  const { t } = useI18n();
  if (simulated) {
    return (
      <button
        type="button"
        className="paypal-sim"
        onClick={onClick}
        disabled={disabled || busy}
        aria-describedby="paypal-sim-note"
      >
        <span className="paypal-sim__label">
          {busy ? t('pay.paypal.checking') : t('pay.paypal.simulated')}
        </span>
        <span className="paypal-sim__amount">
          {busy ? t('pay.paypal.recording') : t('pay.paypal.authorizeSim', { amount: amountLabel })}
        </span>
      </button>
    );
  }
  return (
    <button
      type="button"
      className="paypal-button"
      onClick={onClick}
      disabled={disabled || busy}
      aria-label={busy ? t('pay.paypal.openingAria') : t('pay.paypal.continue', { amount: amountLabel })}
    >
      <span className="paypal-wordmark" aria-hidden="true">
        <span className="paypal-wordmark__pay">Pay</span>
        <span className="paypal-wordmark__pal">Pal</span>
      </span>
      <span className="paypal-button__amount">{busy ? t('pay.paypal.opening') : amountLabel}</span>
    </button>
  );
}
