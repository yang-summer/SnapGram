import { Link, useLocation } from 'react-router';
import { bottombarLinks } from '~/constants';
import type { NavBarLink } from '~/lib/types';

export default function Bottombar() {
  const { pathname } = useLocation();
  return (
    <section className="z-50 grid w-full shrink-0 grid-cols-4 gap-2 rounded-t-[20px] px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:hidden">
      {bottombarLinks.map((link: NavBarLink) => {
        const isActive = pathname === link.route;

        return (
          <Link
            to={link.route}
            key={link.label}
            className={`flex flex-col items-center justify-center gap-1 p-2 transition-colors ${isActive && 'bg-indigo-600'}`}
          >
            <img
              src={link.imgURL}
              alt={link.label}
              width={16}
              height={16}
              className={`${isActive && 'invert brightness-0 transition'}`}
            />
            {link.label}
          </Link>
        );
      })}
    </section>
  );
}
