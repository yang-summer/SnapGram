import { matchPath, type Location } from 'react-router';

const POST_DETAIL_MODAL_KIND = 'post-detail-modal';
const POST_DETAIL_ROUTE_PATTERN = '/posts/:id';

export type PostDetailNavigationState = {
  kind: typeof POST_DETAIL_MODAL_KIND;
  backgroundLocation: Location;
};

export function createPostDetailNavigationState(
  backgroundLocation: Location,
): PostDetailNavigationState {
  return {
    kind: POST_DETAIL_MODAL_KIND,
    backgroundLocation,
  };
}

function isLocationLike(value: unknown): value is Location {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<Location>;

  return (
    typeof candidate.pathname === 'string' &&
    typeof candidate.search === 'string' &&
    typeof candidate.hash === 'string' &&
    typeof candidate.key === 'string'
  );
}

export function getPostDetailBackgroundLocation(state: unknown): Location | null {
  if (!state || typeof state !== 'object') {
    return null;
  }

  const candidate = state as Partial<PostDetailNavigationState>;

  if (candidate.kind !== POST_DETAIL_MODAL_KIND || !isLocationLike(candidate.backgroundLocation)) {
    return null;
  }

  return candidate.backgroundLocation;
}

export function isPostDetailLocation(location: Pick<Location, 'pathname'>): boolean {
  return matchPath(POST_DETAIL_ROUTE_PATTERN, location.pathname) !== null;
}

export function locationsMatch(
  left: Pick<Location, 'hash' | 'key' | 'pathname' | 'search'>,
  right: Pick<Location, 'hash' | 'key' | 'pathname' | 'search'>,
): boolean {
  if (left.key.length > 0 && right.key.length > 0) {
    return left.key === right.key;
  }

  return (
    left.pathname === right.pathname &&
    left.search === right.search &&
    left.hash === right.hash
  );
}
