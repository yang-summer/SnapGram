import { useEffect, useRef, type ReactNode } from 'react';
import {
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
import { PostDetailModalRuntimeProvider } from '~/features/post/lib/post-detail-modal-runtime';
import {
  getPostDetailBackgroundLocation,
  isPostDetailLocation,
  locationsMatch,
} from '~/features/post/lib/post-detail-navigation';
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
  const backgroundLocation = getPostDetailBackgroundLocation(location.state);
  const isPostDetailModalCandidate = Boolean(
    backgroundLocation &&
      isPostDetailLocation(location) &&
      !isPostDetailLocation(backgroundLocation),
  );
  const backgroundSnapshotRef = useRef<{
    location: Location;
    outlet: ReactNode;
  } | null>(null);

  useEffect(() => {
    if (!isPostDetailModalCandidate) {
      backgroundSnapshotRef.current = {
        location,
        outlet,
      };
    }
  }, [isPostDetailModalCandidate, location, outlet]);

  const hasUsableBackgroundSnapshot =
    backgroundLocation !== null &&
    backgroundSnapshotRef.current !== null &&
    locationsMatch(backgroundSnapshotRef.current.location, backgroundLocation);
  const isPostDetailModalActive =
    isPostDetailModalCandidate && hasUsableBackgroundSnapshot;
  const modalBackgroundLocation = isPostDetailModalActive
    ? backgroundSnapshotRef.current?.location ?? null
    : null;

  const shellLocation = modalBackgroundLocation ?? location;
  const backgroundContent = modalBackgroundLocation ? (
    <UNSAFE_LocationContext.Provider
      value={{
        location: modalBackgroundLocation,
        navigationType,
      }}
    >
      {backgroundSnapshotRef.current?.outlet ?? null}
    </UNSAFE_LocationContext.Provider>
  ) : (
    outlet
  );
  const modalContent = modalBackgroundLocation ? outlet : null;

  return (
    <PostDetailModalRuntimeProvider isActive={isPostDetailModalActive}>
      <RootLayoutFrame shellLocation={shellLocation} modalContent={modalContent}>
        {backgroundContent}
      </RootLayoutFrame>
    </PostDetailModalRuntimeProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return (
    <RootLayoutFrame>
      <RouteErrorState error={error} className="min-h-full" />
    </RootLayoutFrame>
  );
}
