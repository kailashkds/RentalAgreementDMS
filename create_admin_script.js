// Emergency Admin User Creation Script
// Run this in your production environment to create an admin user

import bcrypt from 'bcrypt';
import { Pool } from 'pg';

async function createAdminUser() {
  console.log('🚀 Creating emergency admin user...');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    // Check if users table exists
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'users'
    `);
    
    if (tableCheck.rows.length === 0) {
      console.log('❌ Users table does not exist. Database migration may not have run.');
      console.log('Run: npm run db:push');
      return;
    }
    
    // Check if admin user already exists
    const existingUser = await pool.query(`
      SELECT id FROM users WHERE username = 'admin'
    `);
    
    if (existingUser.rows.length > 0) {
      console.log('✅ Admin user already exists');
      return;
    }
    
    // Create password hash
    const passwordHash = await bcrypt.hash('admin', 10);
    
    // Create admin user
    const result = await pool.query(`
      INSERT INTO users (id, username, password, email, role, full_name, phone, status, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'admin',
        $1,
        'admin@example.com',
        'super_admin',
        'System Administrator',
        '1234567890',
        'active',
        NOW(),
        NOW()
      ) RETURNING id, username
    `, [passwordHash]);
    
    console.log('✅ Admin user created successfully:', result.rows[0]);
    console.log('📋 Login credentials:');
    console.log('   Username: admin');
    console.log('   Password: admin');
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  } finally {
    await pool.end();
  }
}

// Run the script
createAdminUser().catch(console.error);