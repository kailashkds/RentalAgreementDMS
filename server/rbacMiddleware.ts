import { Request, Response, NextFunction } from "express";
import { storage } from "./storage";

// Import types to ensure proper typing
import "./types";

export interface PermissionOptions {
  permission: string;
  userType?: 'admin' | 'customer' | 'any';
  allowSelf?: boolean; // For endpoints where users can access their own data
  getSelfId?: (req: Request) => string | undefined; // Function to extract the user's own ID from request
}

/**
 * Middleware to check if authenticated user has required permission
 * 
 * @param options - Permission configuration
 * @returns Express middleware function
 */
export function requirePermission(options: PermissionOptions | string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Handle string parameter (simple permission check)
      const permissionConfig: PermissionOptions = typeof options === 'string' 
        ? { permission: options, userType: 'any' }
        : options;

      const { permission, userType = 'any', allowSelf = false, getSelfId } = permissionConfig;

      // Check if user is authenticated
      if (!req.session?.userId && !req.session?.customerId) {
        return res.status(401).json({ 
          message: "Please log in to access this feature",
          error: "authentication_required",
          action: "Log in with your username and password to continue"
        });
      }

      const isAdmin = !!req.session?.userId && !!req.user;
      const isCustomer = !!req.session?.customerId && !!req.customer;
      
      // Type checking
      if (userType === 'admin' && !isAdmin) {
        return res.status(403).json({ 
          message: "This feature requires administrator access",
          error: "admin_access_required",
          action: "Contact an administrator or log in with an admin account"
        });
      }
      
      if (userType === 'customer' && !isCustomer) {
        return res.status(403).json({ 
          message: "This feature is only available to customers",
          error: "customer_access_required", 
          action: "Log in with a customer account to access this feature"
        });
      }

      let hasPermission = false;
      let userId: string | undefined;

      // Check admin user permissions
      if (isAdmin && (userType === 'admin' || userType === 'any')) {
        userId = req.user!.id;
        
        // Cache permissions for efficiency
        if (!req.userPermissions) {
          req.userPermissions = await storage.getUserPermissions(userId);
          req.userType = 'admin';
        }
        
        hasPermission = req.userPermissions.includes(permission);
      }

      // Check customer permissions
      if (isCustomer && (userType === 'customer' || userType === 'any') && !hasPermission) {
        userId = req.customer!.id;
        
        // Cache permissions for efficiency
        if (!req.customerPermissions) {
          req.customerPermissions = await storage.getCustomerPermissions(userId);
          req.userType = 'customer';
        }
        
        hasPermission = req.customerPermissions.includes(permission);
      }

      // Check self-access permissions
      if (!hasPermission && allowSelf && getSelfId && userId) {
        const selfId = getSelfId(req);
        if (selfId === userId) {
          hasPermission = true;
        }
      }

      if (!hasPermission) {
        return res.status(403).json({ 
          message: "Insufficient permissions", 
          required: permission,
          userType: req.userType
        });
      }

      next();
    } catch (error) {
      console.error("Permission check error:", error);
      return res.status(500).json({ message: "Permission check failed" });
    }
  };
}

/**
 * Middleware to check multiple permissions (user must have ALL of them)
 */
export function requireAllPermissions(permissions: string[], userType: 'admin' | 'customer' | 'any' = 'any') {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.session?.userId && !req.session?.customerId) {
        return res.status(401).json({ 
          message: "Please log in to access this feature",
          error: "authentication_required",
          action: "Log in with your username and password to continue"
        });
      }

      const isAdmin = !!req.session?.userId && !!req.user;
      const isCustomer = !!req.session?.customerId && !!req.customer;
      
      // Type checking
      if (userType === 'admin' && !isAdmin) {
        return res.status(403).json({ 
          message: "This feature requires administrator access",
          error: "admin_access_required",
          action: "Contact an administrator or log in with an admin account"
        });
      }
      
      if (userType === 'customer' && !isCustomer) {
        return res.status(403).json({ 
          message: "This feature is only available to customers",
          error: "customer_access_required", 
          action: "Log in with a customer account to access this feature"
        });
      }

      let userPermissions: string[] = [];

      // Get admin user permissions
      if (isAdmin && (userType === 'admin' || userType === 'any')) {
        const userId = req.user!.id;
        if (!req.userPermissions) {
          req.userPermissions = await storage.getUserPermissions(userId);
          req.userType = 'admin';
        }
        userPermissions = req.userPermissions;
      }

      // Get customer permissions
      if (isCustomer && (userType === 'customer' || userType === 'any')) {
        const customerId = req.customer!.id;
        if (!req.customerPermissions) {
          req.customerPermissions = await storage.getCustomerPermissions(customerId);
          req.userType = 'customer';
        }
        userPermissions = req.customerPermissions;
      }

      // Check if user has all required permissions
      const missingPermissions = permissions.filter(perm => !userPermissions.includes(perm));
      
      if (missingPermissions.length > 0) {
        return res.status(403).json({ 
          message: "Insufficient permissions", 
          required: permissions,
          missing: missingPermissions,
          userType: req.userType
        });
      }

      next();
    } catch (error) {
      console.error("Permission check error:", error);
      return res.status(500).json({ message: "Permission check failed" });
    }
  };
}

/**
 * Middleware to check if user has ANY of the specified permissions
 */
export function requireAnyPermission(permissions: string[], userType: 'admin' | 'customer' | 'any' = 'any') {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.session?.userId && !req.session?.customerId) {
        return res.status(401).json({ 
          message: "Please log in to access this feature",
          error: "authentication_required",
          action: "Log in with your username and password to continue"
        });
      }

      const isAdmin = !!req.session?.userId && !!req.user;
      const isCustomer = !!req.session?.customerId && !!req.customer;
      
      // Type checking
      if (userType === 'admin' && !isAdmin) {
        return res.status(403).json({ 
          message: "This feature requires administrator access",
          error: "admin_access_required",
          action: "Contact an administrator or log in with an admin account"
        });
      }
      
      if (userType === 'customer' && !isCustomer) {
        return res.status(403).json({ 
          message: "This feature is only available to customers",
          error: "customer_access_required", 
          action: "Log in with a customer account to access this feature"
        });
      }

      let userPermissions: string[] = [];

      // Get admin user permissions
      if (isAdmin && (userType === 'admin' || userType === 'any')) {
        const userId = req.user!.id;
        if (!req.userPermissions) {
          req.userPermissions = await storage.getUserPermissions(userId);
          req.userType = 'admin';
        }
        userPermissions = req.userPermissions;
      }

      // Get customer permissions
      if (isCustomer && (userType === 'customer' || userType === 'any')) {
        const customerId = req.customer!.id;
        if (!req.customerPermissions) {
          req.customerPermissions = await storage.getCustomerPermissions(customerId);
          req.userType = 'customer';
        }
        userPermissions = req.customerPermissions;
      }

      // Check if user has any of the required permissions
      const hasAnyPermission = permissions.some(perm => userPermissions.includes(perm));
      
      if (!hasAnyPermission) {
        return res.status(403).json({ 
          message: "Insufficient permissions", 
          required: `Any of: ${permissions.join(', ')}`,
          userType: req.userType
        });
      }

      next();
    } catch (error) {
      console.error("Permission check error:", error);
      return res.status(500).json({ message: "Permission check failed" });
    }
  };
}

/**
 * Utility function to check permission in route handlers
 */
export async function checkPermission(
  req: Request, 
  permission: string, 
  userType: 'admin' | 'customer' | 'any' = 'any'
): Promise<boolean> {
  try {
    const isAdmin = !!req.session?.userId && !!req.user;
    const isCustomer = !!req.session?.customerId && !!req.customer;
    
    if (!isAdmin && !isCustomer) return false;
    
    // Type checking
    if (userType === 'admin' && !isAdmin) return false;
    if (userType === 'customer' && !isCustomer) return false;

    // Check admin user permissions
    if (isAdmin && (userType === 'admin' || userType === 'any')) {
      const userId = req.user!.id;
      if (!req.userPermissions) {
        req.userPermissions = await storage.getUserPermissions(userId);
        req.userType = 'admin';
      }
      if (req.userPermissions.includes(permission)) return true;
    }

    // Check customer permissions
    if (isCustomer && (userType === 'customer' || userType === 'any')) {
      const customerId = req.customer!.id;
      if (!req.customerPermissions) {
        req.customerPermissions = await storage.getCustomerPermissions(customerId);
        req.userType = 'customer';
      }
      return req.customerPermissions.includes(permission);
    }

    return false;
  } catch (error) {
    console.error("Permission check error:", error);
    return false;
  }
}

/**
 * Helper function to get current user ID regardless of user type
 */
export function getCurrentUserId(req: Request): string | undefined {
  return req.session?.user?.id || req.session?.customer?.id;
}

/**
 * Helper function to check if current user can access resource owned by specific user
 */
export async function canAccessOwnResource(
  req: Request, 
  resourceOwnerId: string, 
  ownPermission: string, 
  allPermission: string
): Promise<boolean> {
  const currentUserId = getCurrentUserId(req);
  
  if (!currentUserId) return false;
  
  // User can always access their own resources if they have the "own" permission
  if (currentUserId === resourceOwnerId) {
    return await checkPermission(req, ownPermission);
  }
  
  // Otherwise, user needs the "all" permission
  return await checkPermission(req, allPermission);
}

// Common permission patterns
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