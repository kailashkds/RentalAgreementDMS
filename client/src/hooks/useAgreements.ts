import { useQuery } from "@tanstack/react-query";
import type { Agreement } from "@shared/schema";

interface UseAgreementsOptions {
  customerId?: string;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

interface AgreementsResponse {
  agreements: Agreement[];
  total: number;
}

export function useAgreements(options: UseAgreementsOptions = {}) {
  const { customerId, status, search, limit = 50, offset = 0 } = options;
  
  const params = new URLSearchParams();
  if (customerId) params.append('customerId', customerId);
  if (status) params.append('status', status);
  if (search) params.append('search', search);
  params.append('limit', limit.toString());
  params.append('offset', offset.toString());

  return useQuery<AgreementsResponse>({
    queryKey: ["/api/agreements", customerId, status, search, limit, offset],
    queryFn: async () => {
      const response = await fetch(`/api/agreements?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch agreements');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useAgreement(id: string) {
  return useQuery<Agreement>({
    queryKey: ["/api/agreements", id],
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
