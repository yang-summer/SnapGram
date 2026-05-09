import { CircleUserRound, Compass, Home, SquarePlus } from 'lucide-react';
import { Link, useLocation, type Location } from 'react-router';
import { useCurrentUserQuery } from '~/features/auth/queries/auth.queries';

function isPathWithinRoute(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

const bottombarLinks = [
  {
    Icon: Home,
    route: '/feed',
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

type BottombarProps = {
  location?: Pick<Location, 'pathname'>;
};

export default function Bottombar({ location: providedLocation }: BottombarProps) {
  const currentLocation = useLocation();
  const { pathname } = providedLocation ?? currentLocation;
  const { data } = useCurrentUserQuery();
  const currentUser = data?.status === 'authenticated' ? data.user : null;
  const profileRoute = currentUser?.profileId
    ? `/profile/${currentUser.profileId}`
    : null;
  return (
    <div className="grid grid-cols-4 gap-2 bg-surface-raised h-full">
      {bottombarLinks.map((link) => {
        const isActive = isPathWithinRoute(pathname, link.route);

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
        className={`flex items-center justify-center gap-1 p-2 text-ink-subtle transition-colors ${profileRoute && isPathWithinRoute(pathname, profileRoute) ? 'text-ink-strong' : ''} hover:bg-surface-soft`}
      >
        <CircleUserRound className="w-6 h-6" />
        <span className="hidden md:flex text-base font-normal">Me</span>
      </Link>
    </div>
  );
}
