import { db } from "../db";
import { sql } from "drizzle-orm";
import bcrypt from "bcrypt";

export async function migrateUnifyUsersSQL() {
  console.log("🚀 Starting user unification migration (SQL)...");
  
  try {
    // Step 1: Get migration statistics
    const adminCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM admin_users`);
    const customerCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM customers`);
    const existingUsersCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM users WHERE username IS NOT NULL OR mobile IS NOT NULL`);
    
    const adminCount = (adminCountResult as any)[0]?.count || 0;
    const customerCount = (customerCountResult as any)[0]?.count || 0;
    const existingUsersCount = (existingUsersCountResult as any)[0]?.count || 0;
    
    console.log(`📊 Migration Statistics:`);
    console.log(`  • Admin users: ${adminCount}`);
    console.log(`  • Customers: ${customerCount}`);
    console.log(`  • Existing unified users: ${existingUsersCount}`);
    
    // Step 2: Migrate admin users
    console.log("🔄 Migrating admin users...");
    const adminMigrationResult = await db.execute(sql`
      INSERT INTO users (id, username, mobile, phone, password, first_name, last_name, email, status, default_role, created_at, updated_at)
      SELECT 
        au.id,
        COALESCE(au.username, REPLACE(LOWER(au.name), ' ', '_')),
        au.phone,
        au.phone,
        au.password,
        SPLIT_PART(TRIM(au.name), ' ', 1),
        CASE 
          WHEN LENGTH(TRIM(au.name)) - LENGTH(REPLACE(TRIM(au.name), ' ', '')) > 0 
          THEN SUBSTRING(TRIM(au.name) FROM POSITION(' ' IN TRIM(au.name)) + 1)
          ELSE NULL 
        END,
        NULL,
        CASE WHEN au.is_active THEN 'active' ELSE 'inactive' END,
        au.role,
        au.created_at,
        au.updated_at
      FROM admin_users au
      WHERE au.id NOT IN (SELECT id FROM users WHERE id IS NOT NULL)
      ON CONFLICT (id) DO NOTHING;
    `);
    
    console.log(`  ✓ Migrated ${(adminMigrationResult as any).rowCount || 0} admin users`);
    
    // Step 3: Migrate customers (handle passwords in TypeScript)
    console.log("🔄 Migrating customers...");
    const customersResult = await db.execute(sql`
      SELECT id, username, name, mobile, email, password, is_active, created_at, updated_at
      FROM customers 
      WHERE id NOT IN (SELECT id FROM users WHERE id IS NOT NULL)
    `);
    
    const customers = Array.isArray(customersResult) ? customersResult : [];
    let customerMigratedCount = 0;
    
    console.log(`  • Found ${customers.length} customers to migrate`);
    
    for (const customer of customers) {
      // Handle password hashing in TypeScript
      let hashedPassword = customer.password || 'temp_password_reset_required';
      if (hashedPassword && !hashedPassword.startsWith('$2b$') && hashedPassword !== 'temp_password_reset_required') {
        hashedPassword = await bcrypt.hash(hashedPassword, 10);
      }
      
      // Split name into first and last name
      const nameParts = (customer.name || "").trim().split(/\s+/);
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || null;
      
      // Generate username if not present
      const username = customer.username || customer.name?.toLowerCase().replace(/\s+/g, '_') || `user_${customer.id.slice(0, 8)}`;
      
      await db.execute(sql`
        INSERT INTO users (id, username, mobile, phone, password, first_name, last_name, email, status, default_role, created_at, updated_at)
        VALUES (
          ${customer.id},
          ${username},
          ${customer.mobile},
          ${customer.mobile},
          ${hashedPassword},
          ${firstName},
          ${lastName},
          ${customer.email},
          ${customer.is_active !== false ? 'active' : 'inactive'},
          'Customer',
          ${customer.created_at},
          ${customer.updated_at}
        )
        ON CONFLICT (id) DO NOTHING;
      `);
      customerMigratedCount++;
    }
    
    console.log(`  ✓ Migrated ${customerMigratedCount} customers`);
    
    // Step 4: Migrate customer role assignments to user_roles
    console.log("🔄 Migrating customer role assignments...");
    const roleMigrationResult = await db.execute(sql`
      INSERT INTO user_roles (id, user_id, role_id, created_at)
      SELECT 
        cr.id,
        cr.customer_id,
        cr.role_id,
        cr.created_at
      FROM customer_roles cr
      WHERE NOT EXISTS (
        SELECT 1 FROM user_roles ur 
        WHERE ur.user_id = cr.customer_id AND ur.role_id = cr.role_id
      );
    `);
    
    console.log(`  ✓ Migrated ${(roleMigrationResult as any).rowCount || 0} role assignments`);
    
    // Step 5: Update properties table references
    console.log("🔄 Updating properties table references...");
    const propertiesResult = await db.execute(sql`
      UPDATE properties 
      SET user_id = customer_id 
      WHERE customer_id IS NOT NULL AND user_id IS NULL;
    `);
    
    console.log(`  ✓ Updated ${(propertiesResult as any).rowCount || 0} property references`);
    
    // Step 6: Update agreements table references  
    console.log("🔄 Updating agreements table references...");
    const agreementsResult = await db.execute(sql`
      UPDATE agreements 
      SET user_id = customer_id 
      WHERE customer_id IS NOT NULL AND user_id IS NULL;
    `);
    
    console.log(`  ✓ Updated ${(agreementsResult as any).rowCount || 0} agreement references`);
    
    // Step 7: Show final statistics
    console.log("📊 Final Migration Statistics:");
    const finalUsersCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM users WHERE username IS NOT NULL OR mobile IS NOT NULL`);
    const finalUsersCount = (finalUsersCountResult as any)[0]?.count || 0;
    console.log(`  • Total unified users: ${finalUsersCount}`);
    
    console.log("🎉 User unification migration completed successfully!");
    
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }
}

// Auto-execute migration when run directly
migrateUnifyUsersSQL()
  .then(() => {
    console.log("🎉 Migration script completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Migration script failed:", error);
    process.exit(1);
  });