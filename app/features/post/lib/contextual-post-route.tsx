import {
  createContext,
  useContext,
  useRef,
  type ReactNode,
} from 'react';

const CONTEXTUAL_POST_MODAL_KIND = 'context-post-modal';

export const CONTEXTUAL_POST_ROUTE_SOURCES = [
  'feed',
  'search-result',
  'profile-posts',
  'profile-saved',
  'profile-liked',
] as const;

export type ContextualPostRouteSource =
  (typeof CONTEXTUAL_POST_ROUTE_SOURCES)[number];

export type ContextualPostModalState = {
  kind: typeof CONTEXTUAL_POST_MODAL_KIND;
  source: ContextualPostRouteSource;
  contextId: string;
};

type ContextualPostRouteContextValue = {
  source: ContextualPostRouteSource;
  contextId: string;
  closeTo: string;
  buildPostHref: (postId: string) => string;
  buildStandalonePostHref: (postId: string) => string;
  buildModalState: () => ContextualPostModalState;
  buildPostLink: (
    postId: string,
  ) => {
    to: string;
    state: ContextualPostModalState;
    preventScrollReset: true;
  };
};

type ContextualPostRouteProviderProps = {
  source: ContextualPostRouteSource;
  closeTo: string;
  buildPostHref: (postId: string) => string;
  children: ReactNode;
};

const ContextualPostRouteContext =
  createContext<ContextualPostRouteContextValue | null>(null);

function createContextualRouteRuntimeId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `context-post-${Math.random().toString(36).slice(2, 12)}`;
}

function isContextualPostRouteSource(
  value: unknown,
): value is ContextualPostRouteSource {
  return (
    typeof value === 'string' &&
    CONTEXTUAL_POST_ROUTE_SOURCES.includes(
      value as ContextualPostRouteSource,
    )
  );
}

export function buildStandalonePostHref(postId: string) {
  return `/posts/${postId}`;
}

export function createContextualPostModalState(
  source: ContextualPostRouteSource,
  contextId: string,
): ContextualPostModalState {
  return {
    kind: CONTEXTUAL_POST_MODAL_KIND,
    source,
    contextId,
  };
}

export function getContextualPostModalState(
  value: unknown,
): ContextualPostModalState | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<ContextualPostModalState>;

  if (
    candidate.kind !== CONTEXTUAL_POST_MODAL_KIND ||
    !isContextualPostRouteSource(candidate.source) ||
    typeof candidate.contextId !== 'string' ||
    candidate.contextId.trim().length === 0
  ) {
    return null;
  }

  return {
    kind: CONTEXTUAL_POST_MODAL_KIND,
    source: candidate.source,
    contextId: candidate.contextId,
  };
}

export function ContextualPostRouteProvider({
  source,
  closeTo,
  buildPostHref,
  children,
}: ContextualPostRouteProviderProps) {
  const contextIdRef = useRef<string>(createContextualRouteRuntimeId());
  const contextId = contextIdRef.current;
  const value: ContextualPostRouteContextValue = {
    source,
    contextId,
    closeTo,
    buildPostHref,
    buildStandalonePostHref,
    buildModalState() {
      return createContextualPostModalState(source, contextId);
    },
    buildPostLink(postId) {
      return {
        to: buildPostHref(postId),
        state: createContextualPostModalState(source, contextId),
        preventScrollReset: true,
      };
    },
  };

  return (
    <ContextualPostRouteContext.Provider value={value}>
      {children}
    </ContextualPostRouteContext.Provider>
  );
}

export function useContextualPostRoute() {
  const value = useContext(ContextualPostRouteContext);

  if (!value) {
    throw new Error(
      'useContextualPostRoute must be used within a ContextualPostRouteProvider.',
    );
  }

  return value;
}

export function useOptionalContextualPostRoute() {
  return useContext(ContextualPostRouteContext);
}
