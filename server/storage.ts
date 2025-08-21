import {
  users,
  customers,
  properties,
  societies,
  addresses,
  agreements,
  agreementTemplates,
  pdfTemplates,

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

  type AdminUser,
  type InsertAdminUser,
} from "@shared/schema";
import { db } from "./db";
import { eq, ilike, desc, and, or, count, sql, gte, lte } from "drizzle-orm";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, addMonths } from "date-fns";
import bcrypt from "bcrypt";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
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
  getAdminUserByUsername(username: string): Promise<AdminUser | undefined>;
  createAdminUser(user: InsertAdminUser): Promise<AdminUser>;
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
  duplicateAgreement(id: string, customerId?: string): Promise<Agreement>;
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
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
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

  // Customer operations
  async getCustomers(search?: string, limit = 50, offset = 0, activeOnly = false): Promise<{ customers: (Customer & { agreementCount: number })[]; total: number }> {
    const conditions = [];
    
    if (search) {
      conditions.push(
        or(
          ilike(customers.name, `%${search}%`),
          ilike(customers.mobile, `%${search}%`),
          ilike(customers.email, `%${search}%`)
        )
      );
    }
    
    if (activeOnly) {
      conditions.push(eq(customers.isActive, true));
    }
    
    const whereConditions = conditions.length > 0 ? and(...conditions) : undefined;

    const [customersResult, totalResult] = await Promise.all([
      db
        .select({
          id: customers.id,
          name: customers.name,
          mobile: customers.mobile,
          email: customers.email,
          password: customers.password,
          isActive: customers.isActive,
          createdAt: customers.createdAt,
          updatedAt: customers.updatedAt,
          agreementCount: sql<number>`count(${agreements.id})::int`.as('agreement_count')
        })
        .from(customers)
        .leftJoin(agreements, eq(customers.id, agreements.customerId))
        .where(whereConditions)
        .groupBy(customers.id)
        .orderBy(desc(customers.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: count() })
        .from(customers)
        .where(whereConditions),
    ]);

    return {
      customers: customersResult as (Customer & { agreementCount: number })[],
      total: totalResult[0].count as number,
    };
  }

  async getCustomer(id: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer;
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
          id: customers.id,
          name: customers.name,
          mobile: customers.mobile,
          email: customers.email,
        }
      })
      .from(properties)
      .leftJoin(customers, eq(properties.customerId, customers.id))
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
    
    // Build date condition for agreement end date filtering based on expiry dates
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
          // Filter by agreement expiry date (endDate field)
          dateCondition = and(
            gte(agreements.endDate, cleanStartDate),
            lte(agreements.endDate, cleanEndDate)
          );
          console.log(`[Date Filter] Applied expiry date filter: ${cleanStartDate} to ${cleanEndDate}`);
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
    
    const whereConditions = and(
      customerId ? eq(agreements.customerId, customerId) : undefined,
      propertyId ? eq(agreements.propertyId, propertyId) : undefined,
      status ? eq(agreements.status, status) : undefined,
      search ? ilike(agreements.agreementNumber, `%${search}%`) : undefined,
      dateCondition
    );

    const [agreementsResult, totalResult] = await Promise.all([
      db
        .select()
        .from(agreements)
        .leftJoin(customers, eq(agreements.customerId, customers.id))
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
          customer: row.customers
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
      .leftJoin(customers, eq(agreements.customerId, customers.id))
      .where(eq(agreements.id, id));
    
    if (!result) return undefined;
    
    const agreement = {
      ...result.agreements,
      customer: result.customers
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
      
      const agreement = result[0];
        
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
    // Get the existing agreement to preserve editedContent if not explicitly provided
    const existingAgreement = await this.getAgreement(id);
    if (!existingAgreement) {
      throw new Error("Agreement not found");
    }

    // Preserve editedContent and editedAt if not explicitly provided in update data
    const updateData = {
      ...agreementData,
      updatedAt: new Date(),
      // Preserve existing editedContent if not being updated
      ...(agreementData.editedContent === undefined && {
        editedContent: existingAgreement.editedContent,
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

  async duplicateAgreement(id: string, customerId?: string): Promise<Agreement> {
    const originalAgreement = await this.getAgreement(id);
    if (!originalAgreement) {
      throw new Error("Agreement not found");
    }

    const duplicatedAgreement = await this.createAgreement({
      ...originalAgreement,
      id: undefined as any,
      agreementNumber: undefined as any,
      customerId: customerId || originalAgreement.customerId,
      status: "draft",
      parentAgreementId: id,
      renewedFromId: null,
      agreementDate: new Date().toISOString().split('T')[0] as any,
      documents: {}, // Reset documents for new agreement
      createdAt: undefined as any,
      updatedAt: undefined as any,
    });

    return duplicatedAgreement;
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

  async saveEditedContent(agreementId: string, editedContent: string): Promise<void> {
    await db
      .update(agreements)
      .set({
        editedContent: editedContent,
        editedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(agreements.id, agreementId));
  }

  async getDashboardStats(): Promise<{
    totalAgreements: number;
    activeAgreements: number;
    expiringSoon: number;
    totalCustomers: number;
  }> {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const thirtyDaysFormatted = thirtyDaysFromNow.toISOString().split('T')[0];

    const [
      totalAgreements,
      activeAgreements,
      expiringSoon,
      totalCustomers,
    ] = await Promise.all([
      db.select({ count: count() }).from(agreements),
      db.select({ count: count() }).from(agreements).where(eq(agreements.status, "active")),
      db.select({ count: count() })
        .from(agreements)
        .where(
          and(
            eq(agreements.status, "active"),
            sql`${agreements.endDate} <= ${thirtyDaysFormatted}`
          )
        ),
      db.select({ count: count() }).from(customers).where(eq(customers.isActive, true)),
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
}

export const storage = new DatabaseStorage();
