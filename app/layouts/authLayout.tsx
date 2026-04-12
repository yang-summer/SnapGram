import type { ReactNode } from 'react';
import { Outlet } from 'react-router';
import RouteErrorState from '~/components/feedback/route-error-state';
import RequireGuest from '~/features/auth/components/RequireGuest';
import type { Route } from './+types/authLayout';

type AuthLayoutFrameProps = {
  children: ReactNode;
};

function AuthLayoutFrame({ children }: AuthLayoutFrameProps) {
  return (
    <RequireGuest>
      <div className="min-h-screen md:flex">
        <section className="flex flex-1 items-center justify-center px-6 py-10 md:px-10">
          {children}
        </section>
        <aside className="relative hidden md:block md:w-[44%] lg:w-1/2 overflow-hidden">
          <img
            src="/assets/images/side-img.svg"
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
        </aside>
      </div>
    </RequireGuest>
  );
}

export default function AuthLayout() {
  return (
    <AuthLayoutFrame>
      <Outlet />
    </AuthLayoutFrame>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return (
    <AuthLayoutFrame>
      <RouteErrorState error={error} className="min-h-full" showHomeButton={false} />
    </AuthLayoutFrame>
  );
}
