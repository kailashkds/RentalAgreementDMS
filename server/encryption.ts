import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-super-secret-encryption-key-32-chars-long!!';
const ALGORITHM = 'aes-256-gcm';

if (ENCRYPTION_KEY.length !== 48) {
  console.warn('⚠️  ENCRYPTION_KEY should be 48 characters long for optimal security');
}

/**
 * Encrypts a password for secure storage
 * @param password - The plain text password to encrypt
 * @returns Object containing encrypted data
 */
export function encryptPassword(password: string): { 
  encryptedData: string; 
  iv: string; 
  tag: string; 
} {
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(ALGORITHM, ENCRYPTION_KEY);
    
    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // For AES-GCM, we need to get the authentication tag
    const tag = cipher.getAuthTag();
    
    return {
      encryptedData: encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt password');
  }
}

/**
 * Decrypts a password for admin viewing
 * @param encryptedData - The encrypted password data
 * @param iv - Initialization vector
 * @param tag - Authentication tag
 * @returns The decrypted plain text password
 */
export function decryptPassword(encryptedData: string, iv: string, tag: string): string {
  try {
    const decipher = crypto.createDecipher(ALGORITHM, ENCRYPTION_KEY);
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt password');
  }
}

/**
 * Encrypts a password and returns it in a format suitable for database storage
 * @param password - The plain text password
 * @returns A JSON string containing encrypted password data
 */
export function encryptPasswordForStorage(password: string): string {
  const encrypted = encryptPassword(password);
  return JSON.stringify(encrypted);
}

/**
 * Decrypts a password from database storage format
 * @param encryptedPasswordJson - The JSON string from database
 * @returns The decrypted plain text password
 */
export function decryptPasswordFromStorage(encryptedPasswordJson: string): string {
  try {
    const encrypted = JSON.parse(encryptedPasswordJson);
    return decryptPassword(encrypted.encryptedData, encrypted.iv, encrypted.tag);
  } catch (error) {
    console.error('Failed to decrypt password from storage:', error);
    throw new Error('Invalid encrypted password format');
  }
}