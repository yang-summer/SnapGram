import { NavLink } from 'react-router';
import { cn } from '~/lib/utils';

type ProfileTabKey = 'posts' | 'saved' | 'liked';

export type ProfileTabsProps = {
  profileId: string;
  postsCount: number | undefined;
  savedCount: number | undefined;
  likedCount: number | undefined;
  isOwner: boolean;
};

function formatCount(count: number | undefined): string {
  return typeof count === 'number' ? count.toLocaleString() : '-';
}

export default function ProfileTabs({
  profileId,
  postsCount,
  savedCount,
  likedCount,
  isOwner,
}: ProfileTabsProps) {
  const tabs: Array<{
    key: ProfileTabKey;
    label: string;
    count: number | undefined;
  }> = [
    {
      key: 'posts',
      label: 'Posts',
      count: postsCount,
    },
    ...(isOwner
      ? [
          {
            key: 'saved' as const,
            label: 'Saved',
            count: savedCount,
          },
          {
            key: 'liked' as const,
            label: 'Liked',
            count: likedCount,
          },
        ]
      : []),
  ];

  return (
    <nav
      aria-label="Profile sections"
      className="flex flex-wrap gap-2 rounded-3xl border bg-card p-2 shadow-sm"
    >
      {tabs.map((tab) => (
        <NavLink
          key={tab.key}
          to={`/profile/${profileId}/${tab.key}`}
          className={({ isActive }) =>
            cn(
              'flex min-w-[120px] items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium transition-colors',
              isActive
                ? 'bg-surface-soft text-foreground'
                : 'text-muted-foreground hover:bg-surface-soft hover:text-foreground',
            )
          }
        >
          <span>{tab.label}</span>
          <span className="text-xs">{formatCount(tab.count)}</span>
        </NavLink>
      ))}
    </nav>
  );
}
