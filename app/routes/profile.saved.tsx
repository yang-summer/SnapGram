import { useOutletContext } from 'react-router';
import ProfileFeedTabContent, {
  type ProfileFeedTabContentCopy,
} from '~/features/profile/components/ProfileFeedTabContent';
import { useProfileInfiniteFeedState } from '~/features/profile/hooks/useProfileInfiniteFeedState';
import type { ProfileRouteOutletContext } from '~/features/profile/types/profile-route.type';
import { useProfileSavedFeedInfiniteQuery } from '~/features/post/queries/post.engagement.queries';

function getProfileSavedTabCopy(
  isOwner: boolean,
  profileName: string,
): ProfileFeedTabContentCopy {
  const normalizedProfileName = profileName.trim();
  const visitorProfileLabel =
    normalizedProfileName.length > 0 ? normalizedProfileName : 'This profile';

  return {
    loadingTitle: isOwner ? 'Loading your saved posts' : 'Loading saved posts',
    loadingDescription: isOwner
      ? 'Please wait while we load your most recently saved posts.'
      : `Please wait while we load saved posts for ${visitorProfileLabel}.`,
    errorTitle: isOwner
      ? 'Failed to load your saved posts'
      : `Failed to load saved posts for ${visitorProfileLabel}`,
    emptyTitle: isOwner ? 'No saved posts yet' : 'No saved posts yet',
    emptyDescription: isOwner
      ? 'Save posts to revisit them later from your profile.'
      : `${visitorProfileLabel} has not saved any posts yet.`,
    endReachedMessage: isOwner
      ? 'You have reached the end of your saved posts.'
      : `You have reached the end of saved posts for ${visitorProfileLabel}.`,
  };
}

export default function ProfileSaved() {
  const { profileId, isOwner, profileName } =
    useOutletContext<ProfileRouteOutletContext>();
  const profileSavedFeedQuery = useProfileSavedFeedInfiniteQuery(profileId);
  const state = useProfileInfiniteFeedState({
    query: profileSavedFeedQuery,
  });
  const copy = getProfileSavedTabCopy(isOwner, profileName);

  return <ProfileFeedTabContent state={state} copy={copy} className="w-full" />;
}
