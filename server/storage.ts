import {
  users,
  customers,
  properties,
  societies,
  addresses,
  agreements,
  agreementTemplates,
  pdfTemplates,
  permissions,
  roles,
  rolePermissions,
  userRoles,
  customerRoles,
  auditLogs,

  adminUsers,
  type User,
  type UpsertUser,
  type Customer,
  type InsertCustomer,
  type Property,
  type InsertProperty,
  type Society,
  type InsertSociety,
  type Address,
  type InsertAddress,
  type Agreement,
  type InsertAgreement,
  type AgreementTemplate,
  type InsertAgreementTemplate,
  type PdfTemplate,
  type InsertPdfTemplate,
  type Permission,
  type InsertPermission,
  type Role,
  type InsertRole,
  type RolePermission,
  type InsertRolePermission,
  type UserRole,
  type InsertUserRole,
  type CustomerRole,
  type InsertCustomerRole,
  type RoleWithPermissions,
  type UserWithRoles,
  type CustomerWithRoles,
  type AuditLog,
  type InsertAuditLog,

  type AdminUser,
  type InsertAdminUser,
} from "@shared/schema";
import { db } from "./db";
import { eq, ilike, desc, and, or, count, sql, gte, lte } from "drizzle-orm";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, addMonths } from "date-fns";
import bcrypt from "bcrypt";

export interface IStorage {
  // Unified user operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByMobile(mobile: string): Promise<User | undefined>;
  getUserByPhone(phone: string): Promise<User | undefined>;
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
  
  // Property operations
  getProperties(customerId?: string): Promise<Property[]>;
  getProperty(id: string): Promise<Property | undefined>;
  createProperty(property: InsertProperty): Promise<Property>;
  updateProperty(id: string, property: Partial<InsertProperty>): Promise<Property>;
  deleteProperty(id: string): Promise<void>;
  findOrCreatePropertyForAgreement(customerId: string, propertyDetails: any): Promise<Property>;
  getAllPropertiesWithCustomers(): Promise<any[]>;
  
  // Society operations
  getSocieties(search?: string, limit?: number): Promise<Society[]>;
  getSociety(id: string): Promise<Society | undefined>;
  createSociety(society: InsertSociety): Promise<Society>;
  updateSociety(id: string, society: Partial<InsertSociety>): Promise<Society>;
  deleteSociety(id: string): Promise<void>;
  
  // Address operations for intelligent autocomplete
  searchAddresses(search: string, limit?: number): Promise<Address[]>;
  saveAddress(address: InsertAddress): Promise<Address>;
  incrementAddressUsage(addressId: string): Promise<void>;
  
  // PDF Template operations
  getPdfTemplates(documentType?: string, language?: string): Promise<PdfTemplate[]>;
  getPdfTemplate(id: string): Promise<PdfTemplate | undefined>;
  createPdfTemplate(template: InsertPdfTemplate): Promise<PdfTemplate>;
  updatePdfTemplate(id: string, template: Partial<InsertPdfTemplate>): Promise<PdfTemplate>;
  deletePdfTemplate(id: string): Promise<void>;
  

  
  // Admin user operations
  getAdminUsers(): Promise<AdminUser[]>;
  getAdminUser(id: string): Promise<AdminUser | undefined>;
  getAdminUserByPhone(phone: string): Promise<AdminUser | undefined>;
  getAdminUserByUsername(username: string): Promise<AdminUser | undefined>;
  createAdminUser(userData: InsertAdminUser): Promise<AdminUser>;
  updateAdminUser(id: string, user: Partial<InsertAdminUser>): Promise<AdminUser>;
  deleteAdminUser(id: string): Promise<void>;
  
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
  
  // Dashboard statistics
  getDashboardStats(): Promise<{
    totalAgreements: number;
    activeAgreements: number;
    expiringSoon: number;
    totalCustomers: number;
  }>;
  
  // Agreement templates
  getAgreementTemplates(language?: string): Promise<AgreementTemplate[]>;
  createAgreementTemplate(template: InsertAgreementTemplate): Promise<AgreementTemplate>;
  
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
  getUserRoles(userId: string): Promise<RoleWithPermissions[]>;
  getUserWithRoles(userId: string): Promise<UserWithRoles | undefined>;
  
  // Customer-Role operations
  assignRoleToCustomer(customerId: string, roleId: string): Promise<CustomerRole>;
  removeRoleFromCustomer(customerId: string, roleId: string): Promise<void>;
  getCustomerRoles(customerId: string): Promise<RoleWithPermissions[]>;
  getCustomerWithRoles(customerId: string): Promise<CustomerWithRoles | undefined>;
  
  // Unified permission checking
  userHasPermission(userId: string, permissionCode: string): Promise<boolean>;
  getUserPermissions(userId: string): Promise<string[]>;
  
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
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByMobile(mobile: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.mobile, mobile));
    return user;
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.phone, phone));
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
    await db.delete(users).where(eq(users.id, id));
  }

  async getUsers(filters?: { 
    search?: string; 
    status?: string; 
    defaultRole?: string; 
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
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      mobile: user.mobile!,
      email: user.email,
      password: user.password,
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
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      mobile: user.mobile!,
      email: user.email,
      password: user.password,
      isActive: user.status === 'active',
      createdAt: user.createdAt!,
      updatedAt: user.updatedAt!,
    } as Customer;
  }

  async getCustomerByMobile(mobile: string): Promise<Customer | undefined> {
    try {
      const [customer] = await db.select().from(customers).where(eq(customers.mobile, mobile));
      return customer;
    } catch (error) {
      console.error("Error fetching customer by mobile:", error);
      return undefined;
    }
  }

  async createCustomer(customerData: InsertCustomer & { password?: string }): Promise<Customer> {
    // Store password in plain text as requested by user
    const [newCustomer] = await db
      .insert(customers)
      .values({
        ...customerData,
        password: customerData.password || "default123",
      })
      .returning();
    
    // Automatically assign Customer role to new customers
    try {
      const [customerRole] = await db.select().from(roles).where(eq(roles.name, "Customer"));
      if (customerRole) {
        await db.insert(customerRoles).values({
          customerId: newCustomer.id,
          roleId: customerRole.id,
        });
      }
    } catch (error) {
      console.error("Error assigning Customer role:", error);
      // Don't fail customer creation if role assignment fails
    }
    
    return newCustomer;
  }

  async updateCustomer(id: string, customerData: Partial<InsertCustomer>): Promise<Customer> {
    const [customer] = await db
      .update(customers)
      .set({ ...customerData, updatedAt: new Date() })
      .where(eq(customers.id, id))
      .returning();
    return customer;
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
    
    await db.delete(customers).where(eq(customers.id, id));
  }

  async resetCustomerPassword(id: string, newPassword: string): Promise<Customer> {
    // Store password in plain text as requested by user
    const [customer] = await db
      .update(customers)
      .set({ password: newPassword, updatedAt: new Date() })
      .where(eq(customers.id, id))
      .returning();
    return customer;
  }

  async toggleCustomerStatus(id: string, isActive: boolean): Promise<Customer> {
    const [customer] = await db
      .update(customers)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(customers.id, id))
      .returning();
    return customer;
  }

  // Society operations
  async getSocieties(search?: string, limit = 100): Promise<Society[]> {
    const whereConditions = search
      ? or(
          ilike(societies.societyName, `%${search}%`),
          ilike(societies.area, `%${search}%`),
          ilike(societies.city, `%${search}%`)
        )
      : undefined;

    return db
      .select()
      .from(societies)
      .where(whereConditions)
      .orderBy(societies.societyName)
      .limit(limit);
  }

  async getSociety(id: string): Promise<Society | undefined> {
    const [society] = await db.select().from(societies).where(eq(societies.id, id));
    return society;
  }

  async createSociety(societyData: InsertSociety): Promise<Society> {
    const [society] = await db.insert(societies).values(societyData).returning();
    return society;
  }

  async updateSociety(id: string, societyData: Partial<InsertSociety>): Promise<Society> {
    const [society] = await db
      .update(societies)
      .set(societyData)
      .where(eq(societies.id, id))
      .returning();
    return society;
  }

  async deleteSociety(id: string): Promise<void> {
    await db.delete(societies).where(eq(societies.id, id));
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
    
    console.log(`[Date Filter Debug] Received parameters:`, { dateFilter, startDate, endDate });
    
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
          console.log(`[Date Filter] Applied expiration date filter: ${cleanStartDate} to ${cleanEndDate}`);
        } else {
          console.error('[Date Filter] Invalid date format:', { startDate, endDate });
        }
      } catch (e) {
        console.error('[Date Filter] Error parsing dates:', e);
      }
    } else {
      console.log('[Date Filter] No date filtering applied - missing start or end date');
    }
    // For no date filter or 'all' filter, dateCondition remains undefined (no date filtering)
    
    // Build conditions array, filtering out undefined values
    const conditions = [
      customerId ? eq(agreements.customerId, customerId) : null,
      propertyId ? eq(agreements.propertyId, propertyId) : null,
      status ? eq(agreements.status, status) : null,
      search ? ilike(agreements.agreementNumber, `%${search}%`) : null,
      dateCondition
    ].filter(Boolean);

    const whereConditions = conditions.length > 0 ? and(...conditions) : undefined;

    const [agreementsResult, totalResult] = await Promise.all([
      db
        .select()
        .from(agreements)
        .leftJoin(users, eq(agreements.customerId, users.id))
        .where(whereConditions)
        .orderBy(desc(agreements.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: count() })
        .from(agreements)
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

  // Helper function to convert names, professions, and addresses to uppercase
  private convertToUpperCase(data: any): any {
    if (!data || typeof data !== 'object') return data;
    
    const converted = { ...data };
    
    // Helper function to safely convert string to uppercase
    const safeUpperCase = (value: any): string => {
      return (value && typeof value === 'string') ? value.toUpperCase() : value;
    };
    
    // Convert owner details
    if (converted.ownerDetails && typeof converted.ownerDetails === 'object') {
      const owner = converted.ownerDetails;
      if (owner.name) owner.name = safeUpperCase(owner.name);
      if (owner.profession) owner.profession = safeUpperCase(owner.profession);
      if (owner.occupation) owner.occupation = safeUpperCase(owner.occupation);
      if (owner.address) owner.address = safeUpperCase(owner.address);
      if (owner.fullAddress) owner.fullAddress = safeUpperCase(owner.fullAddress);
      // Convert individual address components
      if (owner.houseNumber) owner.houseNumber = safeUpperCase(owner.houseNumber);
      if (owner.society) owner.society = safeUpperCase(owner.society);
      if (owner.area) owner.area = safeUpperCase(owner.area);
      if (owner.city) owner.city = safeUpperCase(owner.city);
      if (owner.state) owner.state = safeUpperCase(owner.state);
      // Handle nested address object
      if (owner.address && typeof owner.address === 'object') {
        if (owner.address.flatNo) owner.address.flatNo = safeUpperCase(owner.address.flatNo);
        if (owner.address.society) owner.address.society = safeUpperCase(owner.address.society);
        if (owner.address.area) owner.address.area = safeUpperCase(owner.address.area);
        if (owner.address.city) owner.address.city = safeUpperCase(owner.address.city);
        if (owner.address.state) owner.address.state = safeUpperCase(owner.address.state);
      }
    }
    
    // Convert tenant details
    if (converted.tenantDetails && typeof converted.tenantDetails === 'object') {
      const tenant = converted.tenantDetails;
      if (tenant.name) tenant.name = safeUpperCase(tenant.name);
      if (tenant.profession) tenant.profession = safeUpperCase(tenant.profession);
      if (tenant.occupation) tenant.occupation = safeUpperCase(tenant.occupation);
      if (tenant.address) tenant.address = safeUpperCase(tenant.address);
      if (tenant.fullAddress) tenant.fullAddress = safeUpperCase(tenant.fullAddress);
      // Convert individual address components
      if (tenant.houseNumber) tenant.houseNumber = safeUpperCase(tenant.houseNumber);
      if (tenant.society) tenant.society = safeUpperCase(tenant.society);
      if (tenant.area) tenant.area = safeUpperCase(tenant.area);
      if (tenant.city) tenant.city = safeUpperCase(tenant.city);
      if (tenant.state) tenant.state = safeUpperCase(tenant.state);
      // Handle nested address object
      if (tenant.address && typeof tenant.address === 'object') {
        if (tenant.address.flatNo) tenant.address.flatNo = safeUpperCase(tenant.address.flatNo);
        if (tenant.address.society) tenant.address.society = safeUpperCase(tenant.address.society);
        if (tenant.address.area) tenant.address.area = safeUpperCase(tenant.address.area);
        if (tenant.address.city) tenant.address.city = safeUpperCase(tenant.address.city);
        if (tenant.address.state) tenant.address.state = safeUpperCase(tenant.address.state);
      }
    }
    
    // Convert property details addresses
    if (converted.propertyDetails && typeof converted.propertyDetails === 'object') {
      const property = converted.propertyDetails;
      if (property.address) property.address = safeUpperCase(property.address);
      if (property.fullAddress) property.fullAddress = safeUpperCase(property.fullAddress);
      if (property.flatNumber) property.flatNumber = safeUpperCase(property.flatNumber);
      if (property.houseNumber) property.houseNumber = safeUpperCase(property.houseNumber);
      if (property.society) property.society = safeUpperCase(property.society);
      if (property.area) property.area = safeUpperCase(property.area);
      if (property.city) property.city = safeUpperCase(property.city);
      if (property.state) property.state = safeUpperCase(property.state);
      // Handle nested address object
      if (property.address && typeof property.address === 'object') {
        if (property.address.flatNo) property.address.flatNo = safeUpperCase(property.address.flatNo);
        if (property.address.society) property.address.society = safeUpperCase(property.address.society);
        if (property.address.area) property.address.area = safeUpperCase(property.address.area);
        if (property.address.city) property.address.city = safeUpperCase(property.address.city);
        if (property.address.state) property.address.state = safeUpperCase(property.address.state);
      }
    }
    
    return converted;
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
    await db.delete(agreements).where(eq(agreements.id, id));
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
        updatedAt: new Date()
      })
      .where(eq(agreements.id, id))
      .returning();
    
    if (!updatedAgreement) {
      throw new Error("Agreement not found");
    }
    
    return updatedAgreement;
  }

  async saveEditedHtml(agreementId: string, editedHtml: string): Promise<void> {
    await db
      .update(agreements)
      .set({
        editedHtml: editedHtml,
        editedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(agreements.id, agreementId));
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

  async getAgreementTemplates(language?: string): Promise<AgreementTemplate[]> {
    const whereConditions = and(
      eq(agreementTemplates.isActive, true),
      language ? eq(agreementTemplates.language, language) : undefined
    );

    return db
      .select()
      .from(agreementTemplates)
      .where(whereConditions)
      .orderBy(agreementTemplates.name);
  }

  // Admin user operations
  async getAdminUsers(): Promise<AdminUser[]> {
    return db.select().from(adminUsers).orderBy(adminUsers.createdAt);
  }

  async getAdminUser(id: string): Promise<AdminUser | undefined> {
    const [user] = await db.select().from(adminUsers).where(eq(adminUsers.id, id));
    return user;
  }

  async getAdminUserByPhone(phone: string): Promise<AdminUser | undefined> {
    const [user] = await db.select().from(adminUsers).where(eq(adminUsers.phone, phone));
    return user;
  }

  async getAdminUserByUsername(username: string): Promise<AdminUser | undefined> {
    const [user] = await db.select().from(adminUsers).where(eq(adminUsers.username, username));
    return user;
  }

  async createAdminUser(userData: InsertAdminUser): Promise<AdminUser> {
    const [user] = await db.insert(adminUsers).values(userData).returning();
    return user;
  }

  async updateAdminUser(id: string, userData: Partial<InsertAdminUser>): Promise<AdminUser> {
    const [user] = await db
      .update(adminUsers)
      .set({ ...userData, updatedAt: new Date() })
      .where(eq(adminUsers.id, id))
      .returning();
    return user;
  }

  async deleteAdminUser(id: string): Promise<void> {
    await db.delete(adminUsers).where(eq(adminUsers.id, id));
  }

  // PDF Template operations
  async getPdfTemplates(documentType?: string, language?: string): Promise<PdfTemplate[]> {
    const whereConditions = and(
      eq(pdfTemplates.isActive, true),
      documentType ? eq(pdfTemplates.documentType, documentType) : undefined,
      language ? eq(pdfTemplates.language, language) : undefined
    );

    return db
      .select()
      .from(pdfTemplates)
      .where(whereConditions)
      .orderBy(pdfTemplates.createdAt);
  }

  async getPdfTemplate(id: string): Promise<PdfTemplate | undefined> {
    const [template] = await db.select().from(pdfTemplates).where(eq(pdfTemplates.id, id));
    return template;
  }

  async createPdfTemplate(templateData: InsertPdfTemplate): Promise<PdfTemplate> {
    const [template] = await db.insert(pdfTemplates).values(templateData).returning();
    return template;
  }

  async updatePdfTemplate(id: string, templateData: Partial<InsertPdfTemplate>): Promise<PdfTemplate> {
    const [template] = await db
      .update(pdfTemplates)
      .set({ ...templateData, updatedAt: new Date() })
      .where(eq(pdfTemplates.id, id))
      .returning();
    return template;
  }

  async deletePdfTemplate(id: string): Promise<void> {
    await db.update(pdfTemplates).set({ isActive: false }).where(eq(pdfTemplates.id, id));
  }



  async createAgreementTemplate(templateData: InsertAgreementTemplate): Promise<AgreementTemplate> {
    const [template] = await db
      .insert(agreementTemplates)
      .values(templateData)
      .returning();
    return template;
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
    await db.delete(rolePermissions).where(eq(rolePermissions.permissionId, id));
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
      .leftJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
      .leftJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
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
      .leftJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
      .leftJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(roles.id, id));

    if (result.length === 0) return undefined;

    const role = result[0].role;
    const rolePermissionsList = result
      .filter(row => row.permission)
      .map(row => row.permission!);

    return {
      ...role,
      permissions: rolePermissionsList,
    };
  }

  async getRoleByName(name: string): Promise<RoleWithPermissions | undefined> {
    const result = await db
      .select({
        role: roles,
        permission: permissions,
      })
      .from(roles)
      .leftJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
      .leftJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(roles.name, name));

    if (result.length === 0) return undefined;

    const role = result[0].role;
    const rolePermissionsList = result
      .filter(row => row.permission)
      .map(row => row.permission!);

    return {
      ...role,
      permissions: rolePermissionsList,
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
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, id));
    await db.delete(userRoles).where(eq(userRoles.roleId, id));
    await db.delete(customerRoles).where(eq(customerRoles.roleId, id));
    await db.delete(roles).where(eq(roles.id, id));
  }

  // Role-Permission operations
  async assignPermissionToRole(roleId: string, permissionId: string): Promise<RolePermission> {
    const [rolePermission] = await db
      .insert(rolePermissions)
      .values({ roleId, permissionId })
      .returning();
    return rolePermission;
  }

  async removePermissionFromRole(roleId: string, permissionId: string): Promise<void> {
    await db
      .delete(rolePermissions)
      .where(and(eq(rolePermissions.roleId, roleId), eq(rolePermissions.permissionId, permissionId)));
  }

  async getRolePermissions(roleId: string): Promise<Permission[]> {
    const result = await db
      .select({ permission: permissions })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.roleId, roleId));

    return result.map(row => row.permission);
  }

  // User-Role operations
  async assignRoleToUser(userId: string, roleId: string): Promise<UserRole> {
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

  async getUserRoles(userId: string): Promise<RoleWithPermissions[]> {
    const result = await db
      .select({
        role: roles,
        permission: permissions,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .leftJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
      .leftJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(userRoles.userId, userId));

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
  async assignRoleToCustomer(customerId: string, roleId: string): Promise<CustomerRole> {
    const [customerRole] = await db
      .insert(customerRoles)
      .values({ customerId, roleId })
      .returning();
    return customerRole;
  }

  async removeRoleFromCustomer(customerId: string, roleId: string): Promise<void> {
    await db
      .delete(customerRoles)
      .where(and(eq(customerRoles.customerId, customerId), eq(customerRoles.roleId, roleId)));
  }

  async getCustomerRoles(customerId: string): Promise<RoleWithPermissions[]> {
    const result = await db
      .select({
        role: roles,
        permission: permissions,
      })
      .from(customerRoles)
      .innerJoin(roles, eq(customerRoles.roleId, roles.id))
      .leftJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
      .leftJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(customerRoles.customerId, customerId));

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

  async getCustomerWithRoles(customerId: string): Promise<CustomerWithRoles | undefined> {
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
      .innerJoin(rolePermissions, eq(userRoles.roleId, rolePermissions.roleId))
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(and(eq(userRoles.userId, userId), eq(permissions.code, permissionCode)));

    return result[0].count > 0;
  }

  async customerHasPermission(customerId: string, permissionCode: string): Promise<boolean> {
    const result = await db
      .select({ count: count() })
      .from(customerRoles)
      .innerJoin(rolePermissions, eq(customerRoles.roleId, rolePermissions.roleId))
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(and(eq(customerRoles.customerId, customerId), eq(permissions.code, permissionCode)));

    return result[0].count > 0;
  }

  async getUserPermissions(userId: string): Promise<string[]> {
    const result = await db
      .select({ code: permissions.code })
      .from(userRoles)
      .innerJoin(rolePermissions, eq(userRoles.roleId, rolePermissions.roleId))
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(userRoles.userId, userId));

    return result.map(row => row.code);
  }

  async getCustomerPermissions(customerId: string): Promise<string[]> {
    const result = await db
      .select({ code: permissions.code })
      .from(customerRoles)
      .innerJoin(rolePermissions, eq(customerRoles.roleId, rolePermissions.roleId))
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(customerRoles.customerId, customerId));

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
      query = query.where(and(...conditions));
    }

    // Get total count
    let countQuery = db
      .select({ total: count() })
      .from(auditLogs);
    
    if (conditions.length > 0) {
      countQuery = countQuery.where(and(...conditions));
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
