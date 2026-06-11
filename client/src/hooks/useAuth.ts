import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../services/churchtoolsApi';

/** Anmeldestatus + Login/Logout. Nutzt das /api/auth/me-Cookie des Backends. */
export function useAuth() {
  const qc = useQueryClient();

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: api.getMe,
    staleTime: 1000 * 60,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => api.login(email, password),
    onSuccess: (status) => qc.setQueryData(['me'], status),
  });

  const logoutMutation = useMutation({
    mutationFn: api.logout,
    onSuccess: () => {
      qc.setQueryData(['me'], { authenticated: false });
      qc.removeQueries({ queryKey: ['services'] });
    },
  });

  return {
    isLoading: meQuery.isLoading,
    isAuthenticated: meQuery.data?.authenticated ?? false,
    user: meQuery.data?.user,
    login: (email: string, password: string) => loginMutation.mutateAsync({ email, password }),
    logout: () => logoutMutation.mutateAsync(),
  };
}
