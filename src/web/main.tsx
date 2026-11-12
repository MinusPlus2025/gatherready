import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { I18nProvider, loadDictionary, readStoredLocale } from './lib/i18n';
import '@fontsource-variable/inter';
import '@fontsource-variable/fraunces';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('GatherReady: #root element is missing from index.html');

async function start(): Promise<void> {
  const stored = readStoredLocale();
  const initialLocale = stored ?? 'en';
  // A returning visitor who chose a lazily-loaded language should not see an
  // English flash: load that dictionary before the first render.
  const initialDictionary = await loadDictionary(initialLocale).catch(() => undefined);
  createRoot(container!).render(
    <StrictMode>
      <I18nProvider initialLocale={initialLocale} initialDictionary={initialDictionary}>
        <App />
      </I18nProvider>
    </StrictMode>,
  );
}

void start();
