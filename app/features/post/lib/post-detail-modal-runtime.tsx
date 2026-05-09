import { createContext, useContext, type ReactNode } from 'react';

const PostDetailModalRuntimeContext = createContext(false);

type PostDetailModalRuntimeProviderProps = {
  children: ReactNode;
  isActive: boolean;
};

export function PostDetailModalRuntimeProvider({
  children,
  isActive,
}: PostDetailModalRuntimeProviderProps) {
  return (
    <PostDetailModalRuntimeContext.Provider value={isActive}>
      {children}
    </PostDetailModalRuntimeContext.Provider>
  );
}

export function useIsPostDetailModalActive() {
  return useContext(PostDetailModalRuntimeContext);
}
