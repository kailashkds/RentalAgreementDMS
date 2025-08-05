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
  mobile: varchar("mobile", { length: 15 }).notNull(),
  email: varchar("email"),
  password: text("password"),
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
  
  // Document paths
  documents: jsonb("documents").default({}), // Store document file paths
  
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

export const insertAgreementSchema = createInsertSchema(agreements).omit({
  id: true,
  agreementNumber: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAgreementTemplateSchema = createInsertSchema(agreementTemplates).omit({
  id: true,
  createdAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;
export type InsertSociety = z.infer<typeof insertSocietySchema>;
export type Society = typeof societies.$inferSelect;
export type InsertAgreement = z.infer<typeof insertAgreementSchema>;
export type Agreement = typeof agreements.$inferSelect;
export type InsertAgreementTemplate = z.infer<typeof insertAgreementTemplateSchema>;
export type AgreementTemplate = typeof agreementTemplates.$inferSelect;

// Extended types for agreement data structures
export interface OwnerDetails {
  name: string;
  mobile: string;
  age: number;
  occupation: string;
  aadhar: string;
  pan: string;
  address: {
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
  mobile: string;
  age: number;
  occupation: string;
  aadhar: string;
  pan: string;
  address: {
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
  address: {
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
  maintenance: "included" | "excluded";
  noticePeriod: number;
  furniture: string;
  startDate: string;
  endDate: string;
}

export interface AgreementDocuments {
  ownerAadhar?: string;
  ownerPan?: string;
  tenantAadhar?: string;
  tenantPan?: string;
  signedAgreement?: string;
}
