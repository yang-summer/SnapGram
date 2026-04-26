import { useOutletContext } from 'react-router';
import ProfileFeedTabContent, {
  type ProfileFeedTabContentCopy,
} from '~/features/profile/components/ProfileFeedTabContent';
import { useProfileInfiniteFeedState } from '~/features/profile/hooks/useProfileInfiniteFeedState';
import type { ProfileRouteOutletContext } from '~/features/profile/types/profile-route.type';
import { useProfileLikedFeedInfiniteQuery } from '~/features/post/queries/post.engagement.queries';

function getProfileLikedTabCopy(
  isOwner: boolean,
  profileName: string,
): ProfileFeedTabContentCopy {
  const normalizedProfileName = profileName.trim();
  const visitorProfileLabel =
    normalizedProfileName.length > 0 ? normalizedProfileName : 'This profile';

  return {
    loadingTitle: isOwner ? 'Loading your liked posts' : 'Loading liked posts',
    loadingDescription: isOwner
      ? 'Please wait while we load your most recently liked posts.'
      : `Please wait while we load liked posts for ${visitorProfileLabel}.`,
    errorTitle: isOwner
      ? 'Failed to load your liked posts'
      : `Failed to load liked posts for ${visitorProfileLabel}`,
    emptyTitle: isOwner ? 'No liked posts yet' : 'No liked posts yet',
    emptyDescription: isOwner
      ? 'Like posts to keep track of the content you enjoyed most.'
      : `${visitorProfileLabel} has not liked any posts yet.`,
    endReachedMessage: isOwner
      ? 'You have reached the end of your liked posts.'
      : `You have reached the end of liked posts for ${visitorProfileLabel}.`,
  };
}

export default function ProfileLiked() {
  const { profileId, isOwner, profileName } =
    useOutletContext<ProfileRouteOutletContext>();
  const profileLikedFeedQuery = useProfileLikedFeedInfiniteQuery(profileId);
  const state = useProfileInfiniteFeedState({
    query: profileLikedFeedQuery,
  });
  const copy = getProfileLikedTabCopy(isOwner, profileName);

  return <ProfileFeedTabContent state={state} copy={copy} className="w-full" />;
}
