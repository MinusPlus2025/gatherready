/* ==========================================================================
   Presence of the PayPall wordmark/button.

   Two visually distinct modes, on purpose:
   - sandbox: the official PayPal checkout button look (gold pill, two-tone
     wordmark) — we are about to hand the participant to PayPal.
   - simulated: a neutral, dashed stand-in. It never uses PayPal branding,
     because no PayPal account is contacted and pretending otherwise would be a
     fake money claim.
   ========================================================================== */

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
          {busy ? 'Checking with PayPal…' : 'Simulated PayPal — no real money'}
        </span>
        <span className="paypal-sim__amount">
          {busy ? 'Recording a sandbox stand-in' : `Authorize ${amountLabel} in the sandbox stand-in`}
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
      aria-label={busy ? 'Opening PayPal' : `Continue to PayPal to authorize ${amountLabel}`}
    >
      <span className="paypal-wordmark" aria-hidden="true">
        <span className="paypal-wordmark__pay">Pay</span>
        <span className="paypal-wordmark__pal">Pal</span>
      </span>
      <span className="paypal-button__amount">{busy ? 'Opening PayPal…' : amountLabel}</span>
    </button>
  );
}
