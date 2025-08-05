import { useQuery } from "@tanstack/react-query";
import type { Address } from "@shared/schema";

interface UseAddressesOptions {
  search?: string;
  limit?: number;
}

export function useAddresses(options: UseAddressesOptions = {}) {
  const { search, limit = 10 } = options;
  
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  params.append('limit', limit.toString());

  return useQuery<Address[]>({
    queryKey: ["/api/addresses", search, limit],
    queryFn: async () => {
      const response = await fetch(`/api/addresses?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch addresses');
      }
      return response.json();
    },
    enabled: !!search && search.length >= 2, // Only search when user has typed at least 2 characters
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}