import { useQuery } from "@tanstack/react-query";
import type { Address } from "@shared/schema";

interface UseAddressesOptions {
  search?: string;
  limit?: number;
}

export function useAddresses(options: UseAddressesOptions = {}) {
  const { search, limit = 10 } = options;

  return useQuery<Address[]>({
    queryKey: ["/api/addresses", search, limit],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      params.append('limit', limit.toString());
      
      const response = await fetch(`/api/addresses?${params.toString()}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      
      return response.json();
    },
    enabled: !!search && search.length >= 3, // Only search when user has typed at least 3 characters
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}