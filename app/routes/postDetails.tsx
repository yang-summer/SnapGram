import RouteErrorState from '~/components/feedback/route-error-state';
import PostDetailsRouteView, {
  PostDetailsPageShell,
} from '~/features/post/components/PostDetailsRouteView';
import { useNavigate, useParams } from 'react-router';
import type { Route } from './+types/postDetails';

export default function PostDetails() {
  const navigate = useNavigate();
  const { id } = useParams();

  if (!id) {
    throw new Error('PostDetails route requires a post id.');
  }

  function handleDeleteSuccess() {
    void navigate(-1);
  }

  return (
    <PostDetailsRouteView
      postId={id}
      isModal={false}
      onClose={handleDeleteSuccess}
      onDeleteSuccess={handleDeleteSuccess}
    />
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return (
    <PostDetailsPageShell>
      <RouteErrorState error={error} className="px-0 py-4" />
    </PostDetailsPageShell>
  );
}
