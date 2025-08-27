import type { Request } from "express";
import { storage } from "./storage";

/**
 * Utility functions for Role-Based Access Control (RBAC)
 */

export interface UserInfo {
  id: string;
  role: string;
  defaultRole?: string;
  isActive: boolean;
}

export interface AccessCheckResult {
  allowed: boolean;
  reason?: string;
  userRole?: string;
  isSuperAdmin?: boolean;
}

/**
 * Check if user is Super Admin
 */
export function isSuperAdmin(user: UserInfo): boolean {
  return user.role === 'Super Admin' || 
         user.defaultRole === 'Super Admin' ||
         user.role === 'super_admin' || 
         user.defaultRole === 'super_admin';
}

/**
 * Check if user is Customer
 */
export function isCustomer(user: UserInfo): boolean {
  return user.role === 'Customer' || user.defaultRole === 'Customer';
}

/**
 * Check if user has permission with Super Admin bypass
 * Super Admin always has full access to everything
 */
export async function hasPermissionWithSuperAdminBypass(
  user: UserInfo,
  permission: string
): Promise<boolean> {
  // Super Admin has access to everything
  if (isSuperAdmin(user)) {
    return true;
  }

  // Check specific permissions for other roles
  if (isCustomer(user)) {
    return await storage.customerHasPermission(user.id, permission);
  } else {
    return await storage.userHasPermission(user.id, permission);
  }
}

/**
 * Get user permissions with Super Admin having all permissions
 */
export async function getUserPermissionsWithSuperAdminBypass(user: UserInfo): Promise<string[]> {
  // Super Admin has all permissions
  if (isSuperAdmin(user)) {
    // Return all possible permissions - Super Admin can do everything
    const allPermissions = await storage.getPermissions();
    return allPermissions.map((p: any) => p.code);
  }

  // Get specific permissions for other roles
  if (isCustomer(user)) {
    return await storage.getCustomerPermissions(user.id);
  } else {
    return await storage.getUserPermissions(user.id);
  }
}

/**
 * Check data access level based on user role and permissions
 */
export async function getDataAccessLevel(user: UserInfo): Promise<{
  canViewAll: boolean;
  canViewOwn: boolean;
  canEditAll: boolean;
  canEditOwn: boolean;
  canDeleteAll: boolean;
  canDeleteOwn: boolean;
  restrictToUserId?: string;
}> {
  // Super Admin has full access to everything
  if (isSuperAdmin(user)) {
    return {
      canViewAll: true,
      canViewOwn: true,
      canEditAll: true,
      canEditOwn: true,
      canDeleteAll: true,
      canDeleteOwn: true,
    };
  }

  // Check specific permissions for other roles
  const permissions = isCustomer(user) 
    ? await storage.getCustomerPermissions(user.id)
    : await storage.getUserPermissions(user.id);

  const canViewAll = permissions.includes('agreement.view.all');
  const canViewOwn = permissions.includes('agreement.view.own');
  const canEditAll = permissions.includes('agreement.edit.all');
  const canEditOwn = permissions.includes('agreement.edit.own');
  const canDeleteAll = permissions.includes('agreement.delete.all');
  const canDeleteOwn = permissions.includes('agreement.delete.own');

  return {
    canViewAll,
    canViewOwn,
    canEditAll,
    canEditOwn,
    canDeleteAll,
    canDeleteOwn,
    // If user can only access own data, restrict to their user ID
    restrictToUserId: (!canViewAll && canViewOwn) ? user.id : undefined,
  };
}

/**
 * Check if user can access specific record based on ownership and permissions
 */
export async function canAccessRecord(
  user: UserInfo,
  record: { customerId?: string; userId?: string; ownerId?: string },
  action: 'view' | 'edit' | 'delete'
): Promise<AccessCheckResult> {
  // Super Admin can access any record
  if (isSuperAdmin(user)) {
    return {
      allowed: true,
      isSuperAdmin: true,
      userRole: user.role,
    };
  }

  const accessLevel = await getDataAccessLevel(user);
  
  // Determine if user owns this record
  const ownsRecord = record.customerId === user.id || 
                    record.userId === user.id || 
                    record.ownerId === user.id;

  let allowed = false;
  let reason = '';

  switch (action) {
    case 'view':
      allowed = accessLevel.canViewAll || (accessLevel.canViewOwn && ownsRecord);
      reason = accessLevel.canViewAll 
        ? 'Has view all permission' 
        : accessLevel.canViewOwn && ownsRecord 
          ? 'Has view own permission and owns record'
          : 'Insufficient view permissions';
      break;
      
    case 'edit':
      allowed = accessLevel.canEditAll || (accessLevel.canEditOwn && ownsRecord);
      reason = accessLevel.canEditAll 
        ? 'Has edit all permission' 
        : accessLevel.canEditOwn && ownsRecord 
          ? 'Has edit own permission and owns record'
          : 'Insufficient edit permissions';
      break;
      
    case 'delete':
      allowed = accessLevel.canDeleteAll || (accessLevel.canDeleteOwn && ownsRecord);
      reason = accessLevel.canDeleteAll 
        ? 'Has delete all permission' 
        : accessLevel.canDeleteOwn && ownsRecord 
          ? 'Has delete own permission and owns record'
          : 'Insufficient delete permissions';
      break;
  }

  return {
    allowed,
    reason,
    userRole: user.role,
    isSuperAdmin: false,
  };
}

/**
 * Apply role-based filtering to database queries
 */
export function applyRoleBasedFiltering(
  baseFilters: any,
  accessLevel: Awaited<ReturnType<typeof getDataAccessLevel>>,
  user: UserInfo
): any {
  // Super Admin sees everything - no additional filtering needed
  if (isSuperAdmin(user)) {
    return baseFilters;
  }

  // If user can only view own records, add user ID filter
  if (accessLevel.restrictToUserId) {
    return {
      ...baseFilters,
      customerId: accessLevel.restrictToUserId,
    };
  }

  // User can view all - return base filters as is
  return baseFilters;
}