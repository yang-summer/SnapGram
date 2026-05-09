import type { ReactNode } from 'react';
import RouteErrorState from '~/components/feedback/route-error-state';
import PostDetailsRouteView, {
  PostDetailsPageShell,
} from '~/features/post/components/PostDetailsRouteView';
import { useIsPostDetailModalActive } from '~/features/post/lib/post-detail-modal-runtime';
import { useNavigate, useParams } from 'react-router';
import type { Route } from './+types/postDetails';

export default function PostDetails() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isModal = useIsPostDetailModalActive();

  if (!id) {
    throw new Error('PostDetails route requires a post id.');
  }

  function handleClose() {
    void navigate(-1);
  }

  return (
    <PostDetailsRouteView
      postId={id}
      isModal={isModal}
      onClose={handleClose}
      onDeleteSuccess={handleClose}
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
