import { relations } from "drizzle-orm/relations";
import { customers, agreements, properties, roles, rolePermissions, permissions, userRoles, users, customerRoles } from "./schema";

export const agreementsRelations = relations(agreements, ({one}) => ({
	customer: one(customers, {
		fields: [agreements.customerId],
		references: [customers.id]
	}),
	property: one(properties, {
		fields: [agreements.propertyId],
		references: [properties.id]
	}),
}));

export const customersRelations = relations(customers, ({many}) => ({
	agreements: many(agreements),
	properties: many(properties),
	customerRoles: many(customerRoles),
}));

export const propertiesRelations = relations(properties, ({one, many}) => ({
	agreements: many(agreements),
	customer: one(customers, {
		fields: [properties.customerId],
		references: [customers.id]
	}),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({one}) => ({
	role: one(roles, {
		fields: [rolePermissions.roleId],
		references: [roles.id]
	}),
	permission: one(permissions, {
		fields: [rolePermissions.permissionId],
		references: [permissions.id]
	}),
}));

export const rolesRelations = relations(roles, ({many}) => ({
	rolePermissions: many(rolePermissions),
	userRoles: many(userRoles),
	customerRoles: many(customerRoles),
}));

export const permissionsRelations = relations(permissions, ({many}) => ({
	rolePermissions: many(rolePermissions),
}));

export const userRolesRelations = relations(userRoles, ({one}) => ({
	role: one(roles, {
		fields: [userRoles.roleId],
		references: [roles.id]
	}),
	user: one(users, {
		fields: [userRoles.userId],
		references: [users.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	userRoles: many(userRoles),
}));

export const customerRolesRelations = relations(customerRoles, ({one}) => ({
	customer: one(customers, {
		fields: [customerRoles.customerId],
		references: [customers.id]
	}),
	role: one(roles, {
		fields: [customerRoles.roleId],
		references: [roles.id]
	}),
}));