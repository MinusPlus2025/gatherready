/* ==========================================================================
   /p/:token — a real participant link.

   The token is opaque. It is sent as ?ptoken= on the first state read (which
   binds the session cookie) and kept in sessionStorage so refresh and
   navigation do not lose the identity. This route then forwards to the one
   screen this person actually needs next.
   ========================================================================== */

import { Navigate, useParams } from 'react-router-dom';
import { LoadErrorState, LoadingState } from '../components/ui.js';
import { useApp } from '../lib/store.js';

export default function ParticipantLink() {
  const { state, loadError, refresh } = useApp();
  const { token } = useParams<{ token: string }>();

  if (!state) {
    if (loadError) {
      return (
        <LoadErrorState
          message={`${loadError} This link may have expired, or the session may belong to another participant.`}
          onRetry={() => void refresh()}
        />
      );
    }
    return <LoadingState label="Opening your invitation…" />;
  }

  const suffixParams = new URLSearchParams();
  if (token) suffixParams.set('ptoken', token);
  if (new URLSearchParams(window.location.search).get('mock') === '1') suffixParams.set('mock', '1');
  const suffix = suffixParams.size > 0 ? `?${suffixParams.toString()}` : '';

  const me = state.session.viewParticipantId;
  if (!me) {
    return <Navigate to={`/participant/preferences${suffix}`} replace />;
  }

  const openQuestion = state.clarifications.find(
    (clarification) => clarification.participantId === me && clarification.status === 'SENT',
  );
  if (openQuestion) {
    return <Navigate to={`/participant/clarify${suffix}`} replace />;
  }

  const myPayment = state.payments.find((payment) => payment.isMine);
  const needsAuthorization =
    Boolean(state.offer?.isOpen) &&
    Boolean(state.offer?.viewerIncluded) &&
    (!myPayment || myPayment.status === 'NONE' || myPayment.status === 'ORDER_CREATED' || myPayment.status === 'AUTHORIZING');
  if (needsAuthorization) {
    return <Navigate to={`/participant/authorize${suffix}`} replace />;
  }

  return <Navigate to={`/participant/preferences${suffix}`} replace />;
}
