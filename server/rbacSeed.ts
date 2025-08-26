import { storage } from "./storage";

// Initial permissions catalog
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
  AGREEMENT_VIEW_NOTARIZED_OWN: "agreement.view.notarized.own",
  AGREEMENT_VIEW_NOTARIZED_ALL: "agreement.view.notarized.all",
  AGREEMENT_EDIT_NOTARIZED_OWN: "agreement.edit.notarized.own",
  AGREEMENT_EDIT_NOTARIZED_ALL: "agreement.edit.notarized.all",
  VIEW_SENSITIVE_INFO: "view.sensitive.info",
  
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

// Default roles configuration
export const DEFAULT_ROLES = {
  CUSTOMER: {
    name: "Customer",
    description: "Basic customer with limited agreement access",
    permissions: [
      PERMISSIONS.AGREEMENT_VIEW_OWN,
      PERMISSIONS.AGREEMENT_EDIT_OWN,
      PERMISSIONS.DOWNLOAD_AGREEMENT_OWN,
      PERMISSIONS.SHARE_AGREEMENT_OWN,
      PERMISSIONS.AGREEMENT_VIEW_NOTARIZED_OWN,
      PERMISSIONS.AGREEMENT_EDIT_NOTARIZED_OWN,
    ]
  },
  STAFF: {
    name: "Staff", 
    description: "Staff member with agreement management capabilities",
    permissions: [
      PERMISSIONS.AGREEMENT_VIEW_ALL,
      PERMISSIONS.AGREEMENT_CREATE,
      PERMISSIONS.AGREEMENT_EDIT_ALL,
      PERMISSIONS.DOWNLOAD_AGREEMENT_ALL,
      PERMISSIONS.SHARE_AGREEMENT_ALL,
      PERMISSIONS.CUSTOMER_VIEW_ALL,
      PERMISSIONS.TEMPLATE_MANAGE,
      PERMISSIONS.TEMPLATE_CREATE,
      PERMISSIONS.TEMPLATE_EDIT,
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.AGREEMENT_VIEW_NOTARIZED_ALL,
      PERMISSIONS.AGREEMENT_EDIT_NOTARIZED_ALL,
      PERMISSIONS.VIEW_SENSITIVE_INFO,
    ]
  },
  SUPER_ADMIN: {
    name: "Super Admin",
    description: "Full system administrator with all permissions",
    permissions: Object.values(PERMISSIONS)
  }
} as const;

export async function seedRBAC() {
  console.log("🌱 Starting RBAC seeding...");

  try {
    // 1. Create all permissions
    console.log("📋 Creating permissions...");
    const permissionMap = new Map<string, string>();
    
    for (const [key, code] of Object.entries(PERMISSIONS)) {
      try {
        // Check if permission already exists
        const existing = await storage.getPermissionByCode(code);
        if (existing) {
          permissionMap.set(code, existing.id);
          console.log(`  ✓ Permission '${code}' already exists`);
          continue;
        }

        // Create new permission
        const permission = await storage.createPermission({
          code,
          description: `${key.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())} permission`,
        });
        
        permissionMap.set(code, permission.id);
        console.log(`  ✅ Created permission '${code}'`);
      } catch (error) {
        console.error(`  ❌ Failed to create permission '${code}':`, String(error));
      }
    }

    // 2. Create default roles and assign permissions
    console.log("👥 Creating roles...");
    
    for (const [roleKey, roleConfig] of Object.entries(DEFAULT_ROLES)) {
      try {
        // Check if role already exists
        let role = await storage.getRoleByName(roleConfig.name);
        
        if (!role) {
          // Create new role
          const newRole = await storage.createRole({
            name: roleConfig.name,
            description: roleConfig.description,
          });
          
          role = {
            ...newRole,
            permissions: []
          };
          console.log(`  ✅ Created role '${roleConfig.name}'`);
        } else {
          console.log(`  ✓ Role '${roleConfig.name}' already exists`);
        }

        // Assign permissions to role
        console.log(`  🔗 Assigning permissions to '${roleConfig.name}'...`);
        for (const permissionCode of roleConfig.permissions) {
          const permissionId = permissionMap.get(permissionCode);
          if (permissionId) {
            try {
              await storage.assignPermissionToRole(role.id, permissionId);
              console.log(`    ✅ Assigned '${permissionCode}' to '${roleConfig.name}'`);
            } catch (error) {
              // Permission might already be assigned, which is fine
              const errorMsg = String(error);
              if (!errorMsg.includes('unique') && !errorMsg.includes('duplicate')) {
                console.error(`    ❌ Failed to assign '${permissionCode}' to '${roleConfig.name}':`, String(error));
              } else {
                console.log(`    ✓ Permission '${permissionCode}' already assigned to '${roleConfig.name}'`);
              }
            }
          } else {
            console.error(`    ❌ Permission '${permissionCode}' not found`);
          }
        }
      } catch (error) {
        console.error(`  ❌ Failed to create role '${roleConfig.name}':`, error);
      }
    }

    console.log("🎉 RBAC seeding completed successfully!");
    
    // Display summary
    const allPermissions = await storage.getPermissions();
    const allRoles = await storage.getRoles();
    
    console.log(`\n📊 RBAC Summary:`);
    console.log(`  • Permissions: ${allPermissions.length}`);
    console.log(`  • Roles: ${allRoles.length}`);
    
    for (const role of allRoles) {
      console.log(`    - ${role.name}: ${role.permissions.length} permissions`);
    }

  } catch (error) {
    console.error("💥 RBAC seeding failed:", error);
    throw error;
  }
}

// Utility function to assign role to user
export async function assignDefaultRoleToUser(userId: string, roleName: string) {
  try {
    const role = await storage.getRoleByName(roleName);
    if (!role) {
      throw new Error(`Role '${roleName}' not found`);
    }

    await storage.assignRoleToUser(userId, role.id);
    console.log(`✅ Assigned role '${roleName}' to user ${userId}`);
  } catch (error) {
    console.error(`❌ Failed to assign role '${roleName}' to user ${userId}:`, error);
    throw error;
  }
}

// Utility function to assign role to customer
export async function assignDefaultRoleToCustomer(customerId: string, roleName: string) {
  try {
    const role = await storage.getRoleByName(roleName);
    if (!role) {
      throw new Error(`Role '${roleName}' not found`);
    }

    await storage.assignRoleToCustomer(customerId, role.id);
    console.log(`✅ Assigned role '${roleName}' to customer ${customerId}`);
  } catch (error) {
    console.error(`❌ Failed to assign role '${roleName}' to customer ${customerId}:`, error);
    throw error;
  }
}