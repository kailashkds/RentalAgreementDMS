import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import type { Address } from "@shared/schema";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { mapFormDataToTemplateFields, generatePdfHtml, convertPdfToImages } from "./fieldMapping";
import { setupAuth, requireAuth, optionalAuth } from "./auth";
import { requirePermission } from "./rbacMiddleware";
import { insertCustomerSchema, insertSocietySchema, insertPropertySchema, insertAgreementSchema, insertPdfTemplateSchema } from "@shared/schema";
import { directFileUpload } from "./directFileUpload";
import { upload, getFileInfo, deleteFile, readFileAsBase64 } from "./localFileUpload";
import { seedRBAC, assignDefaultRoleToUser, assignDefaultRoleToCustomer } from "./rbacSeed";
import { z } from "zod";
import bcrypt from "bcrypt";
import { decryptPasswordFromStorage, encryptPasswordForStorage } from "./encryption";
import path from "path";
import fs from "fs";
import { generatePassword, generateUsername, generateUserDisplayId } from "./utils/credentialGenerator";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication system
  await setupAuth(app);
  
  // Debug endpoint to check admin user status (temporary)
  app.get("/api/debug/admin-status", async (req, res) => {
    try {
      const adminUser = await storage.getUserByUsername("admin");
      const allAdmins = await storage.getUsers({ defaultRole: "super_admin" });
      res.json({
        adminExists: !!adminUser,
        adminUser: adminUser ? { 
          id: adminUser.id, 
          username: adminUser.username, 
          phone: adminUser.phone, 
          name: `${adminUser.firstName || ''} ${adminUser.lastName || ''}`.trim() 
        } : null,
        totalAdmins: allAdmins.users.length,
        environment: process.env.NODE_ENV || 'development'
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // Emergency admin creation endpoint
  app.post("/api/create-admin", async (req, res) => {
    try {
      const { secret } = req.body;
      if (secret !== "quickkaraar2024") {
        return res.status(403).json({ message: "Invalid secret" });
      }
      
      const existingAdmin = await storage.getUserByUsername("admin");
      if (existingAdmin) {
        return res.json({ 
          message: "Admin already exists", 
          admin: { 
            username: existingAdmin.username, 
            phone: existingAdmin.phone, 
            name: `${existingAdmin.firstName || ''} ${existingAdmin.lastName || ''}`.trim() 
          } 
        });
      }
      
      const hashedPassword = await bcrypt.hash("admin123", 10);
      const newAdmin = await storage.createUser({
        name: "Administrator",
        username: "admin",
        phone: "9999999999",
        firstName: "Administrator",
        lastName: null,
        password: hashedPassword,
        defaultRole: "super_admin",
        status: "active"
      });
      
      res.json({ 
        message: "Admin created successfully", 
        admin: { 
          username: newAdmin.username, 
          phone: newAdmin.phone, 
          name: `${newAdmin.firstName || ''} ${newAdmin.lastName || ''}`.trim() 
        } 
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });
  // Dashboard stats
  app.get("/api/dashboard/stats", requireAuth, async (req: any, res) => {
    try {
      // Check permissions to determine data access level
      const canViewAllAgreements = await storage.userHasPermission(req.user.id, 'agreement.view.all');
      const canViewOwnAgreements = await storage.userHasPermission(req.user.id, 'agreement.view.own');
      
      if (!canViewAllAgreements && !canViewOwnAgreements) {
        return res.status(403).json({ message: "Insufficient permissions to view dashboard" });
      }
      
      // If user can only view own agreements, filter stats by their ID
      const userId = (!canViewAllAgreements && canViewOwnAgreements) ? req.user.id : undefined;
      const stats = await storage.getDashboardStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // RBAC initialization endpoint
  app.post("/api/rbac/seed", async (req, res) => {
    try {
      await seedRBAC();
      res.json({ message: "RBAC system seeded successfully" });
    } catch (error) {
      console.error("Error seeding RBAC:", error);
      res.status(500).json({ message: "Failed to seed RBAC system", error: String(error) });
    }
  });

  // RBAC API endpoints
  // Get current user's permissions
  app.get("/api/auth/permissions", requireAuth, async (req, res) => {
    try {
      const permissions = await storage.getUserPermissions(req.user!.id);
      res.json(permissions);
    } catch (error) {
      console.error("Error fetching user permissions:", error);
      res.status(500).json({ message: "Failed to fetch user permissions" });
    }
  });

  // Enhanced user creation with auto-generated credentials
  app.post("/api/users/create", requireAuth, async (req, res) => {
    try {
      const { name, userType, roleId } = req.body;
      
      if (!name || !userType) {
        return res.status(400).json({ message: "Name and user type are required" });
      }

      // Generate credentials
      const username = generateUsername(name, userType);
      const password = generatePassword(8);
      const displayId = generateUserDisplayId(userType);
      const hashedPassword = await bcrypt.hash(password, 10);

      let user;
      
      if (userType === "admin") {
        // Create admin user
        user = await storage.createAdminUser({
          username,
          phone: `generated_${Date.now()}`, // Temporary phone for admin users
          password: hashedPassword,
          name,
          role: "staff",
          isActive: true,
        });
        
        // Assign role if specified
        if (roleId) {
          await storage.assignRoleToUser(user.id, roleId);
        }
      } else {
        // Create customer
        user = await storage.createCustomer({
          name,
          username,
          mobile: `generated_${Date.now()}`, // Temporary mobile for customers  
          password: hashedPassword,
          isActive: true,
        });
        
        // Assign role if specified
        if (roleId) {
          await storage.assignRoleToCustomer(user.id, roleId);
        }
      }

      // Return user info with generated credentials (password only returned once)
      res.status(201).json({
        user: {
          id: user.id,
          name: user.name,
          username,
          userType,
          displayId,
          isActive: user.isActive,
        },
        credentials: {
          username,
          password, // Only returned once for admin to share
          displayId,
        }
      });
    } catch (error: any) {
      console.error("Error creating user:", error);
      if (error.code === '23505') {
        return res.status(400).json({ message: "Username already exists, please try again" });
      }
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  // Delete admin user endpoint (protected)
  app.delete("/api/admin/users/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Only super_admin can delete admin users
      if (req.user!.role !== 'super_admin') {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      
      // Prevent user from deleting themselves
      if (req.user!.id === id) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }
      
      // Check if user exists
      const userToDelete = await storage.getAdminUser(id);
      if (!userToDelete) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Delete the user
      await storage.deleteAdminUser(id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete admin user error:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Delete customer endpoint (protected)
  app.delete("/api/customers/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Only super_admin can delete customers
      if (req.user!.role !== 'super_admin') {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      
      // Delete the customer
      await storage.deleteCustomer(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Delete customer error:", error);
      if (error.message?.includes('existing agreements')) {
        return res.status(400).json({ message: "Cannot delete customer with existing agreements" });
      }
      res.status(500).json({ message: "Failed to delete customer" });
    }
  });

  // Unified user management endpoints
  app.get("/api/unified/users", requireAuth, requirePermission({ permission: "user.view.all" }), async (req: any, res) => {
    try {
      const { role, status, search, limit, offset } = req.query;
      const result = await storage.getUsersWithRoles({
        role: role as string,
        status: status as string,
        search: search as string,
        limit: limit ? parseInt(limit as string) : 50,
        offset: offset ? parseInt(offset as string) : 0,
      });
      res.json(result);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post("/api/unified/users", requireAuth, requirePermission("user.create"), async (req: any, res) => {
    try {
      const { name, email, username, phone, roleId, password } = req.body;
      
      // Validate required fields
      if (!name || !roleId) {
        return res.status(400).json({ message: "Name and role are required" });
      }

      // Generate credentials if not provided
      const finalUsername = username || generateUsername();
      const finalPassword = password || generatePassword();
      const hashedPassword = await bcrypt.hash(finalPassword, 10);

      // Create user
      const user = await storage.createUser({
        name,
        email,
        username: finalUsername,
        phone,
        password: hashedPassword,
        status: 'active',
        isActive: true,
      });

      // Assign role
      if (roleId) {
        await storage.assignUserRole(user.id, roleId);
      }

      // Log audit (non-blocking)
      try {
        await storage.createAuditLog({
          action: 'user.created',
          resourceType: 'user',
          resourceId: user.id,
          changedBy: req.user.id,
          diff: { created: { name, email, username: finalUsername, roleId } },
          metadata: { userAgent: req.headers['user-agent'], ip: req.ip }
        });
      } catch (auditError) {
        console.warn("Failed to create audit log:", auditError);
      }

      res.status(201).json({
        user,
        credentials: { username: finalUsername, password: finalPassword }
      });
    } catch (error: any) {
      console.error("Error creating user:", error);
      
      // Handle specific constraint violations
      if (error.code === '23505') {
        if (error.detail?.includes('email')) {
          return res.status(400).json({ message: "Email already exists" });
        }
        if (error.detail?.includes('username')) {
          return res.status(400).json({ message: "Username already exists" });
        }
        if (error.detail?.includes('phone') || error.detail?.includes('mobile')) {
          return res.status(400).json({ message: "Phone number already exists" });
        }
      }
      
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.put("/api/unified/users/:id", requireAuth, requirePermission({ permission: "user.edit.all" }), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { name, email, username, phone, status, isActive, roleId } = req.body;
      
      // Get existing user
      const existingUser = await storage.getUser(id);
      if (!existingUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Update user
      const updatedUser = await storage.updateUser(id, {
        name,
        email,
        username,
        phone,
        status,
        isActive,
      });

      // Update role if provided
      if (roleId) {
        // Remove existing roles
        const currentRoles = await storage.getUserRoles(id);
        for (const role of currentRoles) {
          await storage.removeUserRole(id, role.id);
        }
        // Assign new role
        await storage.assignUserRole(id, roleId);
      }

      // Log audit (non-blocking)
      try {
        await storage.createAuditLog({
          action: 'user.updated',
          resourceType: 'user',
          resourceId: id,
          changedBy: req.user.id,
          diff: { 
            before: existingUser, 
            after: { name, email, username, phone, status, isActive, roleId } 
          },
          metadata: { userAgent: req.headers['user-agent'], ip: req.ip }
        });
      } catch (auditError) {
        console.warn("Failed to create audit log:", auditError);
      }

      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete("/api/unified/users/:id", requireAuth, requirePermission({ permission: "user.delete.all" }), async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Prevent user from deleting themselves
      if (req.user.id === id) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }

      // Get user before deleting for audit log
      const existingUser = await storage.getUser(id);
      if (!existingUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Delete user
      await storage.deleteUser(id);

      // Log audit (non-blocking)
      try {
        await storage.createAuditLog({
          action: 'user.deleted',
          resourceType: 'user',
          resourceId: id,
          changedBy: req.user.id,
          diff: { deleted: existingUser },
          metadata: { userAgent: req.headers['user-agent'], ip: req.ip }
        });
      } catch (auditError) {
        console.warn("Failed to create audit log:", auditError);
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  app.patch("/api/unified/users/:id/reset-password", requireAuth, requirePermission({ permission: "user.edit.all" }), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;
      
      const finalPassword = newPassword || generatePassword();
      await storage.resetUserPassword(id, finalPassword);

      // Log audit (non-blocking)
      try {
        await storage.createAuditLog({
          action: 'user.password_reset',
          resourceType: 'user',
          resourceId: id,
          changedBy: req.user.id,
          metadata: { userAgent: req.headers['user-agent'], ip: req.ip }
        });
      } catch (auditError) {
        console.warn("Failed to create audit log:", auditError);
      }

      res.json({ password: finalPassword });
    } catch (error) {
      console.error("Error resetting user password:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  app.patch("/api/unified/users/:id/toggle-status", requireAuth, requirePermission({ permission: "user.edit.all" }), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { isActive } = req.body;
      
      const user = await storage.toggleUserStatus(id, isActive);

      // Log audit (non-blocking)
      try {
        await storage.createAuditLog({
          action: 'user.status_changed',
          resourceType: 'user',
          resourceId: id,
          changedBy: req.user.id,
          diff: { status: isActive ? 'active' : 'inactive' },
          metadata: { userAgent: req.headers['user-agent'], ip: req.ip }
        });
      } catch (auditError) {
        console.warn("Failed to create audit log:", auditError);
      }

      res.json(user);
    } catch (error) {
      console.error("Error toggling user status:", error);
      res.status(500).json({ message: "Failed to toggle user status" });
    }
  });

  // RBAC management endpoints
  app.get("/api/rbac/permissions", requireAuth, async (req, res) => {
    try {
      const permissions = await storage.getPermissions();
      res.json(permissions);
    } catch (error) {
      console.error("Error fetching permissions:", error);
      res.status(500).json({ message: "Failed to fetch permissions" });
    }
  });

  app.get("/api/rbac/roles", requireAuth, async (req, res) => {
    try {
      const roles = await storage.getRoles();
      res.json(roles);
    } catch (error) {
      console.error("Error fetching roles:", error);
      res.status(500).json({ message: "Failed to fetch roles" });
    }
  });

  // Create new role
  app.post("/api/rbac/roles", requireAuth, async (req: any, res) => {
    try {
      const { name, description, permissions: permissionIds = [] } = req.body;

      // Create the role
      const role = await storage.createRole({ name, description });
      
      // Assign permissions to the role
      for (const permissionId of permissionIds) {
        await storage.assignPermissionToRole(role.id, permissionId);
      }

      // Create audit log
      await storage.createAuditLog({
        action: "role.created",
        resourceType: "role",
        resourceId: role.id,
        changedBy: req.user.claims.sub,
        diff: {
          created: {
            name,
            description,
            permissions: permissionIds,
          }
        },
        metadata: {
          userAgent: req.headers['user-agent'],
          ip: req.ip
        }
      });

      res.json(role);
    } catch (error) {
      console.error("Error creating role:", error);
      res.status(500).json({ message: "Failed to create role" });
    }
  });

  // Update role
  app.put("/api/rbac/roles/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const roleData = z.object({
        name: z.string().optional(),
        description: z.string().optional(),
      }).parse(req.body);

      const role = await storage.updateRole(id, roleData);
      res.json(role);
    } catch (error) {
      console.error("Error updating role:", error);
      res.status(500).json({ message: "Failed to update role" });
    }
  });

  // Get role permissions
  app.get("/api/rbac/roles/:id/permissions", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const permissions = await storage.getRolePermissions(id);
      res.json(permissions);
    } catch (error) {
      console.error("Error fetching role permissions:", error);
      res.status(500).json({ message: "Failed to fetch role permissions" });
    }
  });

  // Assign permission to role
  app.post("/api/rbac/assign-role-permission", requireAuth, async (req, res) => {
    try {
      const { roleId, permissionId } = req.body;
      await storage.assignPermissionToRole(roleId, permissionId);
      res.json({ message: "Permission assigned to role successfully" });
    } catch (error) {
      console.error("Error assigning permission to role:", error);
      res.status(500).json({ message: "Failed to assign permission to role" });
    }
  });

  // Remove permission from role
  app.delete("/api/rbac/remove-role-permission", requireAuth, async (req, res) => {
    try {
      const { roleId, permissionId } = req.body;
      await storage.removePermissionFromRole(roleId, permissionId);
      res.json({ message: "Permission removed from role successfully" });
    } catch (error) {
      console.error("Error removing permission from role:", error);
      res.status(500).json({ message: "Failed to remove permission from role" });
    }
  });

  // Role assignment endpoints
  app.post("/api/rbac/assign-user-role", requireAuth, async (req, res) => {
    try {
      const { userId, roleId } = req.body;
      await storage.assignRoleToUser(userId, roleId);
      res.json({ message: "Role assigned to user successfully" });
    } catch (error) {
      console.error("Error assigning role to user:", error);
      res.status(500).json({ message: "Failed to assign role to user" });
    }
  });

  app.post("/api/rbac/assign-customer-role", requireAuth, async (req, res) => {
    try {
      const { userId, roleId } = req.body;
      await storage.assignRoleToCustomer(userId, roleId);
      res.json({ message: "Role assigned to customer successfully" });
    } catch (error) {
      console.error("Error assigning role to customer:", error);
      res.status(500).json({ message: "Failed to assign role to customer" });
    }
  });

  app.delete("/api/rbac/remove-user-role", requireAuth, async (req, res) => {
    try {
      const { userId, roleId } = req.body;
      await storage.removeRoleFromUser(userId, roleId);
      res.json({ message: "Role removed from user successfully" });
    } catch (error) {
      console.error("Error removing role from user:", error);
      res.status(500).json({ message: "Failed to remove role from user" });
    }
  });

  app.delete("/api/rbac/remove-customer-role", requireAuth, async (req, res) => {
    try {
      const { userId, roleId } = req.body;
      await storage.removeRoleFromCustomer(userId, roleId);
      res.json({ message: "Role removed from customer successfully" });
    } catch (error) {
      console.error("Error removing role from customer:", error);
      res.status(500).json({ message: "Failed to remove role from customer" });
    }
  });

  // Audit Logs API
  app.get("/api/rbac/audit-logs", requireAuth, async (req: any, res) => {
    try {
      const { action, resourceId, changedBy, limit = 50, offset = 0 } = req.query;
      
      const result = await storage.getAuditLogs({
        action: action as string,
        resourceId: resourceId as string,
        changedBy: changedBy as string,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });
      
      res.json(result);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  app.get("/api/rbac/roles/:id/audit-logs", requireAuth, async (req, res) => {
    try {
      const logs = await storage.getAuditLogsForRole(req.params.id);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching role audit logs:", error);
      res.status(500).json({ message: "Failed to fetch role audit logs" });
    }
  });

  // Role Cloning API
  app.post("/api/rbac/roles/:id/clone", requireAuth, async (req: any, res) => {
    try {
      const { name, description } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: "Name is required for cloned role" });
      }

      // Get source role with permissions
      const sourceRole = await storage.getRole(req.params.id);
      if (!sourceRole) {
        return res.status(404).json({ error: "Source role not found" });
      }

      // Get permissions of source role
      const sourcePermissions = await storage.getRolePermissions(req.params.id);
      const permissionIds = sourcePermissions.map(p => p.id);

      // Create new role
      const newRole = await storage.createRole({
        name,
        description: description || `Cloned from ${sourceRole.name}`,
      });

      // Assign same permissions
      for (const permissionId of permissionIds) {
        await storage.assignPermissionToRole(newRole.id, permissionId);
      }

      // Create audit log
      await storage.createAuditLog({
        action: "role.created",
        resourceType: "role",
        resourceId: newRole.id,
        changedBy: req.user.claims.sub,
        diff: {
          created: {
            name,
            description,
            permissions: permissionIds,
            clonedFrom: sourceRole.id
          }
        },
        metadata: {
          userAgent: req.headers['user-agent'],
          ip: req.ip
        }
      });

      res.json({ role: newRole, permissions: sourcePermissions });
    } catch (error) {
      console.error("Error cloning role:", error);
      res.status(500).json({ error: "Failed to clone role" });
    }
  });

  // Role Templates API
  app.get("/api/rbac/role-templates", requireAuth, async (req, res) => {
    try {
      // Return predefined role templates
      const templates = [
        {
          id: "customer-template",
          name: "Customer Template",
          description: "Basic customer access with own-only permissions",
          permissions: ["agreement.view.own", "download.agreement.own", "dashboard.view"]
        },
        {
          id: "staff-template", 
          name: "Staff Template",
          description: "Staff access with agreement management and customer view",
          permissions: [
            "agreement.view.all", "agreement.create", "agreement.edit.own", "agreement.notarize",
            "download.agreement.all", "share.agreement.all", "customer.view.all",
            "template.create", "template.edit", "dashboard.view"
          ]
        },
        {
          id: "admin-template",
          name: "Admin Template", 
          description: "Full administrative access to all resources",
          permissions: "all"
        }
      ];
      
      res.json(templates);
    } catch (error) {
      console.error("Error fetching role templates:", error);
      res.status(500).json({ message: "Failed to fetch role templates" });
    }
  });

  // Legacy endpoints (keeping for backwards compatibility)
  // Permissions
  app.get("/api/permissions", requireAuth, async (req, res) => {
    try {
      const permissions = await storage.getPermissions();
      res.json(permissions);
    } catch (error) {
      console.error("Error fetching permissions:", error);
      res.status(500).json({ message: "Failed to fetch permissions" });
    }
  });

  app.post("/api/permissions", requireAuth, async (req, res) => {
    try {
      const permissionData = z.object({
        code: z.string(),
        name: z.string(),
        description: z.string().optional(),
      }).parse(req.body);

      const permission = await storage.createPermission({
        code: permissionData.code,
        description: permissionData.description || permissionData.name,
      });
      res.json(permission);
    } catch (error) {
      console.error("Error creating permission:", error);
      res.status(500).json({ message: "Failed to create permission" });
    }
  });

  app.put("/api/permissions/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const permissionData = z.object({
        code: z.string().optional(),
        name: z.string().optional(),
        description: z.string().optional(),
      }).parse(req.body);

      const permission = await storage.updatePermission(id, permissionData);
      res.json(permission);
    } catch (error) {
      console.error("Error updating permission:", error);
      res.status(500).json({ message: "Failed to update permission" });
    }
  });

  app.delete("/api/permissions/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deletePermission(id);
      res.json({ message: "Permission deleted successfully" });
    } catch (error) {
      console.error("Error deleting permission:", error);
      res.status(500).json({ message: "Failed to delete permission" });
    }
  });

  // Roles
  app.get("/api/roles", requireAuth, async (req, res) => {
    try {
      const roles = await storage.getRoles();
      res.json(roles);
    } catch (error) {
      console.error("Error fetching roles:", error);
      res.status(500).json({ message: "Failed to fetch roles" });
    }
  });

  app.get("/api/roles/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const role = await storage.getRole(id);
      if (!role) {
        return res.status(404).json({ message: "Role not found" });
      }
      res.json(role);
    } catch (error) {
      console.error("Error fetching role:", error);
      res.status(500).json({ message: "Failed to fetch role" });
    }
  });

  app.post("/api/roles", requireAuth, async (req, res) => {
    try {
      const roleData = z.object({
        name: z.string(),
        description: z.string().optional(),
      }).parse(req.body);

      const role = await storage.createRole(roleData);
      res.json(role);
    } catch (error) {
      console.error("Error creating role:", error);
      res.status(500).json({ message: "Failed to create role" });
    }
  });

  app.put("/api/roles/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const roleData = z.object({
        name: z.string().optional(),
        description: z.string().optional(),
      }).parse(req.body);

      const role = await storage.updateRole(id, roleData);
      res.json(role);
    } catch (error) {
      console.error("Error updating role:", error);
      res.status(500).json({ message: "Failed to update role" });
    }
  });

  app.delete("/api/roles/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteRole(id);
      res.json({ message: "Role deleted successfully" });
    } catch (error) {
      console.error("Error deleting role:", error);
      res.status(500).json({ message: "Failed to delete role" });
    }
  });

  // Role-Permission assignments
  app.post("/api/roles/:roleId/permissions/:permissionId", requireAuth, async (req, res) => {
    try {
      const { roleId, permissionId } = req.params;
      await storage.assignPermissionToRole(roleId, permissionId);
      res.json({ message: "Permission assigned to role successfully" });
    } catch (error) {
      console.error("Error assigning permission to role:", error);
      res.status(500).json({ message: "Failed to assign permission to role" });
    }
  });

  app.delete("/api/roles/:roleId/permissions/:permissionId", requireAuth, async (req, res) => {
    try {
      const { roleId, permissionId } = req.params;
      await storage.removePermissionFromRole(roleId, permissionId);
      res.json({ message: "Permission removed from role successfully" });
    } catch (error) {
      console.error("Error removing permission from role:", error);
      res.status(500).json({ message: "Failed to remove permission from role" });
    }
  });

  // User-Role assignments
  app.post("/api/users/:userId/roles/:roleId", requireAuth, async (req, res) => {
    try {
      const { userId, roleId } = req.params;
      await storage.assignRoleToUser(userId, roleId);
      res.json({ message: "Role assigned to user successfully" });
    } catch (error) {
      console.error("Error assigning role to user:", error);
      res.status(500).json({ message: "Failed to assign role to user" });
    }
  });

  app.delete("/api/users/:userId/roles/:roleId", requireAuth, async (req, res) => {
    try {
      const { userId, roleId } = req.params;
      await storage.removeRoleFromUser(userId, roleId);
      res.json({ message: "Role removed from user successfully" });
    } catch (error) {
      console.error("Error removing role from user:", error);
      res.status(500).json({ message: "Failed to remove role from user" });
    }
  });

  app.get("/api/users/:userId/roles", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      const roles = await storage.getUserRoles(userId);
      res.json(roles);
    } catch (error) {
      console.error("Error fetching user roles:", error);
      res.status(500).json({ message: "Failed to fetch user roles" });
    }
  });

  app.get("/api/users/:userId/permissions", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      const permissions = await storage.getUserPermissions(userId);
      res.json(permissions);
    } catch (error) {
      console.error("Error fetching user permissions:", error);
      res.status(500).json({ message: "Failed to fetch user permissions" });
    }
  });

  // Customer-Role assignments
  app.post("/api/customers/:customerId/roles/:roleId", requireAuth, async (req, res) => {
    try {
      const { customerId, roleId } = req.params;
      await storage.assignRoleToCustomer(customerId, roleId);
      res.json({ message: "Role assigned to customer successfully" });
    } catch (error) {
      console.error("Error assigning role to customer:", error);
      res.status(500).json({ message: "Failed to assign role to customer" });
    }
  });

  app.delete("/api/customers/:customerId/roles/:roleId", requireAuth, async (req, res) => {
    try {
      const { customerId, roleId } = req.params;
      await storage.removeRoleFromCustomer(customerId, roleId);
      res.json({ message: "Role removed from customer successfully" });
    } catch (error) {
      console.error("Error removing role from customer:", error);
      res.status(500).json({ message: "Failed to remove role from customer" });
    }
  });

  app.get("/api/customers/:customerId/roles", requireAuth, async (req, res) => {
    try {
      const { customerId } = req.params;
      const roles = await storage.getCustomerRoles(customerId);
      res.json(roles);
    } catch (error) {
      console.error("Error fetching customer roles:", error);
      res.status(500).json({ message: "Failed to fetch customer roles" });
    }
  });

  app.get("/api/customers/:customerId/permissions", requireAuth, async (req, res) => {
    try {
      const { customerId } = req.params;
      const permissions = await storage.getCustomerPermissions(customerId);
      res.json(permissions);
    } catch (error) {
      console.error("Error fetching customer permissions:", error);
      res.status(500).json({ message: "Failed to fetch customer permissions" });
    }
  });

  // Permission checking endpoint
  app.get("/api/check-permission/:userType/:userId/:permission", requireAuth, async (req, res) => {
    try {
      const { userType, userId, permission } = req.params;
      
      let hasPermission = false;
      if (userType === "user") {
        hasPermission = await storage.userHasPermission(userId, permission);
      } else if (userType === "customer") {
        hasPermission = await storage.customerHasPermission(userId, permission);
      } else {
        return res.status(400).json({ message: "Invalid user type" });
      }
      
      res.json({ hasPermission });
    } catch (error) {
      console.error("Error checking permission:", error);
      res.status(500).json({ message: "Failed to check permission" });
    }
  });

  // Customer routes
  app.get("/api/customers/by-mobile", async (req, res) => {
    try {
      const { mobile } = req.query;
      if (!mobile) {
        return res.status(400).json({ message: "Mobile number is required" });
      }
      
      const customer = await storage.getCustomerByMobile(mobile as string);
      if (customer) {
        res.json(customer);
      } else {
        res.status(404).json({ message: "Customer not found" });
      }
    } catch (error) {
      console.error("Error fetching customer by mobile:", error);
      res.status(500).json({ message: "Failed to fetch customer" });
    }
  });

  app.get("/api/customers", async (req, res) => {
    try {
      const { search, limit, offset, activeOnly } = req.query;
      const result = await storage.getCustomers(
        search as string,
        limit ? parseInt(limit as string) : undefined,
        offset ? parseInt(offset as string) : undefined,
        activeOnly === 'true'
      );
      res.json(result);
    } catch (error) {
      console.error("Error fetching customers:", error);
      res.status(500).json({ message: "Failed to fetch customers" });
    }
  });

  app.get("/api/customers/:id", async (req, res) => {
    try {
      const customer = await storage.getCustomer(req.params.id);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      console.error("Error fetching customer:", error);
      res.status(500).json({ message: "Failed to fetch customer" });
    }
  });

  const validatePasswordStrength = (password: string): string | null => {
    if (!password || password.length < 8) {
      return "Password must be at least 8 characters long";
    }
    if (!/[A-Z]/.test(password)) {
      return "Password must contain at least one uppercase letter";
    }
    if (!/[a-z]/.test(password)) {
      return "Password must contain at least one lowercase letter";
    }
    if (!/[0-9]/.test(password)) {
      return "Password must contain at least one number";
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      return "Password must contain at least one special character";
    }
    return null;
  };

  app.patch("/api/customers/:id/reset-password", async (req, res) => {
    try {
      const { newPassword } = req.body;
      
      const validationError = validatePasswordStrength(newPassword);
      if (validationError) {
        return res.status(400).json({ message: validationError });
      }
      
      const customer = await storage.resetCustomerPassword(req.params.id, newPassword);
      res.json(customer);
    } catch (error) {
      console.error("Error resetting customer password:", error);
      res.status(500).json({ message: "Failed to reset customer password" });
    }
  });

  // Decrypt customer password for admin viewing (Protected endpoint)
  app.get("/api/customers/:id/decrypt-password", requireAuth, requirePermission("customer.edit.all"), async (req, res) => {
    try {
      const customer = await storage.getCustomer(req.params.id);
      
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      if (!customer.encryptedPassword) {
        return res.status(400).json({ error: "No encrypted password available" });
      }

      const decryptedPassword = decryptPasswordFromStorage(customer.encryptedPassword);
      
      res.json({ password: decryptedPassword });
    } catch (error) {
      console.error("Error decrypting customer password:", error);
      res.status(500).json({ error: "Failed to decrypt password" });
    }
  });

  app.patch("/api/customers/:id/toggle-status", async (req, res) => {
    try {
      const { isActive } = req.body;
      const customer = await storage.toggleCustomerStatus(req.params.id, isActive);
      res.json(customer);
    } catch (error) {
      console.error("Error toggling customer status:", error);
      res.status(500).json({ message: "Failed to toggle customer status" });
    }
  });

  app.post("/api/customers", async (req, res) => {
    try {
      const customerData = insertCustomerSchema.parse(req.body);
      const customer = await storage.createCustomer({
        ...customerData,
        password: customerData.password || undefined
      });
      res.status(201).json(customer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid customer data", errors: error.errors });
      }
      console.error("Error creating customer:", error);
      res.status(500).json({ message: "Failed to create customer" });
    }
  });

  app.put("/api/customers/:id", async (req, res) => {
    try {
      const customerData = insertCustomerSchema.partial().parse(req.body);
      // Remove null values and convert to correct types
      const cleanData = Object.fromEntries(
        Object.entries(customerData).filter(([_, value]) => value !== null)
      );
      const customer = await storage.updateCustomer(req.params.id, cleanData);
      res.json(customer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid customer data", errors: error.errors });
      }
      console.error("Error updating customer:", error);
      res.status(500).json({ message: "Failed to update customer" });
    }
  });

  app.delete("/api/customers/:id", async (req, res) => {
    try {
      await storage.deleteCustomer(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting customer:", error);
      if (error instanceof Error && error.message.includes("existing agreements")) {
        return res.status(400).json({ message: "Cannot delete customer with existing agreements" });
      }
      res.status(500).json({ message: "Failed to delete customer" });
    }
  });

  // Migrate existing plain text passwords to encrypted format (Super Admin only)
  app.post("/api/admin/migrate-passwords", requireAuth, requirePermission("system.admin"), async (req, res) => {
    try {
      const customers = await storage.getCustomersForPasswordMigration();
      let migratedCount = 0;
      let errorCount = 0;
      
      for (const customer of customers) {
        try {
          // Check if customer has plainPassword from legacy column
          const legacyCustomer = await storage.getCustomerLegacy(customer.id);
          if (legacyCustomer?.plainPassword && !customer.encryptedPassword) {
            await storage.migrateCustomerPassword(customer.id, legacyCustomer.plainPassword);
            migratedCount++;
          }
        } catch (error) {
          console.error(`Failed to migrate password for customer ${customer.id}:`, error);
          errorCount++;
        }
      }
      
      res.json({ 
        message: "Password migration completed",
        migratedCount,
        errorCount,
        totalCustomers: customers.length
      });
    } catch (error) {
      console.error("Error during password migration:", error);
      res.status(500).json({ error: "Failed to migrate passwords" });
    }
  });

  // Property API routes
  app.get("/api/properties/all", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const currentCustomer = req.customer as any;
      
      // Get user permissions
      let userPermissions: string[] = [];
      if (currentUser) {
        userPermissions = await storage.getUserPermissions(currentUser.id);
      } else if (currentCustomer) {
        userPermissions = await storage.getCustomerPermissions(currentCustomer.id);
      }
      
      // Check if user can view all properties
      const canViewAll = userPermissions.includes('agreement.view.all') || userPermissions.includes('customer.view.all');
      
      if (!canViewAll) {
        return res.status(403).json({ message: "Insufficient permissions to view all properties" });
      }
      
      const properties = await storage.getAllPropertiesWithCustomers();
      res.json(properties);
    } catch (error) {
      console.error("Error fetching all properties:", error);
      res.status(500).json({ message: "Failed to fetch all properties" });
    }
  });

  app.get("/api/properties", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as any;
      
      if (!currentUser) {
        return res.status(401).json({ message: "User not found" });
      }
      
      // Get user permissions from unified system
      const userPermissions = await storage.getUserPermissions(currentUser.id);
      
      // Check if user can view all properties or only their own
      const canViewAll = userPermissions.includes('agreement.view.all') || userPermissions.includes('customer.view.all');
      
      if (canViewAll) {
        // Admin/Staff can see all properties
        const properties = await storage.getAllPropertiesWithCustomers();
        res.json(properties);
      } else {
        // Customer can only see their own properties
        const properties = await storage.getProperties(currentUser.id);
        res.json(properties);
      }
    } catch (error) {
      console.error("Error fetching properties:", error);
      res.status(500).json({ message: "Failed to fetch properties" });
    }
  });

  app.get("/api/properties/:id", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const currentCustomer = req.customer as any;
      
      // Get user permissions and ID
      let userPermissions: string[] = [];
      let userId: string;
      
      if (currentUser) {
        userPermissions = await storage.getUserPermissions(currentUser.id);
        userId = currentUser.id;
      } else if (currentCustomer) {
        userPermissions = await storage.getCustomerPermissions(currentCustomer.id);
        userId = currentCustomer.id;
      } else {
        return res.status(401).json({ message: "User not found" });
      }
      
      const property = await storage.getProperty(req.params.id);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }
      
      // Check if user can view all properties or only their own
      const canViewAll = userPermissions.includes('agreement.view.all') || userPermissions.includes('customer.view.all');
      
      if (!canViewAll && property.customerId !== userId) {
        return res.status(403).json({ message: "Insufficient permissions to view this property" });
      }
      
      res.json(property);
    } catch (error) {
      console.error("Error fetching property:", error);
      res.status(500).json({ message: "Failed to fetch property" });
    }
  });

  app.post("/api/properties", requireAuth, async (req, res) => {
    try {
      const propertyData = insertPropertySchema.parse(req.body);
      const property = await storage.createProperty(propertyData);
      res.status(201).json(property);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid property data", errors: error.errors });
      }
      console.error("Error creating property:", error);
      res.status(500).json({ message: "Failed to create property" });
    }
  });

  app.get("/api/properties/:propertyId/agreements", async (req, res) => {
    try {
      const { propertyId } = req.params;
      const result = await storage.getAgreements({ propertyId });
      res.json(result);
    } catch (error) {
      console.error("Error fetching property agreements:", error);
      res.status(500).json({ message: "Failed to fetch property agreements" });
    }
  });

  // Quick PDF download endpoint for form data
  app.post("/api/agreements/generate-pdf", async (req, res) => {
    try {

      const agreementData = req.body;
      const language = agreementData.language || 'english';
      
      // Find a default template for rental agreements
      const templates = await storage.getPdfTemplates('rental_agreement', language);
      const template = templates.find(t => t.isActive) || templates[0]; // Use first active or first available template
      
      if (!template) {
        console.error(`No PDF template found for rental agreements in language: ${language}`);
        return res.status(404).json({ 
          message: "No PDF template found for rental agreements",
          language: language,
          availableTemplates: templates.map(t => ({ id: t.id, name: t.name, active: t.isActive }))
        });
      }

      // Ensure all required fields have default values
      const safeAgreementData = {
        ownerDetails: agreementData.ownerDetails || {},
        tenantDetails: agreementData.tenantDetails || {},
        propertyDetails: agreementData.propertyDetails || {},
        rentalTerms: agreementData.rentalTerms || {},
        agreementDate: agreementData.agreementDate,
        createdAt: agreementData.createdAt,
        agreementType: 'rental_agreement',
        additionalClauses: agreementData.additionalClauses || [],
        agreementNumber: agreementData.agreementNumber,
        language: language,
        // Include document data if available
        documents: agreementData.documents || {},
        ownerDocuments: agreementData.ownerDocuments || {},
        tenantDocuments: agreementData.tenantDocuments || {},
        propertyDocuments: agreementData.propertyDocuments || {}
      };

      // Debug: Log the agreement data structure to understand what we're working with
      console.log("Parsed agreement data:", JSON.stringify(safeAgreementData, null, 2));
      
      // Generate the HTML with mapped field values using the enhanced field mapping system (now with document embedding)
      const processedHtml = await generatePdfHtml(safeAgreementData, template.htmlTemplate, language);
      
      // Debug: Log first 500 chars of processed HTML to see if replacement is working
      console.log("First 500 chars of processed HTML:", processedHtml.substring(0, 500));
      
      // Return HTML for client-side PDF generation
      res.json({
        html: processedHtml,
        templateName: template.name,
        agreementNumber: agreementData.agreementNumber,
        message: "PDF content generated successfully"
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      console.error("Error stack:", error instanceof Error ? error.stack : 'No stack trace');
      res.status(500).json({ 
        message: "Failed to generate PDF",
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

  // View agreement PDF as HTML in browser
  app.get("/api/agreements/:id/view", async (req, res) => {
    try {
      const agreement = await storage.getAgreement(req.params.id);
      if (!agreement) {
        return res.status(404).json({ message: "Agreement not found" });
      }

      // Always prioritize edited_html when it exists and is not empty
      let processedHtml;
      let htmlSource = 'template'; // Track which source we're using
      
      console.log(`[PDF View] Agreement ${req.params.id} - editedHtml exists: ${!!agreement.editedHtml}, length: ${agreement.editedHtml?.length || 0}, trimmed length: ${agreement.editedHtml?.trim()?.length || 0}`);
      
      if (agreement.editedHtml && agreement.editedHtml.trim() !== '') {
        htmlSource = 'edited_html';
        console.log(`[PDF View] ✓ USING EDITED HTML for agreement ${req.params.id} (${agreement.editedHtml.length} chars)`);
        // Resolve placeholders in saved edited HTML with current DB values
        const { resolvePlaceholders } = await import("./fieldMapping");
        processedHtml = await resolvePlaceholders(agreement.editedHtml, agreement);
      } else {
        console.log(`[PDF View] ✓ USING TEMPLATE FALLBACK for agreement ${req.params.id} (no edited HTML found)`);
        // Find template for this agreement and generate HTML
        const templates = await storage.getPdfTemplates('rental_agreement', agreement.language || 'english');
        const template = templates.find(t => t.isActive) || templates[0];
        
        if (!template) {
          return res.status(404).json({ message: "No PDF template found" });
        }

        // Generate PDF HTML content from template and save it to edited_html
        const { generatePdfHtml } = await import("./fieldMapping");
        processedHtml = await generatePdfHtml(agreement, template.htmlTemplate, agreement.language || 'english');
        
        // Save the generated HTML as edited_html for future use
        try {
          await storage.saveEditedHtml(req.params.id, processedHtml);
          console.log(`[PDF View] ✓ SAVED generated HTML to edited_html for agreement ${req.params.id}`);
        } catch (saveError) {
          console.error(`[PDF View] Failed to save HTML to edited_html:`, saveError);
        }
      }
      
      console.log(`[PDF View] Final HTML source: ${htmlSource}, processed length: ${processedHtml.length} chars`);
      
      // Serve the HTML content directly for viewing in browser
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(processedHtml);
    } catch (error) {
      console.error("Error generating agreement PDF view:", error);
      res.status(500).send(`<html><body><h1>Error</h1><p>Failed to generate PDF view: ${error instanceof Error ? error.message : 'Unknown error'}</p></body></html>`);
    }
  });

  // Download agreement PDF
  app.get("/api/agreements/:id/pdf", async (req, res) => {
    try {
      const agreement = await storage.getAgreement(req.params.id);
      if (!agreement) {
        return res.status(404).json({ message: "Agreement not found" });
      }

      // Always prioritize edited_html when it exists and is not empty
      let processedHtml;
      let htmlSource = 'template'; // Track which source we're using
      
      console.log(`[PDF Download] Agreement ${req.params.id} - editedHtml exists: ${!!agreement.editedHtml}, length: ${agreement.editedHtml?.length || 0}, trimmed length: ${agreement.editedHtml?.trim()?.length || 0}`);
      
      if (agreement.editedHtml && agreement.editedHtml.trim() !== '') {
        htmlSource = 'edited_html';
        console.log(`[PDF Download] ✓ USING EDITED HTML (manual edits preserved) for agreement ${req.params.id} (${agreement.editedHtml.length} chars)`);
        // Use saved edited HTML exactly as-is to preserve ALL manual edits
        // Do NOT resolve placeholders as this overwrites manual changes
        processedHtml = agreement.editedHtml;
      } else {
        console.log(`[PDF Download] ✓ USING TEMPLATE FALLBACK for agreement ${req.params.id} (no edited HTML found)`);
        // Find template for this agreement and generate HTML
        const templates = await storage.getPdfTemplates('rental_agreement', agreement.language || 'english');
        const template = templates.find(t => t.isActive) || templates[0];
        
        if (!template) {
          return res.status(404).json({ message: "No PDF template found" });
        }

        // Generate PDF HTML content from template and save it to edited_html
        const { generatePdfHtml } = await import("./fieldMapping");
        processedHtml = await generatePdfHtml(agreement, template.htmlTemplate, agreement.language || 'english');
        
        // Save the generated HTML as edited_html for future use
        try {
          await storage.saveEditedHtml(req.params.id, processedHtml);
          console.log(`[PDF Download] ✓ SAVED generated HTML to edited_html for agreement ${req.params.id}`);
        } catch (saveError) {
          console.error(`[PDF Download] Failed to save HTML to edited_html:`, saveError);
        }
      }
      
      console.log(`[PDF Download] Final HTML source: ${htmlSource}, processed length: ${processedHtml.length} chars`);
      
      // Return the HTML for client-side PDF generation
      res.json({
        html: processedHtml,
        agreementNumber: agreement.agreementNumber,
        filename: `${agreement.agreementNumber}.pdf`
      });
    } catch (error) {
      console.error("Error generating agreement PDF:", error);
      res.status(500).json({ message: "Failed to generate PDF" });
    }
  });


  // Society routes - no auth required for autocomplete
  app.get("/api/societies", async (req, res) => {
    try {
      const { search, limit } = req.query;
      const societies = await storage.getSocieties(
        search as string,
        limit ? parseInt(limit as string) : undefined
      );
      res.json(societies);
    } catch (error) {
      console.error("Error fetching societies:", error);
      res.status(500).json({ message: "Failed to fetch societies" });
    }
  });

  app.post("/api/societies", async (req, res) => {
    try {
      const societyData = insertSocietySchema.parse(req.body);
      const society = await storage.createSociety(societyData);
      res.status(201).json(society);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid society data", errors: error.errors });
      }
      console.error("Error creating society:", error);
      res.status(500).json({ message: "Failed to create society" });
    }
  });


  // Get agreements for a specific property
  app.get("/api/properties/:propertyId/agreements", async (req, res) => {
    try {
      const { propertyId } = req.params;
      const { status, search, limit, offset } = req.query;
      const result = await storage.getAgreements({
        propertyId: propertyId as string,
        status: status as string,
        search: search as string,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });
      res.json(result);
    } catch (error) {
      console.error("Error fetching property agreements:", error);
      res.status(500).json({ message: "Failed to fetch property agreements" });
    }
  });

  // Agreement routes
  app.get("/api/agreements", requireAuth, async (req: any, res) => {
    try {
      const { customerId, status, search, dateFilter, startDate, endDate, limit, offset } = req.query;
      
      // Cache permission checks to avoid repeated database hits
      const cacheKey = `${req.user.id}_${req.user.userType}_permissions`;
      let permissions = req.user.cachedPermissions;
      
      if (!permissions) {
        // Check permissions to determine data access level
        let canViewAllAgreements = false;
        let canViewOwnAgreements = false;
        
        if (req.user.userType === 'customer') {
          [canViewAllAgreements, canViewOwnAgreements] = await Promise.all([
            storage.customerHasPermission(req.user.id, 'agreement.view.all'),
            storage.customerHasPermission(req.user.id, 'agreement.view.own')
          ]);
        } else {
          [canViewAllAgreements, canViewOwnAgreements] = await Promise.all([
            storage.userHasPermission(req.user.id, 'agreement.view.all'),
            storage.userHasPermission(req.user.id, 'agreement.view.own')
          ]);
        }
        
        permissions = { canViewAllAgreements, canViewOwnAgreements };
        req.user.cachedPermissions = permissions; // Cache for this request
      }
      
      if (!permissions.canViewAllAgreements && !permissions.canViewOwnAgreements) {
        return res.status(403).json({ message: "Insufficient permissions to view agreements" });
      }
      
      // If user can only view own agreements, filter by their ID
      let finalCustomerId = customerId as string;
      if (!permissions.canViewAllAgreements && permissions.canViewOwnAgreements) {
        finalCustomerId = req.user.id; // Filter to only their own agreements
      }
      
      const result = await storage.getAgreements({
        customerId: finalCustomerId,
        status: status as string,
        search: search as string,
        dateFilter: dateFilter as string,
        startDate: startDate as string,
        endDate: endDate as string,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });
      res.json(result);
    } catch (error) {
      console.error("Error fetching agreements:", error);
      res.status(500).json({ message: "Failed to fetch agreements" });
    }
  });

  app.get("/api/agreements/:id", async (req, res) => {
    try {
      const agreement = await storage.getAgreement(req.params.id);
      if (!agreement) {
        return res.status(404).json({ message: "Agreement not found" });
      }
      res.json(agreement);
    } catch (error) {
      console.error("Error fetching agreement:", error);
      res.status(500).json({ message: "Failed to fetch agreement" });
    }
  });

  // Save edited content for an agreement
  app.post("/api/agreements/:id/save-content", async (req, res) => {
    try {
      const { id } = req.params;
      const { editedHtml, editedContent } = req.body;
      
      // Support both new (editedHtml) and legacy (editedContent) formats
      const htmlContent = editedHtml || editedContent;

      console.log(`[Save Content API] Saving content for agreement ${id} (${htmlContent?.length || 0} characters)`);

      if (!htmlContent || htmlContent.trim() === '') {
        console.log(`[Save Content API] No content provided for agreement ${id}`);
        return res.status(400).json({ message: "Edited content is required" });
      }

      const agreement = await storage.getAgreement(id);
      if (!agreement) {
        console.log(`[Save Content API] Agreement ${id} not found`);
        return res.status(404).json({ message: "Agreement not found" });
      }

      // Save content as-is to preserve manual edits
      // Manual edits should NOT be converted to placeholders
      console.log(`[Save Content API] ✓ SAVING CONTENT AS-IS (preserving manual edits) - ${htmlContent.length} characters`);
      console.log(`[Save Content API] Sample content: ${htmlContent.substring(0, 200)}...`);

      await storage.saveEditedHtml(id, htmlContent);
      console.log(`[Save Content API] ✓ SUCCESSFULLY SAVED manual edits for agreement ${id}`);
      
      res.json({ 
        success: true, 
        message: "Content saved successfully",
        savedAt: new Date().toISOString(),
        savedLength: htmlContent.length
      });
    } catch (error) {
      console.error(`[Backend] Error saving edited content for agreement ${req.params.id}:`, error);
      res.status(500).json({ message: "Failed to save edited content" });
    }
  });

  // Get edited content for an agreement
  app.get("/api/agreements/:id/edited-content", async (req, res) => {
    try {
      const { id } = req.params;
      
      console.log(`[Edited Content API] Fetching content for agreement ${id}`);
      
      const agreement = await storage.getAgreement(id);
      if (!agreement) {
        console.log(`[Edited Content API] Agreement ${id} not found`);
        return res.status(404).json({ message: "Agreement not found" });
      }

      let resolvedContent = null;
      let contentSource = 'template'; // Track which source we're using
      
      console.log(`[Edited Content API] Agreement ${id} - editedHtml exists: ${!!agreement.editedHtml}, length: ${agreement.editedHtml?.length || 0}, trimmed length: ${agreement.editedHtml?.trim()?.length || 0}`);

      // NORMALIZED: Always prioritize edited_html when it exists and is not empty
      if (agreement.editedHtml && agreement.editedHtml.trim() !== '') {
        contentSource = 'edited_content';
        console.log(`[Edited Content API] ✓ USING EDITED CONTENT (preserving manual edits) for agreement ${id} (${agreement.editedHtml.length} chars)`);
        // Use saved content exactly as-is to preserve ALL manual edits
        // Do NOT resolve placeholders as this overwrites manual changes
        resolvedContent = agreement.editedHtml;
      } else {
        console.log(`[Edited Content API] ✓ GENERATING FROM TEMPLATE for agreement ${id} (no edited content)`);
        // Generate fresh HTML from template for the editor
        const templates = await storage.getPdfTemplates('rental_agreement', agreement.language || 'english');
        const template = templates.find(t => t.isActive) || templates[0];
        
        if (!template) {
          return res.status(404).json({ message: "No PDF template found" });
        }

        // Generate HTML content from template with current DB values
        const { generatePdfHtml } = await import("./fieldMapping");
        resolvedContent = await generatePdfHtml(agreement, template.htmlTemplate, agreement.language || 'english');
      }

      console.log(`[Edited Content API] Final content source: ${contentSource}, resolved length: ${resolvedContent.length} chars`);

      res.json({
        success: true,
        editedContent: resolvedContent,
        editedAt: agreement.editedAt || null,
        hasEdits: (agreement.editedHtml && agreement.editedHtml.trim() !== ''),
        contentSource: contentSource // For debugging
      });
    } catch (error) {
      console.error(`[Edited Content API] Error fetching content for agreement ${req.params.id}:`, error);
      res.status(500).json({ message: "Failed to fetch edited content" });
    }
  });

  app.post("/api/agreements", async (req, res) => {
    try {
      console.log("Received agreement data:", JSON.stringify(req.body, null, 2));
      const agreementData = insertAgreementSchema.parse(req.body);
      console.log("Parsed agreement data:", JSON.stringify(agreementData, null, 2));
      
      const agreement = await storage.createAgreement(agreementData);
      res.status(201).json(agreement);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Validation error:", error.errors);
        return res.status(400).json({ message: "Invalid agreement data", errors: error.errors });
      }
      
      // More detailed error logging
      console.error("Error creating agreement:", {
        message: (error as Error).message,
        stack: (error as Error).stack,
        name: (error as Error).name
      });
      
      // Send a more specific error message based on error type
      if ((error as Error).message.includes('connection') || (error as Error).message.includes('timeout')) {
        return res.status(503).json({ message: "Database connection error. Please try again." });
      }
      
      res.status(500).json({ message: "Failed to create agreement. Please try again." });
    }
  });

  app.put("/api/agreements/:id", async (req, res) => {
    try {
      console.log("=== UPDATING AGREEMENT ===");
      console.log("Agreement ID:", req.params.id);
      console.log("Request body keys:", Object.keys(req.body));
      console.log("Request body sample:", JSON.stringify(req.body, null, 2).substring(0, 500));
      
      const agreementData = insertAgreementSchema.partial().parse(req.body);
      console.log("Parsed agreement data successfully");
      
      const agreement = await storage.updateAgreement(req.params.id, agreementData);
      console.log("Agreement updated successfully:", agreement.id);
      
      res.json(agreement);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("=== ZOD VALIDATION ERROR ===");
        console.error("Validation errors:", JSON.stringify(error.errors, null, 2));
        return res.status(400).json({ message: "Invalid agreement data", errors: error.errors });
      }
      
      console.error("=== UPDATE AGREEMENT ERROR ===");
      console.error("Error type:", error instanceof Error ? error.constructor.name : typeof error);
      console.error("Error message:", error instanceof Error ? error.message : String(error));
      console.error("Error stack:", error instanceof Error ? error.stack : 'No stack trace');
      
      res.status(500).json({ 
        message: "Failed to update agreement",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.delete("/api/agreements/:id", async (req, res) => {
    try {
      await storage.deleteAgreement(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting agreement:", error);
      res.status(500).json({ message: "Failed to delete agreement" });
    }
  });

  // Agreement renewal
  app.post("/api/agreements/:id/renew", requireAuth, async (req, res) => {
    try {
      const { startDate, endDate } = req.body;
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "Start date and end date are required" });
      }
      
      const renewedAgreement = await storage.renewAgreement(
        req.params.id,
        new Date(startDate),
        new Date(endDate)
      );
      res.status(201).json(renewedAgreement);
    } catch (error) {
      console.error("Error renewing agreement:", error);
      res.status(500).json({ message: "Failed to renew agreement" });
    }
  });



  // Address search for intelligent autocomplete - requires authentication
  app.get("/api/addresses", requireAuth, async (req, res) => {
    try {
      const search = req.query.search as string;
      const limit = parseInt(req.query.limit as string) || 10;
      
      if (!search || search.length < 2) {
        return res.json([]);
      }
      
      const addresses = await storage.searchAddresses(search, limit);
      res.json(addresses);
    } catch (error) {
      console.error("Error searching addresses:", error);
      res.status(500).json({ message: "Failed to search addresses" });
    }
  });

  // Save new address - requires authentication  
  app.post("/api/addresses", requireAuth, async (req, res) => {
    try {
      const addressData = req.body;
      const address = await storage.saveAddress(addressData);
      res.status(201).json(address);
    } catch (error) {
      console.error("Error saving address:", error);
      res.status(500).json({ message: "Failed to save address" });
    }
  });



  // Object storage routes for document uploads
  app.get("/objects/:objectPath(*)", async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    const objectPath = req.path;
    console.log(`[Object Access] Requested path: ${objectPath}`);
    
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
      console.log(`[Object Access] File found, serving: ${objectFile.name}`);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error(`[Object Access] Error accessing object at path ${objectPath}:`, error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  app.post("/api/objects/upload", async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  // ENHANCED FILE UPLOAD SYSTEM (auto-converts PDFs to images)
  app.post("/api/upload-direct", requireAuth, async (req, res) => {
    try {
      if (!req.body || !req.body.file) {
        return res.status(400).json({ error: "No file data provided" });
      }

      const { file, fileName } = req.body;
      
      // Convert base64 to buffer
      const base64Data = file.replace(/^data:.*,/, '');
      const fileBuffer = Buffer.from(base64Data, 'base64');
      
      // Save file and process for images (PDFs get converted to images)
      const saveResult = await directFileUpload.saveFile(fileBuffer, fileName);
      const fileUrl = directFileUpload.getFileUrl(saveResult.fileName);
      
      console.log(`[DirectUpload] File processed:`, {
        original: fileName,
        saved: saveResult.fileName,
        fileType: saveResult.fileType,
        imagePath: saveResult.imagePath,
        absolutePath: saveResult.absolutePath
      });
      
      res.json({ 
        success: true,
        fileName: saveResult.fileName,
        fileUrl: fileUrl,
        imagePath: saveResult.imagePath, // Use this path in <img> tags
        absolutePath: saveResult.absolutePath, // Full system path
        fileType: saveResult.fileType, // 'pdf', 'image', or 'unknown'
        message: `File uploaded successfully. ${saveResult.fileType === 'pdf' ? 'PDF converted to image for display.' : 'Image ready for use.'}`
      });
    } catch (error) {
      console.error("Error in direct file upload:", error);
      res.status(500).json({ error: "Failed to upload and process file" });
    }
  });

  // Serve uploaded files from local uploads folder with proper headers
  app.get("/uploads/:fileName", (req, res) => {
    try {
      const fileName = req.params.fileName;
      const filePath = path.join(process.cwd(), 'uploads', fileName);
      
      // Set proper headers for different file types
      const ext = path.extname(fileName).toLowerCase();
      let contentType = 'application/octet-stream';
      
      if (ext === '.jpg' || ext === '.jpeg') {
        contentType = 'image/jpeg';
      } else if (ext === '.png') {
        contentType = 'image/png';
      } else if (ext === '.gif') {
        contentType = 'image/gif';
      } else if (ext === '.webp') {
        contentType = 'image/webp';
      } else if (ext === '.pdf') {
        contentType = 'application/pdf';
      }
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.setHeader('Access-Control-Allow-Origin', '*');
      
      // For PDFs, set inline display to prevent auto-download
      if (ext === '.pdf') {
        res.setHeader('Content-Disposition', 'inline');
      }
      
      // Check if file exists and serve it
      res.sendFile(filePath, (err) => {
        if (err) {
          console.error("Error serving file:", err);
          res.status(404).json({ error: "File not found" });
        }
      });
    } catch (error) {
      console.error("Error serving uploaded file:", error);
      res.status(500).json({ error: "Failed to serve file" });
    }
  });

  // Local file upload endpoint - simple multipart upload
  app.post('/api/upload-local', upload.single('document'), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      console.log(`[Local Upload] File uploaded: ${req.file.filename}, Original: ${req.file.originalname}, Size: ${req.file.size}`);
      
      res.json({
        success: true,
        filename: req.file.filename,
        originalName: req.file.originalname,
        url: `/uploads/${req.file.filename}`,
        size: req.file.size,
        mimetype: req.file.mimetype
      });
    } catch (error) {
      console.error('[Local Upload] Error:', error);
      res.status(500).json({ error: 'Upload failed' });
    }
  });

  // Import existing agreement endpoint
  app.post('/api/agreements/import', async (req, res) => {
    try {
      const {
        customer,
        language,
        ownerDetails,
        tenantDetails,
        agreementPeriod,
        propertyAddress,
        notarizedDocumentUrl,
        policeVerificationDocumentUrl,
        status,
        isImported
      } = req.body;

      // Validate required fields
      if (!notarizedDocumentUrl || !policeVerificationDocumentUrl) {
        return res.status(400).json({ error: 'Both notarized agreement and police verification document URLs are required' });
      }

      if (!customer?.id || !ownerDetails?.name || !tenantDetails?.name) {
        return res.status(400).json({ error: 'Customer, owner, and tenant details are required' });
      }

      console.log('[Import Agreement] Processing import:', {
        customer: customer.name,
        language: language,
        notarizedDocumentUrl: notarizedDocumentUrl,
        policeVerificationDocumentUrl: policeVerificationDocumentUrl
      });

      // Create the agreement in the database using the proper schema format
      const agreementData = {
        customerId: customer.id || null,
        customerName: customer.name,
        language: language,
        status: 'active',
        ownerDetails: ownerDetails,
        tenantDetails: tenantDetails,
        propertyDetails: {
          address: {
            flatNo: propertyAddress.flatNo,
            society: propertyAddress.society,
            area: propertyAddress.area,
            city: propertyAddress.city,
            state: propertyAddress.state,
            pincode: propertyAddress.pincode
          }
        },
        rentalTerms: {
          startDate: agreementPeriod.startDate,
          endDate: agreementPeriod.endDate,
          tenure: agreementPeriod.tenure || "11_months",
          monthlyRent: 0,
          deposit: 0,
          dueDate: 1,
          maintenance: "included",
          noticePeriod: 1,
          minimumStay: 1,
          furniture: ""
        },
        additionalClauses: [],
        startDate: agreementPeriod.startDate,
        endDate: agreementPeriod.endDate,
        agreementDate: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD format
        notarizedDocument: {
          filename: "notarized_document.pdf",
          originalName: "Notarized Rent Agreement",
          fileType: "application/pdf",
          size: 0,
          uploadDate: new Date().toISOString(),
          url: notarizedDocumentUrl
        },
        documents: {
          policeVerificationDocument: {
            filename: "police_verification.pdf",
            originalName: "Police Verification Certificate",
            fileType: "application/pdf",
            size: 0,
            uploadDate: new Date().toISOString(),
            url: policeVerificationDocumentUrl
          }
        }
      };

      // Validate the data using the insert schema
      const validatedData = insertAgreementSchema.parse(agreementData);
      const agreement = await storage.createAgreement(validatedData);

      console.log(`[Import Agreement] Successfully imported agreement ${agreement.agreementNumber}`);

      res.json({
        success: true,
        message: 'Agreement imported successfully',
        agreement: {
          id: agreement.id,
          agreementNumber: agreement.agreementNumber,
          status: agreement.status,
          customerName: agreement.customerName,
          notarizedDocument: agreement.notarizedDocument,
          documents: agreement.documents
        }
      });
    } catch (error) {
      console.error("Error importing agreement:", error);
      res.status(500).json({ error: 'Failed to import agreement' });
    }
  });

  // Upload notarized document for a specific agreement
  app.post('/api/agreements/:agreementId/upload-notarized', upload.single('notarizedDocument'), async (req, res) => {
    try {
      const { agreementId } = req.params;
      
      if (!req.file) {
        return res.status(400).json({ error: 'No notarized document uploaded' });
      }

      // Validate it's a PDF file
      if (req.file.mimetype !== 'application/pdf') {
        return res.status(400).json({ error: 'Only PDF files are allowed for notarized documents' });
      }

      const agreement = await storage.getAgreement(agreementId);
      if (!agreement) {
        return res.status(404).json({ error: 'Agreement not found' });
      }

      // Create a proper naming convention: AGR-XXXX-notarized-YYYY-MM-DD.pdf
      const currentDate = new Date().toISOString().split('T')[0];
      const notarizedFileName = `${agreement.agreementNumber}-notarized-${currentDate}.pdf`;
      const notarizedFilePath = path.join('uploads', 'notarized', notarizedFileName);
      
      // Create notarized directory if it doesn't exist
      const notarizedDir = path.join(process.cwd(), 'uploads', 'notarized');
      if (!fs.existsSync(notarizedDir)) {
        fs.mkdirSync(notarizedDir, { recursive: true });
      }

      // Move file to proper location with proper name
      const finalPath = path.join(process.cwd(), 'uploads', 'notarized', notarizedFileName);
      fs.renameSync(req.file.path, finalPath);

      // Update agreement with notarized document details
      const notarizedDocData = {
        filename: notarizedFileName,
        originalName: req.file.originalname,
        uploadDate: new Date().toISOString(),
        url: `/uploads/notarized/${notarizedFileName}`,
        size: req.file.size,
        mimetype: req.file.mimetype
      };

      await storage.updateAgreementNotarizedDocument(agreementId, notarizedDocData);

      console.log(`[Notarized Upload] Document uploaded for agreement ${agreement.agreementNumber}: ${notarizedFileName}`);
      
      res.json({
        success: true,
        message: 'Notarized document uploaded successfully',
        filename: notarizedFileName,
        originalName: req.file.originalname,
        url: `/uploads/notarized/${notarizedFileName}`,
        size: req.file.size,
        uploadDate: notarizedDocData.uploadDate
      });

    } catch (error) {
      console.error('[Notarized Upload] Error:', error);
      res.status(500).json({ error: 'Failed to upload notarized document' });
    }
  });

  // Get notarized document for an agreement
  app.get('/api/agreements/:agreementId/notarized-document', async (req, res) => {
    try {
      const { agreementId } = req.params;
      const agreement = await storage.getAgreement(agreementId);
      
      if (!agreement) {
        return res.status(404).json({ error: 'Agreement not found' });
      }

      if (!agreement.notarizedDocument || !agreement.notarizedDocument.filename) {
        return res.status(404).json({ error: 'No notarized document found for this agreement' });
      }

      res.json({
        success: true,
        notarizedDocument: agreement.notarizedDocument
      });

    } catch (error) {
      console.error('[Notarized Download] Error:', error);
      res.status(500).json({ error: 'Failed to get notarized document' });
    }
  });

  // Remove notarized document for an agreement
  app.delete('/api/agreements/:agreementId/notarized-document', async (req, res) => {
    try {
      const { agreementId } = req.params;
      const agreement = await storage.getAgreement(agreementId);
      
      if (!agreement) {
        return res.status(404).json({ error: 'Agreement not found' });
      }

      if (!agreement.notarizedDocument || !agreement.notarizedDocument.filename) {
        return res.status(404).json({ error: 'No notarized document found for this agreement' });
      }

      // Delete the physical file
      const filePath = path.join(process.cwd(), 'uploads', 'notarized', agreement.notarizedDocument.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[Notarized Remove] File deleted: ${agreement.notarizedDocument.filename}`);
      }

      // Clear notarized document from database
      await storage.updateAgreementNotarizedDocument(agreementId, null);

      console.log(`[Notarized Remove] Document removed for agreement ${agreement.agreementNumber}`);
      
      res.json({
        success: true,
        message: 'Notarized document removed successfully'
      });

    } catch (error) {
      console.error('[Notarized Remove] Error:', error);
      res.status(500).json({ error: 'Failed to remove notarized document' });
    }
  });

  // Serve notarized documents
  app.get("/uploads/notarized/:fileName", (req, res) => {
    try {
      const fileName = req.params.fileName;
      const filePath = path.join(process.cwd(), 'uploads', 'notarized', fileName);
      
      // Set proper headers for PDF files
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      
      // Check if file exists and serve it
      res.sendFile(filePath, (err) => {
        if (err) {
          console.error("Error serving notarized document:", err);
          res.status(404).json({ error: "Notarized document not found" });
        }
      });
    } catch (error) {
      console.error("Error serving notarized document:", error);
      res.status(500).json({ error: "Failed to serve notarized document" });
    }
  });

  // Update agreement with document URLs
  app.put("/api/agreements/:id/documents", async (req, res) => {
    try {
      const { documents } = req.body;
      if (!documents) {
        return res.status(400).json({ error: "Documents data is required" });
      }

      const objectStorageService = new ObjectStorageService();
      const normalizedDocuments: any = {};

      // Normalize document paths
      for (const [key, url] of Object.entries(documents)) {
        if (typeof url === 'string' && url) {
          normalizedDocuments[key] = objectStorageService.normalizeObjectEntityPath(url);
        }
      }

      const agreement = await storage.updateAgreement(req.params.id, {
        documents: normalizedDocuments,
      });

      res.json({ agreement, documents: normalizedDocuments });
    } catch (error) {
      console.error("Error updating agreement documents:", error);
      res.status(500).json({ error: "Failed to update documents" });
    }
  });

  // PDF Template routes
  app.get("/api/pdf-templates", requireAuth, async (req, res) => {
    try {
      const { documentType, language } = req.query;
      const templates = await storage.getPdfTemplates(
        documentType as string,
        language as string
      );
      res.json(templates);
    } catch (error) {
      console.error("Error fetching PDF templates:", error);
      res.status(500).json({ message: "Failed to fetch PDF templates" });
    }
  });

  app.get("/api/pdf-templates/:id", requireAuth, async (req, res) => {
    try {
      const template = await storage.getPdfTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ message: "PDF template not found" });
      }
      res.json(template);
    } catch (error) {
      console.error("Error fetching PDF template:", error);
      res.status(500).json({ message: "Failed to fetch PDF template" });
    }
  });

  app.post("/api/pdf-templates", requireAuth, async (req, res) => {
    try {
      const templateData = insertPdfTemplateSchema.parse(req.body);
      const template = await storage.createPdfTemplate(templateData);
      res.status(201).json(template);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid template data", errors: error.errors });
      }
      console.error("Error creating PDF template:", error);
      res.status(500).json({ message: "Failed to create PDF template" });
    }
  });

  app.put("/api/pdf-templates/:id", requireAuth, async (req, res) => {
    try {
      const templateData = insertPdfTemplateSchema.partial().parse(req.body);
      const template = await storage.updatePdfTemplate(req.params.id, templateData);
      res.json(template);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid template data", errors: error.errors });
      }
      console.error("Error updating PDF template:", error);
      res.status(500).json({ message: "Failed to update PDF template" });
    }
  });

  app.delete("/api/pdf-templates/:id", requireAuth, async (req, res) => {
    try {
      await storage.deletePdfTemplate(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting PDF template:", error);
      res.status(500).json({ message: "Failed to delete PDF template" });
    }
  });



  // Test field mapping (temporary endpoint for debugging)
  app.post("/api/test-field-mapping", requireAuth, async (req, res) => {
    try {
      const { agreementData } = req.body;
      const mappedFields = mapFormDataToTemplateFields(agreementData);
      
      res.json({
        originalData: agreementData,
        mappedFields: mappedFields,
        message: "Field mapping test completed"
      });
    } catch (error) {
      console.error("Error testing field mapping:", error);
      res.status(500).json({ message: "Failed to test field mapping" });
    }
  });

  // Generate PDF from template using new field mapping system
  app.post("/api/generate-pdf", requireAuth, async (req, res) => {
    try {
      const { templateId, agreementData } = req.body;
      
      if (!templateId || !agreementData) {
        return res.status(400).json({ message: "Template ID and agreement data are required" });
      }

      const template = await storage.getPdfTemplate(templateId);
      if (!template) {
        return res.status(404).json({ message: "PDF template not found" });
      }

      // Use the new field mapping system to generate PDF HTML (now with document embedding)
      const processedHtml = await generatePdfHtml(agreementData, template.htmlTemplate);

      res.json({ 
        html: processedHtml,
        templateName: template.name,
        mappedFields: mapFormDataToTemplateFields(agreementData), // Include mapped fields for debugging
        message: "PDF generated successfully with field mapping" 
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ message: "Failed to generate PDF" });
    }
  });

  // PDF to images conversion endpoint for preview
  app.post('/api/pdf-to-images', async (req, res) => {
    try {
      const { pdfUrl } = req.body;
      
      if (!pdfUrl) {
        return res.status(400).json({ error: 'pdfUrl is required' });
      }

      console.log(`[PDF-to-Images API] Converting PDF: ${pdfUrl}`);

      // Check if it's a local URL (starts with /objects/ or /uploads/)
      if (pdfUrl.startsWith('/objects/') || pdfUrl.startsWith('/uploads/')) {
        // Handle local files
        const filePath = pdfUrl.startsWith('/objects/') 
          ? pdfUrl.replace('/objects/', 'uploads/')
          : pdfUrl.replace('/uploads/', 'uploads/');
        
        const fullPath = path.join(process.cwd(), filePath);
        
        if (!fs.existsSync(fullPath)) {
          console.error(`[PDF-to-Images API] File not found: ${fullPath}`);
          return res.status(404).json({ error: 'PDF file not found' });
        }

        // Convert PDF to images using the existing function
        const documentType = 'PDF Document';
        const imageHtml = await convertPdfToImages(fullPath, documentType);
        
        if (imageHtml) {
          // Extract base64 image data from HTML
          const base64Pattern = /data:image\/png;base64,([^"]+)/g;
          const images: string[] = [];
          let match;
          
          while ((match = base64Pattern.exec(imageHtml)) !== null) {
            images.push(`data:image/png;base64,${match[1]}`);
          }
          
          console.log(`[PDF-to-Images API] Successfully converted PDF to ${images.length} images`);
          
          res.json({
            success: true,
            images,
            pageCount: images.length
          });
        } else {
          console.error(`[PDF-to-Images API] Failed to convert PDF: ${pdfUrl}`);
          res.status(500).json({ error: 'Failed to convert PDF to images' });
        }
      } else {
        // Handle external URLs or other cases
        res.status(400).json({ error: 'Unsupported PDF URL format' });
      }
    } catch (error) {
      console.error('[PDF-to-Images API] Error:', error);
      res.status(500).json({ error: 'Internal server error while converting PDF' });
    }
  });

  // Generate PDF from existing agreement
  app.post("/api/agreements/:id/generate-pdf", requireAuth, async (req, res) => {
    try {
      const { templateId } = req.body;
      
      // Get the agreement data
      const agreement = await storage.getAgreement(req.params.id);
      if (!agreement) {
        return res.status(404).json({ message: "Agreement not found" });
      }

      // Get the PDF template
      const template = await storage.getPdfTemplate(templateId);
      if (!template) {
        return res.status(404).json({ message: "PDF template not found" });
      }

      // Map agreement data to template fields
      const agreementFormData = {
        ownerDetails: agreement.ownerDetails,
        tenantDetails: agreement.tenantDetails,
        propertyDetails: agreement.propertyDetails,
        rentalTerms: agreement.rentalTerms,
        agreementDate: agreement.agreementDate,
        createdAt: agreement.createdAt,
        agreementType: 'rental_agreement'
      };

      // Generate the HTML with mapped field values (now with document embedding)
      const processedHtml = await generatePdfHtml(agreementFormData, template.htmlTemplate, template.language);
      
      res.json({
        html: processedHtml,
        templateName: template.name,
        agreementNumber: agreement.agreementNumber,
        message: "PDF generated from existing agreement"
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ message: "Failed to generate PDF" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Helper function to get nested object values
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}
