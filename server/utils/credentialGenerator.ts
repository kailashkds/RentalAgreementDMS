// Utility functions for generating user credentials

/**
 * Generate a secure random password
 */
export function generatePassword(length: number = 8): string {
  const charset = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  
  return password;
}

/**
 * Generate a username based on name and type
 */
export function generateUsername(name: string, userType: 'admin' | 'customer'): string {
  // Clean the name - remove spaces, special characters, convert to lowercase
  const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 8);
  
  // Generate a random suffix
  const suffix = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
  
  // Create username with type prefix
  const prefix = userType === 'admin' ? 'adm' : 'cust';
  
  return `${prefix}_${cleanName}_${suffix}`;
}

/**
 * Generate a unique user ID for display purposes
 */
export function generateUserDisplayId(userType: 'admin' | 'customer'): string {
  const prefix = userType === 'admin' ? 'ADM' : 'CUST';
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 999).toString().padStart(3, '0');
  
  return `${prefix}${timestamp}${random}`;
}