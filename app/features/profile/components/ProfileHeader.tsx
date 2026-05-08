import { Link } from 'react-router';
import { Button } from '~/components/ui/button';
import type { PublicUserProfileViewModel } from '~/features/user/types/user.type';

type ProfileStatsProps = {
  postsCount: number | undefined;
  savedCount: number | undefined;
  likedCount: number | undefined;
  isOwner: boolean;
};

export type ProfileHeaderProps = ProfileStatsProps & {
  profile: PublicUserProfileViewModel;
  profileId: string;
};

function formatCount(count: number | undefined): string {
  return typeof count === 'number' ? count.toLocaleString() : '-';
}

export function getProfileDisplayName(profile: PublicUserProfileViewModel): string {
  return profile.name || profile.username || 'Snapgram User';
}

export default function ProfileHeader({
  profile,
  profileId,
  postsCount,
  savedCount,
  likedCount,
  isOwner,
}: ProfileHeaderProps) {
  const displayName = getProfileDisplayName(profile);
  const usernameLabel = profile.username ? `@${profile.username}` : 'No username yet';

  return (
    <section className="flex justify-center rounded-3xl bg-card p-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <img
            src={profile.imageUrl}
            alt={`${displayName} avatar`}
            className="size-24 rounded-full border bg-surface-soft object-cover"
          />
          <div className="min-w-0 space-y-3">
            <div className="space-y-1">
              <h1 className="truncate text-3xl font-semibold tracking-tight text-foreground">
                {displayName}
              </h1>
              <p className="text-sm text-muted-foreground">{usernameLabel}</p>
            </div>
            {profile.bio ? (
              <p className="max-w-2xl text-sm leading-6 text-foreground">{profile.bio}</p>
            ) : (
              <p className="text-sm text-muted-foreground">This profile has not added a bio yet.</p>
            )}
          </div>
        </div>
        {isOwner ? (
          <Button asChild variant="outline">
            <Link to={`/update-profile/${profileId}`}>Edit Profile</Link>
          </Button>
        ) : null}
      </div>
    </section>
  );
}
