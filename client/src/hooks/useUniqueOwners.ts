import { useQuery } from "@tanstack/react-query";

export function useUniqueOwners() {
  return useQuery({
    queryKey: ["/api/agreements/unique-owners"],
    select: (data: any) => data.owners,
  });
}