import type { ReactNode } from 'react';
import { Navigate } from 'react-router';

export type ProfileRouteTab = 'posts' | 'saved' | 'liked' | null;

type ProfileRouteGuardProps = {
  profileId: string;
  isOwner: boolean;
  activeTab: ProfileRouteTab;
  children: ReactNode;
};

function isPrivateProfileTab(activeTab: ProfileRouteTab): boolean {
  return activeTab === 'saved' || activeTab === 'liked';
}

export default function ProfileRouteGuard({
  profileId,
  isOwner,
  activeTab,
  children,
}: ProfileRouteGuardProps) {
  if (!isOwner && isPrivateProfileTab(activeTab)) {
    return <Navigate to={`/profile/${profileId}/posts`} replace />;
  }

  return <>{children}</>;
}
