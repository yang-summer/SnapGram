import { useOutletContext } from 'react-router';
import ProfileFeedTabContent, {
  type ProfileFeedTabContentCopy,
} from '~/features/profile/components/ProfileFeedTabContent';
import { useProfileInfiniteFeedState } from '~/features/profile/hooks/useProfileInfiniteFeedState';
import type { ProfileRouteOutletContext } from '~/features/profile/types/profile-route.type';
import { useProfilePostsInfiniteQuery } from '~/features/post/queries/post.queries';

function getProfilePostsTabCopy(
  isOwner: boolean,
  profileName: string,
): ProfileFeedTabContentCopy {
  const normalizedProfileName = profileName.trim();
  const visitorProfileLabel =
    normalizedProfileName.length > 0 ? normalizedProfileName : 'This profile';

  return {
    loadingTitle: isOwner ? 'Loading your posts' : 'Loading posts',
    loadingDescription: isOwner
      ? 'Please wait while we load your latest published posts.'
      : "Please wait while we load this profile's published posts.",
    errorTitle: isOwner
      ? 'Failed to load your posts'
      : "Failed to load this profile's posts",
    emptyTitle: isOwner ? 'No posts yet' : 'No published posts yet',
    emptyDescription: isOwner
      ? 'Publish your first post to start building your profile.'
      : `${visitorProfileLabel} has not published any posts yet.`,
    endReachedMessage: isOwner
      ? 'You have reached the end of your posts.'
      : "You have reached the end of this profile's posts.",
  };
}

export default function ProfilePosts() {
  const { profileId, isOwner, profileName } =
    useOutletContext<ProfileRouteOutletContext>();
  const profilePostsQuery = useProfilePostsInfiniteQuery(profileId);
  const state = useProfileInfiniteFeedState({
    query: profilePostsQuery,
  });
  const copy = getProfilePostsTabCopy(isOwner, profileName);

  return <ProfileFeedTabContent state={state} copy={copy} className="w-full" />;
}
