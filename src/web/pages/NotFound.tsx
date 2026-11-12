import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui.js';

export default function NotFound() {
  return (
    <EmptyState
      title="That page does not exist"
      action={<Link className="btn btn-primary" to="/">Back to GatherReady</Link>}
    >
      <p>The link may be outdated. The demo views are listed in the footer.</p>
    </EmptyState>
  );
}
