import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui';
import { Search } from '../components/Icons';

export default function NotFound() {
  return (
    <div className="container">
      <EmptyState
        icon={<Search size={30} />}
        title="404 — Page not found"
        message="The page you are looking for does not exist or has moved."
        action={<Link to="/" className="btn btn-primary btn-lg">Back to home</Link>}
      />
    </div>
  );
}
