import { useEffect, useRef, type ReactNode } from 'react';
import {
  matchPath,
  UNSAFE_LocationContext,
  useLocation,
  useNavigationType,
  useOutlet,
  type Location,
} from 'react-router';
import RouteErrorState from '~/components/feedback/route-error-state';
import Bottombar from '~/components/shared/Bottombar';
import LeftSidebar from '~/components/shared/LeftSidebar';
import Topbar from '~/components/shared/Topbar';
import RequireAuth from '~/features/auth/components/RequireAuth';
import type { PostDetailNavigationState } from '~/features/post/lib/post-detail-navigation';
import type { Route } from './+types/rootLayout';

type RootLayoutFrameProps = {
  children: ReactNode;
  modalContent?: ReactNode;
  shellLocation?: Pick<Location, 'pathname' | 'search'>;
};

function RootLayoutFrame({ children, modalContent, shellLocation }: RootLayoutFrameProps) {
  const currentLocation = useLocation();
  const effectiveLocation = shellLocation ?? currentLocation;

  useEffect(() => {
    if (!modalContent) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [modalContent]);

  return (
    <RequireAuth>
      <aside className="hidden lg:flex flex-col fixed z-50 top-18 left-0 w-62 xl:w-68 h-[calc(100vh-72px)] px-5 py-6 xl:px-6">
        <LeftSidebar />
      </aside>
      <header className="sticky z-50 top-0 w-full h-18 px-5 xl:px-6">
        <Topbar location={effectiveLocation} />
      </header>
      <main className="lg:ml-62 xl:ml-68">
        <section>{children}</section>
        {/* Spacer for Bottom Nav on Mobile */}
        <div className="h-12 lg:hidden"></div>
      </main>
      <nav className="lg:hidden fixed z-50 inset-x-0 bottom-0 w-full h-12">
        <Bottombar location={effectiveLocation} />
      </nav>
      {modalContent ? (
        <div className="fixed inset-0 z-60 overflow-hidden">{modalContent}</div>
      ) : null}
    </RequireAuth>
  );
}

export default function RootLayout() {
  const outlet = useOutlet();
  const location = useLocation();
  const navigationType = useNavigationType();
  const locationState = location.state as PostDetailNavigationState | null;
  const backgroundLocation = locationState?.backgroundLocation ?? null;
  const isPostDetailModal = Boolean(
    backgroundLocation && matchPath('/posts/:id', location.pathname),
  );
  const modalBackgroundLocation = isPostDetailModal ? backgroundLocation : null;
  const backgroundOutletRef = useRef<ReactNode>(outlet);

  useEffect(() => {
    if (!modalBackgroundLocation) {
      backgroundOutletRef.current = outlet;
    }
  }, [modalBackgroundLocation, outlet]);

  const shellLocation = modalBackgroundLocation ?? location;
  const backgroundContent = modalBackgroundLocation ? (
    <UNSAFE_LocationContext.Provider
      value={{
        location: modalBackgroundLocation,
        navigationType,
      }}
    >
      {backgroundOutletRef.current}
    </UNSAFE_LocationContext.Provider>
  ) : (
    outlet
  );
  const modalContent = modalBackgroundLocation ? outlet : null;

  return (
    <RootLayoutFrame shellLocation={shellLocation} modalContent={modalContent}>
      {backgroundContent}
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
