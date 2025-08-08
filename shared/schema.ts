import { sql, relations } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  integer,
  boolean,
  index,
  decimal,
  date
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for authentication
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Users table for admin authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Customers table
export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  mobile: varchar("mobile", { length: 15 }).notNull().unique(), // Make mobile unique
  email: varchar("email"),
  password: text("password"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Admin users table for login system
export const adminUsers = pgTable("admin_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username", { length: 50 }).notNull().unique(),
  email: varchar("email").notNull().unique(),
  password: text("password").notNull(), // hashed password
  name: text("name").notNull(),
  role: varchar("role", { length: 20 }).notNull().default("admin"), // admin, super_admin
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Societies table for address autocomplete
export const societies = pgTable("societies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  societyName: text("society_name").notNull(),
  area: text("area").notNull(),
  district: text("district").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  pincode: varchar("pincode", { length: 10 }).notNull(),
  landmark: text("landmark"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Address database for intelligent autocomplete
export const addresses = pgTable("addresses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  society: text("society").notNull(),
  area: text("area").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  pincode: varchar("pincode", { length: 10 }).notNull(),
  district: text("district"),
  landmark: text("landmark"),
  usageCount: integer("usage_count").default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  societyIdx: index("address_society_idx").on(table.society),
  areaIdx: index("address_area_idx").on(table.area),
  cityIdx: index("address_city_idx").on(table.city),
}));

// Agreements table with JSONB for flexible data storage
export const agreements: any = pgTable("agreements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agreementNumber: varchar("agreement_number").unique().notNull(),
  customerId: varchar("customer_id").references(() => customers.id).notNull(),
  language: varchar("language", { length: 20 }).notNull().default("english"),
  
  // Owner/Landlord details stored as JSONB
  ownerDetails: jsonb("owner_details").notNull(),
  
  // Tenant details stored as JSONB
  tenantDetails: jsonb("tenant_details").notNull(),
  
  // Property details stored as JSONB
  propertyDetails: jsonb("property_details").notNull(),
  
  // Rental terms stored as JSONB
  rentalTerms: jsonb("rental_terms").notNull(),
  
  // Additional clauses as array
  additionalClauses: text("additional_clauses").array().default([]),
  
  // Agreement dates
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  agreementDate: date("agreement_date").notNull(),
  
  // Status tracking
  status: varchar("status", { length: 20 }).notNull().default("draft"), // draft, active, expired, renewed, terminated
  
  // Relationship tracking
  parentAgreementId: varchar("parent_agreement_id"),
  renewedFromId: varchar("renewed_from_id"),
  
  // Document paths - storing URLs for uploaded documents
  documents: jsonb("documents").default({}), // Store document file paths
  ownerDocuments: jsonb("owner_documents").default({}), // Owner's Aadhar, PAN, etc.
  tenantDocuments: jsonb("tenant_documents").default({}), // Tenant's Aadhar, PAN, etc.
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Agreement templates for different languages
export const agreementTemplates = pgTable("agreement_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  language: varchar("language", { length: 20 }).notNull(),
  templateContent: text("template_content").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// PDF Templates for dynamic document generation
export const pdfTemplates = pgTable("pdf_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  documentType: text("document_type").notNull(), // 'rental_agreement', 'promissory_note', etc.
  language: varchar("language", { length: 20 }).notNull(),
  htmlTemplate: text("html_template").notNull(), // WYSIWYG HTML content
  dynamicFields: jsonb("dynamic_fields").notNull().default('[]'), // Array of field configurations
  conditionalRules: jsonb("conditional_rules").notNull().default('[]'), // Conditional display rules
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const customersRelations = relations(customers, ({ many }) => ({
  agreements: many(agreements),
}));

export const agreementsRelations = relations(agreements, ({ one, many }) => ({
  customer: one(customers, {
    fields: [agreements.customerId],
    references: [customers.id],
  }),
  parentAgreement: one(agreements, {
    fields: [agreements.parentAgreementId],
    references: [agreements.id],
  }),
  renewedFrom: one(agreements, {
    fields: [agreements.renewedFromId],
    references: [agreements.id],
  }),
  childAgreements: many(agreements, {
    relationName: "parent_child",
  }),
  renewedAgreements: many(agreements, {
    relationName: "renewed_agreements",
  }),
}));

// Insert schemas
export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSocietySchema = createInsertSchema(societies).omit({
  id: true,
  createdAt: true,
});

export const insertAddressSchema = createInsertSchema(addresses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAgreementSchema = createInsertSchema(agreements).omit({
  id: true,
  agreementNumber: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  // Make date fields optional for draft saving
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  agreementDate: z.string().optional(),
  // Make JSONB fields optional for draft saving
  ownerDetails: z.any().optional(),
  tenantDetails: z.any().optional(),
  propertyDetails: z.any().optional(),
  rentalTerms: z.any().optional(),
});

export const insertAgreementTemplateSchema = createInsertSchema(agreementTemplates).omit({
  id: true,
  createdAt: true,
});

export const insertPdfTemplateSchema = createInsertSchema(pdfTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAdminUserSchema = createInsertSchema(adminUsers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;
export type InsertSociety = z.infer<typeof insertSocietySchema>;
export type Society = typeof societies.$inferSelect;
export type InsertAddress = z.infer<typeof insertAddressSchema>;
export type Address = typeof addresses.$inferSelect;
export type InsertAgreement = z.infer<typeof insertAgreementSchema>;
export type Agreement = typeof agreements.$inferSelect;
export type InsertAgreementTemplate = z.infer<typeof insertAgreementTemplateSchema>;
export type AgreementTemplate = typeof agreementTemplates.$inferSelect;
export type InsertPdfTemplate = z.infer<typeof insertPdfTemplateSchema>;
export type PdfTemplate = typeof pdfTemplates.$inferSelect;
export type InsertAdminUser = z.infer<typeof insertAdminUserSchema>;
export type AdminUser = typeof adminUsers.$inferSelect;

// Extended types for agreement data structures
export interface OwnerDetails {
  name: string;
  company?: string;
  mobile: string;
  age: number;
  occupation: string;
  aadhar: string;
  pan: string;
  // Granular address fields
  houseNumber?: string;
  society?: string;
  area?: string;
  city?: string;
  state?: string;
  pincode?: string;
  // Legacy nested address support for backward compatibility
  address?: {
    flatNo: string;
    society: string;
    area: string;
    district: string;
    city: string;
    state: string;
    pincode: string;
    landmark?: string;
  };
}

export interface TenantDetails {
  name: string;
  company?: string;
  mobile: string;
  age: number;
  occupation: string;
  aadhar: string;
  pan: string;
  // Granular address fields
  houseNumber?: string;
  society?: string;
  area?: string;
  city?: string;
  state?: string;
  pincode?: string;
  // Legacy nested address support for backward compatibility
  address?: {
    flatNo: string;
    society: string;
    area: string;
    district: string;
    city: string;
    state: string;
    pincode: string;
    landmark?: string;
  };
}

export interface PropertyDetails {
  type: string;
  purpose?: string; // Resident/Commercial
  furnishedStatus?: string;
  additionalItems?: string;
  areaInSqFt?: number; // Property area in square feet
  // Granular address fields
  houseNumber?: string;
  society?: string;
  area?: string;
  city?: string;
  state?: string;
  pincode?: string;
  // Legacy nested address support for backward compatibility
  address?: {
    flatNo: string;
    society: string;
    area: string;
    district: string;
    city: string;
    state: string;
    pincode: string;
    landmark?: string;
  };
  place: string;
}

export interface RentalTerms {
  deposit: number;
  monthlyRent: number;
  dueDate: number;
  maintenanceCharge?: string; // Add maintenanceCharge field
  maintenance: "included" | "excluded";
  noticePeriod: number;
  minimumStay?: string; // Add minimumStay field
  paymentDueFromDate?: number; // Add payment due from date
  paymentDueToDate?: number; // Add payment due to date
  furniture: string;
  startDate: string;
  endDate: string;
  tenure: "11_months" | "custom"; // New tenure field
}

export interface AgreementDocuments {
  ownerAadhar?: string;
  ownerPan?: string;
  tenantAadhar?: string;
  tenantPan?: string;
  signedAgreement?: string;
}
