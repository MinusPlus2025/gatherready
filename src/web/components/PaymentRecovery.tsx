import { useState } from 'react';
import { useI18n } from '../lib/i18n.js';

/** Read-only recovery: never re-submit an uncertain payment. */
export function PaymentRecovery({ refresh }: { refresh: () => Promise<void> }) {
  const { t } = useI18n();
  const [checking, setChecking] = useState(false);
  async function check() {
    if (checking) return;
    setChecking(true);
    try { await refresh(); } finally { setChecking(false); }
  }
  return <div className="payment-recovery">
    <p>{t('flow.authorize.recovery.body')}</p>
    <button type="button" className="btn btn-secondary" aria-disabled={checking} aria-busy={checking} onClick={() => void check()}>
      {t(checking ? 'flow.authorize.recovery.busy' : 'flow.authorize.recovery.button')}
    </button>
  </div>;
}
