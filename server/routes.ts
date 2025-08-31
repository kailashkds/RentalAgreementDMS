import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import type { Address } from "@shared/schema";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { mapFormDataToTemplateFields, generatePdfHtml, convertPdfToImages } from "./fieldMapping";
import { setupAuth, requireAuth, optionalAuth } from "./auth";
import { requirePermission } from "./rbacMiddleware";
import { insertPropertySchema, insertAgreementSchema } from "@shared/schema";
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
          mobile: adminUser.mobile, 
          name: adminUser.name
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
            mobile: existingAdmin.mobile, 
            name: existingAdmin.name
          } 
        });
      }
      
      const hashedPassword = await bcrypt.hash("admin123", 10);
      const newAdmin = await storage.createUser({
        name: "Administrator",
        username: "admin",
        mobile: "9999999999",
        password: hashedPassword,
        defaultRole: "super_admin",
        status: "active"
      });
      
      res.json({ 
        message: "Admin created successfully", 
        admin: { 
          username: newAdmin.username, 
          mobile: newAdmin.mobile, 
          name: newAdmin.name
        } 
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });
  // Dashboard stats - accessible to all authenticated users
  app.get("/api/dashboard/stats", requireAuth, async (req: any, res) => {
    try {
      // Check permissions to determine data access level
      const canViewAllAgreements = await storage.userHasPermission(req.user.id, 'agreement.view.all');
      const canViewOwnAgreements = await storage.userHasPermission(req.user.id, 'agreement.view.own');
      
      // Dashboard is now accessible to all authenticated users
      // Data will be filtered based on user's permissions below
      
      // If user can only view own agreements, filter stats by their ID
      const userId = (!canViewAllAgreements && canViewOwnAgreements) ? req.user.id : undefined;
      const stats = await storage.getDashboardStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ 
        message: "We're having trouble loading the dashboard data",
        error: "dashboard_stats_failed",
        action: "Please try refreshing the page. If the problem continues, contact support."
      });
    }
  });

  // RBAC initialization endpoint
  app.post("/api/rbac/seed", async (req, res) => {
    try {
      await seedRBAC();
      res.json({ message: "RBAC system seeded successfully" });
    } catch (error) {
      console.error("Error seeding RBAC:", error);
      res.status(500).json({ 
        message: "We're having trouble setting up the permission system",
        error: "rbac_setup_failed",
        action: "This is a system setup issue. Contact technical support.",
        details: String(error)
      });
    }
  });

  // RBAC API endpoints
  // Get current user's permissions
  app.get("/api/auth/permissions", requireAuth, async (req, res) => {
    try {
      let permissions: string[];
      
      // Check if user is a customer based on their role
      const isCustomer = req.user!.role === 'Customer' || req.user!.defaultRole === 'Customer';
      
      if (isCustomer) {
        permissions = await storage.getCustomerPermissions(req.user!.id);
      } else {
        permissions = await storage.getUserPermissions(req.user!.id);
      }
      
      res.json(permissions);
    } catch (error) {
      console.error("Error fetching user permissions:", error);
      res.status(500).json({ 
        message: "We're having trouble loading your permissions",
        error: "permissions_fetch_failed",
        action: "Please try logging out and back in. If the problem persists, contact support."
      });
    }
  });

  // Enhanced user creation with auto-generated credentials (UNIFIED VERSION)
  app.post("/api/users/create", requireAuth, async (req, res) => {
    try {
      const { name, userType, roleId } = req.body;
      if (!name || !userType) {
        return res.status(400).json({ 
          message: "Please provide both a name and user type",
          error: "missing_required_fields",
          action: "Enter a full name and select either 'admin' or 'customer' as user type",
          missing: {
            name: !name ? "Name is required" : "✓",
            userType: !userType ? "User type is required" : "✓"
          }
        });
      }

      // Generate credentials
      const username = generateUsername(name, userType);
      const password = generatePassword(8);
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user using unified system
      const user = await storage.createUser({
        name,
        username,
        mobile: `999${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`, // Generate 10-digit mobile
        password: hashedPassword,
        status: 'active',
        isActive: true,
      });
      
      // Assign role if specified
      if (roleId) {
        await storage.assignUserRole(user.id, roleId);
      }

      // Return user info with generated credentials (password only returned once)
      res.status(201).json({
        user: {
          id: user.id,
          name: user.name,
          username,
          userType,
          isActive: user.isActive,
        },
        credentials: {
          username,
          password, // Only returned once for admin to share
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
      const userToDelete = await storage.getUser(id);
      if (!userToDelete) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Delete the user
      await storage.deleteUser(id);
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
  app.get("/api/unified/users", requireAuth, async (req: any, res) => {
    try {
      const { role, status, search, limit, offset } = req.query;
      
      // Use RBAC utilities for permission checking
      const { isSuperAdmin, hasPermissionWithSuperAdminBypass } = await import('./rbacUtils.js');
      
      // Check permissions - Super Admin has full access, others need specific permission
      if (!isSuperAdmin(req.user)) {
        const hasPermission = await hasPermissionWithSuperAdminBypass(req.user, 'user.view.all');
        if (!hasPermission) {
          return res.status(403).json({ 
            message: "Insufficient permissions to view users",
            error: "permission_denied",
            action: "Contact an administrator for access to user management"
          });
        }
      }
      
      const result = await storage.getUsersWithRoles({
        role: role as string,
        status: status as string,
        search: search as string,
        limit: limit ? parseInt(limit as string) : 50,
        offset: offset ? parseInt(offset as string) : 0,
      });
      
      console.log(`User listing access: User ${req.user.id} (${req.user.role}) - Super Admin: ${isSuperAdmin(req.user)}`);
      res.json(result);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ 
        message: "We're having trouble loading the users list",
        error: "users_fetch_failed",
        action: "Please try refreshing the page. If the problem continues, contact support."
      });
    }
  });

  app.post("/api/unified/users", requireAuth, async (req: any, res) => {
    try {
      const { name, email, username, phone, roleId, password } = req.body;
      // Use RBAC utilities for permission checking
      const { isSuperAdmin, hasPermissionWithSuperAdminBypass } = await import('./rbacUtils.js');
      
      // Check permissions - Super Admin has full access, others need specific permission
      if (!isSuperAdmin(req.user)) {
        const hasPermission = await hasPermissionWithSuperAdminBypass(req.user, 'user.create');
        if (!hasPermission) {
          return res.status(403).json({ 
            message: "Insufficient permissions to create users",
            error: "permission_denied",
            action: "Contact an administrator for access to user creation"
          });
        }
      }

      // Validate required fields
      if (!name || !roleId) {
        return res.status(400).json({ 
          message: "Please provide both a name and select a role",
          error: "missing_required_fields",
          action: "Enter a full name and select a role from the dropdown",
          missing: {
            name: !name ? "Name is required" : "✓",
            roleId: !roleId ? "Role selection is required" : "✓"
          }
        });
      }

      // Generate credentials if not provided
      const finalUsername = username || generateUsername(name, 'customer');
      const finalPassword = password || generatePassword();
      const hashedPassword = await bcrypt.hash(finalPassword, 10);

      // Create user
      const user = await storage.createUser({
        name,
        email,
        username: finalUsername,
        mobile: phone, // Map phone to mobile field
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
        if (error.detail?.includes('mobile')) {
          return res.status(400).json({ message: "Mobile number already exists" });
        }
      }
      
      // Handle foreign key violations
      if (error.code === '23503') {
        if (error.detail?.includes('role_id')) {
          return res.status(400).json({ message: "Invalid role selected. Please choose a valid role." });
        }
        return res.status(400).json({ message: "Referenced record not found. Please check your inputs." });
      }
      
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.put("/api/unified/users/:id", requireAuth, requirePermission({ permission: "user.edit.all" }), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { name, email, username, mobile, status, isActive, roleId } = req.body;
      
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
        mobile,
        status,
        isActive,
      });

      // Update role if provided
      if (roleId) {
        // Find role by name if roleId is a role name
        let actualRoleId = roleId;
        if (roleId && !roleId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
          // roleId is a role name, find the actual ID
          const roles = await storage.getRoles();
          const role = roles.find(r => r.name?.toLowerCase().replace(' ', '_') === roleId.toLowerCase());
          if (role) {
            actualRoleId = role.id;
          } else {
            return res.status(400).json({ message: "Role not found" });
          }
        }
        
        // Remove existing roles
        const currentRoles = await storage.getUserRoles(id);
        for (const role of currentRoles) {
          await storage.removeUserRole(id, role.id);
        }
        // Assign new role
        await storage.assignUserRole(id, actualRoleId);
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
            after: { name, email, username, mobile, status, isActive, roleId } 
          },
          metadata: { userAgent: req.headers['user-agent'], ip: req.ip }
        });
      } catch (auditError) {
        console.warn("Failed to create audit log:", auditError);
      }

      res.json(updatedUser);
    } catch (error: any) {
      console.error("Error updating user:", error);
      
      // Handle specific constraint violations
      if (error.code === '23505') {
        if (error.detail?.includes('email')) {
          return res.status(400).json({ 
            message: "This email address is already registered",
            error: "duplicate_email",
            action: "Use a different email address or check if this user already exists"
          });
        }
        if (error.detail?.includes('username')) {
          return res.status(400).json({ 
            message: "This username is already taken",
            error: "duplicate_username",
            action: "Choose a different username"
          });
        }
        if (error.detail?.includes('mobile')) {
          return res.status(400).json({ 
            message: "This mobile number is already registered",
            error: "duplicate_mobile",
            action: "Use a different mobile number or check if this user already exists"
          });
        }
      }
      
      // Handle foreign key violations
      if (error.code === '23503') {
        if (error.detail?.includes('role_id')) {
          return res.status(400).json({ 
            message: "The selected role is not valid",
            error: "invalid_role",
            action: "Please select a valid role from the dropdown"
          });
        }
        return res.status(400).json({ 
          message: "One of the selected values is not valid",
          error: "invalid_reference",
          action: "Please check all dropdown selections and try again"
        });
      }
      
      res.status(500).json({ 
        message: "We're having trouble updating this user",
        error: "user_update_failed",
        action: "Please try again. If the problem persists, contact support."
      });
    }
  });

  app.delete("/api/unified/users/:id", requireAuth, requirePermission({ permission: "user.delete.all" }), async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Prevent user from deleting themselves
      if (req.user.id === id) {
        return res.status(400).json({ 
          message: "You cannot delete your own account",
          error: "self_deletion_forbidden",
          action: "Ask another administrator to delete your account if needed"
        });
      }

      // Get user before deleting for audit log
      const existingUser = await storage.getUser(id);
      if (!existingUser) {
        return res.status(404).json({ 
          message: "The user you're trying to delete doesn't exist",
          error: "user_not_found",
          action: "Check the user list and try again"
        });
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
    } catch (error: any) {
      console.error("Error deleting user:", error);
      
      // Handle foreign key constraint violations
      if (error.code === '23503') {
        if (error.detail?.includes('agreements')) {
          return res.status(400).json({ message: "Cannot delete user: User has existing agreements" });
        }
        if (error.detail?.includes('audit_logs')) {
          return res.status(400).json({ message: "Cannot delete user: User has audit log entries" });
        }
        return res.status(400).json({ message: "Cannot delete user: User is still referenced by other records" });
      }
      
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Migrate all users to have encrypted passwords
  app.post("/api/admin/migrate-user-passwords", requireAuth, requirePermission({ permission: "system.admin" }), async (req: any, res) => {
    try {
      const usersToMigrate = await storage.getUsers({ hasEncryptedPassword: false });
      const results = [];
      
      for (const user of usersToMigrate.users) {
        try {
          // Generate a new password for this user
          const newPassword = generatePassword(12);
          
          // Reset the user's password (this will create both hashed and encrypted versions)
          await storage.resetUserPassword(user.id, newPassword);
          
          results.push({
            userId: user.id,
            name: user.name,
            username: user.username,
            newPassword: newPassword,
            success: true
          });
        } catch (error) {
          results.push({
            userId: user.id,
            name: user.name,
            username: user.username,
            error: error.message,
            success: false
          });
        }
      }
      
      res.json({
        message: "Password migration completed",
        totalUsers: usersToMigrate.users.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results: results
      });
    } catch (error) {
      console.error("Error migrating user passwords:", error);
      res.status(500).json({ message: "Failed to migrate user passwords" });
    }
  });

  // Get current password (for display before reset)
  app.get("/api/unified/users/:id/current-password", requireAuth, requirePermission({ permission: "user.edit.all" }), async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Get current user data to decrypt current password
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      let currentPassword = null;
      try {
        // Try to decrypt the current password if it exists
        if (user.encryptedPassword) {
          const { decryptPasswordFromStorage } = await import('./encryption');
          currentPassword = decryptPasswordFromStorage(user.encryptedPassword);
        } else if (user.password) {
          // User has a hashed password but no encrypted version
          currentPassword = "Password is hashed and cannot be decrypted. Please reset to generate a new password.";
        } else {
          currentPassword = "No password set for this user";
        }
      } catch (decryptError) {
        console.warn("Failed to decrypt current password:", decryptError);
        currentPassword = "Unable to decrypt current password";
      }
      
      res.json({ currentPassword });
    } catch (error) {
      console.error("Error getting current password:", error);
      res.status(500).json({ message: "Failed to get current password" });
    }
  });

  app.patch("/api/unified/users/:id/reset-password", requireAuth, requirePermission({ permission: "user.edit.all" }), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;
      
      // Get current user data to decrypt current password
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      let currentPassword = null;
      try {
        // Try to decrypt the current password if it exists
        if (user.encryptedPassword) {
          const { decryptPasswordFromStorage } = await import('./encryption');
          currentPassword = decryptPasswordFromStorage(user.encryptedPassword);
        }
      } catch (decryptError) {
        console.warn("Failed to decrypt current password:", decryptError);
        currentPassword = "Unable to decrypt current password";
      }
      
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

      res.json({ 
        currentPassword: currentPassword,
        newPassword: finalPassword 
      });
    } catch (error) {
      console.error("Error resetting user password:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  app.patch("/api/unified/users/:id/toggle-status", requireAuth, requirePermission({ permission: "user.status.change" }), async (req: any, res) => {
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

  // Permission override management endpoints
  app.get("/api/unified/users/:id/permissions-with-sources", requireAuth, requirePermission({ permission: "user.view.all" }), async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Check if user exists
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const permissionsWithSources = await storage.getUserPermissionsWithSources(id);
      res.json(permissionsWithSources);
    } catch (error) {
      console.error("Error fetching user permissions with sources:", error);
      res.status(500).json({ message: "Failed to fetch user permissions with sources" });
    }
  });

  app.post("/api/unified/users/:id/permission-overrides", requireAuth, requirePermission({ permission: "user.edit.all" }), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { permissionId } = req.body;
      
      if (!permissionId) {
        return res.status(400).json({ message: "Permission ID is required" });
      }

      // Check if user exists
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if permission exists
      const permission = await storage.getPermission(permissionId);
      if (!permission) {
        return res.status(404).json({ message: "Permission not found" });
      }

      await storage.addUserPermissionOverride(id, permissionId, req.user.id);

      // Log audit (non-blocking)
      try {
        await storage.createAuditLog({
          action: 'user.permission_override_added',
          resourceType: 'user',
          resourceId: id,
          changedBy: req.user.id,
          diff: { permissionOverride: { added: permission.code } },
          metadata: { userAgent: req.headers['user-agent'], ip: req.ip }
        });
      } catch (auditError) {
        console.warn("Failed to create audit log:", auditError);
      }

      res.json({ message: "Permission override added successfully" });
    } catch (error) {
      console.error("Error adding permission override:", error);
      res.status(500).json({ message: "Failed to add permission override" });
    }
  });


  // Unified roles endpoint
  app.get("/api/unified/roles", requireAuth, async (req, res) => {
    try {
      const roles = await storage.getRoles();
      // Add user count and permissions for each role
      const rolesWithDetails = await Promise.all(roles.map(async (role) => {
        const permissions = await storage.getRolePermissions(role.id);
        const users = await storage.getUsers({ defaultRole: role.name?.toLowerCase().replace(' ', '_') });
        return {
          ...role,
          permissions: permissions.map(p => p.code),
          userCount: users.users.length
        };
      }));
      res.json(rolesWithDetails);
    } catch (error) {
      console.error("Error fetching unified roles:", error);
      res.status(500).json({ message: "Failed to fetch roles" });
    }
  });

  // Unified permissions endpoint
  app.get("/api/unified/permissions", requireAuth, async (req, res) => {
    try {
      const permissions = await storage.getPermissions();
      // Transform permissions to match frontend expectations
      const transformedPermissions = permissions.map(permission => ({
        id: permission.id,
        name: permission.code,
        description: permission.description,
        category: permission.code.split('.')[0] // Extract category from permission code
      }));
      res.json(transformedPermissions);
    } catch (error) {
      console.error("Error fetching unified permissions:", error);
      res.status(500).json({ message: "Failed to fetch permissions" });
    }
  });

  // Unified role creation endpoint
  app.post("/api/unified/roles", requireAuth, requirePermission("role.manage"), async (req: any, res) => {
    try {
      const { name, description, permissions: permissionCodes = [] } = req.body;

      // Create the role
      const role = await storage.createRole({ name, description });
      
      // Get permission IDs from codes
      const allPermissions = await storage.getPermissions();
      const permissionIds = allPermissions
        .filter(p => permissionCodes.includes(p.code))
        .map(p => p.id);
      
      // Assign permissions to the role
      for (const permissionId of permissionIds) {
        await storage.assignPermissionToRole(role.id, permissionId);
      }

      // Create audit log
      try {
        await storage.createAuditLog({
          action: "role.created",
          resourceType: "role",
          resourceId: role.id,
          changedBy: req.user.claims.sub,
          diff: {
            created: {
              name,
              description,
              permissions: permissionCodes,
            }
          },
          metadata: {
            userAgent: req.headers['user-agent'],
            ip: req.ip
          }
        });
      } catch (auditError) {
        console.warn("Failed to create audit log:", auditError);
      }

      res.json({
        ...role,
        permissions: permissionCodes
      });
    } catch (error) {
      console.error("Error creating unified role:", error);
      res.status(500).json({ message: "Failed to create role" });
    }
  });

  // Unified role update endpoint
  app.put("/api/unified/roles/:id", requireAuth, requirePermission("role.manage"), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { name, description, permissions: permissionCodes = [] } = req.body;

      // Update role basic info
      const role = await storage.updateRole(id, { name, description });
      
      // Get current permissions
      const currentPermissions = await storage.getRolePermissions(id);
      const currentPermissionIds = currentPermissions.map(p => p.id);
      
      // Get new permission IDs from codes
      const allPermissions = await storage.getPermissions();
      const newPermissionIds = allPermissions
        .filter(p => permissionCodes.includes(p.code))
        .map(p => p.id);
      
      // Remove permissions that are no longer needed
      for (const permissionId of currentPermissionIds) {
        if (!newPermissionIds.includes(permissionId)) {
          await storage.removePermissionFromRole(id, permissionId);
        }
      }
      
      // Add new permissions
      for (const permissionId of newPermissionIds) {
        if (!currentPermissionIds.includes(permissionId)) {
          await storage.assignPermissionToRole(id, permissionId);
        }
      }

      // Create audit log
      try {
        await storage.createAuditLog({
          action: "role.updated",
          resourceType: "role",
          resourceId: id,
          changedBy: req.user.claims.sub,
          diff: {
            updated: {
              name,
              description,
              permissions: permissionCodes,
            }
          },
          metadata: {
            userAgent: req.headers['user-agent'],
            ip: req.ip
          }
        });
      } catch (auditError) {
        console.warn("Failed to create audit log:", auditError);
      }

      // Broadcast permission updates to all users with this role
      if ((httpServer as any).broadcastPermissionUpdate) {
        await (httpServer as any).broadcastPermissionUpdate(id, role.name);
      }

      res.json({
        ...role,
        permissions: permissionCodes
      });
    } catch (error) {
      console.error("Error updating unified role:", error);
      res.status(500).json({ message: "Failed to update role" });
    }
  });

  // Unified role deletion endpoint
  app.delete("/api/unified/roles/:id", requireAuth, requirePermission("role.manage"), async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Check if role has users assigned
      const role = await storage.getRole(id);
      if (!role) {
        return res.status(404).json({ message: "Role not found" });
      }
      
      const users = await storage.getUsers({ defaultRole: role.name?.toLowerCase().replace(' ', '_') });
      if (users.users.length > 0) {
        return res.status(400).json({ 
          message: "Cannot delete role that has users assigned. Please reassign users first." 
        });
      }

      await storage.deleteRole(id);

      // Create audit log
      try {
        await storage.createAuditLog({
          action: "role.deleted",
          resourceType: "role",
          resourceId: id,
          changedBy: req.user.claims.sub,
          diff: {
            deleted: {
              name: role.name,
              description: role.description,
            }
          },
          metadata: {
            userAgent: req.headers['user-agent'],
            ip: req.ip
          }
        });
      } catch (auditError) {
        console.warn("Failed to create audit log:", auditError);
      }

      res.json({ message: "Role deleted successfully" });
    } catch (error) {
      console.error("Error deleting unified role:", error);
      res.status(500).json({ message: "Failed to delete role" });
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
          permissions: ["agreement.view.own", "download.agreement.own"]
        },
        {
          id: "staff-template", 
          name: "Staff Template",
          description: "Staff access with agreement management and customer view",
          permissions: [
            "agreement.view.all", "agreement.create", "agreement.edit.own", "agreement.notarize",
            "download.agreement.all", "share.agreement.all", "customer.view.all",
            "template.create", "template.edit"
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

  // User Permission Override Management - Add debugging middleware
  app.use("/api/unified/users/:userId/permission-overrides*", (req, res, next) => {
    console.log(`🌐 ROUTE DEBUG: ${req.method} ${req.originalUrl}`);
    console.log(`🌐 Params:`, req.params);
    console.log(`🌐 Body:`, req.body);
    next();
  });

  app.post("/api/unified/users/:userId/permission-overrides", requireAuth, requirePermission({ permission: "user.edit.all" }), async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { permissionId } = req.body;
      console.log(`🔧 DEBUG: Adding permission override for user ${userId}, permission ${permissionId}`);
      
      if (!permissionId) {
        console.log(`❌ Permission ID is required`);
        return res.status(400).json({ message: "Permission ID is required" });
      }
      
      // Check if user exists
      const user = await storage.getUser(userId);
      if (!user) {
        console.log(`❌ User not found: ${userId}`);
        return res.status(404).json({ message: "User not found" });
      }
      console.log(`✅ User found: ${user.name}`);
      
      // Get all user permissions to determine the action
      const userPermissions = await storage.getUserPermissionsWithSources(userId);
      const rolePermissions = userPermissions.filter(p => p.source === 'role');
      console.log(`📊 User has ${userPermissions.length} total permissions, ${rolePermissions.length} from roles`);
      
      // Find the permission
      const permission = await storage.getPermission(permissionId);
      if (!permission) {
        console.log(`❌ Permission not found: ${permissionId}`);
        return res.status(404).json({ message: "Permission not found" });
      }
      console.log(`✅ Permission found: ${permission.code}`);
      
      // Check if user has this permission from roles
      const hasFromRole = rolePermissions.some(p => p.code === permission.code);
      console.log(`🔍 User has permission '${permission.code}' from role: ${hasFromRole}`);
      
      if (hasFromRole) {
        // User has this permission from role, so we need to REMOVE the removal
        // (i.e., restore the role-based permission)
        console.log(`🔄 Removing permission removal to restore role-based permission`);
        await storage.removeUserPermissionRemoval(userId, permissionId);
        console.log(`✅ Permission removal removed successfully`);
      } else {
        // User doesn't have this permission from role, so we ADD it manually
        console.log(`➕ Adding manual permission override`);
        await storage.addUserPermissionOverride(userId, permissionId, req.user.id);
        console.log(`✅ Manual permission override added successfully`);
      }
      
      res.json({ message: "Permission override updated successfully" });
    } catch (error) {
      console.error("❌ Error updating user permission override:", error);
      res.status(500).json({ message: "Failed to update permission override" });
    }
  });
  
  app.delete("/api/unified/users/:userId/permission-overrides/:permissionId", requireAuth, requirePermission({ permission: "user.edit.all" }), async (req: any, res) => {
    try {
      const { userId, permissionId } = req.params;
      console.log(`🔧 DEBUG: Removing permission override for user ${userId}, permission ${permissionId}`);
      
      // Check if user exists
      const user = await storage.getUser(userId);
      if (!user) {
        console.log(`❌ User not found: ${userId}`);
        return res.status(404).json({ message: "User not found" });
      }
      console.log(`✅ User found: ${user.name}`);
      
      // Get all user permissions to determine the action
      const userPermissions = await storage.getUserPermissionsWithSources(userId);
      const rolePermissions = userPermissions.filter(p => p.source === 'role');
      console.log(`📊 User has ${userPermissions.length} total permissions, ${rolePermissions.length} from roles`);
      
      // Find the permission
      const permission = await storage.getPermission(permissionId);
      if (!permission) {
        console.log(`❌ Permission not found: ${permissionId}`);
        return res.status(404).json({ message: "Permission not found" });
      }
      console.log(`✅ Permission found: ${permission.code}`);
      
      // Check if user has this permission from roles
      const hasFromRole = rolePermissions.some(p => p.code === permission.code);
      console.log(`🔍 User has permission '${permission.code}' from role: ${hasFromRole}`);
      
      if (hasFromRole) {
        // User has this permission from role, so we REMOVE it by adding a removal
        console.log(`➖ Adding permission removal for role-based permission`);
        await storage.addUserPermissionRemoval(userId, permissionId, req.user.id);
        console.log(`✅ Permission removal added successfully`);
      } else {
        // User has this permission manually, so we REMOVE the manual override
        console.log(`🗑️ Removing manual permission override`);
        await storage.removeUserPermissionOverride(userId, permissionId);
        console.log(`✅ Manual permission override removed successfully`);
      }
      
      res.json({ message: "Permission override removed successfully" });
    } catch (error) {
      console.error("❌ Error removing user permission override:", error);
      res.status(500).json({ message: "Failed to remove permission override" });
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

  app.get("/api/customers", requireAuth, async (req: any, res) => {
    try {
      const { search, limit, offset, activeOnly } = req.query;
      
      // Use RBAC utilities for permission checking
      const { isSuperAdmin, hasPermissionWithSuperAdminBypass } = await import('./rbacUtils.js');
      
      // Check permissions - Super Admin has full access, others need specific permission
      if (!isSuperAdmin(req.user)) {
        const hasPermission = await hasPermissionWithSuperAdminBypass(req.user, 'customer.view.all');
        if (!hasPermission) {
          return res.status(403).json({ 
            message: "Insufficient permissions to view customers",
            error: "permission_denied",
            action: "Contact an administrator for access to customer management"
          });
        }
      }
      
      const result = await storage.getCustomers(
        search as string,
        limit ? parseInt(limit as string) : undefined,
        offset ? parseInt(offset as string) : undefined,
        activeOnly === 'true'
      );
      
      console.log(`Customer listing access: User ${req.user.id} (${req.user.role}) - Super Admin: ${isSuperAdmin(req.user)}`);
      res.json(result);
    } catch (error) {
      console.error("Error fetching customers:", error);
      res.status(500).json({ message: "Failed to fetch customers" });
    }
  });

  app.get("/api/customers/:id", requireAuth, async (req: any, res) => {
    try {
      const customer = await storage.getCustomer(req.params.id);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      // Use RBAC utilities for permission checking
      const { isSuperAdmin, canAccessRecord } = await import('./rbacUtils.js');
      
      // Check if user can access this specific customer
      const accessCheck = await canAccessRecord(
        req.user,
        { customerId: customer.id, ownerId: customer.id },
        'view'
      );
      
      if (!accessCheck.allowed) {
        return res.status(403).json({ 
          message: "Insufficient permissions to view this customer",
          error: "permission_denied",
          action: "You can only view customers you have permission to access"
        });
      }
      
      console.log(`Customer detail access: User ${req.user.id} (${req.user.role}) accessing customer ${customer.id} - Super Admin: ${isSuperAdmin(req.user)}`);
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

  // Get customer password info for admin viewing (Protected endpoint)
  app.get("/api/customers/:id/password-info", requireAuth, requirePermission("customer.edit.all"), async (req, res) => {
    try {
      const customer = await storage.getCustomer(req.params.id);
      
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      let passwordInfo = {
        hasPassword: false,
        password: null,
        isEncrypted: false,
        canView: false,
        lastResetDate: null
      };

      // Try to get password from various sources
      if (customer.encryptedPassword) {
        try {
          // Try to decrypt the password
          const plainTextPassword = decryptPasswordFromStorage(customer.encryptedPassword);
          passwordInfo = {
            hasPassword: true,
            password: plainTextPassword,
            isEncrypted: true,
            canView: true,
            lastResetDate: customer.updatedAt
          };
        } catch (decryptError) {
          console.log("Decryption failed, checking for fallback options");
          // If decryption fails, still provide info that password exists but can't be viewed
          passwordInfo = {
            hasPassword: true,
            password: null,
            isEncrypted: true,
            canView: false,
            lastResetDate: customer.updatedAt
          };
        }
      }

      res.json(passwordInfo);
    } catch (error) {
      console.error("Error getting customer password info:", error);
      res.status(500).json({ error: "Failed to get password information" });
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

  app.post("/api/customers", requireAuth, async (req: any, res) => {
    try {
      // Use RBAC utilities for permission checking
      const { isSuperAdmin, hasPermissionWithSuperAdminBypass } = await import('./rbacUtils.js');
      
      // Check permissions - Super Admin has full access, others need specific permission
      if (!isSuperAdmin(req.user)) {
        const hasPermission = await hasPermissionWithSuperAdminBypass(req.user, 'customer.create');
        if (!hasPermission) {
          return res.status(403).json({ 
            message: "Insufficient permissions to create customers",
            error: "permission_denied",
            action: "Contact an administrator for access to customer creation"
          });
        }
      }
      
      // Create customer data schema dynamically since we moved to unified users table
      const customerDataSchema = z.object({
        name: z.string().min(1),
        mobile: z.string().min(10),
        email: z.string().email().optional(),
        password: z.string().optional()
      });
      const customerData = customerDataSchema.parse(req.body);
      const customer = await storage.createCustomer({
        ...customerData,
        password: customerData.password || undefined
      });
      
      console.log(`Customer creation: User ${req.user.id} (${req.user.role}) created customer ${customer.id} - Super Admin: ${isSuperAdmin(req.user)}`);
      res.status(201).json(customer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid customer data", errors: error.errors });
      }
      
      console.error("Error creating customer:", error);
      
      // Handle specific database errors
      if ((error as any).code === '23505') { // Unique constraint violation
        if ((error as any).constraint === 'users_mobile_unique') {
          return res.status(400).json({ 
            message: "A customer with this mobile number already exists",
            error: "duplicate_mobile"
          });
        }
        if ((error as any).constraint === 'users_email_unique') {
          return res.status(400).json({ 
            message: "A customer with this email address already exists",
            error: "duplicate_email"
          });
        }
        return res.status(400).json({ 
          message: "A customer with this information already exists",
          error: "duplicate_data"
        });
      }
      
      res.status(500).json({ message: "Failed to create customer" });
    }
  });

  app.put("/api/customers/:id", requireAuth, async (req: any, res) => {
    try {
      // Use RBAC utilities for permission checking
      const { isSuperAdmin, canAccessRecord } = await import('./rbacUtils.js');
      
      // Get customer first to check access
      const existingCustomer = await storage.getCustomer(req.params.id);
      if (!existingCustomer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      
      // Check if user can edit this specific customer
      const accessCheck = await canAccessRecord(
        req.user,
        { customerId: existingCustomer.id, ownerId: existingCustomer.id },
        'edit'
      );
      
      if (!accessCheck.allowed) {
        return res.status(403).json({ 
          message: "Insufficient permissions to edit this customer",
          error: "permission_denied",
          action: "You can only edit customers you have permission to modify"
        });
      }
      
      // Create customer data schema dynamically since we moved to unified users table
      const customerDataSchema = z.object({
        name: z.string().min(1).optional(),
        mobile: z.string().min(10).optional(),
        email: z.string().email().optional(),
        password: z.string().optional()
      });
      const customerData = customerDataSchema.parse(req.body);
      // Remove null values and convert to correct types
      const cleanData = Object.fromEntries(
        Object.entries(customerData).filter(([_, value]) => value !== null)
      );
      const customer = await storage.updateCustomer(req.params.id, cleanData);
      
      console.log(`Customer update: User ${req.user.id} (${req.user.role}) updated customer ${customer.id} - Super Admin: ${isSuperAdmin(req.user)}`);
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
      const { customerId } = req.query; // Get customerId from query parameters
      
      if (!currentUser) {
        return res.status(401).json({ message: "User not found" });
      }
      
      // Get user permissions from unified system
      const userPermissions = await storage.getUserPermissions(currentUser.id);
      
      // Check if user can view all properties or only their own
      const canViewAll = userPermissions.includes('agreement.view.all') || userPermissions.includes('customer.view.all');
      
      // If a specific customerId is requested
      if (customerId) {
        // Check if admin/staff can view this customer's properties, or if customer is viewing their own
        if (canViewAll || currentUser.id === customerId) {
          const properties = await storage.getProperties(customerId as string);
          res.json(properties);
        } else {
          return res.status(403).json({ message: "Insufficient permissions to view this customer's properties" });
        }
      } else {
        // No specific customer requested - use original logic
        if (canViewAll) {
          // Admin/Staff can see all properties
          const properties = await storage.getAllPropertiesWithCustomers();
          res.json(properties);
        } else {
          // Customer can only see their own properties
          const properties = await storage.getProperties(currentUser.id);
          res.json(properties);
        }
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

  app.put("/api/properties/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const currentUser = req.user as any;

      if (!currentUser) {
        return res.status(401).json({ message: "User not found" });
      }

      // Get user permissions
      const userPermissions = await storage.getUserPermissions(currentUser.id);
      
      // Check if user can edit properties
      const canEditAll = userPermissions.includes('customer.edit.all') || userPermissions.includes('customer.manage');
      
      if (!canEditAll) {
        return res.status(403).json({ message: "Insufficient permissions to edit properties" });
      }

      // Parse and validate the property data
      const propertyData = insertPropertySchema.omit({ customerId: true }).parse(req.body);
      
      // Update the property
      const updatedProperty = await storage.updateProperty(id, propertyData);
      
      if (!updatedProperty) {
        return res.status(404).json({ message: "Property not found" });
      }

      res.json(updatedProperty);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid property data", errors: error.errors });
      }
      console.error("Error updating property:", error);
      res.status(500).json({ message: "Failed to update property" });
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

      // Find template for this agreement and generate HTML
      const templates = await storage.getPdfTemplates('rental_agreement', agreement.language || 'english');
      const template = templates.find(t => t.isActive) || templates[0];
      
      if (!template) {
        return res.status(404).json({ message: "No PDF template found" });
      }

      // Generate PDF HTML content from template
      const { generatePdfHtml } = await import("./fieldMapping");
      const processedHtml = await generatePdfHtml(agreement, template.htmlTemplate, agreement.language || 'english');
      
      // Serve the HTML content directly for viewing in browser
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(processedHtml);
    } catch (error) {
      console.error("Error generating agreement PDF view:", error);
      res.status(500).send(`<html><body><h1>Error</h1><p>Failed to generate PDF view: ${error instanceof Error ? error.message : 'Unknown error'}</p></body></html>`);
    }
  });

  // Download agreement PDF - uses edited content if available, otherwise generates from template
  app.get("/api/agreements/:id/pdf", async (req, res) => {
    try {
      console.log(`[PDF Download] Starting PDF generation for agreement: ${req.params.id}`);
      
      const agreement = await storage.getAgreement(req.params.id);
      if (!agreement) {
        console.error(`[PDF Download] Agreement not found: ${req.params.id}`);
        return res.status(404).json({ message: "Agreement not found", agreementId: req.params.id });
      }
      
      console.log(`[PDF Download] Found agreement: ${agreement.agreementNumber}, language: ${agreement.language}`);

      let processedHtml: string;
      
      // Check if there's edited content saved for this agreement
      if (agreement.editedHtml && agreement.editedHtml.trim() !== '') {
        console.log(`[PDF] Using saved edited content for agreement ${agreement.id}`);
        // The saved content is in template format, so convert it to actual values for PDF
        const { mapFormDataToTemplateFields, convertFromTemplateFormat } = await import("./fieldMapping");
        const fieldValues = mapFormDataToTemplateFields(agreement, agreement.language || 'english');
        processedHtml = convertFromTemplateFormat(agreement.editedHtml, fieldValues);
      } else {
        console.log(`[PDF] No edited content found, generating from template for agreement ${agreement.id}`);
        // Find template for this agreement and generate HTML
        console.log(`[PDF Download] Searching for templates: type=rental_agreement, language=${agreement.language || 'english'}`);
        const templates = await storage.getPdfTemplates('rental_agreement', agreement.language || 'english');
        console.log(`[PDF Download] Found ${templates.length} templates`);
        
        const template = templates.find(t => t.isActive) || templates[0] || {
          id: 'default-rental-agreement',
          name: 'Default Rental Agreement',
          isActive: true,
          htmlTemplate: '<div style="font-family: Arial, sans-serif; padding: 20px;"><h1>Rental Agreement</h1><p>Owner: {{OWNER_NAME}}</p><p>Tenant: {{TENANT_NAME}}</p><p>Property: {{PROPERTY_FULL_ADDRESS}}</p><p>Monthly Rent: {{MONTHLY_RENT}}</p><p>Security Deposit: {{SECURITY_DEPOSIT}}</p></div>'
        };
        
        if (!template?.htmlTemplate) {
          console.error(`[PDF Download] No PDF template found for agreement ${agreement.agreementNumber}, language: ${agreement.language || 'english'}`);
          return res.status(404).json({ 
            message: "No PDF template found", 
            language: agreement.language || 'english',
            templatesFound: templates.length,
            agreementNumber: agreement.agreementNumber 
          });
        }
        
        console.log(`[PDF Download] Using template: ${template.name} (active: ${template.isActive})`);

        // Generate PDF HTML content from template
        const { generatePdfHtml } = await import("./fieldMapping");
        processedHtml = await generatePdfHtml(agreement, template.htmlTemplate, agreement.language || 'english');
      }
      
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

  // Save edited content for a specific agreement
  app.post("/api/agreements/:id/save-content", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { editedHtml } = req.body;

      if (!editedHtml || typeof editedHtml !== 'string') {
        return res.status(400).json({ 
          message: "Missing or invalid edited content",
          errorCode: "INVALID_CONTENT",
          action: "Please provide valid HTML content to save"
        });
      }

      // Check if agreement exists
      const agreement = await storage.getAgreement(id);
      if (!agreement) {
        return res.status(404).json({ 
          message: "Agreement not found",
          errorCode: "AGREEMENT_NOT_FOUND",
          action: "Please check the agreement ID and try again"
        });
      }

      // Convert actual values back to template placeholders before saving
      const { mapFormDataToTemplateFields, convertToTemplateFormat } = await import("./fieldMapping");
      const fieldValues = mapFormDataToTemplateFields(agreement, agreement.language || 'english');
      const templateHtml = convertToTemplateFormat(editedHtml, fieldValues);
      
      // Save the template format to the database (with placeholders like {{OWNER_NAME}})
      await storage.saveEditedContent(id, templateHtml);
      
      console.log(`[Save Content] Successfully saved edited content for agreement ${id} (${editedHtml.length} characters -> ${templateHtml.length} template characters)`);
      console.log(`[Save Content] Template conversion preview:`, templateHtml.substring(0, 200) + '...');

      res.json({
        message: "Content saved successfully",
        savedAt: new Date().toISOString(),
        contentLength: editedHtml.length,
        templateLength: templateHtml.length
      });
    } catch (error) {
      console.error("Error saving edited content:", error);
      res.status(500).json({ 
        message: "Failed to save content",
        errorCode: "SAVE_FAILED",
        action: "Please try again or contact support if the problem persists"
      });
    }
  });

  // Get edited content for a specific agreement
  app.get("/api/agreements/:id/edited-content", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      const agreement = await storage.getAgreement(id);
      if (!agreement) {
        return res.status(404).json({ 
          message: "Agreement not found",
          errorCode: "AGREEMENT_NOT_FOUND",
          action: "Please check the agreement ID and try again"
        });
      }

      const { mapFormDataToTemplateFields, convertFromTemplateFormat, generatePdfHtml } = await import("./fieldMapping");
      
      // Log agreement structure for debugging
      console.log(`[Debug] Agreement structure for ${id}:`);
      console.log(`  - documents:`, agreement.documents ? Object.keys(agreement.documents) : 'null');
      console.log(`  - ownerDocuments:`, agreement.ownerDocuments ? Object.keys(agreement.ownerDocuments) : 'null');
      console.log(`  - tenantDocuments:`, agreement.tenantDocuments ? Object.keys(agreement.tenantDocuments) : 'null');
      console.log(`  - propertyDocuments:`, agreement.propertyDocuments ? Object.keys(agreement.propertyDocuments) : 'null');
      console.log(`  - additionalClauses:`, agreement.additionalClauses ? `Array(${agreement.additionalClauses.length})` : 'null');
      
      const fieldValues = mapFormDataToTemplateFields(agreement, agreement.language || 'english');

      // Check if there's edited content
      if (agreement.editedHtml && agreement.editedHtml.trim() !== '') {
        console.log(`[Get Content] Converting saved template content to display format for agreement ${id} (${agreement.editedHtml.length} characters)`);
        
        // Convert template placeholders to actual values for editing display
        const displayHtml = convertFromTemplateFormat(agreement.editedHtml, fieldValues);
        
        res.json({
          hasEdits: true,
          editedContent: displayHtml,
          editedAt: agreement.editedAt,
          contentSource: 'database'
        });
      } else {
        console.log(`[Get Content] No edited content found for agreement ${id}, generating from template`);
        // Generate content from template as fallback
        const templates = await storage.getPdfTemplates('rental_agreement', agreement.language || 'english');
        const template = templates.find(t => t.isActive) || templates[0] || {
          id: 'default-rental-agreement',
          name: 'Default Rental Agreement',
          isActive: true,
          htmlTemplate: '<div style="font-family: Arial, sans-serif; padding: 20px;"><h1>Rental Agreement</h1><p>Owner: {{OWNER_NAME}}</p><p>Tenant: {{TENANT_NAME}}</p><p>Property: {{PROPERTY_FULL_ADDRESS}}</p><p>Monthly Rent: {{MONTHLY_RENT}}</p><p>Security Deposit: {{SECURITY_DEPOSIT}}</p></div>'
        };

        const generatedHtml = await generatePdfHtml(agreement, template.htmlTemplate, agreement.language || 'english');
        
        res.json({
          hasEdits: false,
          editedContent: generatedHtml,
          editedAt: null,
          contentSource: 'template'
        });
      }
    } catch (error) {
      console.error("Error fetching edited content:", error);
      res.status(500).json({ 
        message: "Failed to fetch content",
        errorCode: "FETCH_FAILED",
        action: "Please try again or contact support if the problem persists"
      });
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

  // Manual expiry update endpoint
  app.post("/api/agreements/update-expired", requireAuth, requirePermission('agreement.edit.all'), async (req, res) => {
    try {
      const updatedCount = await storage.updateExpiredAgreements();
      res.json({ 
        message: `Updated ${updatedCount} expired agreements`,
        updatedCount 
      });
    } catch (error) {
      console.error("Error updating expired agreements:", error);
      res.status(500).json({ error: "Failed to update expired agreements" });
    }
  });

  // Agreement routes
  app.get("/api/agreements", requireAuth, async (req: any, res) => {
    try {
      const { customerId, status, search, dateFilter, startDate, endDate, limit, offset } = req.query;
      
      // Get user's data access level using new RBAC utilities
      const { isSuperAdmin, getDataAccessLevel, applyRoleBasedFiltering } = await import('./rbacUtils.js');
      const accessLevel = await getDataAccessLevel(req.user);
      
      // Agreements are now accessible to all authenticated users
      // Data will be filtered based on user's permissions below
      
      // Prepare base filters from query parameters
      const baseFilters = {
        customerId: customerId as string,
        status: status as string,
        search: search as string,
        dateFilter: dateFilter as string,
        startDate: startDate as string,
        endDate: endDate as string,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      };
      
      // Apply role-based filtering - Super Admin sees all, others get filtered
      const finalFilters = applyRoleBasedFiltering(baseFilters, accessLevel, req.user);
      
      console.log(`Agreement listing access: User ${req.user.id} (${req.user.role}) - Super Admin: ${isSuperAdmin(req.user)}, Can View All: ${accessLevel.canViewAll}, Restricted: ${!!accessLevel.restrictToUserId}`);
      
      const result = await storage.getAgreements(finalFilters);
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


  app.post("/api/agreements", async (req, res) => {
    try {
      console.log("Received agreement data:", JSON.stringify(req.body, null, 2));
      const agreementData = insertAgreementSchema.parse(req.body);
      console.log("Parsed agreement data:", JSON.stringify(agreementData, null, 2));
      
      // If this is a draft, check if there's already an existing draft for this customer
      if (agreementData.status === 'draft' && agreementData.customerId) {
        console.log("Checking for existing draft for customer:", agreementData.customerId);
        
        const existingDrafts = await storage.getAgreements({
          customerId: agreementData.customerId,
          status: 'draft',
          limit: 1
        });
        
        if (existingDrafts.agreements.length > 0) {
          const existingDraft = existingDrafts.agreements[0];
          console.log("Found existing draft, updating:", existingDraft.id);
          
          // Update the existing draft instead of creating a new one
          const updatedAgreement = await storage.updateAgreement(existingDraft.id, agreementData);
          return res.json(updatedAgreement);
        }
      }
      
      // Create new agreement if no draft exists or status is not draft
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

  app.put("/api/agreements/:id", requireAuth, async (req, res) => {
    try {
      console.log("=== UPDATING AGREEMENT ===");
      console.log("Agreement ID:", req.params.id);
      console.log("Request body keys:", Object.keys(req.body));
      console.log("Request body sample:", JSON.stringify(req.body, null, 2).substring(0, 500));
      
      // Check if agreement exists and validate business rules
      const existingAgreement = await storage.getAgreement(req.params.id);
      if (!existingAgreement) {
        return res.status(404).json({ message: "Agreement not found" });
      }
      
      // Rule: Notarized agreements can only be edited by users with proper permissions
      if (existingAgreement.notarizedDocument && 
          Object.keys(existingAgreement.notarizedDocument).length > 0) {
        
        // Check if user is a customer based on their role
        const isCustomer = req.user!.role === 'Customer' || req.user!.defaultRole === 'Customer';
        
        let canEditNotarized = false;
        
        if (isCustomer) {
          // Check customer permissions for notarized agreement editing
          const [canEditNotarizedAll, canEditNotarizedOwn] = await Promise.all([
            storage.customerHasPermission(req.user!.id, 'agreement.edit.notarized.all'),
            storage.customerHasPermission(req.user!.id, 'agreement.edit.notarized.own')
          ]);
          
          // Can edit if has "all" permission, or "own" permission and owns this agreement
          canEditNotarized = canEditNotarizedAll || 
            (canEditNotarizedOwn && existingAgreement.customerId === req.user!.id);
        } else {
          // Check admin user permissions for notarized agreement editing
          const [canEditNotarizedAll, canEditNotarizedOwn] = await Promise.all([
            storage.userHasPermission(req.user!.id, 'agreement.edit.notarized.all'),
            storage.userHasPermission(req.user!.id, 'agreement.edit.notarized.own')
          ]);
          
          // Admin users with "all" permission can edit any notarized agreement
          // "own" permission logic would depend on how ownership is defined for admin users
          canEditNotarized = canEditNotarizedAll || canEditNotarizedOwn;
        }
        
        if (!canEditNotarized) {
          return res.status(403).json({ 
            message: "Cannot edit notarized agreements. Only users with proper permissions can modify notarized agreements.",
            reason: "insufficient_permissions_for_notarized"
          });
        }
      }
      
      const agreementData = insertAgreementSchema.partial().parse(req.body);
      console.log("Parsed agreement data successfully");
      
      const agreement = await storage.updateAgreement(req.params.id, agreementData);
      console.log("Agreement updated successfully:", agreement.id);
      
      // Clear edited content if form data changed to force regeneration with new data
      // This ensures additional clauses and other dynamic content updates properly
      if (agreementData.additionalClauses || agreementData.rentalTerms || 
          agreementData.ownerDetails || agreementData.tenantDetails || 
          agreementData.propertyDetails) {
        console.log("Form data changed, clearing edited content to force regeneration");
        await storage.clearEditedContent(req.params.id);
      }
      
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

  app.delete("/api/agreements/:id", requireAuth, async (req, res) => {
    try {
      console.log(`[Delete Agreement] Attempting to delete agreement ${req.params.id}`);
      
      // Check if agreement exists and validate business rules
      const existingAgreement = await storage.getAgreement(req.params.id);
      if (!existingAgreement) {
        console.log(`[Delete Agreement] Agreement ${req.params.id} not found`);
        return res.status(404).json({ message: "Agreement not found" });
      }
      
      console.log(`[Delete Agreement] Agreement found, status: ${existingAgreement.status}`);
      
      // Rule: Active agreements cannot be deleted
      if (existingAgreement.status === "active") {
        console.log(`[Delete Agreement] Cannot delete active agreement ${req.params.id}`);
        return res.status(400).json({ 
          message: "Cannot delete active agreements. Active agreements are currently in effect and must be terminated first.",
          reason: "active_agreement"
        });
      }
      
      console.log(`[Delete Agreement] Proceeding to delete agreement ${req.params.id}`);
      await storage.deleteAgreement(req.params.id);
      console.log(`[Delete Agreement] Successfully deleted agreement ${req.params.id}`);
      res.status(204).send();
    } catch (error) {
      console.error(`[Delete Agreement] Error deleting agreement ${req.params.id}:`, error);
      res.status(500).json({ 
        message: "Failed to delete agreement", 
        error: error instanceof Error ? error.message : String(error),
        agreementId: req.params.id
      });
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

  // Serve uploaded files from local uploads folder with proper headers (including subdirectories)
  app.get("/uploads/*", (req, res) => {
    try {
      // Extract the full path after /uploads/
      const requestedPath = req.params['0'] || '';
      console.log(`[File Serve] Requested file: ${requestedPath}`);
      
      const filePath = path.join(process.cwd(), 'uploads', requestedPath);
      console.log(`[File Serve] Full file path: ${filePath}`);
      
      // Check if file exists before attempting to serve it
      if (!fs.existsSync(filePath)) {
        console.error(`[File Serve] File not found: ${filePath}`);
        return res.status(404).json({ 
          error: "File not found", 
          requestedPath,
          fullPath: filePath 
        });
      }
      
      // Set proper headers for different file types
      const ext = path.extname(requestedPath).toLowerCase();
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
      console.log(`[File Serve] Serving file: ${filePath} (${contentType})`);
      res.sendFile(filePath, (err) => {
        if (err) {
          console.error(`[File Serve] Error serving file ${filePath}:`, err);
          if (!res.headersSent) {
            res.status(404).json({ 
              error: "File not found", 
              filePath: filePath,
              details: err.message 
            });
          }
        } else {
          console.log(`[File Serve] Successfully served: ${requestedPath}`);
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
        policeVerificationStatus,
        status,
        isImported
      } = req.body;

      // Validate required fields
      if (!notarizedDocumentUrl) {
        return res.status(400).json({ error: 'Notarized agreement document is required' });
      }

      // Police verification document is compulsory ONLY when status is "yes"
      if (policeVerificationStatus === "done" && !policeVerificationDocumentUrl) {
        return res.status(400).json({ error: 'Police verification document is compulsory when status is "Done"' });
      }

      // For "no" and "pending" status, document upload is optional during import but can be uploaded later

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
        policeVerificationStatus: policeVerificationStatus || 'pending',
        isImported: isImported || true, // Mark as imported agreement
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
        documents: policeVerificationDocumentUrl ? {
          policeVerificationDocument: {
            filename: "police_verification.pdf",
            originalName: "Police Verification Certificate",
            fileType: "application/pdf",
            size: 0,
            uploadDate: new Date().toISOString(),
            url: policeVerificationDocumentUrl
          }
        } : {}
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
  app.get("/api/pdf-templates", requireAuth, async (req: any, res) => {
    try {
      const { documentType, language } = req.query;
      
      // Use RBAC utilities for permission checking
      const { isSuperAdmin, hasPermissionWithSuperAdminBypass } = await import('./rbacUtils.js');
      
      // Check permissions - Super Admin has full access, others need template.manage permission
      if (!isSuperAdmin(req.user)) {
        const hasPermission = await hasPermissionWithSuperAdminBypass(req.user, 'template.manage');
        if (!hasPermission) {
          return res.status(403).json({ 
            message: "Insufficient permissions to view templates",
            error: "permission_denied",
            action: "Contact an administrator for access to template management"
          });
        }
      }
      
      const templates = await storage.getPdfTemplates(
        documentType as string,
        language as string
      );
      
      console.log(`Template listing access: User ${req.user.id} (${req.user.role}) - Super Admin: ${isSuperAdmin(req.user)}`);
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

  app.post("/api/pdf-templates", requireAuth, async (req: any, res) => {
    try {
      // Use RBAC utilities for permission checking
      const { isSuperAdmin, hasPermissionWithSuperAdminBypass } = await import('./rbacUtils.js');
      
      // Check permissions - Super Admin has full access, others need template.create permission
      if (!isSuperAdmin(req.user)) {
        const hasPermission = await hasPermissionWithSuperAdminBypass(req.user, 'template.create');
        if (!hasPermission) {
          return res.status(403).json({ 
            message: "Insufficient permissions to create templates",
            error: "permission_denied",
            action: "Contact an administrator for access to template creation"
          });
        }
      }
      
      // Use agreement templates instead of deprecated PDF templates
      const templateDataSchema = z.object({
        name: z.string().min(1),
        language: z.string(),
        htmlTemplate: z.string(),
        isActive: z.boolean().optional()
      });
      const templateData = templateDataSchema.parse(req.body);
      const template = await storage.createPdfTemplate(templateData);
      
      console.log(`Template creation: User ${req.user.id} (${req.user.role}) created template ${template.id} - Super Admin: ${isSuperAdmin(req.user)}`);
      res.status(201).json(template);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid template data", errors: error.errors });
      }
      console.error("Error creating PDF template:", error);
      res.status(500).json({ message: "Failed to create PDF template" });
    }
  });

  app.put("/api/pdf-templates/:id", requireAuth, async (req: any, res) => {
    try {
      // Use RBAC utilities for permission checking
      const { isSuperAdmin, hasPermissionWithSuperAdminBypass } = await import('./rbacUtils.js');
      
      // Check permissions - Super Admin has full access, others need template.edit permission
      if (!isSuperAdmin(req.user)) {
        const hasPermission = await hasPermissionWithSuperAdminBypass(req.user, 'template.edit');
        if (!hasPermission) {
          return res.status(403).json({ 
            message: "Insufficient permissions to edit templates",
            error: "permission_denied",
            action: "Contact an administrator for access to template editing"
          });
        }
      }
      
      // Use agreement templates instead of deprecated PDF templates
      const templateDataSchema = z.object({
        name: z.string().min(1).optional(),
        language: z.string().optional(),
        htmlTemplate: z.string().optional(),
        isActive: z.boolean().optional()
      });
      const templateData = templateDataSchema.parse(req.body);
      const template = await storage.updatePdfTemplate(req.params.id, templateData);
      if (!template) {
        return res.status(404).json({ message: "PDF template not found" });
      }
      
      console.log(`Template update: User ${req.user.id} (${req.user.role}) updated template ${template.id} - Super Admin: ${isSuperAdmin(req.user)}`);
      res.json(template);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid template data", errors: error.errors });
      }
      console.error("Error updating PDF template:", error);
      res.status(500).json({ message: "Failed to update PDF template" });
    }
  });

  app.delete("/api/pdf-templates/:id", requireAuth, async (req: any, res) => {
    try {
      // Use RBAC utilities for permission checking
      const { isSuperAdmin, hasPermissionWithSuperAdminBypass } = await import('./rbacUtils.js');
      
      // Check permissions - Super Admin has full access, others need template.delete permission
      if (!isSuperAdmin(req.user)) {
        const hasPermission = await hasPermissionWithSuperAdminBypass(req.user, 'template.delete');
        if (!hasPermission) {
          return res.status(403).json({ 
            message: "Insufficient permissions to delete templates",
            error: "permission_denied",
            action: "Contact an administrator for access to template deletion"
          });
        }
      }
      
      const deleted = await storage.deletePdfTemplate(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "PDF template not found" });
      }
      
      console.log(`Template deletion: User ${req.user.id} (${req.user.role}) deleted template ${req.params.id} - Super Admin: ${isSuperAdmin(req.user)}`);
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

      // Use fallback template since templates are no longer stored in database
      const template = {
        id: 'default-rental-agreement',
        name: 'Default Rental Agreement',
        isActive: true,
        htmlTemplate: '<div style="font-family: Arial, sans-serif; padding: 20px;"><h1>Rental Agreement</h1><p>Owner: {{OWNER_NAME}}</p><p>Tenant: {{TENANT_NAME}}</p><p>Property: {{PROPERTY_FULL_ADDRESS}}</p><p>Monthly Rent: {{MONTHLY_RENT}}</p><p>Security Deposit: {{SECURITY_DEPOSIT}}</p></div>'
      };

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
  
  // Setup WebSocket server for real-time updates
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws',
    clientTracking: true 
  });
  
  // Store user sessions for targeted updates
  const userSessions = new Map<string, WebSocket[]>();
  
  wss.on('connection', async (ws, req) => {
    console.log('🔌 WebSocket client connected');
    
    // Handle authentication and user session tracking
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'auth') {
          const userId = message.userId;
          if (userId) {
            // Track user connection
            if (!userSessions.has(userId)) {
              userSessions.set(userId, []);
            }
            userSessions.get(userId)!.push(ws);
            
            // Send initial permissions
            try {
              const permissions = await storage.getUserPermissions(userId);
              ws.send(JSON.stringify({
                type: 'permissions_update',
                permissions: permissions
              }));
            } catch (error) {
              console.error('Error fetching user permissions:', error);
            }
            
            console.log(`👤 User ${userId} authenticated via WebSocket`);
          }
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });
    
    ws.on('close', () => {
      // Clean up user sessions when connection closes
      for (const [userId, connections] of userSessions.entries()) {
        const index = connections.indexOf(ws);
        if (index !== -1) {
          connections.splice(index, 1);
          if (connections.length === 0) {
            userSessions.delete(userId);
          }
          break;
        }
      }
      console.log('🔌 WebSocket client disconnected');
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });
  
  // Broadcast permission updates to all affected users
  async function broadcastPermissionUpdate(roleId: string, roleName: string) {
    try {
      // Get all users with this role
      const usersWithRole = await storage.getUsersByRoleId(roleId);
      
      for (const user of usersWithRole) {
        const userConnections = userSessions.get(user.id);
        if (userConnections && userConnections.length > 0) {
          // Get updated permissions for this user
          const updatedPermissions = await storage.getUserPermissions(user.id);
          
          const updateMessage = JSON.stringify({
            type: 'permissions_update',
            permissions: updatedPermissions,
            reason: `Role "${roleName}" permissions updated`,
            timestamp: new Date().toISOString()
          });
          
          // Send to all connections for this user
          userConnections.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(updateMessage);
            }
          });
          
          console.log(`📡 Broadcasted permission update to user ${user.id} (role: ${roleName})`);
        }
      }
    } catch (error) {
      console.error('Error broadcasting permission update:', error);
    }
  }
  
  // Make broadcast function available globally
  (httpServer as any).broadcastPermissionUpdate = broadcastPermissionUpdate;
  
  return httpServer;
}

// Helper function to get nested object values
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}
