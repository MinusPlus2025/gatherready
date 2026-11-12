import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Shell } from './components/Shell';
import { useI18n } from './lib/i18n';
import { AppStateProvider } from './lib/store';
import Landing from './pages/Landing';

/* The landing ships eagerly; every other screen is its own chunk so a first
   visit does not download the whole product before painting. */
const OrganizerFunding = lazy(() => import('./pages/OrganizerFunding'));
const OrganizerOffer = lazy(() => import('./pages/OrganizerOffer'));
const OrganizerPlan = lazy(() => import('./pages/OrganizerPlan'));
const OrganizerResult = lazy(() => import('./pages/OrganizerResult'));
const OrganizerSetup = lazy(() => import('./pages/OrganizerSetup'));
const ParticipantAuthorize = lazy(() => import('./pages/ParticipantAuthorize'));
const ParticipantClarify = lazy(() => import('./pages/ParticipantClarify'));
const ParticipantLink = lazy(() => import('./pages/ParticipantLink'));
const ParticipantPreferences = lazy(() => import('./pages/ParticipantPreferences'));
const NotFound = lazy(() => import('./pages/NotFound'));

function RouteFallback() {
  const { t } = useI18n();
  return (
    <div className="route-loading" role="status" aria-live="polite">
      {t('common.loading')}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppStateProvider>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route element={<Shell />}>
              <Route index element={<Landing />} />
              <Route path="organizer/setup" element={<OrganizerSetup />} />
              <Route path="organizer/plan" element={<OrganizerPlan />} />
              <Route path="organizer/offer" element={<OrganizerOffer />} />
              <Route path="organizer/funding" element={<OrganizerFunding />} />
              <Route path="organizer/result" element={<OrganizerResult />} />
              <Route path="participant/preferences" element={<ParticipantPreferences />} />
              <Route path="participant/clarify" element={<ParticipantClarify />} />
              <Route path="participant/authorize" element={<ParticipantAuthorize />} />
              <Route path="p/:token" element={<ParticipantLink />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </Suspense>
      </AppStateProvider>
    </BrowserRouter>
  );
}
