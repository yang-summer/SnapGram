import { PiUser } from 'react-icons/pi';
import { Link, NavLink } from 'react-router';
import { useCurrentUserQuery } from '~/features/auth/queries/auth.queries';
import { Compass, House, Menu, SquarePlus } from 'lucide-react';

const sidebarLinks = [
  {
    Icon: House,
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
    label: 'Create Post',
  },
];

export default function LeftSidebar() {
  const { data } = useCurrentUserQuery();
  const currentUser = data?.status === 'authenticated' ? data.user : null;

  return (
    <div className="flex flex-col gap-1 h-full bg-surface-raised">
      <ul>
        {sidebarLinks.map((link) => {
          return (
            <li key={link.label}>
              <NavLink
                to={link.route}
                className={({ isActive }) =>
                  `flex gap-4 items-center rounded-full p-4 text-base text-ink-strong font-semibold transition-colors hover:bg-surface-soft ${isActive ? 'bg-surface-soft' : ''}`
                }
              >
                <link.Icon className="w-6 h-6" />
                <span>{link.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
      <Link
        to={`/profile/${currentUser?.profileId ?? ''}`}
        className="flex gap-3 items-center rounded-full p-3 text-ink-strong transition-colors hover:bg-surface-soft"
      >
        {currentUser?.imageUrl ? (
          <img src={currentUser.imageUrl} alt="profile" className="h-11 w-11 rounded-full" />
        ) : (
          <PiUser className="h-11 w-11" />
        )}
        <div className="flex flex-col">
          <span className="truncate text-sm font-semibold">{currentUser?.name ?? ''}</span>
          <span className="truncate text-xs">@{currentUser?.username ?? ''}</span>
        </div>
      </Link>
      <button className="flex gap-4 items-center rounded-full p-4 text-base text-ink-strong font-semibold transition-colors hover:bg-surface-soft mt-auto cursor-pointer">
        <Menu className="w-6 h-6" />
        <span>More</span>
      </button>
    </div>
  );
}
