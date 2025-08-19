import { useQuery } from "@tanstack/react-query";
import type { Customer } from "@shared/schema";

interface UseCustomersOptions {
  search?: string;
  limit?: number;
  offset?: number;
  activeOnly?: boolean;
}

interface CustomersResponse {
  customers: Customer[];
  total: number;
}

export function useCustomers(options: UseCustomersOptions = {}) {
  const { search, limit = 50, offset = 0, activeOnly = false } = options;
  
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (activeOnly) params.append('activeOnly', 'true');
  params.append('limit', limit.toString());
  params.append('offset', offset.toString());

  return useQuery<CustomersResponse>({
    queryKey: ["/api/customers", search, limit, offset, activeOnly],
    queryFn: async () => {
      const response = await fetch(`/api/customers?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch customers');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useCustomer(id: string) {
  return useQuery<Customer>({
    queryKey: ["/api/customers", id],
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
