import { Navigate, useLocation, useNavigate, useParams } from 'react-router';
import {
  buildStandalonePostHref,
  getContextualPostModalState,
  useContextualPostRoute,
} from '../lib/contextual-post-route';
import PostDetailsRouteView from './PostDetailsRouteView';

export default function ContextualPostDetailsRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const { postId } = useParams();
  const contextualPostRoute = useContextualPostRoute();

  if (!postId) {
    throw new Error('Contextual post route requires a post id.');
  }

  const modalState = getContextualPostModalState(location.state);
  const isValidModalNavigation =
    modalState?.source === contextualPostRoute.source &&
    modalState.contextId === contextualPostRoute.contextId;

  if (!isValidModalNavigation) {
    return <Navigate to={buildStandalonePostHref(postId)} replace />;
  }

  function handleClose() {
    void navigate(contextualPostRoute.closeTo, { replace: true });
  }

  return (
    <PostDetailsRouteView
      postId={postId}
      isModal
      onClose={handleClose}
      onDeleteSuccess={handleClose}
    />
  );
}
