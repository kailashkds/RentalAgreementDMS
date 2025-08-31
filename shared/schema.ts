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

// Unified users table - supports both admin and customer users
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Authentication fields
  username: varchar("username", { length: 50 }).unique(), // For admin login
  mobile: varchar("mobile", { length: 20 }).unique(), // For customer mobile
  password: text("password").notNull(), // Hashed password for login
  encryptedPassword: text("encrypted_password"), // Encrypted password for admin viewing
  
  // Profile fields
  name: text("name").notNull(), // Full name or display name
  email: varchar("email").unique(),
  profileImageUrl: varchar("profile_image_url"),
  
  // Status and metadata
  isActive: boolean("is_active").default(true),
  status: varchar("status", { length: 20 }).default('active'), // active, inactive, suspended
  defaultRole: varchar("default_role").default('Customer'), // Customer, super_admin, Staff
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// RBAC Tables
export const permissions = pgTable("permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code", { length: 100 }).notNull().unique(), // e.g., "agreement.create"
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const roles = pgTable("roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const rolePermissions = pgTable("role_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roleId: varchar("role_id").references(() => roles.id, { onDelete: 'cascade' }).notNull(),
  permissionId: varchar("permission_id").references(() => permissions.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Audit logging table
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  action: varchar("action").notNull(), // "role.created", "role.updated", "role.deleted"
  resourceType: varchar("resource_type").notNull().default("role"),
  resourceId: varchar("resource_id").notNull(), // roleId
  changedBy: varchar("changed_by").notNull().references(() => users.id),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  diff: jsonb("diff"), // JSON snapshot of changes
  metadata: jsonb("metadata"), // Additional context
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_audit_logs_action").on(table.action),
  index("idx_audit_logs_resource").on(table.resourceType, table.resourceId),
  index("idx_audit_logs_changed_by").on(table.changedBy),
  index("idx_audit_logs_timestamp").on(table.timestamp),
]);

// Unified user roles table - works for all users
export const userRoles = pgTable("user_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  roleId: varchar("role_id").references(() => roles.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Manual permission overrides (user-specific permissions beyond role)
export const userPermissions = pgTable("user_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  permissionId: varchar("permission_id").references(() => permissions.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id), // Who assigned this override
});

// DEPRECATED: customerRoles is merged into userRoles
// This table will be dropped after data migration
export const customerRoles = pgTable("customer_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").references(() => customers.id, { onDelete: 'cascade' }).notNull(),
  roleId: varchar("role_id").references(() => roles.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// DEPRECATED: customers table is merged into users
// This table will be dropped after data migration
export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  username: varchar("username").unique(),
  mobile: varchar("mobile", { length: 20 }).notNull().unique(),
  email: varchar("email"),
  password: text("password"), // bcrypt hashed password for authentication
  encryptedPassword: text("encrypted_password"), // Encrypted password for admin viewing
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Properties table for user property management
export const properties = pgTable("properties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").references(() => users.id).notNull(), // Links to unified users table
  
  // Property address details
  flatNumber: text("flat_number").notNull(),
  building: text("building"),
  society: text("society").notNull(),
  area: text("area").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  pincode: varchar("pincode", { length: 10 }).notNull(),
  district: text("district"),
  landmark: text("landmark"),
  
  // Property characteristics
  propertyType: varchar("property_type", { length: 20 }).notNull(), // residential, commercial
  purpose: varchar("purpose", { length: 50 }), // family, business, etc.
  
  // Property status
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  customerIdx: index("property_customer_idx").on(table.customerId), // Index on customer_id
  addressIdx: index("property_address_idx").on(table.society, table.area, table.city),
}));

// DEPRECATED: adminUsers table is merged into users
// This table will be dropped after data migration
export const adminUsers = pgTable("admin_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username", { length: 50 }).notNull().unique(),
  phone: varchar("phone", { length: 15 }).notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: varchar("role", { length: 20 }).notNull().default("admin"),
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
  customerId: varchar("customer_id").references(() => users.id).notNull(), // Links to unified users table
  propertyId: varchar("property_id").references(() => properties.id),
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
  propertyDocuments: jsonb("property_documents").default({}), // Property related documents
  
  // Notarized document details
  notarizedDocument: jsonb("notarized_document").default({}), // Store notarized PDF details
  
  // Edited document content - stores HTML from editor for persistent editing
  editedHtml: text("edited_html"), // Stores the edited HTML content for this specific agreement
  editedAt: timestamp("edited_at"), // When the content was last edited
  
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
  properties: many(properties),
  agreements: many(agreements),
  customerRoles: many(customerRoles),
}));

// RBAC Relations
export const usersRelations = relations(users, ({ many }) => ({
  userRoles: many(userRoles),
  userPermissions: many(userPermissions),
  properties: many(properties),
  agreements: many(agreements),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  rolePermissions: many(rolePermissions),
  userRoles: many(userRoles),
  customerRoles: many(customerRoles), // Will be deprecated after migration
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.roleId],
    references: [roles.id],
  }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
  }),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.userId],
    references: [users.id],
  }),
  role: one(roles, {
    fields: [userRoles.roleId],
    references: [roles.id],
  }),
}));

export const userPermissionsRelations = relations(userPermissions, ({ one }) => ({
  user: one(users, {
    fields: [userPermissions.userId],
    references: [users.id],
  }),
  permission: one(permissions, {
    fields: [userPermissions.permissionId],
    references: [permissions.id],
  }),
  createdByUser: one(users, {
    fields: [userPermissions.createdBy],
    references: [users.id],
  }),
}));

export const customerRolesRelations = relations(customerRoles, ({ one }) => ({
  customer: one(customers, {
    fields: [customerRoles.customerId],
    references: [customers.id],
  }),
  role: one(roles, {
    fields: [customerRoles.roleId],
    references: [roles.id],
  }),
}));

export const propertiesRelations = relations(properties, ({ one, many }) => ({
  user: one(users, {
    fields: [properties.customerId],
    references: [users.id],
  }),
  agreements: many(agreements),
}));

export const agreementsRelations = relations(agreements, ({ one, many }) => ({
  user: one(users, {
    fields: [agreements.customerId],
    references: [users.id],
  }),
  property: one(properties, {
    fields: [agreements.propertyId],
    references: [properties.id],
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

export const insertPropertySchema = createInsertSchema(properties).omit({
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
// Customer type is now based on users table with Customer role
export interface Customer {
  id: string;
  name: string;
  mobile: string;
  email?: string | null;
  password?: string | null;
  encryptedPassword?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
export type InsertSociety = z.infer<typeof insertSocietySchema>;
export type Society = typeof societies.$inferSelect;
export type InsertAddress = z.infer<typeof insertAddressSchema>;
export type Address = typeof addresses.$inferSelect;
export type InsertProperty = z.infer<typeof insertPropertySchema>;
export type Property = typeof properties.$inferSelect;
export type InsertAgreement = z.infer<typeof insertAgreementSchema>;
export type Agreement = typeof agreements.$inferSelect;
export type InsertAgreementTemplate = z.infer<typeof insertAgreementTemplateSchema>;
export type AgreementTemplate = typeof agreementTemplates.$inferSelect;
export type InsertPdfTemplate = z.infer<typeof insertPdfTemplateSchema>;
export type PdfTemplate = typeof pdfTemplates.$inferSelect;

export type InsertAdminUser = z.infer<typeof insertAdminUserSchema>;
export type AdminUser = typeof adminUsers.$inferSelect;

// RBAC Insert Schemas
export const insertPermissionSchema = createInsertSchema(permissions).omit({
  id: true,
  createdAt: true,
});

export const insertRoleSchema = createInsertSchema(roles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRolePermissionSchema = createInsertSchema(rolePermissions).omit({
  id: true,
  createdAt: true,
});

export const insertUserRoleSchema = createInsertSchema(userRoles).omit({
  id: true,
  createdAt: true,
});

export const insertUserPermissionSchema = createInsertSchema(userPermissions).omit({
  id: true,
  createdAt: true,
});

export const insertCustomerRoleSchema = createInsertSchema(customerRoles).omit({
  id: true,
  createdAt: true,
});

// RBAC Types
export type InsertPermission = z.infer<typeof insertPermissionSchema>;
export type Permission = typeof permissions.$inferSelect;
export type InsertRole = z.infer<typeof insertRoleSchema>;
export type Role = typeof roles.$inferSelect;
export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;
export type RolePermission = typeof rolePermissions.$inferSelect;
export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;
export type UserRole = typeof userRoles.$inferSelect;
export type InsertUserPermission = z.infer<typeof insertUserPermissionSchema>;
export type UserPermission = typeof userPermissions.$inferSelect;
export type InsertCustomerRole = z.infer<typeof insertCustomerRoleSchema>;
export type CustomerRole = typeof customerRoles.$inferSelect;

// Extended RBAC types for API responses
export interface RoleWithPermissions extends Role {
  permissions: Permission[];
}

// Frontend-specific types with string permissions for easier handling
export interface RoleWithStringPermissions extends Role {
  permissions: string[];
}

export interface UserWithRoles extends User {
  roles: RoleWithStringPermissions[];
}

export interface CustomerWithRoles extends Customer {
  roles: RoleWithPermissions[];
}

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

// Audit Log types
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;
