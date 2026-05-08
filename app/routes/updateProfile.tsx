import { UserRoundPen } from 'lucide-react';
import { Navigate, useParams } from 'react-router';
import PageEmptyState from '~/components/feedback/page-empty-state';
import PageErrorState from '~/components/feedback/page-error-state';
import PageLoadingState from '~/components/feedback/page-loading-state';
import RouteErrorState from '~/components/feedback/route-error-state';
import EditProfileForm from '~/features/user/components/EditProfileForm';
import { useEditableUserProfileQuery } from '~/features/user/queries/user.queries';
import { useCurrentUserQuery } from '~/features/auth/queries/auth.queries';
import type { Route } from './+types/updateProfile';

type UpdateProfilePageFrameProps = {
  children: React.ReactNode;
};

function UpdateProfilePageFrame({ children }: UpdateProfilePageFrameProps) {
  return (
    <div className="flex">
      <div className="flex flex-1 flex-col items-center gap-10 px-5 py-10 md:px-8 lg:px-14 lg:pt-10 lg:pb-14">
        <div className="flex w-full max-w-4xl items-center gap-3">
          <UserRoundPen className="size-9" aria-hidden="true" />
          <h2 className="w-full text-left text-[24px] font-bold leading-[140%] tracking-tighter">
            Edit Profile
          </h2>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function UpdateProfile() {
  const { id } = useParams();

  if (!id) {
    throw new Error('UpdateProfile route requires a profile id.');
  }

  const profileId = id;
  const { data: currentUserResult } = useCurrentUserQuery();
  const currentUser =
    currentUserResult?.status === 'authenticated' ? currentUserResult.user : null;
  const isOwner = currentUser?.profileId === profileId;
  const {
    data: editableProfile,
    isPending,
    isError,
    error,
    refetch,
    isFetching,
  } = useEditableUserProfileQuery(profileId, {
    enabled: isOwner,
  });

  if (!currentUser) {
    return (
      <UpdateProfilePageFrame>
        <PageLoadingState
          title="Loading profile editor"
          description="Please wait while we prepare your profile editor."
          className="px-0 py-4"
        />
      </UpdateProfilePageFrame>
    );
  }

  if (!isOwner) {
    return <Navigate to={`/profile/${profileId}/posts`} replace />;
  }

  if (isPending) {
    return (
      <UpdateProfilePageFrame>
        <PageLoadingState
          title="Loading profile editor"
          description="Please wait while we load your editable profile."
          className="px-0 py-4"
        />
      </UpdateProfilePageFrame>
    );
  }

  if (isError) {
    return (
      <UpdateProfilePageFrame>
        <PageErrorState
          title="Failed to load your editable profile"
          description={error instanceof Error ? error.message : 'Please try again in a moment.'}
          onRetry={() => void refetch()}
          isRetrying={isFetching}
          className="px-0 py-4"
        />
      </UpdateProfilePageFrame>
    );
  }

  if (!editableProfile) {
    return (
      <UpdateProfilePageFrame>
        <PageEmptyState
          title="Profile not found"
          description="This profile is unavailable for editing right now."
          className="px-0 py-4"
        />
      </UpdateProfilePageFrame>
    );
  }

  return (
    <UpdateProfilePageFrame>
      <EditProfileForm profile={editableProfile} />
    </UpdateProfilePageFrame>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return (
    <UpdateProfilePageFrame>
      <RouteErrorState error={error} className="px-0 py-4" />
    </UpdateProfilePageFrame>
  );
}
