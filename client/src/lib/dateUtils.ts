/**
 * Date Utilities for DD MM YYYY Format
 * Comprehensive date formatting functions for the entire system
 */

// DD MM YYYY format constants
export const DATE_FORMATS = {
  DD_MM_YYYY: 'DD MM YYYY',
  DD_MM_YYYY_DISPLAY: 'DD MM YYYY',
  DD_MM_YYYY_INPUT: 'DD-MM-YYYY',
  DD_MM_YYYY_SHORT: 'DD/MM/YYYY'
} as const;

/**
 * Convert date to DD MM YYYY format
 */
export function formatDateToDDMMYYYY(dateInput: string | Date, separator: string = ' '): string {
  if (!dateInput) return '';
  
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    
    if (isNaN(date.getTime())) {
      console.warn('Invalid date provided to formatDateToDDMMYYYY:', dateInput);
      return '';
    }
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}${separator}${month}${separator}${year}`;
  } catch (error) {
    console.error('Error formatting date to DD MM YYYY:', error);
    return '';
  }
}

/**
 * Convert DD MM YYYY string back to Date object
 */
export function parseDDMMYYYYToDate(dateString: string, separator: string = ' '): Date | null {
  if (!dateString) return null;
  
  try {
    const parts = dateString.split(separator);
    if (parts.length !== 3) return null;
    
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
    const year = parseInt(parts[2], 10);
    
    const date = new Date(year, month, day);
    
    // Validate the date
    if (date.getDate() !== day || date.getMonth() !== month || date.getFullYear() !== year) {
      return null;
    }
    
    return date;
  } catch (error) {
    console.error('Error parsing DD MM YYYY date:', error);
    return null;
  }
}

/**
 * Convert date to HTML input format (YYYY-MM-DD) for date inputs
 */
export function formatDateForInput(dateInput: string | Date): string {
  if (!dateInput) return '';
  
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    
    if (isNaN(date.getTime())) return '';
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error('Error formatting date for input:', error);
    return '';
  }
}

/**
 * Convert HTML input date (YYYY-MM-DD) to DD MM YYYY display format
 */
export function formatInputDateToDisplay(inputDate: string, separator: string = ' '): string {
  if (!inputDate) return '';
  
  try {
    const date = new Date(inputDate);
    return formatDateToDDMMYYYY(date, separator);
  } catch (error) {
    console.error('Error converting input date to display:', error);
    return '';
  }
}

/**
 * Get current date in DD MM YYYY format
 */
export function getCurrentDateDDMMYYYY(separator: string = ' '): string {
  return formatDateToDDMMYYYY(new Date(), separator);
}

/**
 * Format date for display with day suffix (e.g., "1st January 2025")
 */
export function formatDateWithSuffix(dateInput: string | Date): string {
  if (!dateInput) return '';
  
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    
    if (isNaN(date.getTime())) return '';
    
    const day = date.getDate();
    const month = date.toLocaleString('en-US', { month: 'long' });
    const year = date.getFullYear();
    
    const getDaySuffix = (day: number): string => {
      if (day >= 11 && day <= 13) return 'th';
      switch (day % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
      }
    };
    
    return `${day}${getDaySuffix(day)} ${month} ${year}`;
  } catch (error) {
    console.error('Error formatting date with suffix:', error);
    return '';
  }
}

/**
 * Check if date is valid
 */
export function isValidDate(dateInput: string | Date): boolean {
  if (!dateInput) return false;
  
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    return !isNaN(date.getTime());
  } catch {
    return false;
  }
}

/**
 * Convert various date formats to DD MM YYYY
 */
export function normalizeDateFormat(dateInput: string | Date, separator: string = ' '): string {
  if (!dateInput) return '';
  
  // If it's already in DD MM YYYY format, return as is
  if (typeof dateInput === 'string') {
    const ddmmyyyyPattern = /^\d{2}[\s\-\/]\d{2}[\s\-\/]\d{4}$/;
    if (ddmmyyyyPattern.test(dateInput)) {
      const parts = dateInput.split(/[\s\-\/]/);
      return `${parts[0]}${separator}${parts[1]}${separator}${parts[2]}`;
    }
  }
  
  return formatDateToDDMMYYYY(dateInput, separator);
}

/**
 * Get relative date description (Today, Tomorrow, etc.)
 */
export function getRelativeDateDescription(dateInput: string | Date): string {
  if (!dateInput) return '';
  
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    
    // Reset time for comparison
    date.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    tomorrow.setHours(0, 0, 0, 0);
    yesterday.setHours(0, 0, 0, 0);
    
    if (date.getTime() === today.getTime()) {
      return 'Today';
    } else if (date.getTime() === tomorrow.getTime()) {
      return 'Tomorrow';
    } else if (date.getTime() === yesterday.getTime()) {
      return 'Yesterday';
    }
    
    return formatDateToDDMMYYYY(date);
  } catch (error) {
    console.error('Error getting relative date:', error);
    return formatDateToDDMMYYYY(dateInput);
  }
}

/**
 * Gujarati date formatting (for backward compatibility)
 */
export function formatGujaratiDate(dateInput: string | Date): string {
  const GUJARATI_MONTHS = [
    'જાન્યુઆરી', 'ફેબ્રુઆરી', 'માર્ચ', 'એપ્રિલ', 'મે', 'જૂન',
    'જુલાઈ', 'ઓગસ્ટ', 'સપ્ટેમ્બર', 'ઓક્ટોબર', 'નવેમ્બર', 'ડિસેમ્બર'
  ];
  
  const GUJARATI_NUMBERS = ['૦', '૧', '૨', '૩', '૪', '૫', '૬', '૭', '૮', '૯'];
  
  const convertToGujaratiNumerals = (text: string): string => {
    return text.replace(/[0-9]/g, (digit) => GUJARATI_NUMBERS[parseInt(digit)] || digit);
  };
  
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    
    if (isNaN(date.getTime())) return '';
    
    const day = date.getDate();
    const month = date.getMonth();
    const year = date.getFullYear();
    
    const gujaratiDay = convertToGujaratiNumerals(String(day).padStart(2, '0'));
    const gujaratiMonth = GUJARATI_MONTHS[month];
    const gujaratiYear = convertToGujaratiNumerals(year.toString());
    
    return `${gujaratiDay} ${gujaratiMonth} ${gujaratiYear}`;
  } catch (error) {
    console.error('Error formatting Gujarati date:', error);
    return '';
  }
}