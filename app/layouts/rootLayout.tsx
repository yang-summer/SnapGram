import type { ReactNode } from 'react';
import { useOutlet } from 'react-router';
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
      <aside className="hidden lg:flex flex-col fixed z-50 top-18 left-0 w-62 xl:w-68 h-[calc(100vh-72px)] px-5 py-6 xl:px-6">
        <LeftSidebar />
      </aside>
      <header className="sticky z-50 top-0 w-full h-18 px-5 xl:px-6">
        <Topbar />
      </header>
      <main className="lg:ml-62 xl:ml-68">
        <section>{children}</section>
        {/* Spacer for Bottom Nav on Mobile */}
        <div className="h-12 lg:hidden"></div>
      </main>
      <nav className="lg:hidden fixed z-50 inset-x-0 bottom-0 w-full h-12">
        <Bottombar />
      </nav>
    </RequireAuth>
  );
}

export default function RootLayout() {
  const outlet = useOutlet();

  return <RootLayoutFrame>{outlet}</RootLayoutFrame>;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return (
    <RootLayoutFrame>
      <RouteErrorState error={error} className="min-h-full" />
    </RootLayoutFrame>
  );
}
