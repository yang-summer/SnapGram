import { useMutation } from '@tanstack/react-query';
import { createUserAccount, signInAccount, signOutAccount } from '../appwrite/api';
import type { NewUser } from '../types';

export function useCreateUserAccountMutation() {
  return useMutation({
    mutationFn: (newUser: NewUser) => {
      return createUserAccount(newUser);
    },
  });
}

export function useSignInAccountMutation() {
  return useMutation({
    mutationFn: (user: { email: string; password: string }) => signInAccount(user),
  });
}

export function useSignOutAccountMutation() {
  return useMutation({
    mutationFn: () => signOutAccount(),
  });
}
