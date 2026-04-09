import { Outlet } from 'react-router';
import Bottombar from '~/components/shared/Bottombar';
import LeftSidebar from '~/components/shared/LeftSidebar';
import Topbar from '~/components/shared/Topbar';
import RequireAuth from '~/features/auth/components/RequireAuth';

export default function RootLayout() {
  return (
    <RequireAuth>
      <div className="grid h-dvh w-full grid-rows-[auto_minmax(0,1fr)_auto] md:grid-cols-[270px_minmax(0,1fr)] md:grid-rows-1">
        <Topbar />
        <LeftSidebar />

        <section className="min-h-0 min-w-0 overflow-y-auto">
          <Outlet />
        </section>

        <Bottombar />
      </div>
    </RequireAuth>
  );
}
