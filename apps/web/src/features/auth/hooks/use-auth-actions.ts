// Mutacje sesji (logowanie, rejestracja, wylogowanie) przez proxy /api/auth; sukces odswieza tozsamosc.
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/keys';

import { signInWithEmail, signOutUser, signUpWithEmail } from '../api/auth.api';

/** Po kazdej zmianie sesji tozsamosc w cache jest nieaktualna: unieważniamy cala domene `auth`. */
function useSessionMutation<V>(mutationFn: (variables: V) => Promise<void>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: V) => mutationFn(variables),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.auth.all }),
  });
}

export const useSignIn = () => useSessionMutation(signInWithEmail);
export const useSignUp = () => useSessionMutation(signUpWithEmail);
export const useSignOut = () => useSessionMutation(signOutUser);
