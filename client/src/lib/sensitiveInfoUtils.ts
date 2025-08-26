/**
 * Utility functions for masking sensitive information based on user permissions
 */

/**
 * Masks a phone number with asterisks, showing only the last 4 digits
 */
export function maskPhoneNumber(phoneNumber?: string | null): string {
  if (!phoneNumber) return "****-****-****";
  
  // Remove any non-digit characters
  const cleanNumber = phoneNumber.replace(/\D/g, '');
  
  if (cleanNumber.length <= 4) {
    return "*".repeat(cleanNumber.length);
  }
  
  const lastFour = cleanNumber.slice(-4);
  const maskedPart = "*".repeat(cleanNumber.length - 4);
  
  // Format like: ******-7890 or similar
  return `${maskedPart}-${lastFour}`;
}

/**
 * Masks an Aadhar number, showing only last 4 digits
 */
export function maskAadharNumber(aadharNumber?: string | null): string {
  if (!aadharNumber) return "****-****-****";
  
  const cleanNumber = aadharNumber.replace(/\D/g, '');
  
  if (cleanNumber.length <= 4) {
    return "*".repeat(cleanNumber.length);
  }
  
  const lastFour = cleanNumber.slice(-4);
  const maskedPart = "*".repeat(Math.max(0, cleanNumber.length - 4));
  
  return `${maskedPart}-${lastFour}`;
}

/**
 * Masks a PAN number, showing only last 4 characters
 */
export function maskPanNumber(panNumber?: string | null): string {
  if (!panNumber) return "****-****";
  
  if (panNumber.length <= 4) {
    return "*".repeat(panNumber.length);
  }
  
  const lastFour = panNumber.slice(-4);
  const maskedPart = "*".repeat(panNumber.length - 4);
  
  return `${maskedPart}${lastFour}`;
}

/**
 * Masks monetary amounts
 */
export function maskAmount(amount?: number | string | null): string {
  return "₹ ****";
}

/**
 * Masks property address details
 */
export function maskPropertyAddress(address?: string | null): string {
  if (!address) return "*** *** ***";
  
  const words = address.split(' ');
  if (words.length <= 2) {
    return "*".repeat(address.length);
  }
  
  // Show first and last word, mask middle
  const firstWord = words[0];
  const lastWord = words[words.length - 1];
  const middleMask = "*".repeat(3);
  
  return `${firstWord} ${middleMask} ${lastWord}`;
}

/**
 * Generic text masking for sensitive info
 */
export function maskSensitiveText(text?: string | null, placeholder: string = "*** HIDDEN ***"): string {
  return text ? placeholder : placeholder;
}

/**
 * Masks document URLs by returning a placeholder
 */
export function maskDocumentUrl(): string {
  return "*** DOCUMENT HIDDEN ***";
}