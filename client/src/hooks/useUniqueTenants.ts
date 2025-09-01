import { useQuery } from "@tanstack/react-query";

export function useUniqueTenants() {
  return useQuery({
    queryKey: ["/api/agreements/unique-tenants"],
    select: (data: any) => data.tenants,
  });
}