import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui.js';
import { useI18n } from '../lib/i18n.js';

export default function NotFound() {
  const { t } = useI18n();
  return (
    <EmptyState
      title={t('notfound.title')}
      action={
        <Link className="btn btn-primary" to="/">
          {t('notfound.back')}
        </Link>
      }
    >
      <p>{t('notfound.body')}</p>
    </EmptyState>
  );
}
