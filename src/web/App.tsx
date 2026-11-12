import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Shell } from './components/Shell';
import { AppStateProvider } from './lib/store';
import Landing from './pages/Landing';
import NotFound from './pages/NotFound';
import OrganizerFunding from './pages/OrganizerFunding';
import OrganizerOffer from './pages/OrganizerOffer';
import OrganizerPlan from './pages/OrganizerPlan';
import OrganizerResult from './pages/OrganizerResult';
import OrganizerSetup from './pages/OrganizerSetup';
import ParticipantAuthorize from './pages/ParticipantAuthorize';
import ParticipantClarify from './pages/ParticipantClarify';
import ParticipantLink from './pages/ParticipantLink';
import ParticipantPreferences from './pages/ParticipantPreferences';

/**
 * The eight product screens, the landing page and the participant token route.
 * Everything shares one AppState snapshot from <AppStateProvider>.
 */
export default function App() {
  return (
    <BrowserRouter>
      <AppStateProvider>
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
      </AppStateProvider>
    </BrowserRouter>
  );
}
