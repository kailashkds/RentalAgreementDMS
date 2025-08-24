import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";

export interface UserPermissions {
  permissions: string[];
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissionList: string[]) => boolean;
  hasAllPermissions: (permissionList: string[]) => boolean;
}

/**
 * Hook to get current user's permissions
 */
export function usePermissions(): UserPermissions & { isLoading: boolean } {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  
  const { data: permissions = [], isLoading: permissionsLoading } = useQuery({
    queryKey: ['/api/auth/permissions'],
    enabled: isAuthenticated && !!user,
    retry: false,
  }) as { data: string[]; isLoading: boolean };

  const hasPermission = (permission: string): boolean => {
    return permissions.includes(permission);
  };

  const hasAnyPermission = (permissionList: string[]): boolean => {
    return permissionList.some(permission => permissions.includes(permission));
  };

  const hasAllPermissions = (permissionList: string[]): boolean => {
    return permissionList.every(permission => permissions.includes(permission));
  };

  return {
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isLoading: authLoading || permissionsLoading,
  };
}

/**
 * Hook to check if user has a specific permission
 */
export function useHasPermission(permission: string): boolean {
  const { permissions } = usePermissions();
  return permissions.includes(permission);
}

/**
 * Hook to check if user has all of the specified permissions
 */
export function useHasAllPermissions(requiredPermissions: string[]): boolean {
  const { permissions } = usePermissions();
  return requiredPermissions.every(perm => permissions.includes(perm));
}

/**
 * Hook to check if user has any of the specified permissions
 */
export function useHasAnyPermission(requiredPermissions: string[]): boolean {
  const { permissions } = usePermissions();
  return requiredPermissions.some(perm => permissions.includes(perm));
}

/**
 * Permission constants for easy reference
 */
export const PERMISSIONS = {
  // Agreement permissions
  AGREEMENT_VIEW_OWN: "agreement.view.own",
  AGREEMENT_VIEW_ALL: "agreement.view.all",
  AGREEMENT_CREATE: "agreement.create",
  AGREEMENT_EDIT_OWN: "agreement.edit.own",
  AGREEMENT_EDIT_ALL: "agreement.edit.all",
  AGREEMENT_DELETE_OWN: "agreement.delete.own",
  AGREEMENT_DELETE_ALL: "agreement.delete.all",
  AGREEMENT_NOTARIZE: "agreement.notarize",
  
  // Download permissions
  DOWNLOAD_AGREEMENT_OWN: "download.agreement.own",
  DOWNLOAD_AGREEMENT_ALL: "download.agreement.all",
  
  // Share permissions
  SHARE_AGREEMENT_OWN: "share.agreement.own",
  SHARE_AGREEMENT_ALL: "share.agreement.all",
  
  // User management permissions
  USER_MANAGE: "user.manage",
  USER_VIEW_ALL: "user.view.all",
  USER_CREATE: "user.create",
  USER_EDIT_ALL: "user.edit.all",
  USER_DELETE_ALL: "user.delete.all",
  
  // Role management permissions
  ROLE_MANAGE: "role.manage",
  ROLE_ASSIGN: "role.assign",
  
  // Customer management permissions
  CUSTOMER_MANAGE: "customer.manage",
  CUSTOMER_VIEW_ALL: "customer.view.all",
  CUSTOMER_CREATE: "customer.create",
  CUSTOMER_EDIT_ALL: "customer.edit.all",
  CUSTOMER_DELETE_ALL: "customer.delete.all",
  
  // Template permissions
  TEMPLATE_MANAGE: "template.manage",
  TEMPLATE_CREATE: "template.create",
  TEMPLATE_EDIT: "template.edit",
  TEMPLATE_DELETE: "template.delete",
  
  // System permissions
  SYSTEM_ADMIN: "system.admin",
  DASHBOARD_VIEW: "dashboard.view",
} as const;