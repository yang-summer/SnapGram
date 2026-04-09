import { Link } from 'react-router';
import { Button } from '../ui/button';
import { PiSignOut, PiUser } from 'react-icons/pi';
import { useSignOutMutation } from '~/features/auth/queries/auth.mutations';
import { useCurrentUserQuery } from '~/features/auth/queries/auth.queries';

export default function Topbar() {
  const { mutate: signOut, isPending: isSigningOut } = useSignOutMutation();
  const { data } = useCurrentUserQuery();
  const currentUser = data?.status === 'authenticated' ? data.user : null;

  return (
    <section className="z-50 w-full shrink-0 md:hidden">
      <div className="flex items-center justify-between px-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-4">
        <Link to="/">
          <img src="/assets/images/logo.svg" alt="logo" width={130} height={325} />
        </Link>

        <div className="flex gap-4 items-center">
          <Button variant="ghost" onClick={() => signOut()} disabled={isSigningOut}>
            <PiSignOut />
          </Button>
          <Link to={`/profile/${currentUser?.profileId ?? ''}`}>
            {currentUser?.imageUrl ? (
              <img src={currentUser.imageUrl} alt="profile" className="h-8 w-8 rounded-full" />
            ) : (
              <PiUser className="h-8 w-8" />
            )}
          </Link>
        </div>
      </div>
    </section>
  );
}
