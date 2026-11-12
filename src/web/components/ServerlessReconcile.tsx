import { useEffect, useId, useRef, useState } from 'react';
import { api, describeError } from '../lib/api';
import { useApp } from '../lib/store';
import './serverless-reconcile.css';

export function ReconcilePanel({ busy, acknowledged, onAcknowledge, onConfirm, message, error }: {
  busy: boolean; acknowledged: boolean; onAcknowledge(value: boolean): void;
  onConfirm(): void; message: string; error: string;
}) {
  const id = useId();
  return <section className="reconcile-panel" aria-labelledby={`${id}-title`} aria-busy={busy}>
    <div className="reconcile-panel__intro">
      <span className="reconcile-panel__eyebrow">Preview operating mode</span>
      <h2 id={`${id}-title`}>You control payment follow-up</h2>
      <p>No automatic deadline processing runs on this preview. Opening or refreshing a page does not collect money.</p>
    </div>
    <details className="reconcile-panel__action">
      <summary>Check and finish pending payments</summary>
      <p id={`${id}-help`}>This can finish an already approved collection, release expired holds, or complete a pending refund for this workshop. It does not start a new collection. Uncertain results remain pending or require manual review.</p>
      <label className="reconcile-panel__consent"><input type="checkbox" checked={acknowledged} disabled={busy} onChange={e=>onAcknowledge(e.target.checked)} />I understand that this action can complete pending payment operations.</label>
      <button type="button" className="button button--secondary" disabled={!acknowledged || busy} aria-describedby={`${id}-help`} onClick={onConfirm}>{busy ? 'Checking payment records…' : 'Check and finish pending payments'}</button>
      <p role="status" aria-live="polite">{message}</p>
      {error && <p role="alert">{error}</p>}
    </details>
  </section>;
}

export function ServerlessReconcile() {
  const { state, token, refresh } = useApp();
  const inFlight = useRef(false);
  const [enabled,setEnabled] = useState(false);
  const [busy,setBusy] = useState(false);
  const [acknowledged,setAcknowledged] = useState(false);
  const [message,setMessage] = useState('');
  const [error,setError] = useState('');
  useEffect(()=>{
    const controller=new AbortController();
    fetch('/healthz',{signal:controller.signal,cache:'no-store',credentials:'same-origin'})
      .then(r=>r.ok?r.json():null).then(data=>setEnabled(data?.settlementMode==='organizer-triggered-reconciliation'))
      .catch(()=>{});
    return ()=>controller.abort();
  },[]);
  useEffect(()=>{setAcknowledged(false);setMessage('');setError('');},[state?.workshop?.id]);
  if (!enabled || state?.session.role!=='organizer' || !state.workshop || !state.offer) return null;
  async function reconcile() {
    if (!acknowledged || busy || inFlight.current || !state?.workshop) return;
    inFlight.current=true;
    setBusy(true);setMessage('');setError('');
    try {
      await api.reconcileWorkshop(state.workshop.id,token);
      await refresh();
      setMessage('Payment check finished. Review the updated statuses below; this does not mean every payment succeeded.');
      setAcknowledged(false);
    } catch(err) {
      setError(`The check could not be confirmed: ${describeError(err)} Payment outcomes may still be pending. Review the current status before trying again.`);
    } finally {inFlight.current=false;setBusy(false);}
  }
  return <ReconcilePanel busy={busy} acknowledged={acknowledged} onAcknowledge={setAcknowledged} onConfirm={reconcile} message={message} error={error}/>;
}
