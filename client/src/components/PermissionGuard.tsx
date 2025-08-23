import { ReactNode } from "react";
import { useHasPermission, useHasAllPermissions, useHasAnyPermission } from "@/hooks/usePermissions";

interface PermissionGuardProps {
  children: ReactNode;
  permission?: string;
  permissions?: string[];
  requireAll?: boolean; // If true, user must have ALL permissions. If false, user needs ANY permission
  fallback?: ReactNode;
  showFallback?: boolean;
}

/**
 * Component that conditionally renders children based on user permissions
 * 
 * @param permission - Single permission to check
 * @param permissions - Array of permissions to check
 * @param requireAll - If true with permissions array, user must have ALL permissions. If false, user needs ANY permission
 * @param fallback - Component to show when user doesn't have permission
 * @param showFallback - Whether to show fallback component or nothing when permission check fails
 */
export function PermissionGuard({
  children,
  permission,
  permissions,
  requireAll = true,
  fallback = null,
  showFallback = false,
}: PermissionGuardProps) {
  let hasPermission = false;

  // Single permission check
  if (permission && !permissions) {
    hasPermission = useHasPermission(permission);
  }
  
  // Multiple permissions check
  else if (permissions && permissions.length > 0) {
    if (requireAll) {
      hasPermission = useHasAllPermissions(permissions);
    } else {
      hasPermission = useHasAnyPermission(permissions);
    }
  }
  
  // If permission is granted, render children
  if (hasPermission) {
    return <>{children}</>;
  }
  
  // If no permission and showFallback is true, show fallback
  if (showFallback) {
    return <>{fallback}</>;
  }
  
  // Otherwise, render nothing
  return null;
}

/**
 * Higher-order component that wraps a component with permission checking
 */
export function withPermission<T extends object>(
  Component: React.ComponentType<T>,
  permission: string,
  fallback?: ReactNode
) {
  return function PermissionWrappedComponent(props: T) {
    return (
      <PermissionGuard permission={permission} fallback={fallback} showFallback={!!fallback}>
        <Component {...props} />
      </PermissionGuard>
    );
  };
}

/**
 * Higher-order component that wraps a component with multiple permissions checking
 */
export function withPermissions<T extends object>(
  Component: React.ComponentType<T>,
  permissions: string[],
  requireAll: boolean = true,
  fallback?: ReactNode
) {
  return function PermissionsWrappedComponent(props: T) {
    return (
      <PermissionGuard 
        permissions={permissions} 
        requireAll={requireAll}
        fallback={fallback} 
        showFallback={!!fallback}
      >
        <Component {...props} />
      </PermissionGuard>
    );
  };
}