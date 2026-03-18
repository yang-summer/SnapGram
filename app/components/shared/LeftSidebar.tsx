import { PiSignOut, PiUser } from 'react-icons/pi';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { sidebarLinks } from '~/constants';
import { useUserContext } from '~/context/AuthContext';
import { useSignOutAccountMutation } from '~/lib/react-query/queriesAndMutations';
import type { NavBarLink } from '~/lib/types';
import { Button } from '../ui/button';

export default function LeftSidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { mutate: signOut, isSuccess } = useSignOutAccountMutation();
  const { user } = useUserContext();

  return (
    <nav className="hidden md:flex px-6 py-10 flex-col justify-between min-w-67.5">
      <div className="flex flex-col gap-11">
        <Link to="/">
          <img src="/assets/images/logo.svg" alt="logo" width={130} height={36} />
        </Link>
        <Link to={`/profile/${user.id}`} className="flex gap-3 items-center">
          {user.imageUrl ? (
            <img src={user.imageUrl} alt="profile" className="h-8 w-8 rounded-full" />
          ) : (
            <PiUser className="h-8 w-8" />
          )}
          <div className="flex flex-col">
            <p className="font-bold">{user.name}</p>
            <p className="text-[14px] font-normal">@{user.username}</p>
          </div>
        </Link>
        <ul>
          {sidebarLinks.map((link: NavBarLink) => {
            const isActive = pathname === link.route;

            return (
              <li
                key={link.label}
                className={`rounded-lg text-[16px] font-medium leading-[140%] hover:bg-indigo-600 transition group; ${
                  isActive && 'bg-indigo-600'
                }`}
              >
                <NavLink to={link.route} className="flex gap-4 items-center p-4">
                  <img
                    src={link.imgURL}
                    alt={link.label}
                    className={`group-hover:invert brightness-0 transition ${
                      isActive && 'invert brightness-0 transition'
                    }`}
                  />
                  {link.label}
                </NavLink>
              </li>
            );
          })}
        </ul>
        <Button
          variant="ghost"
          onClick={() => signOut()}
          className="flex gap-4 justify-start items-center"
        >
          <PiSignOut />
          <p className="text-[16px] font-medium">Log out</p>
        </Button>
      </div>
    </nav>
  );
}
