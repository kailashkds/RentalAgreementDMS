import { db } from "../db";
import { users, adminUsers, customers, userRoles, customerRoles, properties, agreements } from "@shared/schema";
import { sql } from "drizzle-orm";
import bcrypt from "bcrypt";

/**
 * Data migration to unify admin users and customers into a single users table
 * This script:
 * 1. Migrates all admin users to the unified users table
 * 2. Migrates all customers to the unified users table  
 * 3. Migrates role assignments from both userRoles and customerRoles
 * 4. Updates foreign key references in properties and agreements tables
 * 5. Handles conflicts by prioritizing admin users over customers
 */

interface AdminUser {
  id: string;
  username: string;
  phone: string;
  password: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface Customer {
  id: string;
  name: string;
  username?: string;
  mobile: string;
  email?: string;
  password?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface UserRole {
  id: string;
  userId: string;
  roleId: string;
  createdAt: Date;
}

interface CustomerRole {
  id: string;
  customerId: string;
  roleId: string;
  createdAt: Date;
}

export async function migrateUnifyUsers() {
  console.log("🚀 Starting user unification migration...");
  
  try {
    // Step 1: Backup existing data counts
    const adminCount = await db.select({ count: sql`count(*)` }).from(adminUsers);
    const customerCount = await db.select({ count: sql`count(*)` }).from(customers);
    const existingUsersCount = await db.select({ count: sql`count(*)` }).from(users);
    
    console.log(`📊 Migration Statistics:`);
    console.log(`  • Admin users: ${adminCount[0].count}`);
    console.log(`  • Customers: ${customerCount[0].count}`);
    console.log(`  • Existing users: ${existingUsersCount[0].count}`);
    
    // Step 2: Migrate admin users to unified users table
    console.log("🔄 Migrating admin users...");
    const admins = await db.select().from(adminUsers);
    
    for (const admin of admins as AdminUser[]) {
      // Check if user already exists in unified table
      const existingUser = await db.select().from(users).where(sql`id = ${admin.id}`);
      
      if (existingUser.length === 0) {
        await db.insert(users).values({
          id: admin.id, // Preserve original ID
          username: admin.username,
          phone: admin.phone,
          mobile: admin.phone, // Use phone as mobile for admins
          password: admin.password, // Already hashed
          name: admin.name,
          email: null, // Admins don't have email in current system
          firstName: null,
          lastName: null,
          profileImageUrl: null,
          isActive: admin.isActive,
          createdAt: admin.createdAt,
          updatedAt: admin.updatedAt,
        });
        console.log(`  ✓ Migrated admin user: ${admin.username} (${admin.id})`);
      } else {
        console.log(`  ⚠ Admin user already exists: ${admin.username} (${admin.id})`);
      }
    }
    
    // Step 3: Migrate customers to unified users table
    console.log("🔄 Migrating customers...");
    const customersData = await db.select().from(customers);
    
    for (const customer of customersData as Customer[]) {
      // Check if user already exists in unified table (by ID)
      const existingUser = await db.select().from(users).where(sql`id = ${customer.id}`);
      
      if (existingUser.length === 0) {
        // Hash password if it exists and is not already hashed
        let hashedPassword = customer.password;
        if (hashedPassword && !hashedPassword.startsWith('$2b$')) {
          hashedPassword = await bcrypt.hash(hashedPassword, 10);
        }
        
        await db.insert(users).values({
          id: customer.id, // Preserve original ID
          username: customer.username,
          phone: customer.mobile, // Use mobile as phone
          mobile: customer.mobile,
          password: hashedPassword || 'temp_password_reset_required',
          name: customer.name,
          email: customer.email,
          firstName: null,
          lastName: null,
          profileImageUrl: null,
          isActive: customer.isActive ?? true,
          createdAt: customer.createdAt,
          updatedAt: customer.updatedAt,
        });
        console.log(`  ✓ Migrated customer: ${customer.name} (${customer.id})`);
      } else {
        console.log(`  ⚠ Customer already exists: ${customer.name} (${customer.id})`);
      }
    }
    
    // Step 4: Migrate customer role assignments to unified userRoles table
    console.log("🔄 Migrating customer role assignments...");
    const customerRoleAssignments = await db.select().from(customerRoles);
    
    for (const customerRole of customerRoleAssignments as CustomerRole[]) {
      // Check if role assignment already exists
      const existingAssignment = await db.select().from(userRoles).where(
        sql`user_id = ${customerRole.customerId} AND role_id = ${customerRole.roleId}`
      );
      
      if (existingAssignment.length === 0) {
        await db.insert(userRoles).values({
          id: customerRole.id, // Preserve original ID
          userId: customerRole.customerId, // customer ID becomes user ID
          roleId: customerRole.roleId,
          createdAt: customerRole.createdAt,
        });
        console.log(`  ✓ Migrated customer role assignment: ${customerRole.customerId} -> ${customerRole.roleId}`);
      } else {
        console.log(`  ⚠ Customer role assignment already exists: ${customerRole.customerId} -> ${customerRole.roleId}`);
      }
    }
    
    // Step 5: Update properties table references (customerId -> userId)
    console.log("🔄 Updating properties table references...");
    const propertiesCount = await db.execute(
      sql`SELECT COUNT(*) as count FROM properties WHERE customer_id IS NOT NULL`
    );
    const propertyCount = (propertiesCount as any)[0]?.count || 0;
    
    if (propertyCount > 0) {
      await db.execute(
        sql`ALTER TABLE properties ADD COLUMN IF NOT EXISTS user_id VARCHAR REFERENCES users(id)`
      );
      
      await db.execute(
        sql`UPDATE properties SET user_id = customer_id WHERE customer_id IS NOT NULL AND user_id IS NULL`
      );
      
      console.log(`  ✓ Updated ${propertyCount} property references`);
    }
    
    // Step 6: Update agreements table references (customerId -> userId)  
    console.log("🔄 Updating agreements table references...");
    const agreementsCount = await db.execute(
      sql`SELECT COUNT(*) as count FROM agreements WHERE customer_id IS NOT NULL`
    );
    const agreementCount = (agreementsCount as any)[0]?.count || 0;
    
    if (agreementCount > 0) {
      await db.execute(
        sql`ALTER TABLE agreements ADD COLUMN IF NOT EXISTS user_id VARCHAR REFERENCES users(id)`
      );
      
      await db.execute(
        sql`UPDATE agreements SET user_id = customer_id WHERE customer_id IS NOT NULL AND user_id IS NULL`
      );
      
      console.log(`  ✓ Updated ${agreementCount} agreement references`);
    }
    
    // Step 7: Verify migration results
    console.log("🔍 Verifying migration results...");
    const finalUsersCount = await db.select({ count: sql`count(*)` }).from(users);
    const finalUserRolesCount = await db.select({ count: sql`count(*)` }).from(userRoles);
    
    console.log(`📊 Migration Results:`);
    console.log(`  • Total unified users: ${finalUsersCount[0].count}`);
    console.log(`  • Total user role assignments: ${finalUserRolesCount[0].count}`);
    console.log(`  • Properties updated: ${propertyCount}`);
    console.log(`  • Agreements updated: ${agreementCount}`);
    
    console.log("✅ User unification migration completed successfully!");
    
    console.log("\n⚠️  NEXT STEPS:");
    console.log("1. Test the unified authentication system");
    console.log("2. Verify all user permissions work correctly");
    console.log("3. Once verified, you can drop the old tables:");
    console.log("   - DROP TABLE customer_roles;");
    console.log("   - DROP TABLE admin_users;");
    console.log("   - DROP TABLE customers;");
    console.log("4. Remove deprecated columns from properties and agreements tables");
    
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }
}

// Auto-execute migration when run directly
migrateUnifyUsers()
  .then(() => {
    console.log("🎉 Migration script completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Migration script failed:", error);
    process.exit(1);
  });