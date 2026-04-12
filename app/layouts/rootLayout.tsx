import type { ReactNode } from 'react';
import { Outlet } from 'react-router';
import RouteErrorState from '~/components/feedback/route-error-state';
import Bottombar from '~/components/shared/Bottombar';
import LeftSidebar from '~/components/shared/LeftSidebar';
import Topbar from '~/components/shared/Topbar';
import RequireAuth from '~/features/auth/components/RequireAuth';
import type { Route } from './+types/rootLayout';

type RootLayoutFrameProps = {
  children: ReactNode;
};

function RootLayoutFrame({ children }: RootLayoutFrameProps) {
  return (
    <RequireAuth>
      <div className="grid h-dvh w-full grid-rows-[auto_minmax(0,1fr)_auto] md:grid-cols-[270px_minmax(0,1fr)] md:grid-rows-1">
        <Topbar />
        <LeftSidebar />

        <section className="min-h-0 min-w-0 overflow-y-auto">{children}</section>

        <Bottombar />
      </div>
    </RequireAuth>
  );
}

export default function RootLayout() {
  return (
    <RootLayoutFrame>
      <Outlet />
    </RootLayoutFrame>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return (
    <RootLayoutFrame>
      <RouteErrorState error={error} className="min-h-full" />
    </RootLayoutFrame>
  );
}
