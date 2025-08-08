import { useState, useCallback } from 'react';
import { apiRequest } from '@/lib/queryClient';

export interface CustomerDetails {
  id: string;
  name: string;
  mobile: string;
  email?: string;
}

export function useCustomerLookup() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookupCustomer = useCallback(async (mobile: string): Promise<CustomerDetails | null> => {
    if (!mobile || mobile.length < 10) {
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const customer = await apiRequest(`/api/customers/by-mobile?mobile=${encodeURIComponent(mobile)}`);
      return customer;
    } catch (err: any) {
      if (err.message?.includes('404')) {
        setError('Customer not found');
        return null;
      }
      setError('Failed to lookup customer');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    lookupCustomer,
    isLoading,
    error,
  };
}