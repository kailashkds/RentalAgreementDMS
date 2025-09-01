import { useQuery } from "@tanstack/react-query";
import type { Agreement } from "@shared/schema";

interface UseAgreementsOptions {
  customerId?: string;
  status?: string;
  search?: string;
  dateFilter?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

interface AgreementsResponse {
  agreements: Agreement[];
  total: number;
}

export function useAgreements(options: UseAgreementsOptions = {}) {
  const { customerId, status, search, dateFilter, startDate, endDate, limit, offset } = options;
  
  const params = new URLSearchParams();
  if (customerId && customerId.trim() !== "") params.append('customerId', customerId);
  if (status && status.trim() !== "") params.append('status', status);
  if (search && search.trim() !== "") params.append('search', search);
  if (dateFilter && dateFilter.trim() !== "" && dateFilter !== "all") {
    params.append('dateFilter', dateFilter);
  }
  if (startDate && startDate.trim() !== "") {
    params.append('startDate', startDate);
  }
  if (endDate && endDate.trim() !== "") {
    params.append('endDate', endDate);
  }
  
  // Only add pagination if limit is specified
  if (limit !== undefined) {
    params.append('limit', limit.toString());
    params.append('offset', (offset || 0).toString());
  }

  return useQuery<AgreementsResponse>({
    queryKey: ["/api/agreements", customerId, status, search, dateFilter || null, startDate || null, endDate || null, limit, offset],
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
