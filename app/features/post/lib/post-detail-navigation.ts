import type { Location } from 'react-router';

export type PostDetailNavigationState = {
  backgroundLocation: Location;
};

export function createPostDetailNavigationState(
  backgroundLocation: Location,
): PostDetailNavigationState {
  return { backgroundLocation };
}
