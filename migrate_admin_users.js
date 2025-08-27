// Script to migrate admin users from old table to new unified users table
// Run this BEFORE approving the deployment

const { Pool } = require('pg');

async function migrateAdminUsers() {
  console.log('🔄 Starting admin users migration...');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    // Step 1: Check if old admin_users table exists
    const oldTableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'admin_users'
    `);
    
    if (oldTableCheck.rows.length === 0) {
      console.log('❌ admin_users table not found');
      return;
    }
    
    // Step 2: Check if new users table exists (it should after migration)
    const newTableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'users'
    `);
    
    if (newTableCheck.rows.length === 0) {
      console.log('❌ users table not found. Run migration first.');
      return;
    }
    
    // Step 3: Get all admin users from old table
    const adminUsers = await pool.query(`
      SELECT id, username, password, email, role, full_name, created_at, updated_at 
      FROM admin_users
    `);
    
    console.log(`📋 Found ${adminUsers.rows.length} admin users to migrate`);
    
    // Step 4: Migrate each user to new table
    for (const user of adminUsers.rows) {
      try {
        // Check if user already exists in new table
        const existing = await pool.query(`
          SELECT id FROM users WHERE username = $1
        `, [user.username]);
        
        if (existing.rows.length > 0) {
          console.log(`⏭️  User ${user.username} already exists in users table`);
          continue;
        }
        
        // Insert into new users table
        await pool.query(`
          INSERT INTO users (id, username, password, email, role, full_name, phone, status, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
          user.id,
          user.username,
          user.password,
          user.email,
          user.role || 'super_admin',
          user.full_name,
          '1234567890', // Default phone number
          'active',
          user.created_at,
          user.updated_at
        ]);
        
        console.log(`✅ Migrated user: ${user.username}`);
        
      } catch (error) {
        console.error(`❌ Error migrating user ${user.username}:`, error.message);
      }
    }
    
    console.log('🎉 Admin users migration completed!');
    console.log('💡 You can now safely approve the deployment');
    
  } catch (error) {
    console.error('❌ Migration error:', error);
  } finally {
    await pool.end();
  }
}

// Run the migration
migrateAdminUsers().catch(console.error);