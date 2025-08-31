import { useQuery } from "@tanstack/react-query";

export function useAuth() {
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["/api/auth/me"],
    retry: (failureCount, error: any) => {
      // Don't retry on 401 (not authenticated)
      if (error?.message?.includes('401') || error?.message?.includes('Please log in')) {
        return false;
      }
      return failureCount < 2;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    // Make sure the query resolves quickly on auth errors
    retryDelay: 0,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user && !error,
    error,
  };
}