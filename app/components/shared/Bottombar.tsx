import { CircleUserRound, Compass, Home, SquarePlus } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { useCurrentUserQuery } from '~/features/auth/queries/auth.queries';

const bottombarLinks = [
  {
    Icon: Home,
    route: '/',
    label: 'Home',
  },
  {
    Icon: Compass,
    route: '/explore',
    label: 'Explore',
  },
  {
    Icon: SquarePlus,
    route: '/create-post',
    label: 'Create',
  },
];

export default function Bottombar() {
  const { pathname } = useLocation();
  const { data } = useCurrentUserQuery();
  const currentUser = data?.status === 'authenticated' ? data.user : null;
  return (
    <div className="grid grid-cols-4 gap-2 bg-surface-raised h-full">
      {bottombarLinks.map((link) => {
        const isActive = pathname === link.route;

        return (
          <Link
            to={link.route}
            key={link.label}
            className={`flex items-center justify-center gap-1 p-2 ${isActive && 'text-ink-strong'} text-ink-subtle transition-colors hover:bg-surface-soft`}
          >
            <link.Icon className="w-6 h-6" />
            <span className="hidden md:flex text-base font-normal">{link.label}</span>
          </Link>
        );
      })}
      <Link
        to={`/profile/${currentUser?.profileId ?? ''}`}
        className={`flex items-center justify-center gap-1 p-2 text-ink-subtle transition-colors ${pathname === `/profile/${currentUser?.profileId ?? ''}` && 'text-ink-strong'} hover:bg-surface-soft`}
      >
        <CircleUserRound className="w-6 h-6" />
        <span className="hidden md:flex text-base font-normal">Me</span>
      </Link>
    </div>
  );
}
