import { useQuery } from "@tanstack/react-query";
import type { Society } from "@shared/schema";

interface UseSocietiesOptions {
  search?: string;
  limit?: number;
}

export function useSocieties(options: UseSocietiesOptions = {}) {
  const { search, limit = 100 } = options;
  
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  params.append('limit', limit.toString());

  return useQuery<Society[]>({
    queryKey: ["/api/societies", search, limit],
    queryFn: async () => {
      const response = await fetch(`/api/societies?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch societies');
      }
      return response.json();
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}
