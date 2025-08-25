import { Pool } from '@neondatabase/serverless';
import { encryptPasswordForStorage } from './server/encryption.js';

async function migrateToEncryptedPasswords() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('🔐 Starting password encryption migration...');
    
    // Get all customers with plain text passwords that haven't been encrypted yet
    const { rows: customers } = await pool.query(`
      SELECT id, plain_password 
      FROM customers 
      WHERE plain_password IS NOT NULL 
      AND encrypted_password IS NULL
    `);
    
    console.log(`📊 Found ${customers.length} customers to migrate`);
    
    for (const customer of customers) {
      try {
        // Encrypt the plain text password
        const encryptedPassword = encryptPasswordForStorage(customer.plain_password);
        
        // Update customer with encrypted password
        await pool.query(
          'UPDATE customers SET encrypted_password = $1 WHERE id = $2',
          [encryptedPassword, customer.id]
        );
        
        console.log(`✅ Migrated password for customer ID: ${customer.id}`);
      } catch (error) {
        console.error(`❌ Failed to migrate customer ${customer.id}:`, error.message);
      }
    }
    
    console.log('🎉 Password encryption migration completed successfully!');
    
    // Verify the migration
    const { rows: verification } = await pool.query(`
      SELECT 
        COUNT(*) as total_customers,
        COUNT(encrypted_password) as encrypted_count,
        COUNT(plain_password) as plain_count
      FROM customers
    `);
    
    console.log('📈 Migration verification:');
    console.log(`   Total customers: ${verification[0].total_customers}`);
    console.log(`   Encrypted passwords: ${verification[0].encrypted_count}`);
    console.log(`   Plain passwords: ${verification[0].plain_count}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await pool.end();
  }
}

// Only run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateToEncryptedPasswords();
}

export { migrateToEncryptedPasswords };