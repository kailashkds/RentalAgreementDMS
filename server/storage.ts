import {
  users,
  customers,
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
import { eq, ilike, desc, and, or, count, sql } from "drizzle-orm";
import bcrypt from "bcrypt";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Customer operations
  getCustomers(search?: string, limit?: number, offset?: number): Promise<{ customers: Customer[]; total: number }>;
  getCustomer(id: string): Promise<Customer | undefined>;
  getCustomerByMobile(mobile: string): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer & { password?: string | null }): Promise<Customer>;
  updateCustomer(id: string, customer: Partial<InsertCustomer>): Promise<Customer>;
  deleteCustomer(id: string): Promise<void>;
  
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
  async getCustomers(search?: string, limit = 50, offset = 0): Promise<{ customers: Customer[]; total: number }> {
    const whereConditions = search
      ? or(
          ilike(customers.name, `%${search}%`),
          ilike(customers.mobile, `%${search}%`),
          ilike(customers.email, `%${search}%`)
        )
      : undefined;

    const [customersResult, totalResult] = await Promise.all([
      db
        .select()
        .from(customers)
        .where(whereConditions)
        .orderBy(desc(customers.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: count() })
        .from(customers)
        .where(whereConditions),
    ]);

    return {
      customers: customersResult,
      total: totalResult[0].count,
    };
  }

  async getCustomer(id: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer;
  }

  async getCustomerByMobile(mobile: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.mobile, mobile));
    return customer;
  }

  async createCustomer(customerData: InsertCustomer & { password?: string }): Promise<Customer> {
    const { password, ...customer } = customerData;
    const hashedPassword = password ? await bcrypt.hash(password, 10) : await bcrypt.hash("default123", 10);
    
    const [newCustomer] = await db
      .insert(customers)
      .values({
        ...customer,
        password: hashedPassword,
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
    await db.delete(customers).where(eq(customers.id, id));
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

  // Agreement operations
  async getAgreements(filters?: {
    customerId?: string;
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ agreements: Agreement[]; total: number }> {
    const { customerId, status, search, limit = 50, offset = 0 } = filters || {};
    
    const whereConditions = and(
      customerId ? eq(agreements.customerId, customerId) : undefined,
      status ? eq(agreements.status, status) : undefined,
      search ? ilike(agreements.agreementNumber, `%${search}%`) : undefined
    );

    const [agreementsResult, totalResult] = await Promise.all([
      db
        .select({
          ...agreements,
          customer: customers,
        })
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
      agreements: agreementsResult.map(row => ({
        ...row.agreements,
        customer: row.customer
      })) as any,
      total: totalResult[0].count,
    };
  }

  async getAgreement(id: string): Promise<Agreement | undefined> {
    const [agreement] = await db
      .select({
        ...agreements,
        customer: customers,
      })
      .from(agreements)
      .leftJoin(customers, eq(agreements.customerId, customers.id))
      .where(eq(agreements.id, id));
    
    if (!agreement) return undefined;
    
    return {
      ...agreement.agreements,
      customer: agreement.customer
    } as any;
  }

  async getAgreementByNumber(agreementNumber: string): Promise<Agreement | undefined> {
    const [agreement] = await db
      .select()
      .from(agreements)
      .where(eq(agreements.agreementNumber, agreementNumber));
    return agreement;
  }

  async createAgreement(agreementData: InsertAgreement): Promise<Agreement> {
    try {
      // Generate agreement number
      const year = new Date().getFullYear();
      const lastAgreement = await db
        .select()
        .from(agreements)
        .where(ilike(agreements.agreementNumber, `AGR-${year}-%`))
        .orderBy(desc(agreements.createdAt))
        .limit(1);

      let nextNumber = 1;
      if (Array.isArray(lastAgreement) && lastAgreement.length > 0) {
        const lastNumber = parseInt(lastAgreement[0].agreementNumber.split('-')[2]);
        nextNumber = lastNumber + 1;
      }

      const agreementNumber = `AGR-${year}-${nextNumber.toString().padStart(3, '0')}`;

      const [agreement] = await db
        .insert(agreements)
        .values({
          ...agreementData,
          agreementNumber,
        })
        .returning();
        
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
    const [agreement] = await db
      .update(agreements)
      .set({ ...agreementData, updatedAt: new Date() })
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
      startDate: newStartDate.toISOString().split('T')[0] as any,
      endDate: newEndDate.toISOString().split('T')[0] as any,
      agreementDate: new Date().toISOString().split('T')[0] as any,
      status: "active",
      renewedFromId: id,
      parentAgreementId: originalAgreement.parentAgreementId || id,
      documents: {}, // Reset documents for new agreement
      createdAt: undefined as any,
      updatedAt: undefined as any,
    });

    // Update original agreement status
    await this.updateAgreement(id, { status: "renewed" });

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
