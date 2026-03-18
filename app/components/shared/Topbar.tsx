import { Link, useNavigate } from 'react-router';
import { Button } from '../ui/button';
import { PiSignOut, PiUser } from 'react-icons/pi';
import { useSignOutAccountMutation } from '~/lib/react-query/queriesAndMutations';
import { useEffect } from 'react';
import { useUserContext } from '~/context/AuthContext';

export default function Topbar() {
  const navigate = useNavigate();
  const { mutate: signOut, isSuccess } = useSignOutAccountMutation();
  const { user } = useUserContext();

  useEffect(() => {
    if (isSuccess) navigate('/sign-in');
  }, [isSuccess]);

  return (
    <section className="z-50 w-full shrink-0 md:hidden">
      <div className="flex items-center justify-between px-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-4">
        <Link to="/">
          <img src="/assets/images/logo.svg" alt="logo" width={130} height={325} />
        </Link>

        <div className="flex gap-4 items-center">
          <Button variant="ghost" onClick={() => signOut()}>
            <PiSignOut />
          </Button>
          <Link to={`/profile/${user.id}`}>
            {user.imageUrl ? (
              <img src={user.imageUrl} alt="profile" className="h-8 w-8 rounded-full" />
            ) : (
              <PiUser className="h-8 w-8" />
            )}
          </Link>
        </div>
      </div>
    </section>
  );
}
