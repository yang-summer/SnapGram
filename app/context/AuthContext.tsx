import { createContext, useContext } from 'react';
import { useCurrentUserQuery } from '~/features/auth/queries/auth.queries';
import type { CurrentUserResult } from '~/features/auth/types/auth.type';
import type { User } from '~/lib/types';

type AuthContextType = {
  user: User;
  isLoading: boolean;
  setUser: React.Dispatch<React.SetStateAction<User>>;
  isAuthenticated: boolean;
  setIsAuthenticated: React.Dispatch<React.SetStateAction<boolean>>;
  checkAuthUser: () => Promise<boolean>;
};

const INITIAL_USER = {
  id: '',
  name: '',
  username: '',
  email: '',
  imageUrl: '',
  bio: '',
};

const noopSetUser: React.Dispatch<React.SetStateAction<User>> = () => {};
const noopSetIsAuthenticated: React.Dispatch<React.SetStateAction<boolean>> = () => {};

function mapCurrentUserToLegacyUser(currentUser: CurrentUserResult | undefined): User {
  if (currentUser?.status !== 'authenticated') {
    return INITIAL_USER;
  }

  return {
    id: currentUser.user.profileId,
    name: currentUser.user.name,
    username: currentUser.user.username,
    email: currentUser.user.email,
    imageUrl: currentUser.user.imageUrl ?? '',
    bio: currentUser.user.bio ?? '',
  };
}

const INITIAL_STATE = {
  user: INITIAL_USER,
  isLoading: false,
  isAuthenticated: false,
  setUser: noopSetUser,
  setIsAuthenticated: noopSetIsAuthenticated,
  checkAuthUser: async () => false as boolean,
};

const AuthContext = createContext<AuthContextType>(INITIAL_STATE);

export function AuthContextProvider({ children }: { children: React.ReactNode }) {
  const { data, isPending, isFetching, refetch } = useCurrentUserQuery();
  const user = mapCurrentUserToLegacyUser(data);
  const isAuthenticated = data?.status === 'authenticated';
  const isLoading = isPending || isFetching;

  const checkAuthUser = async () => {
    const result = await refetch();
    return result.data?.status === 'authenticated';
  };

  const value = {
    user,
    setUser: noopSetUser,
    isLoading,
    isAuthenticated,
    setIsAuthenticated: noopSetIsAuthenticated,
    checkAuthUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useUserContext = () => useContext(AuthContext);
