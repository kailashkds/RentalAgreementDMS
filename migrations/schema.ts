import { pgTable, varchar, text, boolean, timestamp, unique, index, jsonb, integer, foreignKey, date, uniqueIndex } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const agreementTemplates = pgTable("agreement_templates", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	name: text().notNull(),
	language: varchar({ length: 20 }).notNull(),
	templateContent: text("template_content").notNull(),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const customers = pgTable("customers", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	name: text().notNull(),
	mobile: varchar({ length: 15 }).notNull(),
	email: varchar(),
	password: text(),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	username: varchar(),
}, (table) => [
	unique("customers_mobile_unique").on(table.mobile),
	unique("customers_username_key").on(table.username),
]);

export const sessions = pgTable("sessions", {
	sid: varchar().primaryKey().notNull(),
	sess: jsonb().notNull(),
	expire: timestamp({ mode: 'string' }).notNull(),
}, (table) => [
	index("IDX_session_expire").using("btree", table.expire.asc().nullsLast().op("timestamp_ops")),
]);

export const societies = pgTable("societies", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	societyName: text("society_name").notNull(),
	area: text().notNull(),
	district: text().notNull(),
	city: text().notNull(),
	state: text().notNull(),
	pincode: varchar({ length: 10 }).notNull(),
	landmark: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const adminUsers = pgTable("admin_users", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	password: text().notNull(),
	name: text().notNull(),
	role: varchar({ length: 20 }).default('admin').notNull(),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	phone: varchar(),
	username: varchar(),
}, (table) => [
	unique("admin_users_username_key").on(table.username),
]);

export const addresses = pgTable("addresses", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	society: text().notNull(),
	area: text().notNull(),
	city: text().notNull(),
	state: text().notNull(),
	pincode: varchar({ length: 10 }).notNull(),
	district: text(),
	landmark: text(),
	usageCount: integer("usage_count").default(1),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("address_area_idx").using("btree", table.area.asc().nullsLast().op("text_ops")),
	index("address_city_idx").using("btree", table.city.asc().nullsLast().op("text_ops")),
	index("address_society_idx").using("btree", table.society.asc().nullsLast().op("text_ops")),
]);

export const pdfTemplates = pgTable("pdf_templates", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	name: text().notNull(),
	documentType: text("document_type").notNull(),
	language: varchar({ length: 20 }).notNull(),
	htmlTemplate: text("html_template").notNull(),
	dynamicFields: jsonb("dynamic_fields").default([]).notNull(),
	conditionalRules: jsonb("conditional_rules").default([]).notNull(),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const wordTemplates = pgTable("word_templates", {
	id: text().default(gen_random_uuid()).primaryKey().notNull(),
	name: text().notNull(),
	documentType: text("document_type").notNull(),
	language: text().default('english').notNull(),
	structure: text().notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
});

export const agreements = pgTable("agreements", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	agreementNumber: varchar("agreement_number").notNull(),
	customerId: varchar("customer_id").notNull(),
	language: varchar({ length: 20 }).default('english').notNull(),
	ownerDetails: jsonb("owner_details").notNull(),
	tenantDetails: jsonb("tenant_details").notNull(),
	propertyDetails: jsonb("property_details").notNull(),
	rentalTerms: jsonb("rental_terms").notNull(),
	additionalClauses: text("additional_clauses").array().default([""]),
	startDate: date("start_date").notNull(),
	endDate: date("end_date").notNull(),
	agreementDate: date("agreement_date").notNull(),
	status: varchar({ length: 20 }).default('draft').notNull(),
	parentAgreementId: varchar("parent_agreement_id"),
	renewedFromId: varchar("renewed_from_id"),
	documents: jsonb().default({}),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	ownerDocuments: jsonb("owner_documents").default({}),
	tenantDocuments: jsonb("tenant_documents").default({}),
	propertyDocuments: jsonb("property_documents").default({}),
	notarizedDocument: jsonb("notarized_document").default({}),
	propertyId: varchar("property_id"),
	editedHtml: text("edited_html"),
	editedAt: timestamp("edited_at", { mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.customerId],
			foreignColumns: [customers.id],
			name: "agreements_customer_id_customers_id_fk"
		}),
	foreignKey({
			columns: [table.propertyId],
			foreignColumns: [properties.id],
			name: "agreements_property_id_properties_id_fk"
		}),
	unique("agreements_agreement_number_unique").on(table.agreementNumber),
]);

export const properties = pgTable("properties", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	customerId: varchar("customer_id").notNull(),
	flatNumber: text("flat_number").notNull(),
	building: text(),
	society: text().notNull(),
	area: text().notNull(),
	city: text().notNull(),
	state: text().notNull(),
	pincode: varchar({ length: 10 }).notNull(),
	district: text(),
	landmark: text(),
	propertyType: varchar("property_type", { length: 20 }).notNull(),
	purpose: varchar({ length: 50 }),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("property_address_idx").using("btree", table.society.asc().nullsLast().op("text_ops"), table.area.asc().nullsLast().op("text_ops"), table.city.asc().nullsLast().op("text_ops")),
	index("property_customer_idx").using("btree", table.customerId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.customerId],
			foreignColumns: [customers.id],
			name: "properties_customer_id_customers_id_fk"
		}),
]);

export const permissions = pgTable("permissions", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	code: varchar({ length: 100 }).notNull(),
	description: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("permissions_code_key").on(table.code),
]);

export const users = pgTable("users", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	email: varchar(),
	firstName: varchar("first_name"),
	lastName: varchar("last_name"),
	profileImageUrl: varchar("profile_image_url"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	username: varchar({ length: 255 }),
	mobile: varchar({ length: 20 }),
	phone: varchar({ length: 20 }),
	password: varchar({ length: 255 }),
	status: varchar({ length: 20 }).default('active'),
	permissions: text().array(),
	defaultRole: varchar("default_role", { length: 255 }),
	name: text(),
	isActive: boolean("is_active").default(true),
}, (table) => [
	uniqueIndex("users_mobile_idx").using("btree", table.mobile.asc().nullsLast().op("text_ops")).where(sql`(mobile IS NOT NULL)`),
	uniqueIndex("users_username_idx").using("btree", table.username.asc().nullsLast().op("text_ops")).where(sql`(username IS NOT NULL)`),
	unique("users_email_unique").on(table.email),
]);

export const roles = pgTable("roles", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	name: varchar({ length: 100 }).notNull(),
	description: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("roles_name_key").on(table.name),
]);

export const rolePermissions = pgTable("role_permissions", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	roleId: varchar("role_id").notNull(),
	permissionId: varchar("permission_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.roleId],
			foreignColumns: [roles.id],
			name: "role_permissions_role_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.permissionId],
			foreignColumns: [permissions.id],
			name: "role_permissions_permission_id_fkey"
		}).onDelete("cascade"),
	unique("role_permissions_role_id_permission_id_key").on(table.roleId, table.permissionId),
]);

export const userRoles = pgTable("user_roles", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	roleId: varchar("role_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.roleId],
			foreignColumns: [roles.id],
			name: "user_roles_role_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_roles_user_id_fkey"
		}),
	unique("user_roles_user_id_role_id_key").on(table.userId, table.roleId),
]);

export const customerRoles = pgTable("customer_roles", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	customerId: varchar("customer_id").notNull(),
	roleId: varchar("role_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.customerId],
			foreignColumns: [customers.id],
			name: "customer_roles_customer_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.roleId],
			foreignColumns: [roles.id],
			name: "customer_roles_role_id_fkey"
		}).onDelete("cascade"),
	unique("customer_roles_customer_id_role_id_key").on(table.customerId, table.roleId),
]);
