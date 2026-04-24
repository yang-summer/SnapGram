import PageEmptyState from '~/components/feedback/page-empty-state';
import PageErrorState from '~/components/feedback/page-error-state';
import PageLoadingState from '~/components/feedback/page-loading-state';
import RouteErrorState from '~/components/feedback/route-error-state';
import { useCurrentUserQuery } from '~/features/auth/queries/auth.queries';
import ProfileHeader, {
  getProfileDisplayName,
} from '~/features/profile/components/ProfileHeader';
import ProfileRouteGuard from '~/features/profile/components/ProfileRouteGuard';
import ProfileTabs from '~/features/profile/components/ProfileTabs';
import type { ProfileRouteOutletContext } from '~/features/profile/types/profile-route.type';
import { useProfileLikedCountQuery, useProfileSavedCountQuery } from '~/features/post/queries/post.engagement.queries';
import { useProfilePostCountQuery } from '~/features/post/queries/post.queries';
import { usePublicUserProfileQuery } from '~/features/user/queries/user.queries';
import { Outlet, useMatch, useParams } from 'react-router';
import type { Route } from './+types/profile';

type ProfilePageFrameProps = {
  children: React.ReactNode;
};

function ProfilePageFrame({ children }: ProfilePageFrameProps) {
  return (
    <div className="flex">
      <div className="flex flex-1 flex-col items-center overflow-scroll px-5 py-8 md:px-8 lg:px-10">
        <div className="w-full max-w-6xl">{children}</div>
      </div>
    </div>
  );
}

export default function Profile() {
  const { id } = useParams();

  if (!id) {
    throw new Error('Profile route requires a profile id.');
  }

  const profileId = id;
  const isSavedTab = !!useMatch('/profile/:id/saved');
  const isLikedTab = !!useMatch('/profile/:id/liked');
  const activeTab = isSavedTab ? 'saved' : isLikedTab ? 'liked' : 'posts';
  const { data: currentUserResult } = useCurrentUserQuery();
  const currentUser =
    currentUserResult?.status === 'authenticated' ? currentUserResult.user : null;
  const isOwner = currentUser?.profileId === profileId;
  const { data: profile, isPending, isError, error, refetch, isFetching } =
    usePublicUserProfileQuery(profileId);
  const { data: postsCount } = useProfilePostCountQuery(profileId);
  const { data: savedCount } = useProfileSavedCountQuery(profileId, {
    enabled: isOwner,
  });
  const { data: likedCount } = useProfileLikedCountQuery(profileId, {
    enabled: isOwner,
  });

  if (!currentUser) {
    return (
      <ProfilePageFrame>
        <PageLoadingState
          title="Loading profile"
          description="Please wait while we prepare this profile."
          className="px-0 py-4"
        />
      </ProfilePageFrame>
    );
  }

  if (isPending) {
    return (
      <ProfilePageFrame>
        <PageLoadingState
          title="Loading profile"
          description="Please wait while we load this profile."
          className="px-0 py-4"
        />
      </ProfilePageFrame>
    );
  }

  if (isError) {
    return (
      <ProfilePageFrame>
        <PageErrorState
          title="Failed to load this profile"
          description={error instanceof Error ? error.message : 'Please try again in a moment.'}
          onRetry={() => void refetch()}
          isRetrying={isFetching}
          className="px-0 py-4"
        />
      </ProfilePageFrame>
    );
  }

  if (!profile) {
    return (
      <ProfilePageFrame>
        <PageEmptyState
          title="Profile not found"
          description="This profile may have been removed or is no longer available."
          className="px-0 py-4"
        />
      </ProfilePageFrame>
    );
  }

  const outletContext: ProfileRouteOutletContext = {
    profileId,
    isOwner,
    profileName: getProfileDisplayName(profile),
  };

  return (
    <ProfilePageFrame>
      <ProfileRouteGuard profileId={profileId} isOwner={isOwner} activeTab={activeTab}>
        <div className="space-y-6">
          <ProfileHeader
            profile={profile}
            profileId={profileId}
            postsCount={postsCount}
            savedCount={savedCount}
            likedCount={likedCount}
            isOwner={isOwner}
          />
          <ProfileTabs
            profileId={profileId}
            postsCount={postsCount}
            savedCount={savedCount}
            likedCount={likedCount}
            isOwner={isOwner}
          />
          <div className="w-full">
            <Outlet context={outletContext} />
          </div>
        </div>
      </ProfileRouteGuard>
    </ProfilePageFrame>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return (
    <ProfilePageFrame>
      <RouteErrorState error={error} className="px-0 py-4" />
    </ProfilePageFrame>
  );
}
