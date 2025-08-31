import {
  users,
  properties,
  addresses,
  agreements,
  permissions,
  roles,
  rolePermissions as rolePermissionsTable,
  userRoles,
  userPermissions,
  userPermissionRemovals,
  auditLogs,
  pdfTemplates,

  type User,
  type UpsertUser,
  type Customer,
  type InsertCustomer,
  type Property,
  type InsertProperty,
  type Address,
  type InsertAddress,
  type Agreement,
  type InsertAgreement,
  type Permission,
  type InsertPermission,
  type Role,
  type InsertRole,
  type RolePermission,
  type InsertRolePermission,
  type UserRole,
  type InsertUserRole,
  type UserPermission,
  type InsertUserPermission,
  type UserPermissionRemoval,
  type InsertUserPermissionRemoval,
  type RoleWithPermissions,
  type RoleWithStringPermissions,
  type UserWithRoles,
  type AuditLog,
  type InsertAuditLog,
  type PdfTemplate,
  type InsertPdfTemplate,

} from "@shared/schema";
import { db } from "./db";
import { eq, ilike, desc, asc, and, or, count, sql, gte, lte, isNull, isNotNull } from "drizzle-orm";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, addMonths } from "date-fns";
import bcrypt from "bcrypt";
import { encryptPasswordForStorage, decryptPasswordFromStorage } from "./encryption";

export interface IStorage {
  // Unified user operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByFullName(fullName: string): Promise<User | undefined>;
  getUserByMobile(mobile: string): Promise<User | undefined>;
  createUser(user: Omit<UpsertUser, 'id'>): Promise<User>;
  updateUser(id: string, user: Partial<UpsertUser>): Promise<User>;
  deleteUser(id: string): Promise<void>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Customer operations
  getCustomers(search?: string, limit?: number, offset?: number, activeOnly?: boolean): Promise<{ customers: (Customer & { agreementCount: number })[]; total: number }>;
  getCustomer(id: string): Promise<Customer | undefined>;
  getCustomerByMobile(mobile: string): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer & { password?: string | null }): Promise<Customer>;
  updateCustomer(id: string, customer: Partial<InsertCustomer>): Promise<Customer>;
  deleteCustomer(id: string): Promise<void>;
  resetCustomerPassword(id: string, newPassword: string): Promise<Customer>;
  toggleCustomerStatus(id: string, isActive: boolean): Promise<Customer>;
  getCustomersForPasswordMigration(): Promise<Customer[]>;
  migrateCustomerPassword(id: string, plainPassword: string): Promise<Customer>;
  getCustomerLegacy(id: string): Promise<{ plainPassword?: string } | undefined>;
  
  // Property operations
  getProperties(customerId?: string): Promise<Property[]>;
  getProperty(id: string): Promise<Property | undefined>;
  createProperty(property: InsertProperty): Promise<Property>;
  updateProperty(id: string, property: Partial<InsertProperty>): Promise<Property>;
  deleteProperty(id: string): Promise<void>;
  findOrCreatePropertyForAgreement(customerId: string, propertyDetails: any): Promise<Property>;
  getAllPropertiesWithCustomers(): Promise<any[]>;
  
  
  // Address operations for intelligent autocomplete
  searchAddresses(search: string, limit?: number): Promise<Address[]>;
  saveAddress(address: InsertAddress): Promise<Address>;
  incrementAddressUsage(addressId: string): Promise<void>;
  
  // PDF Template operations (full CRUD)
  getPdfTemplates(documentType?: string, language?: string): Promise<PdfTemplate[]>;
  getPdfTemplate(id: string): Promise<PdfTemplate | undefined>;
  createPdfTemplate(template: InsertPdfTemplate): Promise<PdfTemplate>;
  updatePdfTemplate(id: string, template: Partial<InsertPdfTemplate>): Promise<PdfTemplate | undefined>;
  deletePdfTemplate(id: string): Promise<boolean>;
  
  

  
  
  // Unified user role operations
  assignUserRole(userId: string, roleId: string): Promise<void>;
  removeUserRole(userId: string, roleId: string): Promise<void>;
  getUserRoles(userId: string): Promise<Role[]>;
  getUserPermissions(userId: string): Promise<string[]>;
  getUsersWithRoles(filters?: { role?: string; status?: string; search?: string; limit?: number; offset?: number }): Promise<{ users: UserWithRoles[]; total: number }>;
  
  // Agreement operations
  getAgreements(filters?: {
    customerId?: string;
    propertyId?: string;
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ agreements: Agreement[]; total: number }>;
  getAgreement(id: string): Promise<Agreement | undefined>;
  getAgreementByNumber(agreementNumber: string): Promise<Agreement | undefined>;
  createAgreement(agreement: InsertAgreement): Promise<Agreement>;
  updateAgreement(id: string, agreement: Partial<InsertAgreement>): Promise<Agreement>;
  deleteAgreement(id: string): Promise<void>;
  renewAgreement(id: string, newStartDate: Date, newEndDate: Date): Promise<Agreement>;
  updateAgreementNotarizedDocument(id: string, notarizedDocData: any): Promise<Agreement>;
  
  // Edited content operations
  saveEditedContent(agreementId: string, editedHtml: string): Promise<void>;
  
  // Dashboard statistics
  getDashboardStats(): Promise<{
    totalAgreements: number;
    activeAgreements: number;
    expiringSoon: number;
    totalCustomers: number;
  }>;
  
  
  // RBAC operations
  // Permission operations
  getPermissions(): Promise<Permission[]>;
  getPermission(id: string): Promise<Permission | undefined>;
  getPermissionByCode(code: string): Promise<Permission | undefined>;
  createPermission(permission: InsertPermission): Promise<Permission>;
  updatePermission(id: string, permission: Partial<InsertPermission>): Promise<Permission>;
  deletePermission(id: string): Promise<void>;
  
  // Role operations
  getRoles(): Promise<RoleWithPermissions[]>;
  getRole(id: string): Promise<RoleWithPermissions | undefined>;
  getRoleByName(name: string): Promise<RoleWithPermissions | undefined>;
  createRole(role: InsertRole): Promise<Role>;
  updateRole(id: string, role: Partial<InsertRole>): Promise<Role>;
  deleteRole(id: string): Promise<void>;
  
  // Role-Permission operations
  assignPermissionToRole(roleId: string, permissionId: string): Promise<RolePermission>;
  removePermissionFromRole(roleId: string, permissionId: string): Promise<void>;
  getRolePermissions(roleId: string): Promise<Permission[]>;
  
  // User-Role operations
  assignRoleToUser(userId: string, roleId: string): Promise<UserRole>;
  removeRoleFromUser(userId: string, roleId: string): Promise<void>;
  getUserRoles(userId: string): Promise<RoleWithStringPermissions[]>;
  getUserWithRoles(userId: string): Promise<UserWithRoles | undefined>;
  
  // Customer-Role operations
  assignRoleToCustomer(customerId: string, roleId: string): Promise<CustomerRole>;
  removeRoleFromCustomer(customerId: string, roleId: string): Promise<void>;
  getCustomerRoles(customerId: string): Promise<RoleWithPermissions[]>;
  getCustomerWithRoles(customerId: string): Promise<CustomerWithRoles | undefined>;
  
  // Unified permission checking
  userHasPermission(userId: string, permissionCode: string): Promise<boolean>;
  getUserPermissions(userId: string): Promise<string[]>;
  getUserPermissionsWithSources(userId: string): Promise<{ code: string; source: 'role' | 'override'; roleName?: string }[]>;
  
  // Manual permission overrides
  addUserPermissionOverride(userId: string, permissionId: string, createdBy: string): Promise<void>;
  removeUserPermissionOverride(userId: string, permissionId: string): Promise<void>;
  getUserPermissionOverrides(userId: string): Promise<UserPermission[]>;
  
  // Legacy permission checking (deprecated)
  customerHasPermission(customerId: string, permissionCode: string): Promise<boolean>;
  getCustomerPermissions(customerId: string): Promise<string[]>;

  // Audit logging operations
  createAuditLog(auditLog: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(filters?: { 
    action?: string; 
    resourceId?: string; 
    changedBy?: string; 
    limit?: number; 
    offset?: number; 
  }): Promise<{ logs: AuditLog[]; total: number; }>;
  getAuditLogsForRole(roleId: string): Promise<AuditLog[]>;
}

export class DatabaseStorage implements IStorage {
  
  // Auto-update expired agreements on startup and periodically
  constructor() {
    this.updateExpiredAgreements();
    // Run every 24 hours to update expired agreements
    setInterval(() => {
      this.updateExpiredAgreements();
    }, 24 * 60 * 60 * 1000);
  }

  // Update agreements that have passed their expiry date to 'expired' status
  async updateExpiredAgreements(): Promise<number> {
    try {
      const today = new Date().toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format
      
      const result = await db
        .update(agreements)
        .set({ 
          status: 'expired',
          notaryStatus: 'expired', // Also update notary status to expired
          updatedAt: new Date()
        })
        .where(
          and(
            // Agreement end date is before today
            sql`${agreements.endDate} < ${today}`,
            // Current status is active (don't update already expired or draft agreements)
            eq(agreements.status, 'active')
          )
        )
        .returning({ id: agreements.id });

      const updatedCount = result.length;
      if (updatedCount > 0) {
        console.log(`✅ Auto-updated ${updatedCount} agreements and notary statuses to 'expired'`);
      }
      
      return updatedCount;
    } catch (error) {
      console.error('❌ Error updating expired agreements:', error);
      return 0;
    }
  }
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    if (!user) return undefined;
    
    // Map defaultRole to role for compatibility
    return {
      ...user,
      role: user.defaultRole || 'Customer'
    } as User;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    if (!user) return undefined;
    
    // Map defaultRole to role for compatibility
    return {
      ...user,
      role: user.defaultRole || 'Customer'
    } as User;
  }

  async getUserByFullName(fullName: string): Promise<User | undefined> {
    // Normalize the input full name (trim spaces, case insensitive)
    const normalizedFullName = fullName.trim().toLowerCase();
    
    // Find user where name field matches the full name (case insensitive)
    const users_result = await db
      .select()
      .from(users)
      .where(
        sql`LOWER(TRIM(${users.name})) = ${normalizedFullName}`
      );
    
    if (!users_result[0]) return undefined;
    
    // Map defaultRole to role for compatibility
    return {
      ...users_result[0],
      role: users_result[0].defaultRole || 'Customer'
    } as User;
  }

  async getUserByMobile(mobile: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.mobile, mobile));
    if (!user) return undefined;
    
    // Map defaultRole to role for compatibility
    return {
      ...user,
      role: user.defaultRole || 'Customer'
    } as User;
  }

  async getUserByMobile(mobile: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.mobile, mobile));
    return user;
  }

  async createUser(userData: Omit<UpsertUser, 'id'>): Promise<User> {
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  async updateUser(id: string, userData: Partial<UpsertUser>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...userData, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async deleteUser(id: string): Promise<void> {
    // First, delete any user-role assignments to avoid foreign key constraints
    await db.delete(userRoles).where(eq(userRoles.userId, id));
    
    // Then delete the user
    await db.delete(users).where(eq(users.id, id));
  }

  async resetUserPassword(id: string, newPassword: string): Promise<User> {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const encryptedPassword = encryptPasswordForStorage(newPassword);
    
    const [user] = await db
      .update(users)
      .set({ 
        password: hashedPassword,
        encryptedPassword: encryptedPassword,
        updatedAt: new Date() 
      })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async toggleUserStatus(id: string, isActive: boolean): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ 
        isActive, 
        status: isActive ? 'active' : 'inactive',
        updatedAt: new Date() 
      })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async assignUserRole(userId: string, roleId: string): Promise<void> {
    await this.assignRoleToUser(userId, roleId);
  }

  async removeUserRole(userId: string, roleId: string): Promise<void> {
    await this.removeRoleFromUser(userId, roleId);
  }

  async getUsersWithRoles(filters?: { role?: string; status?: string; search?: string; limit?: number; offset?: number }): Promise<{ users: UserWithRoles[]; total: number }> {
    let conditions: any[] = [];
    
    if (filters?.search) {
      conditions.push(
        or(
          ilike(users.name, `%${filters.search}%`),
          ilike(users.email, `%${filters.search}%`),
          ilike(users.username, `%${filters.search}%`),
          ilike(users.mobile, `%${filters.search}%`)
        )
      );
    }
    
    if (filters?.status) {
      conditions.push(eq(users.status, filters.status));
    }
    
    const whereConditions = conditions.length > 0 ? and(...conditions) : undefined;

    // Get users
    const usersResult = await db
      .select()
      .from(users)
      .where(whereConditions)
      .orderBy(desc(users.createdAt))
      .limit(filters?.limit || 50)
      .offset(filters?.offset || 0);

    // Get total count
    const totalResult = await db
      .select({ count: count() })
      .from(users)
      .where(whereConditions);

    // Get roles and manual permissions for each user
    const usersWithRoles = await Promise.all(
      usersResult.map(async (user) => {
        const userRoles = await this.getUserRoles(user.id);
        
        // Get manual permission additions
        const manualPermissionOverrides = await db
          .select({ code: permissions.code })
          .from(userPermissions)
          .innerJoin(permissions, eq(userPermissions.permissionId, permissions.id))
          .where(eq(userPermissions.userId, user.id));
        
        // Get manual permission removals
        const manualPermissionRemovals = await db
          .select({ code: permissions.code })
          .from(userPermissionRemovals)
          .innerJoin(permissions, eq(userPermissionRemovals.permissionId, permissions.id))
          .where(eq(userPermissionRemovals.userId, user.id));
        
        return {
          ...user,
          roles: userRoles,
          manualPermissions: {
            added: manualPermissionOverrides.map(p => p.code),
            removed: manualPermissionRemovals.map(p => p.code)
          }
        };
      })
    );

    // Filter by role if specified
    let filteredUsers = usersWithRoles;
    if (filters?.role) {
      filteredUsers = usersWithRoles.filter(user => 
        user.roles.some(role => role.name === filters.role)
      );
    }

    return {
      users: filteredUsers,
      total: totalResult[0].count as number,
    };
  }

  async getUsersByRoleId(roleId: string): Promise<User[]> {
    const usersResult = await db
      .select()
      .from(users)
      .innerJoin(userRoles, eq(users.id, userRoles.userId))
      .where(eq(userRoles.roleId, roleId));
    
    return usersResult.map(result => result.users);
  }

  async getUsers(filters?: { 
    search?: string; 
    status?: string; 
    defaultRole?: string; 
    hasEncryptedPassword?: boolean;
    limit?: number; 
    offset?: number; 
  }): Promise<{ users: User[]; total: number }> {
    const conditions = [];
    
    if (filters?.search) {
      conditions.push(
        or(
          ilike(users.firstName, `%${filters.search}%`),
          ilike(users.lastName, `%${filters.search}%`),
          ilike(users.username, `%${filters.search}%`),
          ilike(users.mobile, `%${filters.search}%`),
          ilike(users.email, `%${filters.search}%`)
        )
      );
    }
    
    if (filters?.status) {
      conditions.push(eq(users.status, filters.status));
    }
    
    if (filters?.defaultRole) {
      conditions.push(eq(users.defaultRole, filters.defaultRole));
    }
    
    if (filters?.hasEncryptedPassword !== undefined) {
      if (filters.hasEncryptedPassword) {
        conditions.push(isNotNull(users.encryptedPassword));
      } else {
        conditions.push(isNull(users.encryptedPassword));
      }
    }
    
    const whereConditions = conditions.length > 0 ? and(...conditions) : undefined;

    const [usersResult, totalResult] = await Promise.all([
      db
        .select()
        .from(users)
        .where(whereConditions)
        .orderBy(desc(users.createdAt))
        .limit(filters?.limit || 50)
        .offset(filters?.offset || 0),
      db
        .select({ count: count() })
        .from(users)
        .where(whereConditions),
    ]);

    return {
      users: usersResult,
      total: totalResult[0].count as number,
    };
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Customer operations - use unified users table instead
  async getCustomers(search?: string, limit = 50, offset = 0, activeOnly = false): Promise<{ customers: (Customer & { agreementCount: number })[]; total: number }> {
    // Simple query without complex conditions for now
    const usersResult = await db
      .select()
      .from(users)
      .where(eq(users.defaultRole, 'Customer'))
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    const totalResult = await db
      .select({ count: count() })
      .from(users)
      .where(eq(users.defaultRole, 'Customer'));

    // For each user, get their agreement count  
    const customersWithCounts = await Promise.all(
      usersResult.map(async (user) => {
        const agreementCountResult = await db
          .select({ count: count() })
          .from(agreements)
          .where(eq(agreements.customerId, user.id));
        const agreementCount = agreementCountResult[0];
        
        return {
          id: user.id,
          name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
          mobile: user.mobile,
          email: user.email,
          password: user.password,
          encryptedPassword: user.encryptedPassword,
          isActive: user.status === 'active',
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          agreementCount: agreementCount.count,
        } as Customer & { agreementCount: number };
      })
    );

    return {
      customers: customersWithCounts,
      total: totalResult[0].count as number,
    };
  }

  async getCustomer(id: string): Promise<Customer | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    if (!user) return undefined;
    
    // Convert unified user to customer format
    return {
      id: user.id,
      name: user.name,
      mobile: user.mobile!,
      email: user.email,
      password: user.password,
      encryptedPassword: user.encryptedPassword,
      isActive: user.status === 'active',
      createdAt: user.createdAt!,
      updatedAt: user.updatedAt!,
    } as Customer;
  }

  async getCustomerByUsername(username: string): Promise<Customer | undefined> {
    const [user] = await db.select().from(users).where(and(eq(users.username, username), eq(users.defaultRole, 'Customer')));
    if (!user) return undefined;
    
    // Convert unified user to customer format
    return {
      id: user.id,
      name: user.name,
      mobile: user.mobile!,
      email: user.email,
      password: user.password,
      encryptedPassword: user.encryptedPassword,
      isActive: user.status === 'active',
      createdAt: user.createdAt!,
      updatedAt: user.updatedAt!,
    } as Customer;
  }

  async getCustomerByMobile(mobile: string): Promise<Customer | undefined> {
    try {
      const [user] = await db.select().from(users).where(and(eq(users.mobile, mobile), eq(users.defaultRole, 'Customer')));
      if (!user) return undefined;
      
      // Convert unified user to customer format
      return {
        id: user.id,
        name: user.name,
        mobile: user.mobile!,
        email: user.email,
        password: user.password,
        isActive: user.status === 'active',
        createdAt: user.createdAt!,
        updatedAt: user.updatedAt!,
      } as Customer;
    } catch (error) {
      console.error("Error fetching customer by mobile:", error);
      return undefined;
    }
  }

  async createCustomer(customerData: InsertCustomer & { password?: string }): Promise<Customer> {
    const plainPassword = customerData.password || "default123";
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    const encryptedPassword = encryptPasswordForStorage(plainPassword);
    
    // Create customer in unified users table
    const [newUser] = await db
      .insert(users)
      .values({
        name: customerData.name,
        mobile: customerData.mobile,
        email: customerData.email,
        password: hashedPassword, // Store hashed password for authentication
        encryptedPassword: encryptedPassword, // Store encrypted password for admin viewing
        defaultRole: 'Customer',
        status: 'active',
        isActive: true,
      })
      .returning();
    
    // Automatically assign Customer role to new customers
    try {
      const [customerRole] = await db.select().from(roles).where(eq(roles.name, "Customer"));
      if (customerRole) {
        await db.insert(userRoles).values({
          userId: newUser.id,
          roleId: customerRole.id,
        });
      }
    } catch (error) {
      console.error("Error assigning Customer role:", error);
      // Don't fail customer creation if role assignment fails
    }
    
    // Convert unified user to customer format for backward compatibility
    return {
      id: newUser.id,
      name: newUser.name,
      mobile: newUser.mobile!,
      email: newUser.email,
      password: newUser.password,
      isActive: newUser.status === 'active',
      createdAt: newUser.createdAt!,
      updatedAt: newUser.updatedAt!,
    } as Customer;
  }

  async updateCustomer(id: string, customerData: Partial<InsertCustomer> & { password?: string }): Promise<Customer> {
    let updateData: any = { updatedAt: new Date() };
    
    // Map customer fields to user fields
    if (customerData.name) updateData.name = customerData.name;
    if (customerData.mobile) updateData.mobile = customerData.mobile;
    if (customerData.email) updateData.email = customerData.email;
    if (customerData.isActive !== undefined) {
      updateData.isActive = customerData.isActive;
      updateData.status = customerData.isActive ? 'active' : 'inactive';
    }
    
    // If password is being updated, hash it
    if (customerData.password) {
      const hashedPassword = await bcrypt.hash(customerData.password, 10);
      updateData.password = hashedPassword;
    }
    
    const [user] = await db
      .update(users)
      .set(updateData)
      .where(and(eq(users.id, id), eq(users.defaultRole, 'Customer')))
      .returning();
    
    // Convert unified user to customer format
    return {
      id: user.id,
      name: user.name,
      mobile: user.mobile!,
      email: user.email,
      password: user.password,
      isActive: user.status === 'active',
      createdAt: user.createdAt!,
      updatedAt: user.updatedAt!,
    } as Customer;
  }

  async deleteCustomer(id: string): Promise<void> {
    // Check if customer has any agreements
    const [agreementCount] = await db
      .select({ count: count() })
      .from(agreements)
      .where(eq(agreements.customerId, id));
    
    if (agreementCount.count > 0) {
      throw new Error('Cannot delete customer with existing agreements');
    }
    
    // Delete customer from unified users table
    await db.delete(users).where(and(eq(users.id, id), eq(users.defaultRole, 'Customer')));
  }

  async resetCustomerPassword(id: string, newPassword: string): Promise<Customer> {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const encryptedPassword = encryptPasswordForStorage(newPassword);
    
    const [user] = await db
      .update(users)
      .set({ 
        password: hashedPassword, // Store hashed password for authentication
        encryptedPassword: encryptedPassword, // Store encrypted password for admin viewing
        updatedAt: new Date() 
      })
      .where(eq(users.id, id))
      .returning();
    
    if (!user) {
      throw new Error("Customer not found");
    }
    
    // Convert unified user to customer format
    return {
      id: user.id,
      name: user.name,
      mobile: user.mobile!,
      email: user.email,
      password: user.password,
      isActive: user.status === 'active',
      createdAt: user.createdAt!,
      updatedAt: user.updatedAt!,
    } as Customer;
  }

  async toggleCustomerStatus(id: string, isActive: boolean): Promise<Customer> {
    const [customer] = await db
      .update(customers)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(customers.id, id))
      .returning();
    return customer;
  }

  // Migration helper functions for password encryption
  async getCustomersForPasswordMigration(): Promise<Customer[]> {
    return await db
      .select()
      .from(customers)
      .where(
        and(
          sql`plain_password IS NOT NULL`,
          sql`encrypted_password IS NULL`
        )
      );
  }

  async migrateCustomerPassword(id: string, plainPassword: string): Promise<Customer> {
    const encryptedPassword = encryptPasswordForStorage(plainPassword);
    
    const [customer] = await db
      .update(customers)
      .set({ 
        encryptedPassword: encryptedPassword,
        updatedAt: new Date() 
      })
      .where(eq(customers.id, id))
      .returning();
    return customer;
  }

  async getCustomerLegacy(id: string): Promise<{ plainPassword?: string } | undefined> {
    const [customer] = await db
      .select({ plainPassword: sql<string>`plain_password` })
      .from(customers)
      .where(eq(customers.id, id));
    return customer;
  }

  // Society operations - now returns addresses with society field
  async getSocieties(search?: string, limit = 100): Promise<any[]> {
    const whereConditions = search
      ? or(
          ilike(addresses.society, `%${search}%`),
          ilike(addresses.area, `%${search}%`),
          ilike(addresses.city, `%${search}%`)
        )
      : undefined;

    const results = await db
      .select({
        id: addresses.id,
        societyName: addresses.society,
        area: addresses.area,
        city: addresses.city,
        state: addresses.state,
        district: addresses.district,
        pincode: addresses.pincode
      })
      .from(addresses)
      .where(whereConditions)
      .orderBy(addresses.society)
      .limit(limit);

    return results;
  }

  async getSociety(id: string): Promise<any | undefined> {
    const [address] = await db.select().from(addresses).where(eq(addresses.id, id));
    if (!address) return undefined;
    
    return {
      id: address.id,
      societyName: address.society,
      area: address.area,
      city: address.city,
      state: address.state,
      district: address.district,
      pincode: address.pincode
    };
  }

  // Note: Society create/update/delete operations have been migrated to address management
  // These methods are kept for API compatibility but redirect to address operations
  async createSociety(societyData: any): Promise<any> {
    const addressData = {
      flatNumber: '',
      building: '',
      society: societyData.societyName || societyData.society,
      area: societyData.area,
      city: societyData.city,
      state: societyData.state,
      district: societyData.district,
      pincode: societyData.pincode,
      landmark: ''
    };
    
    const [address] = await db.insert(addresses).values(addressData).returning();
    return {
      id: address.id,
      societyName: address.society,
      area: address.area,
      city: address.city,
      state: address.state,
      district: address.district,
      pincode: address.pincode
    };
  }

  async updateSociety(id: string, societyData: any): Promise<any> {
    const updateData = {
      society: societyData.societyName || societyData.society,
      area: societyData.area,
      city: societyData.city,
      state: societyData.state,
      district: societyData.district,
      pincode: societyData.pincode
    };
    
    const [address] = await db
      .update(addresses)
      .set(updateData)
      .where(eq(addresses.id, id))
      .returning();
      
    return {
      id: address.id,
      societyName: address.society,
      area: address.area,
      city: address.city,
      state: address.state,
      district: address.district,
      pincode: address.pincode
    };
  }

  async deleteSociety(id: string): Promise<void> {
    await db.delete(addresses).where(eq(addresses.id, id));
  }

  // Property operations
  async getProperties(customerId?: string): Promise<Property[]> {
    const whereConditions = customerId ? eq(properties.customerId, customerId) : undefined;
    
    return db
      .select()
      .from(properties)
      .where(whereConditions)
      .orderBy(properties.society, properties.flatNumber);
  }

  async getProperty(id: string): Promise<Property | undefined> {
    const [property] = await db.select().from(properties).where(eq(properties.id, id));
    return property;
  }

  async createProperty(propertyData: InsertProperty): Promise<Property> {
    const [property] = await db.insert(properties).values(propertyData).returning();
    return property;
  }

  async updateProperty(id: string, propertyData: Partial<InsertProperty>): Promise<Property> {
    const [property] = await db
      .update(properties)
      .set(propertyData)
      .where(eq(properties.id, id))
      .returning();
    return property;
  }

  async deleteProperty(id: string): Promise<void> {
    await db.delete(properties).where(eq(properties.id, id));
  }

  async getAllPropertiesWithCustomers(): Promise<any[]> {
    const result = await db
      .select({
        id: properties.id,
        customerId: properties.customerId,
        flatNumber: properties.flatNumber,
        building: properties.building,
        society: properties.society,
        area: properties.area,
        city: properties.city,
        state: properties.state,
        pincode: properties.pincode,
        district: properties.district,
        landmark: properties.landmark,
        propertyType: properties.propertyType,
        purpose: properties.purpose,
        isActive: properties.isActive,
        createdAt: properties.createdAt,
        updatedAt: properties.updatedAt,
        customer: {
          id: users.id,
          name: users.name,
          mobile: users.mobile,
          email: users.email,
        }
      })
      .from(properties)
      .leftJoin(users, eq(properties.customerId, users.id))
      .orderBy(desc(properties.createdAt));

    // Get agreement counts for each property
    const propertiesWithCounts = await Promise.all(result.map(async (property) => {
      const [agreementCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(agreements)
        .where(eq(agreements.propertyId, property.id));
      
      return {
        ...property,
        agreementCount: agreementCount.count || 0
      };
    }));

    return propertiesWithCounts;
  }


  async findOrCreatePropertyForAgreement(customerId: string, propertyDetails: any): Promise<Property> {
    // Extract property details from agreement
    const flatNumber = propertyDetails.flatNumber || '';
    const building = propertyDetails.building || '';
    const society = propertyDetails.society || '';
    const area = propertyDetails.area || '';
    const city = propertyDetails.city || '';
    const state = propertyDetails.state || '';
    const pincode = propertyDetails.pincode || '';
    const district = propertyDetails.district || '';
    const landmark = propertyDetails.landmark || '';
    const propertyType = propertyDetails.propertyType || 'residential';
    const purpose = propertyDetails.purpose || '';

    // Try to find existing property with same address
    const [existingProperty] = await db
      .select()
      .from(properties)
      .where(and(
        eq(properties.customerId, customerId),
        eq(properties.flatNumber, flatNumber),
        eq(properties.society, society),
        eq(properties.area, area),
        eq(properties.city, city)
      ));

    if (existingProperty) {
      return existingProperty;
    }

    // Create new property
    const [newProperty] = await db
      .insert(properties)
      .values({
        customerId,
        flatNumber,
        building,
        society,
        area,
        city,
        state,
        pincode,
        district,
        landmark,
        propertyType,
        purpose,
      })
      .returning();

    return newProperty;
  }

  // Agreement operations
  async getAgreements(filters?: {
    customerId?: string;
    propertyId?: string;
    status?: string;
    search?: string;
    dateFilter?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ agreements: Agreement[]; total: number }> {
    const { customerId, propertyId, status, search, dateFilter, startDate, endDate, limit = 50, offset = 0 } = filters || {};
    
    // console.log(`[Date Filter Debug] Received parameters:`, { dateFilter, startDate, endDate }); // Removed for performance
    
    // Build date condition for agreement expiration date filtering (endDate field)
    let dateCondition;
    
    // Apply date filtering only when we have start and end dates (from calculated ranges or custom)
    if (startDate && endDate && startDate.trim() && endDate.trim()) {
      try {
        const cleanStartDate = startDate.trim();
        const cleanEndDate = endDate.trim();
        
        // Validate the dates
        const parsedStart = new Date(cleanStartDate);
        const parsedEnd = new Date(cleanEndDate);
        
        if (!isNaN(parsedStart.getTime()) && !isNaN(parsedEnd.getTime())) {
          // Filter by agreement expiration date (endDate field) - when agreements expire
          // Use string dates for date fields (not timestamps)
          dateCondition = and(
            gte(agreements.endDate, cleanStartDate),
            lte(agreements.endDate, cleanEndDate)
          );
          // console.log(`[Date Filter] Applied expiration date filter: ${cleanStartDate} to ${cleanEndDate}`); // Removed for performance
        } else {
          console.error('[Date Filter] Invalid date format:', { startDate, endDate });
        }
      } catch (e) {
        console.error('[Date Filter] Error parsing dates:', e);
      }
    } else {
      // console.log('[Date Filter] No date filtering applied - missing start or end date'); // Removed for performance
    }
    // For no date filter or 'all' filter, dateCondition remains undefined (no date filtering)
    
    // Build search condition for multiple fields
    let searchCondition = null;
    if (search) {
      const searchTerm = `%${search}%`;
      searchCondition = or(
        // Search by agreement number
        ilike(agreements.agreementNumber, searchTerm),
        // Search by customer name (via join)
        ilike(users.name, searchTerm),
        // Search by owner/landlord details (convert JSON to text for search)
        sql`${agreements.ownerDetails}::text ILIKE ${searchTerm}`,
        // Search by tenant details (convert JSON to text for search)
        sql`${agreements.tenantDetails}::text ILIKE ${searchTerm}`,
        // Search by property details (convert JSON to text for search)
        sql`${agreements.propertyDetails}::text ILIKE ${searchTerm}`
      );
    }

    // Build conditions array, filtering out undefined values
    const conditions = [
      customerId ? eq(agreements.customerId, customerId) : null,
      propertyId ? eq(agreements.propertyId, propertyId) : null,
      status ? eq(agreements.status, status) : null,
      searchCondition,
      dateCondition
    ].filter((condition): condition is NonNullable<typeof condition> => Boolean(condition));

    const whereConditions = conditions.length > 0 ? and(...conditions) : undefined;

    const [agreementsResult, totalResult] = await Promise.all([
      db
        .select()
        .from(agreements)
        .leftJoin(users, eq(agreements.customerId, users.id))
        .where(whereConditions)
        .orderBy(asc(agreements.endDate))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: count() })
        .from(agreements)
        .leftJoin(users, eq(agreements.customerId, users.id))
        .where(whereConditions),
    ]);

    return {
      agreements: agreementsResult.map(row => {
        const agreement = {
          ...row.agreements,
          customer: row.users
        } as any;
        // Apply uppercase conversion to existing data when retrieving
        return this.convertToUpperCase(agreement);
      }),
      total: totalResult[0].count,
    };
  }

  async getAgreement(id: string): Promise<Agreement | undefined> {
    const [result] = await db
      .select()
      .from(agreements)
      .leftJoin(users, eq(agreements.customerId, users.id))
      .where(eq(agreements.id, id));
    
    if (!result) return undefined;
    
    const agreement = {
      ...result.agreements,
      customer: result.users
    } as any;
    
    // Apply uppercase conversion to existing data when retrieving
    return this.convertToUpperCase(agreement);
  }

  async getAgreementByNumber(agreementNumber: string): Promise<Agreement | undefined> {
    const [agreement] = await db
      .select()
      .from(agreements)
      .where(eq(agreements.agreementNumber, agreementNumber));
    
    if (!agreement) return undefined;
    
    // Apply uppercase conversion to existing data when retrieving
    return this.convertToUpperCase(agreement);
  }

  // Optimized helper function to convert names, professions, and addresses to uppercase
  private convertToUpperCase(data: any): any {
    if (!data || typeof data !== 'object') return data;
    
    // Helper function to safely convert string to uppercase
    const safeUpperCase = (value: any): string => {
      return (value && typeof value === 'string') ? value.toUpperCase() : value;
    };
    
    // Process fields in-place for better performance
    const processDetails = (details: any) => {
      if (!details || typeof details !== 'object') return;
      
      // Convert main fields
      if (details.name) details.name = safeUpperCase(details.name);
      if (details.profession) details.profession = safeUpperCase(details.profession);
      if (details.occupation) details.occupation = safeUpperCase(details.occupation);
      if (details.address && typeof details.address === 'string') details.address = safeUpperCase(details.address);
      if (details.fullAddress) details.fullAddress = safeUpperCase(details.fullAddress);
      
      // Convert individual address components
      if (details.houseNumber) details.houseNumber = safeUpperCase(details.houseNumber);
      if (details.society) details.society = safeUpperCase(details.society);
      if (details.area) details.area = safeUpperCase(details.area);
      if (details.city) details.city = safeUpperCase(details.city);
      if (details.state) details.state = safeUpperCase(details.state);
      
      // Handle nested address object
      if (details.address && typeof details.address === 'object') {
        const addr = details.address;
        if (addr.flatNo) addr.flatNo = safeUpperCase(addr.flatNo);
        if (addr.society) addr.society = safeUpperCase(addr.society);
        if (addr.area) addr.area = safeUpperCase(addr.area);
        if (addr.city) addr.city = safeUpperCase(addr.city);
        if (addr.state) addr.state = safeUpperCase(addr.state);
      }
    };
    
    // Convert owner details
    if (data.ownerDetails) {
      processDetails(data.ownerDetails);
    }
    
    // Convert tenant details
    if (data.tenantDetails) {
      processDetails(data.tenantDetails);
    }
    
    // Convert property details
    if (data.propertyDetails) {
      processDetails(data.propertyDetails);
      // Additional property-specific fields
      if (data.propertyDetails.type) data.propertyDetails.type = safeUpperCase(data.propertyDetails.type);
      if (data.propertyDetails.purpose) data.propertyDetails.purpose = safeUpperCase(data.propertyDetails.purpose);
      if (data.propertyDetails.flatNumber) data.propertyDetails.flatNumber = safeUpperCase(data.propertyDetails.flatNumber);
    }
    
    return data;
  }

  async createAgreement(agreementData: InsertAgreement): Promise<Agreement> {
    try {
      // Convert names, professions, and addresses to uppercase before saving
      const processedData = this.convertToUpperCase(agreementData);
      
      // Generate agreement number
      const year = new Date().getFullYear();
      const lastAgreement = await db
        .select()
        .from(agreements)
        .where(ilike(agreements.agreementNumber, `AGR-${year}-%`))
        .orderBy(desc(agreements.createdAt))
        .limit(1);

      let nextNumber = 1;
      if (lastAgreement.length > 0) {
        const lastNumber = parseInt(lastAgreement[0].agreementNumber.split('-')[2]);
        nextNumber = lastNumber + 1;
      }

      const agreementNumber = `AGR-${year}-${nextNumber.toString().padStart(3, '0')}`;

      // Handle property relationship
      let propertyId = processedData.propertyId;
      
      // If property details are provided but no propertyId, create/find property
      if (!propertyId && processedData.propertyDetails && processedData.customerId) {
        const property = await this.findOrCreatePropertyForAgreement(
          processedData.customerId,
          processedData.propertyDetails
        );
        propertyId = property.id;
      }

      const result = await db
        .insert(agreements)
        .values({
          ...processedData,
          agreementNumber,
          propertyId,
        })
        .returning();
      
      const agreement = Array.isArray(result) ? result[0] : result;
        
      if (!agreement) {
        throw new Error('Failed to create agreement - no data returned');
      }
        
      return agreement;
    } catch (error) {
      console.error('Database error in createAgreement:', error);
      throw error;
    }
  }

  async updateAgreement(id: string, agreementData: Partial<InsertAgreement>): Promise<Agreement> {
    // Get the existing agreement to preserve editedHtml if not explicitly provided
    const existingAgreement = await this.getAgreement(id);
    if (!existingAgreement) {
      throw new Error("Agreement not found");
    }

    // Preserve editedHtml and editedAt if not explicitly provided in update data
    const updateData = {
      ...agreementData,
      updatedAt: new Date(),
      // Preserve existing editedHtml if not being updated
      ...(agreementData.editedHtml === undefined && {
        editedHtml: existingAgreement.editedHtml,
        editedAt: existingAgreement.editedAt
      })
    };

    const [agreement] = await db
      .update(agreements)
      .set(updateData)
      .where(eq(agreements.id, id))
      .returning();
    return agreement;
  }

  async deleteAgreement(id: string): Promise<void> {
    try {
      console.log(`[Storage] Attempting to delete agreement ${id} from database`);
      
      // First check if the agreement exists
      const existingAgreement = await this.getAgreement(id);
      if (!existingAgreement) {
        throw new Error(`Agreement with id ${id} not found`);
      }
      
      // Delete the agreement
      const result = await db.delete(agreements).where(eq(agreements.id, id));
      console.log(`[Storage] Delete result for agreement ${id}:`, result);
      console.log(`[Storage] Successfully deleted agreement ${id} from database`);
    } catch (error) {
      console.error(`[Storage] Error deleting agreement ${id}:`, error);
      throw error;
    }
  }

  async renewAgreement(id: string, newStartDate: Date, newEndDate: Date): Promise<Agreement> {
    const originalAgreement = await this.getAgreement(id);
    if (!originalAgreement) {
      throw new Error("Agreement not found");
    }

    // Create renewed agreement
    const renewedAgreement = await this.createAgreement({
      ...originalAgreement,
      id: undefined as any,
      agreementNumber: undefined as any,
      startDate: newStartDate.toISOString().split('T')[0],
      endDate: newEndDate.toISOString().split('T')[0],
      agreementDate: new Date().toISOString().split('T')[0],
      status: "active",
      renewedFromId: id,
      parentAgreementId: originalAgreement.parentAgreementId || id,
      documents: {}, // Reset documents for new agreement
      createdAt: undefined as any,
      updatedAt: undefined as any,
    } as InsertAgreement);

    // Update original agreement status
    await this.updateAgreement(id, { status: "renewed" as any });

    return renewedAgreement;
  }


  async updateAgreementNotarizedDocument(id: string, notarizedDocData: any): Promise<Agreement> {
    const [updatedAgreement] = await db
      .update(agreements)
      .set({ 
        notarizedDocument: notarizedDocData,
        notaryStatus: 'complete', // Update notary status to complete when document is uploaded
        updatedAt: new Date()
      })
      .where(eq(agreements.id, id))
      .returning();
    
    if (!updatedAgreement) {
      throw new Error("Agreement not found");
    }
    
    return updatedAgreement;
  }

  // Save edited content for a specific agreement
  async saveEditedContent(agreementId: string, editedHtml: string): Promise<void> {
    const [updatedAgreement] = await db
      .update(agreements)
      .set({ 
        editedHtml: editedHtml,
        editedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(agreements.id, agreementId))
      .returning();
    
    if (!updatedAgreement) {
      throw new Error("Agreement not found");
    }
  }

  async clearEditedContent(agreementId: string): Promise<void> {
    const [updatedAgreement] = await db
      .update(agreements)
      .set({ 
        editedHtml: null,
        editedAt: null,
        updatedAt: new Date()
      })
      .where(eq(agreements.id, agreementId))
      .returning();
    
    if (!updatedAgreement) {
      throw new Error("Agreement not found");
    }
  }


  async getDashboardStats(customerId?: string): Promise<{
    totalAgreements: number;
    activeAgreements: number;
    expiringSoon: number;
    totalCustomers: number;
  }> {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const thirtyDaysFormatted = thirtyDaysFromNow.toISOString().split('T')[0];

    // For customers, filter by their ID; for admins, show all stats
    const customerFilter = customerId ? eq(agreements.customerId, customerId) : undefined;

    const [
      totalAgreements,
      activeAgreements,
      expiringSoon,
      totalCustomers,
    ] = await Promise.all([
      customerFilter 
        ? db.select({ count: count() }).from(agreements).where(customerFilter)
        : db.select({ count: count() }).from(agreements),
      customerFilter
        ? db.select({ count: count() }).from(agreements).where(and(eq(agreements.status, "active"), customerFilter))
        : db.select({ count: count() }).from(agreements).where(eq(agreements.status, "active")),
      customerFilter
        ? db.select({ count: count() })
            .from(agreements)
            .where(
              and(
                eq(agreements.status, "active"),
                customerFilter,
                sql`${agreements.endDate} <= ${thirtyDaysFormatted}`
              )
            )
        : db.select({ count: count() })
            .from(agreements)
            .where(
              and(
                eq(agreements.status, "active"),
                sql`${agreements.endDate} <= ${thirtyDaysFormatted}`
              )
            ),
      // For customers, totalCustomers should be 1 (themselves); for admins, show all
      customerId 
        ? Promise.resolve([{ count: 1 }]) 
        : db.select({ count: count() }).from(users).where(eq(users.defaultRole, 'Customer')),
    ]);

    return {
      totalAgreements: totalAgreements[0].count,
      activeAgreements: activeAgreements[0].count,
      expiringSoon: expiringSoon[0].count,
      totalCustomers: totalCustomers[0].count,
    };
  }

  // Full PDF Template CRUD operations
  async getPdfTemplates(documentType?: string, language?: string): Promise<PdfTemplate[]> {
    let query = db.select().from(pdfTemplates);
    
    const conditions = [];
    if (documentType) {
      conditions.push(eq(pdfTemplates.documentType, documentType));
    }
    if (language) {
      conditions.push(eq(pdfTemplates.language, language));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    const templates = await query.orderBy(desc(pdfTemplates.isActive), desc(pdfTemplates.createdAt));
    console.log(`[PDF Templates] Found ${templates.length} templates for documentType: ${documentType}, language: ${language}`);
    return templates;
  }

  async getPdfTemplate(id: string): Promise<PdfTemplate | undefined> {
    const [template] = await db.select().from(pdfTemplates).where(eq(pdfTemplates.id, id));
    console.log(`[PDF Templates] Retrieved template ${id}:`, template ? 'found' : 'not found');
    return template || undefined;
  }

  async createPdfTemplate(template: InsertPdfTemplate): Promise<PdfTemplate> {
    const [newTemplate] = await db.insert(pdfTemplates).values(template).returning();
    console.log(`[PDF Templates] Created template ${newTemplate.id}: ${newTemplate.name}`);
    return newTemplate;
  }

  async updatePdfTemplate(id: string, template: Partial<InsertPdfTemplate>): Promise<PdfTemplate | undefined> {
    const [updatedTemplate] = await db
      .update(pdfTemplates)
      .set({ ...template, updatedAt: new Date() })
      .where(eq(pdfTemplates.id, id))
      .returning();
    
    console.log(`[PDF Templates] Updated template ${id}:`, updatedTemplate ? 'success' : 'not found');
    return updatedTemplate || undefined;
  }

  async deletePdfTemplate(id: string): Promise<boolean> {
    const result = await db.delete(pdfTemplates).where(eq(pdfTemplates.id, id));
    const deleted = result.rowCount && result.rowCount > 0;
    console.log(`[PDF Templates] Deleted template ${id}:`, deleted ? 'success' : 'not found');
    return deleted || false;
  }







  // Address operations for intelligent autocomplete
  async searchAddresses(search: string, limit: number = 10): Promise<Address[]> {
    const results = await db
      .select()
      .from(addresses)
      .where(
        or(
          ilike(addresses.society, `%${search}%`),
          ilike(addresses.area, `%${search}%`),
          ilike(addresses.city, `%${search}%`)
        )
      )
      .orderBy(desc(addresses.usageCount), desc(addresses.createdAt))
      .limit(limit);
    
    return results;
  }

  async saveAddress(addressData: InsertAddress): Promise<Address> {
    try {
      // Check if address already exists
      const existingAddress = await db
        .select()
        .from(addresses)
        .where(
          and(
            eq(addresses.society, addressData.society),
            eq(addresses.area, addressData.area),
            eq(addresses.city, addressData.city)
          )
        )
        .limit(1);

      if (existingAddress.length > 0) {
        // Increment usage count
        const [updatedAddress] = await db
          .update(addresses)
          .set({ 
            usageCount: sql`${addresses.usageCount} + 1`,
            updatedAt: new Date()
          })
          .where(eq(addresses.id, existingAddress[0].id))
          .returning();
        return updatedAddress;
      }

      // Create new address
      const [newAddress] = await db
        .insert(addresses)
        .values(addressData)
        .returning();
      return newAddress;
    } catch (error) {
      console.error("Error saving address:", error);
      throw error;
    }
  }

  async incrementAddressUsage(addressId: string): Promise<void> {
    await db
      .update(addresses)
      .set({ 
        usageCount: sql`${addresses.usageCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(addresses.id, addressId));
  }

  // RBAC operations implementation
  // Permission operations
  async getPermissions(): Promise<Permission[]> {
    return db.select().from(permissions).orderBy(permissions.code);
  }

  async getPermission(id: string): Promise<Permission | undefined> {
    const [permission] = await db.select().from(permissions).where(eq(permissions.id, id));
    return permission;
  }

  async getPermissionByCode(code: string): Promise<Permission | undefined> {
    const [permission] = await db.select().from(permissions).where(eq(permissions.code, code));
    return permission;
  }

  async createPermission(permissionData: InsertPermission): Promise<Permission> {
    const [permission] = await db.insert(permissions).values(permissionData).returning();
    return permission;
  }

  async updatePermission(id: string, permissionData: Partial<InsertPermission>): Promise<Permission> {
    const [permission] = await db
      .update(permissions)
      .set(permissionData)
      .where(eq(permissions.id, id))
      .returning();
    return permission;
  }

  async deletePermission(id: string): Promise<void> {
    await db.delete(rolePermissionsTable).where(eq(rolePermissionsTable.permissionId, id));
    await db.delete(permissions).where(eq(permissions.id, id));
  }

  // Role operations
  async getRoles(): Promise<RoleWithPermissions[]> {
    const rolesResult = await db
      .select({
        role: roles,
        permission: permissions,
      })
      .from(roles)
      .leftJoin(rolePermissionsTable, eq(roles.id, rolePermissionsTable.roleId))
      .leftJoin(permissions, eq(rolePermissionsTable.permissionId, permissions.id))
      .orderBy(roles.name);

    const rolesMap = new Map<string, RoleWithPermissions>();
    
    for (const row of rolesResult) {
      if (!rolesMap.has(row.role.id)) {
        rolesMap.set(row.role.id, {
          ...row.role,
          permissions: [],
        });
      }
      
      if (row.permission) {
        rolesMap.get(row.role.id)!.permissions.push(row.permission);
      }
    }

    return Array.from(rolesMap.values());
  }

  async getRole(id: string): Promise<RoleWithPermissions | undefined> {
    const result = await db
      .select({
        role: roles,
        permission: permissions,
      })
      .from(roles)
      .leftJoin(rolePermissionsTable, eq(roles.id, rolePermissionsTable.roleId))
      .leftJoin(permissions, eq(rolePermissionsTable.permissionId, permissions.id))
      .where(eq(roles.id, id));

    if (result.length === 0) return undefined;

    const role = result[0].role;
    const rolePermissionsTableList = result
      .filter(row => row.permission)
      .map(row => row.permission!);

    return {
      ...role,
      permissions: rolePermissionsTableList,
    };
  }

  async getRoleByName(name: string): Promise<RoleWithPermissions | undefined> {
    const result = await db
      .select({
        role: roles,
        permission: permissions,
      })
      .from(roles)
      .leftJoin(rolePermissionsTable, eq(roles.id, rolePermissionsTable.roleId))
      .leftJoin(permissions, eq(rolePermissionsTable.permissionId, permissions.id))
      .where(eq(roles.name, name));

    if (result.length === 0) return undefined;

    const role = result[0].role;
    const rolePermissionsTableList = result
      .filter(row => row.permission)
      .map(row => row.permission!);

    return {
      ...role,
      permissions: rolePermissionsTableList,
    };
  }

  async createRole(roleData: InsertRole): Promise<Role> {
    const [role] = await db.insert(roles).values(roleData).returning();
    return role;
  }

  async updateRole(id: string, roleData: Partial<InsertRole>): Promise<Role> {
    const [role] = await db
      .update(roles)
      .set({ ...roleData, updatedAt: new Date() })
      .where(eq(roles.id, id))
      .returning();
    return role;
  }

  async deleteRole(id: string): Promise<void> {
    await db.delete(rolePermissionsTable).where(eq(rolePermissionsTable.roleId, id));
    await db.delete(userRoles).where(eq(userRoles.roleId, id));
    await db.delete(roles).where(eq(roles.id, id));
  }

  // Role-Permission operations
  async assignPermissionToRole(roleId: string, permissionId: string): Promise<RolePermission> {
    const [rolePermission] = await db
      .insert(rolePermissionsTable)
      .values({ roleId, permissionId })
      .returning();
    return rolePermission;
  }

  async removePermissionFromRole(roleId: string, permissionId: string): Promise<void> {
    await db
      .delete(rolePermissionsTable)
      .where(and(eq(rolePermissionsTable.roleId, roleId), eq(rolePermissionsTable.permissionId, permissionId)));
  }

  async getRolePermissions(roleId: string): Promise<Permission[]> {
    const result = await db
      .select({ permission: permissions })
      .from(rolePermissionsTable)
      .innerJoin(permissions, eq(rolePermissionsTable.permissionId, permissions.id))
      .where(eq(rolePermissionsTable.roleId, roleId));

    return result.map(row => row.permission);
  }

  // User-Role operations
  async assignRoleToUser(userId: string, roleId: string): Promise<UserRole> {
    // Check if role is already assigned to avoid duplicate key errors
    const existing = await db
      .select()
      .from(userRoles)
      .where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId)))
      .limit(1);
    
    if (existing.length > 0) {
      return existing[0];
    }
    
    const [userRole] = await db
      .insert(userRoles)
      .values({ userId, roleId })
      .returning();
    return userRole;
  }

  async removeRoleFromUser(userId: string, roleId: string): Promise<void> {
    await db
      .delete(userRoles)
      .where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId)));
  }

  async getUserRoles(userId: string): Promise<RoleWithStringPermissions[]> {
    const result = await db
      .select({
        role: roles,
        permission: permissions,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .leftJoin(rolePermissionsTable, eq(roles.id, rolePermissionsTable.roleId))
      .leftJoin(permissions, eq(rolePermissionsTable.permissionId, permissions.id))
      .where(eq(userRoles.userId, userId));

    const rolesMap = new Map<string, RoleWithStringPermissions>();
    
    for (const row of result) {
      if (!rolesMap.has(row.role.id)) {
        rolesMap.set(row.role.id, {
          ...row.role,
          permissions: [],
        });
      }
      
      if (row.permission) {
        rolesMap.get(row.role.id)!.permissions.push(row.permission.code);
      }
    }

    return Array.from(rolesMap.values());
  }

  async getUserWithRoles(userId: string): Promise<UserWithRoles | undefined> {
    const user = await this.getUser(userId);
    if (!user) return undefined;

    const userRolesList = await this.getUserRoles(userId);
    
    return {
      ...user,
      roles: userRolesList,
    };
  }

  // Customer-Role operations
  async assignRoleToCustomer(customerId: string, roleId: string): Promise<UserRole> {
    // Check if role is already assigned to avoid duplicate key errors
    const existing = await db
      .select()
      .from(userRoles)
      .where(and(eq(userRoles.userId, customerId), eq(userRoles.roleId, roleId)))
      .limit(1);
    
    if (existing.length > 0) {
      return existing[0];
    }
    
    const [customerRole] = await db
      .insert(userRoles)
      .values({ userId: customerId, roleId })
      .returning();
    return customerRole;
  }

  async removeRoleFromCustomer(customerId: string, roleId: string): Promise<void> {
    await db
      .delete(userRoles)
      .where(and(eq(userRoles.userId, customerId), eq(userRoles.roleId, roleId)));
  }

  async getCustomerRoles(customerId: string): Promise<RoleWithPermissions[]> {
    const result = await db
      .select({
        role: roles,
        permission: permissions,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .leftJoin(rolePermissionsTable, eq(roles.id, rolePermissionsTable.roleId))
      .leftJoin(permissions, eq(rolePermissionsTable.permissionId, permissions.id))
      .where(eq(userRoles.userId, customerId));

    const rolesMap = new Map<string, RoleWithPermissions>();
    
    for (const row of result) {
      if (!rolesMap.has(row.role.id)) {
        rolesMap.set(row.role.id, {
          ...row.role,
          permissions: [],
        });
      }
      
      if (row.permission) {
        rolesMap.get(row.role.id)!.permissions.push(row.permission);
      }
    }

    return Array.from(rolesMap.values());
  }

  async getCustomerWithRoles(customerId: string): Promise<UserWithRoles | undefined> {
    const customer = await this.getCustomer(customerId);
    if (!customer) return undefined;

    const customerRolesList = await this.getCustomerRoles(customerId);
    
    return {
      ...customer,
      roles: customerRolesList,
    };
  }

  // Permission checking
  async userHasPermission(userId: string, permissionCode: string): Promise<boolean> {
    const result = await db
      .select({ count: count() })
      .from(userRoles)
      .innerJoin(rolePermissionsTable, eq(userRoles.roleId, rolePermissionsTable.roleId))
      .innerJoin(permissions, eq(rolePermissionsTable.permissionId, permissions.id))
      .where(and(eq(userRoles.userId, userId), eq(permissions.code, permissionCode)));

    return result[0].count > 0;
  }

  async customerHasPermission(customerId: string, permissionCode: string): Promise<boolean> {
    const result = await db
      .select({ count: count() })
      .from(userRoles)
      .innerJoin(rolePermissionsTable, eq(userRoles.roleId, rolePermissionsTable.roleId))
      .innerJoin(permissions, eq(rolePermissionsTable.permissionId, permissions.id))
      .where(and(eq(userRoles.userId, customerId), eq(permissions.code, permissionCode)));

    return result[0].count > 0;
  }

  async getUserPermissions(userId: string): Promise<string[]> {
    // Get permissions from roles
    const rolePermissionResults = await db
      .select({ code: permissions.code })
      .from(userRoles)
      .innerJoin(rolePermissionsTable, eq(userRoles.roleId, rolePermissionsTable.roleId))
      .innerJoin(permissions, eq(rolePermissionsTable.permissionId, permissions.id))
      .where(eq(userRoles.userId, userId));

    // Get manual permission additions
    const manualPermissions = await db
      .select({ code: permissions.code })
      .from(userPermissions)
      .innerJoin(permissions, eq(userPermissions.permissionId, permissions.id))
      .where(eq(userPermissions.userId, userId));

    // Get manual permission removals
    const removedPermissions = await db
      .select({ code: permissions.code })
      .from(userPermissionRemovals)
      .innerJoin(permissions, eq(userPermissionRemovals.permissionId, permissions.id))
      .where(eq(userPermissionRemovals.userId, userId));

    // Get removed permission codes
    const removedPermissionCodes = new Set(removedPermissions.map(p => p.code));

    // Combine permissions and filter out removed ones
    const allPermissions = new Set([
      ...rolePermissionResults.filter(p => !removedPermissionCodes.has(p.code)).map(p => p.code),
      ...manualPermissions.filter(p => !removedPermissionCodes.has(p.code)).map(p => p.code)
    ]);

    return Array.from(allPermissions);
  }

  async getUserPermissionsWithSources(userId: string): Promise<{ code: string; source: 'role' | 'override'; roleName?: string }[]> {
    // Get permissions from roles with role names
    const rolePermissions = await db
      .select({ 
        code: permissions.code,
        roleName: roles.name
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .innerJoin(rolePermissionsTable, eq(userRoles.roleId, rolePermissionsTable.roleId))
      .innerJoin(permissions, eq(rolePermissionsTable.permissionId, permissions.id))
      .where(eq(userRoles.userId, userId));

    // Get manual permission additions
    const manualPermissions = await db
      .select({ code: permissions.code })
      .from(userPermissions)
      .innerJoin(permissions, eq(userPermissions.permissionId, permissions.id))
      .where(eq(userPermissions.userId, userId));

    // Get manual permission removals
    const removedPermissions = await db
      .select({ code: permissions.code })
      .from(userPermissionRemovals)
      .innerJoin(permissions, eq(userPermissionRemovals.permissionId, permissions.id))
      .where(eq(userPermissionRemovals.userId, userId));

    const result: { code: string; source: 'role' | 'override'; roleName?: string }[] = [];
    const removedPermissionCodes = new Set(removedPermissions.map(p => p.code));

    // Add role permissions (except those explicitly removed)
    rolePermissions.forEach(p => {
      if (!removedPermissionCodes.has(p.code)) {
        result.push({
          code: p.code,
          source: 'role',
          roleName: p.roleName
        });
      }
    });

    // Add manual overrides (only if not already from role and not removed)
    const rolePermissionCodes = new Set(rolePermissions.map(p => p.code));
    manualPermissions.forEach(p => {
      if (!rolePermissionCodes.has(p.code) && !removedPermissionCodes.has(p.code)) {
        result.push({
          code: p.code,
          source: 'override'
        });
      }
    });

    return result;
  }

  async addUserPermissionOverride(userId: string, permissionId: string, createdBy: string): Promise<void> {
    // Check if override already exists
    const existing = await db
      .select()
      .from(userPermissions)
      .where(and(
        eq(userPermissions.userId, userId),
        eq(userPermissions.permissionId, permissionId)
      ));

    if (existing.length === 0) {
      await db.insert(userPermissions).values({
        userId,
        permissionId,
        createdBy
      });
    }
  }

  async removeUserPermissionOverride(userId: string, permissionId: string): Promise<void> {
    await db
      .delete(userPermissions)
      .where(and(
        eq(userPermissions.userId, userId),
        eq(userPermissions.permissionId, permissionId)
      ));
  }

  async addUserPermissionRemoval(userId: string, permissionId: string, createdBy: string): Promise<void> {
    // Check if removal already exists
    const existing = await db
      .select()
      .from(userPermissionRemovals)
      .where(and(
        eq(userPermissionRemovals.userId, userId),
        eq(userPermissionRemovals.permissionId, permissionId)
      ));

    if (existing.length === 0) {
      await db.insert(userPermissionRemovals).values({
        userId,
        permissionId,
        createdBy
      });
    }
  }

  async removeUserPermissionRemoval(userId: string, permissionId: string): Promise<void> {
    await db
      .delete(userPermissionRemovals)
      .where(and(
        eq(userPermissionRemovals.userId, userId),
        eq(userPermissionRemovals.permissionId, permissionId)
      ));
  }

  async getUserPermissionRemovals(userId: string): Promise<UserPermissionRemoval[]> {
    return await db
      .select()
      .from(userPermissionRemovals)
      .where(eq(userPermissionRemovals.userId, userId));
  }

  async getUserPermissionOverrides(userId: string): Promise<UserPermission[]> {
    return await db
      .select()
      .from(userPermissions)
      .where(eq(userPermissions.userId, userId));
  }

  async getCustomerPermissions(customerId: string): Promise<string[]> {
    const result = await db
      .select({ code: permissions.code })
      .from(userRoles)
      .innerJoin(rolePermissionsTable, eq(userRoles.roleId, rolePermissionsTable.roleId))
      .innerJoin(permissions, eq(rolePermissionsTable.permissionId, permissions.id))
      .where(eq(userRoles.userId, customerId));

    return result.map(row => row.code);
  }

  // Audit logging operations implementation
  async createAuditLog(auditLogData: InsertAuditLog): Promise<AuditLog> {
    const [auditLog] = await db.insert(auditLogs).values(auditLogData).returning();
    return auditLog;
  }

  async getAuditLogs(filters?: { 
    action?: string; 
    resourceId?: string; 
    changedBy?: string; 
    limit?: number; 
    offset?: number; 
  }): Promise<{ logs: AuditLog[]; total: number; }> {
    const { action, resourceId, changedBy, limit = 50, offset = 0 } = filters || {};
    
    let query = db
      .select({
        auditLog: auditLogs,
        user: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        },
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.changedBy, users.id));

    const conditions = [];
    if (action) conditions.push(eq(auditLogs.action, action));
    if (resourceId) conditions.push(eq(auditLogs.resourceId, resourceId));
    if (changedBy) conditions.push(eq(auditLogs.changedBy, changedBy));

    if (conditions.length > 0) {
      const whereCondition = conditions.length === 1 ? conditions[0] : and(...conditions);
      query = query.where(whereCondition) as any;
    }

    // Get total count
    let countQuery = db
      .select({ total: count() })
      .from(auditLogs);
    
    if (conditions.length > 0) {
      const whereCondition = conditions.length === 1 ? conditions[0] : and(...conditions);
      countQuery = countQuery.where(whereCondition) as any;
    }

    const [{ total }] = await countQuery;

    // Get paginated results
    const results = await query
      .orderBy(desc(auditLogs.timestamp))
      .limit(limit)
      .offset(offset);

    const logs = results.map(row => ({
      ...row.auditLog,
      user: row.user,
    })) as AuditLog[];

    return { logs, total };
  }

  async getAuditLogsForRole(roleId: string): Promise<AuditLog[]> {
    const results = await db
      .select({
        auditLog: auditLogs,
        user: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        },
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.changedBy, users.id))
      .where(eq(auditLogs.resourceId, roleId))
      .orderBy(desc(auditLogs.timestamp));

    return results.map(row => ({
      ...row.auditLog,
      user: row.user,
    })) as AuditLog[];
  }
}

export const storage = new DatabaseStorage();
