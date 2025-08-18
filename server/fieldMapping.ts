// Field mapping utilities for PDF template generation
// Maps form field names to template field names

import { ObjectStorageService } from './objectStorage';
import { localFileStorage } from './localFileStorage';
import { fileProcessor } from './fileProcessor';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

// Gujarati language constants
const GUJARATI_MONTHS = [
  'જાન્યુઆરી', 'ફેબ્રુઆરી', 'માર્ચ', 'એપ્રિલ', 'મે', 'જૂન',
  'જુલાઈ', 'ઓગસ્ટ', 'સપ્ટેમ્બર', 'ઓક્ટોબર', 'નવેમ્બર', 'ડિસેમ્બર'
];

const GUJARATI_DAYS = [
  'રવિવાર', 'સોમવાર', 'મંગળવાર', 'બુધવાર', 'ગુરુવાર', 'શુક્રવાર', 'શનિવાર'
];

const GUJARATI_NUMBERS: Record<number, string> = {
  0: '૦', 1: '૧', 2: '૨', 3: '૩', 4: '૪', 5: '૫', 6: '૬', 7: '૭', 8: '૮', 9: '૯'
};

// Gujarati number to words conversion
const GUJARATI_ONES = ['', 'એક', 'બે', 'ત્રણ', 'ચાર', 'પાંચ', 'છ', 'સાત', 'આઠ', 'નવ'];
const GUJARATI_TEENS = ['દસ', 'અગિયાર', 'બાર', 'તેર', 'ચૌદ', 'પંદર', 'સોળ', 'સત્તર', 'અઢાર', 'ઓગણીસ'];
const GUJARATI_TENS = ['', '', 'વીસ', 'ત્રીસ', 'ચાળીસ', 'પચાસ', 'સાઠ', 'સિત્તેર', 'એંસી', 'નેવું'];
const GUJARATI_HUNDREDS = ['', 'એકસો', 'બસો', 'ત્રણસો', 'ચારસો', 'પાંચસો', 'છસો', 'સાતસો', 'આઠસો', 'નવસો'];

/**
 * Convert English numbers to Gujarati numerals
 */
function convertToGujaratiNumerals(text: string): string {
  return text.replace(/[0-9]/g, (digit) => GUJARATI_NUMBERS[parseInt(digit)] || digit);
}

/**
 * Convert date to Gujarati format
 */
function formatGujaratiDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const day = date.getDate();
    const month = date.getMonth();
    const year = date.getFullYear();
    const dayOfWeek = date.getDay();

    const gujaratiDay = convertToGujaratiNumerals(day.toString());
    const gujaratiMonth = GUJARATI_MONTHS[month];
    const gujaratiYear = convertToGujaratiNumerals(year.toString());
    
    return `${gujaratiDay}મી ${gujaratiMonth} ${gujaratiYear}`;
  } catch (error) {
    console.error('Error formatting Gujarati date:', error);
    return dateStr;
  }
}

/**
 * Get current day name in Gujarati
 */
function getCurrentGujaratiDay(): string {
  const today = new Date();
  const dayIndex = today.getDay();
  return GUJARATI_DAYS[dayIndex];
}

/**
 * Convert numbers to Gujarati words
 */
function numberToGujaratiWords(num: number): string {
  if (num === 0) return 'શૂન્ય';
  
  function convertHundredsGujarati(n: number): string {
    let result = '';
    
    if (n >= 100) {
      const hundreds = Math.floor(n / 100);
      result += GUJARATI_HUNDREDS[hundreds];
      n %= 100;
    }
    
    if (n >= 20) {
      const tens = Math.floor(n / 10);
      result += (result ? ' ' : '') + GUJARATI_TENS[tens];
      n %= 10;
    } else if (n >= 10) {
      result += (result ? ' ' : '') + GUJARATI_TEENS[n - 10];
      n = 0;
    }
    
    if (n > 0) {
      result += (result ? ' ' : '') + GUJARATI_ONES[n];
    }
    
    return result;
  }
  
  if (num < 1000) {
    return convertHundredsGujarati(num);
  } else if (num < 100000) {
    const thousands = Math.floor(num / 1000);
    let remainder = num % 1000;
    let result = convertHundredsGujarati(thousands) + ' હજાર';
    if (remainder > 0) {
      result += ' ' + convertHundredsGujarati(remainder);
    }
    return result;
  } else if (num < 10000000) {
    const lakhs = Math.floor(num / 100000);
    let remainder = num % 100000;
    let result = convertHundredsGujarati(lakhs) + ' લાખ';
    if (remainder >= 1000) {
      result += ' ' + convertHundredsGujarati(Math.floor(remainder / 1000)) + ' હજાર';
      remainder = remainder % 1000;
    }
    if (remainder > 0) {
      result += ' ' + convertHundredsGujarati(remainder);
    }
    return result;
  } else {
    const crores = Math.floor(num / 10000000);
    let remainder = num % 10000000;
    let result = convertHundredsGujarati(crores) + ' કરોડ';
    if (remainder > 0) {
      if (remainder >= 100000) {
        result += ' ' + convertHundredsGujarati(Math.floor(remainder / 100000)) + ' લાખ';
        remainder = remainder % 100000;
      }
      if (remainder >= 1000) {
        result += ' ' + convertHundredsGujarati(Math.floor(remainder / 1000)) + ' હજાર';
        remainder = remainder % 1000;
      }
      if (remainder > 0) {
        result += ' ' + convertHundredsGujarati(remainder);
      }
    }
    return result + ' પૂરા';
  }
}

export interface FormData {
  ownerDetails: {
    name: string;
    company: string;
    age: string;
    occupation: string;
    houseNumber: string;
    society: string;
    area: string;
    city: string;
    state: string;
    pincode: string;
  };
  tenantDetails: {
    name: string;
    company: string;
    age: string;
    occupation: string;
    houseNumber: string;
    society: string;
    area: string;
    city: string;
    state: string;
    pincode: string;
  };
  propertyDetails: {
    houseNumber: string;
    society: string;
    area: string;
    city: string;
    state: string;
    pincode: string;
    purpose: string;
    furnishedStatus: string;
    additionalItems: string;
  };
  rentalTerms: {
    rentAmount: number;
    securityDeposit: number;
    maintenanceCharge: string;
    tenure: string;
    startDate: string;
    endDate: string;
    paymentDueDateFrom: string;
    paymentDueDateTo: string;
    minimumStay: string;
    noticePeriod: string;
    renewalPeriod: string;
  };
  agreementDate: string;
  agreementType: string;
}

// Mapping configuration: form field path -> template field name
const FIELD_MAPPINGS = {
  // Owner fields - support both granular and legacy nested formats
  'ownerDetails.name': 'OWNER_NAME',
  'ownerDetails.company': 'OWNER_COMPANY',
  'ownerDetails.age': 'OWNER_AGE',
  'ownerDetails.occupation': 'OWNER_OCCUPATION',
  'ownerDetails.houseNumber': 'OWNER_HOUSE_NUMBER',
  'ownerDetails.society': 'OWNER_SOCIETY',
  'ownerDetails.area': 'OWNER_AREA',
  'ownerDetails.city': 'OWNER_CITY',
  'ownerDetails.state': 'OWNER_STATE',
  'ownerDetails.pincode': 'OWNER_PINCODE',
  // Legacy nested address fields
  'ownerDetails.address.flatNo': 'OWNER_HOUSE_NUMBER',
  'ownerDetails.address.society': 'OWNER_SOCIETY',
  'ownerDetails.address.area': 'OWNER_AREA',
  'ownerDetails.address.city': 'OWNER_CITY',
  'ownerDetails.address.state': 'OWNER_STATE',
  'ownerDetails.address.pincode': 'OWNER_PINCODE',

  // Tenant fields - support both granular and legacy nested formats
  'tenantDetails.name': 'TENANT_NAME',
  'tenantDetails.company': 'TENANT_COMPANY',
  'tenantDetails.age': 'TENANT_AGE',
  'tenantDetails.occupation': 'TENANT_OCCUPATION',
  'tenantDetails.houseNumber': 'TENANT_HOUSE_NUMBER',
  'tenantDetails.society': 'TENANT_SOCIETY',
  'tenantDetails.area': 'TENANT_AREA',
  'tenantDetails.city': 'TENANT_CITY',
  'tenantDetails.state': 'TENANT_STATE',
  'tenantDetails.pincode': 'TENANT_PINCODE',
  // Legacy nested address fields
  'tenantDetails.address.flatNo': 'TENANT_HOUSE_NUMBER',
  'tenantDetails.address.society': 'TENANT_SOCIETY',
  'tenantDetails.address.area': 'TENANT_AREA',
  'tenantDetails.address.city': 'TENANT_CITY',
  'tenantDetails.address.state': 'TENANT_STATE',
  'tenantDetails.address.pincode': 'TENANT_PINCODE',

  // Property fields - support both granular and legacy nested formats
  'propertyDetails.houseNumber': 'PROPERTY_HOUSE_NUMBER',
  'propertyDetails.society': 'PROPERTY_SOCIETY',
  'propertyDetails.area': 'PROPERTY_AREA',
  'propertyDetails.city': 'PROPERTY_CITY',
  'propertyDetails.state': 'PROPERTY_STATE',
  'propertyDetails.pincode': 'PROPERTY_PINCODE',
  'propertyDetails.areaInSqFt': 'PROPERTY_AREA_SQFT',
  'propertyDetails.purpose': 'PROPERTY_PURPOSE',
  'propertyDetails.furnishedStatus': 'PROPERTY_FURNISHED_STATUS',
  'propertyDetails.additionalItems': 'ADDITIONAL_ITEMS',
  // Legacy nested address fields
  'propertyDetails.address.flatNo': 'PROPERTY_HOUSE_NUMBER',
  'propertyDetails.address.society': 'PROPERTY_SOCIETY',
  'propertyDetails.address.area': 'PROPERTY_AREA',
  'propertyDetails.address.city': 'PROPERTY_CITY',
  'propertyDetails.address.state': 'PROPERTY_STATE',
  'propertyDetails.address.pincode': 'PROPERTY_PINCODE',

  // Rental terms - handle both current and expected field names
  'rentalTerms.monthlyRent': 'RENT_AMOUNT',
  'rentalTerms.rentAmount': 'RENT_AMOUNT',
  'rentalTerms.deposit': 'SECURITY_DEPOSIT',
  'rentalTerms.securityDeposit': 'SECURITY_DEPOSIT',
  'rentalTerms.maintenanceCharge': 'MAINTENANCE_CHARGE',
  'rentalTerms.tenure': 'TENURE',
  'rentalTerms.startDate': 'START_DATE',
  'rentalTerms.endDate': 'END_DATE',
  'rentalTerms.dueDate': 'DUE_DATE',
  'rentalTerms.paymentDueDateFrom': 'PAYMENT_DUE_DATE_FROM',
  'rentalTerms.paymentDueDateTo': 'PAYMENT_DUE_DATE_TO',
  'rentalTerms.paymentDueFromDate': 'PAYMENT_DUE_DATE_FROM',
  'rentalTerms.paymentDueToDate': 'PAYMENT_DUE_DATE_TO',
  'rentalTerms.noticePeriod': 'NOTICE_PERIOD',
  'rentalTerms.minimumStay': 'MINIMUM_STAY',
  'rentalTerms.renewalPeriod': 'RENEWAL_PERIOD',

  // Agreement fields
  'agreementDate': 'AGREEMENT_DATE',
  'createdAt': 'AGREEMENT_DATE',
  'agreementType': 'AGREEMENT_TYPE',
  'additionalClauses': 'ADDITIONAL_CLAUSES',
  
  // Property type mapping
  'propertyDetails.type': 'PROPERTY_TYPE',
  'propertyDetails.place': 'PROPERTY_PLACE',
  
  // Owner mobile and contact info
  'ownerDetails.mobile': 'OWNER_MOBILE',
  'ownerDetails.email': 'OWNER_EMAIL',
  'ownerDetails.aadhar': 'OWNER_AADHAR',
  'ownerDetails.pan': 'OWNER_PAN',
  
  // Tenant mobile and contact info
  'tenantDetails.mobile': 'TENANT_MOBILE',
  'tenantDetails.email': 'TENANT_EMAIL',
  'tenantDetails.aadhar': 'TENANT_AADHAR',
  'tenantDetails.pan': 'TENANT_PAN',
  
  // Maintenance mapping
  'rentalTerms.maintenance': 'MAINTENANCE_CHARGE',
  
  // Document URLs - Dynamic document fields for conditional PDF display
  'ownerDocuments.aadharUrl': 'OWNER_AADHAR_URL',
  'ownerDocuments.aadhar': 'OWNER_AADHAR_URL',
  'ownerDocuments.panUrl': 'OWNER_PAN_URL',
  'ownerDocuments.pan': 'OWNER_PAN_URL',
  'tenantDocuments.aadharUrl': 'TENANT_AADHAR_URL',
  'tenantDocuments.aadhar': 'TENANT_AADHAR_URL',
  'tenantDocuments.panUrl': 'TENANT_PAN_URL',
  'tenantDocuments.pan': 'TENANT_PAN_URL',
  'documents.propertyUrl': 'PROPERTY_DOCUMENTS_URL',
  'documents.property': 'PROPERTY_DOCUMENTS_URL',
  'propertyDocuments.urls': 'PROPERTY_DOCUMENTS_URL',
  'propertyDocuments': 'PROPERTY_DOCUMENTS_URL',
  
  // Alternative document field mappings (from AgreementWizard documents state)
  'documents.ownerAadhar': 'OWNER_AADHAR_URL',
  'documents.ownerPan': 'OWNER_PAN_URL',
  'documents.tenantAadhar': 'TENANT_AADHAR_URL',
  'documents.tenantPan': 'TENANT_PAN_URL',
  'documents.propertyDocuments': 'PROPERTY_DOCUMENTS_URL',
  'documents.propertyDocs': 'PROPERTY_DOCUMENTS_URL',
  
  // Additional fields for Gujarati template
  'ownerDetails.powerOfAttorney': 'OWNER_POWER_OF_ATTORNEY',
  'ownerDetails.mobileNumber': 'OWNER_MOBILE',
  'tenantDetails.mobileNumber': 'TENANT_MOBILE',
  
  // Current date and time fields for Gujarati dates
  'currentDay': 'CURRENT_DAY',
  'currentDate': 'CURRENT_DATE_GUJARATI',
  'currentMonth': 'CURRENT_MONTH_GUJARATI', 
  'currentYear': 'CURRENT_YEAR',
  'startDate': 'START_DATE_GUJARATI',
  'endDate': 'END_DATE_GUJARATI',
};

// Helper function to get nested object property by path
function getNestedProperty(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

// Helper function to format strings by capitalizing first letter of each word and replacing underscores with spaces
function formatStringValue(value: string): string {
  if (!value) return '';
  return value
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// Helper function to format date from YYYY-MM-DD to DD-MM-YYYY
function formatDateToDDMMYYYY(dateString: string): string {
  if (!dateString) return '';
  
  // Handle different date formats
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString; // Return original if invalid date
  
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  
  return `${day}-${month}-${year}`;
}

// Helper function to determine if a value should be formatted based on its characteristics
function shouldFormatValue(value: string, templateField: string): { shouldFormat: boolean; formatType: 'string' | 'date' | 'none' } {
  if (!value || typeof value !== 'string') {
    return { shouldFormat: false, formatType: 'none' };
  }

  // Check if it's a date field based on field name or value pattern
  const dateFieldPatterns = ['DATE', 'START', 'END', 'DUE', 'CREATED', 'UPDATED'];
  const isDateField = dateFieldPatterns.some(pattern => templateField.includes(pattern));
  
  // Check if value looks like a date (YYYY-MM-DD format)
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const looksLikeDate = datePattern.test(value);
  
  if (isDateField || looksLikeDate) {
    return { shouldFormat: true, formatType: 'date' };
  }
  
  // Check if it's a string that should be formatted (contains underscores, is all lowercase, or is a single lowercase word)
  const hasUnderscores = value.includes('_');
  const isAllLowercase = value === value.toLowerCase() && value.includes(' ');
  const isSingleLowercaseWord = value === value.toLowerCase() && !value.includes(' ') && value.length > 2;
  const shouldFormatString = hasUnderscores || isAllLowercase || isSingleLowercaseWord;
  
  // Skip formatting for certain field types that should remain as-is
  const skipFormattingPatterns = ['ID', 'NUMBER', 'AMOUNT', 'PHONE', 'EMAIL', 'PINCODE', 'URL'];
  const shouldSkip = skipFormattingPatterns.some(pattern => templateField.includes(pattern));
  
  // Also skip formatting if the value looks like a URL
  const looksLikeUrl = value.startsWith('http://') || value.startsWith('https://') || value.includes('storage.googleapis.com');
  if (looksLikeUrl) {
    return { shouldFormat: false, formatType: 'none' };
  }
  
  if (shouldFormatString && !shouldSkip) {
    return { shouldFormat: true, formatType: 'string' };
  }
  
  return { shouldFormat: false, formatType: 'none' };
}

// Generic function to apply formatting based on value characteristics
function applySmartFormatting(value: string, templateField: string, language?: string): string {
  const { shouldFormat, formatType } = shouldFormatValue(value, templateField);
  
  if (!shouldFormat) {
    return value;
  }
  
  switch (formatType) {
    case 'date':
      const formattedDate = formatDateToDDMMYYYY(value);
      // Convert to Gujarati numerals if language is Gujarati
      if (language === 'gujarati') {
        return convertToGujaratiNumerals(formattedDate);
      }
      return formattedDate;
    case 'string':
      return formatStringValue(value);
    default:
      return value;
  }
}

// Helper function to convert number to words (Indian format)
function numberToWords(num: number): string {
  if (num === 0) return 'Zero';
  
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  function convertHundreds(n: number): string {
    let result = '';
    
    if (n >= 100) {
      result += ones[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    
    if (n >= 20) {
      result += tens[Math.floor(n / 10)] + ' ';
      n %= 10;
    } else if (n >= 10) {
      result += teens[n - 10] + ' ';
      return result.trim();
    }
    
    if (n > 0) {
      result += ones[n] + ' ';
    }
    
    return result.trim();
  }
  
  if (num < 1000) {
    return convertHundreds(num);
  } else if (num < 100000) {
    const thousands = Math.floor(num / 1000);
    const remainder = num % 1000;
    let result = convertHundreds(thousands) + ' Thousand';
    if (remainder > 0) {
      result += ' ' + convertHundreds(remainder);
    }
    return result;
  } else if (num < 10000000) {
    const lakhs = Math.floor(num / 100000);
    let remainder = num % 100000;
    let result = convertHundreds(lakhs) + ' Lakh';
    if (remainder > 0) {
      if (remainder >= 1000) {
        result += ' ' + convertHundreds(Math.floor(remainder / 1000)) + ' Thousand';
        remainder = remainder % 1000;
      }
      if (remainder > 0) {
        result += ' ' + convertHundreds(remainder);
      }
    }
    return result;
  } else {
    const crores = Math.floor(num / 10000000);
    let remainder = num % 10000000;
    let result = convertHundreds(crores) + ' Crore';
    if (remainder > 0) {
      if (remainder >= 100000) {
        result += ' ' + convertHundreds(Math.floor(remainder / 100000)) + ' Lakh';
        remainder = remainder % 100000;
      }
      if (remainder >= 1000) {
        result += ' ' + convertHundreds(Math.floor(remainder / 1000)) + ' Thousand';
        remainder = remainder % 1000;
      }
      if (remainder > 0) {
        result += ' ' + convertHundreds(remainder);
      }
    }
    return result;
  }
}

/**
 * Maps form data to template field values
 * Converts form field paths (like 'owner.area') to template fields (like {{OWNER_AREA}})
 * Handles both granular fields and legacy nested address structure
 */
export function mapFormDataToTemplateFields(formData: any, language?: string): Record<string, string> {
  const templateLanguage = language || formData.language || 'english';
  const templateFields: Record<string, string> = {};

  // Debug: Log the form data to understand its structure
  console.log("Mapping form data to template fields...");
  console.log("Form data keys:", Object.keys(formData));
  
  // Debug: Log document-related fields to see structure
  if (formData.documents) {
    console.log("[DEBUG] Documents object:", JSON.stringify(formData.documents, null, 2));
  }
  if (formData.ownerDocuments) {
    console.log("[DEBUG] Owner documents:", JSON.stringify(formData.ownerDocuments, null, 2));
  }
  if (formData.tenantDocuments) {
    console.log("[DEBUG] Tenant documents:", JSON.stringify(formData.tenantDocuments, null, 2));
  }
  
  // Map all configured fields, handling precedence for granular vs nested
  for (const [formPath, templateField] of Object.entries(FIELD_MAPPINGS)) {
    const value = getNestedProperty(formData, formPath);
    if (value !== undefined && value !== null) {
      // Handle object values (like propertyDocuments array)
      let formattedValue: string;
      if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value) && value.length > 0) {
          // For arrays, take the first URL
          formattedValue = String(value[0]);
        } else if (value.url) {
          // For objects with url property
          formattedValue = String(value.url);
        } else {
          // Skip objects that can't be converted to URLs
          console.log(`Skipping object value for ${formPath}: ${JSON.stringify(value)}`);
          continue;
        }
      } else {
        formattedValue = String(value);
      }
      
      // Only set if we haven't already set this template field
      // This gives precedence to granular fields over nested address fields
      if (!templateFields[templateField]) {
        // Apply smart formatting based on value characteristics and field patterns
        formattedValue = applySmartFormatting(formattedValue, templateField, templateLanguage);
        
        templateFields[templateField] = formattedValue;
        
        // Debug: Log successful mappings
        console.log(`Mapped ${formPath} = "${value}" -> ${templateField} = "${formattedValue}"`);
      }
    }
  }

  // Handle additional clauses array
  if (formData.additionalClauses && Array.isArray(formData.additionalClauses)) {
    const validClauses = formData.additionalClauses.filter((clause: any) => clause && clause.trim());
    if (validClauses.length > 0) {
      const clausesText = validClauses
        .map((clause: any, index: number) => `${index + 1}. ${clause.trim()}`)
        .join('<br/>');
      templateFields['ADDITIONAL_CLAUSES'] = clausesText;
    } else {
      templateFields['ADDITIONAL_CLAUSES'] = 'No additional clauses specified.';
    }
  } else if (typeof formData.additionalClauses === 'string') {
    // Handle case where additionalClauses comes as comma-separated string
    const clausesArray = formData.additionalClauses.split(',').filter((clause: any) => clause && clause.trim());
    if (clausesArray.length > 0) {
      const clausesText = clausesArray
        .map((clause: any, index: number) => `${index + 1}. ${clause.trim()}`)
        .join('<br/>');
      templateFields['ADDITIONAL_CLAUSES'] = clausesText;
    } else {
      templateFields['ADDITIONAL_CLAUSES'] = 'No additional clauses specified.';
    }
  } else {
    templateFields['ADDITIONAL_CLAUSES'] = 'No additional clauses specified.';
  }

  // Handle conditional logic for maintenance charge
  // Check both maintenanceCharge and maintenance fields as the form might use either
  const maintenanceCharge = formData.rentalTerms?.maintenanceCharge || formData.rentalTerms?.maintenance;
  
  if (maintenanceCharge) {
    const maintenanceLower = String(maintenanceCharge).toLowerCase();
    if (maintenanceLower === 'included' || maintenanceLower === 'included in rent') {
      // When maintenance is INCLUDED - show text with maintenance charges
      if (templateLanguage === 'gujarati') {
        templateFields['MAINTENANCE_INCLUSION'] = 'એસ.એમ. સી. ટેક્ષ અને મેન્ટેનન્સ સાથે';
        templateFields['MAINTENANCE_EXCLUSION'] = '';
      } else {
        templateFields['MAINTENANCE_INCLUSION'] = 'with SMC Tax and Maintenance';
        templateFields['MAINTENANCE_EXCLUSION'] = '';
      }
    } else {
      // When maintenance is EXCLUDED - show text without maintenance charges
      if (templateLanguage === 'gujarati') {
        templateFields['MAINTENANCE_INCLUSION'] = '';
        templateFields['MAINTENANCE_EXCLUSION'] = 'પુરા ';
      } else {
        templateFields['MAINTENANCE_INCLUSION'] = '';
        templateFields['MAINTENANCE_EXCLUSION'] = 'complete ';
      }
    }
  } else {
    // Default to excluded if not specified
    if (templateLanguage === 'gujarati') {
      templateFields['MAINTENANCE_INCLUSION'] = '';
      templateFields['MAINTENANCE_EXCLUSION'] = 'પુરા ';
    } else {
      templateFields['MAINTENANCE_INCLUSION'] = '';
      templateFields['MAINTENANCE_EXCLUSION'] = 'complete ';
    }
  }

  // Add computed fields (amounts in words)
  // Handle both monthlyRent and rentAmount fields
  const rentAmount = formData.rentalTerms?.rentAmount || formData.rentalTerms?.monthlyRent;
  if (rentAmount) {
    const rentAmountNum = Number(rentAmount);
    // English amount in words
    templateFields['RENT_AMOUNT_WORDS'] = numberToWords(rentAmountNum);
    templateFields['MONTHLY_RENT'] = String(rentAmountNum);
    templateFields['MONTHLY_RENT_WORDS'] = numberToWords(rentAmountNum);
    
    // Gujarati amount in words
    templateFields['MONTHLY_RENT_WORDS_GUJARATI'] = numberToGujaratiWords(rentAmountNum);
    templateFields['RENT_AMOUNT_WORDS_GUJARATI'] = numberToGujaratiWords(rentAmountNum);
  }

  // Handle both deposit and securityDeposit fields
  const securityDeposit = formData.rentalTerms?.securityDeposit || formData.rentalTerms?.deposit;
  if (securityDeposit) {
    const securityDepositNum = Number(securityDeposit);
    // English amount in words
    templateFields['SECURITY_DEPOSIT_WORDS'] = numberToWords(securityDepositNum);
    templateFields['DEPOSIT_AMOUNT'] = String(securityDepositNum);
    templateFields['DEPOSIT_AMOUNT_WORDS'] = numberToWords(securityDepositNum);
    
    // Gujarati amount in words
    templateFields['SECURITY_DEPOSIT_WORDS_GUJARATI'] = numberToGujaratiWords(securityDepositNum);
    templateFields['DEPOSIT_AMOUNT_WORDS_GUJARATI'] = numberToGujaratiWords(securityDepositNum);
  }

  // Handle notice period conversion to words
  const noticePeriod = formData.rentalTerms?.noticePeriod;
  if (noticePeriod) {
    const noticePeriodNum = Number(noticePeriod);
    if (!isNaN(noticePeriodNum) && noticePeriodNum > 0) {
      // English notice period in words
      templateFields['NOTICE_PERIOD_WORDS'] = numberToWords(noticePeriodNum);
      
      // Gujarati notice period in words
      templateFields['NOTICE_PERIOD_WORDS_GUJARATI'] = numberToGujaratiWords(noticePeriodNum);
      
      console.log(`Notice period conversion: ${noticePeriodNum} -> English: "${templateFields['NOTICE_PERIOD_WORDS']}" -> Gujarati: "${templateFields['NOTICE_PERIOD_WORDS_GUJARATI']}"`);
    }
  }

  // Additional computed fields for payment dates
  if (formData.rentalTerms?.dueDate && !templateFields['PAYMENT_DUE_DATE_TO']) {
    // If we only have a single due date, set both from and to
    const dueDate = formData.rentalTerms.dueDate;
    templateFields['PAYMENT_DUE_DATE_FROM'] = String(dueDate);
    templateFields['PAYMENT_DUE_DATE_TO'] = String(Math.min(Number(dueDate) + 7, 31)); // Default 7-day window
  }



  // Handle conditional logic for property purpose (for GST clause)
  const propertyPurpose = formData.propertyDetails?.purpose;
  if (propertyPurpose && propertyPurpose.toLowerCase().includes('commercial')) {
    templateFields['PROPERTY_PURPOSE_COMMERCIAL'] = 'true';
  } else {
    templateFields['PROPERTY_PURPOSE_COMMERCIAL'] = '';
  }

  // Convert property purpose to Gujarati
  if (propertyPurpose) {
    const purposeMapping: Record<string, string> = {
      'residential': 'રહેણાંક',
      'commercial': 'કોમર્શિયલ', 
      'mixed': 'મિશ્ર ઉપયોગ',
      'office': 'કાર્યાલય',
      'shop': 'દુકાન',
      'warehouse': 'ગોદામ',
      'industrial': 'ઉદ્યોગિક'
    };
    
    const purposeLower = propertyPurpose.toLowerCase();
    templateFields['PROPERTY_PURPOSE_GUJARATI'] = purposeMapping[purposeLower] || propertyPurpose;
  } else {
    templateFields['PROPERTY_PURPOSE_GUJARATI'] = 'રહેણાંક'; // Default to residential
  }

  // Default values for common fields if not provided
  if (!templateFields['TENURE']) {
    templateFields['TENURE'] = '11 Month';
  }
  if (!templateFields['NOTICE_PERIOD']) {
    templateFields['NOTICE_PERIOD'] = '2 month';
  }
  if (!templateFields['MINIMUM_STAY']) {
    templateFields['MINIMUM_STAY'] = '11 months';
  }

  // Handle agreement date mapping - use createdAt if available, or current date as fallback
  if (!templateFields['AGREEMENT_DATE']) {
    if (formData.createdAt) {
      const agreementDate = new Date(formData.createdAt);
      templateFields['AGREEMENT_DATE'] = agreementDate.toLocaleDateString('en-GB');
    } else if (formData.agreementDate) {
      const agreementDate = new Date(formData.agreementDate);
      templateFields['AGREEMENT_DATE'] = agreementDate.toLocaleDateString('en-GB');
    } else {
      // Fallback to current date
      templateFields['AGREEMENT_DATE'] = new Date().toLocaleDateString('en-GB');
    }
  }

  // Add language-specific formatting
  if (templateLanguage === 'gujarati') {
    // Add Gujarati-specific date formatting
    const currentDate = new Date();
    templateFields['CURRENT_DAY'] = getCurrentGujaratiDay();
    templateFields['CURRENT_DATE_GUJARATI'] = convertToGujaratiNumerals(currentDate.getDate().toString()) + 'મી';
    templateFields['CURRENT_MONTH_GUJARATI'] = GUJARATI_MONTHS[currentDate.getMonth()];
    templateFields['CURRENT_YEAR'] = convertToGujaratiNumerals(currentDate.getFullYear().toString());

    // Format start and end dates in Gujarati
    if (formData.rentalTerms?.startDate) {
      templateFields['START_DATE_GUJARATI'] = formatGujaratiDate(formData.rentalTerms.startDate);
    }
    if (formData.rentalTerms?.endDate) {
      templateFields['END_DATE_GUJARATI'] = formatGujaratiDate(formData.rentalTerms.endDate);
    }

    // Calculate agreement duration
    if (formData.rentalTerms?.startDate && formData.rentalTerms?.endDate) {
      const startDate = new Date(formData.rentalTerms.startDate);
      const endDate = new Date(formData.rentalTerms.endDate);
      const monthsDiff = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
      templateFields['AGREEMENT_DURATION'] = convertToGujaratiNumerals(monthsDiff.toString());
    } else {
      templateFields['AGREEMENT_DURATION'] = convertToGujaratiNumerals('11'); // Default 11 months
    }

    // Add full property address in Gujarati format
    const propertyParts = [];
    if (formData.propertyDetails?.houseNumber || templateFields['PROPERTY_HOUSE_NUMBER']) {
      propertyParts.push(templateFields['PROPERTY_HOUSE_NUMBER'] || formData.propertyDetails?.houseNumber);
    }
    if (formData.propertyDetails?.society || templateFields['PROPERTY_SOCIETY']) {
      propertyParts.push(templateFields['PROPERTY_SOCIETY'] || formData.propertyDetails?.society);
    }
    if (formData.propertyDetails?.area || templateFields['PROPERTY_AREA']) {
      propertyParts.push(templateFields['PROPERTY_AREA'] || formData.propertyDetails?.area);
    }
    if (formData.propertyDetails?.city || templateFields['PROPERTY_CITY']) {
      propertyParts.push(templateFields['PROPERTY_CITY'] || formData.propertyDetails?.city);
    }
    if (formData.propertyDetails?.state || templateFields['PROPERTY_STATE']) {
      propertyParts.push(templateFields['PROPERTY_STATE'] || formData.propertyDetails?.state);
    }
    if (formData.propertyDetails?.pincode || templateFields['PROPERTY_PINCODE']) {
      propertyParts.push(convertToGujaratiNumerals(templateFields['PROPERTY_PINCODE'] || formData.propertyDetails?.pincode));
    }
    
    templateFields['PROPERTY_FULL_ADDRESS'] = propertyParts.filter(Boolean).join(', ');
  }

  return templateFields;
}

/**
 * Processes HTML template by replacing template fields with actual values and handling conditional logic
 */
export function processTemplate(htmlTemplate: string, fieldValues: Record<string, string>): string {
  let processedTemplate = htmlTemplate;
  
  // First, process conditional statements {{#if FIELD_NAME}} ... {{/if}}
  processedTemplate = processConditionalLogic(processedTemplate, fieldValues);
  
  // Replace all template fields with actual values
  for (const [fieldName, value] of Object.entries(fieldValues)) {
    const templateField = `{{${fieldName}}}`;
    processedTemplate = processedTemplate.replace(new RegExp(templateField.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value || '');
  }

  // Replace any remaining empty placeholders with empty string
  processedTemplate = processedTemplate.replace(/\{\{[^}]*\}\}/g, '');

  return processedTemplate;
}

/**
 * Process conditional logic in templates {{#if FIELD_NAME}} content {{/if}}
 */
function processConditionalLogic(template: string, fieldValues: Record<string, string>): string {
  let processedTemplate = template;
  
  // Find all conditional blocks using regex
  const conditionalRegex = /\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/gi;
  
  processedTemplate = processedTemplate.replace(conditionalRegex, (match, fieldName, content) => {
    const trimmedFieldName = fieldName.trim();
    const fieldValue = fieldValues[trimmedFieldName];
    
    console.log(`[Conditional Logic] Checking field: ${trimmedFieldName}, value: ${fieldValue}`);
    
    // Show content only if field has a value and is not empty
    if (fieldValue && fieldValue.trim() && fieldValue !== 'undefined' && fieldValue !== 'null') {
      console.log(`[Conditional Logic] Field ${trimmedFieldName} has value, including content`);
      return content;
    } else {
      console.log(`[Conditional Logic] Field ${trimmedFieldName} is empty/null, excluding content`);
      return '';
    }
  });
  
  return processedTemplate;
}

/**
 * Generates PDF-ready HTML from form data and template with document embedding
 */
export async function generatePdfHtml(formData: any, htmlTemplate: string, language?: string): Promise<string> {
  const fieldValues = mapFormDataToTemplateFields(formData, language);
  
  // Process document embedding for images/PDFs
  const processedFieldValues = await processDocumentEmbedding(fieldValues, formData);
  
  let processedHtml = processTemplate(htmlTemplate, processedFieldValues);
  
  // Determine font family based on language
  const fontFamily = language === 'gujarati' 
    ? '"Noto Sans Gujarati", "Shruti", "Lohit Gujarati", system-ui, Arial, sans-serif'
    : language === 'hindi'
    ? '"Noto Sans Devanagari", "Mangal", "Lohit Devanagari", system-ui, Arial, sans-serif'
    : language === 'tamil'
    ? '"Noto Sans Tamil", "Latha", "Lohit Tamil", system-ui, Arial, sans-serif'
    : language === 'marathi'
    ? '"Noto Sans Devanagari", "Mangal", "Lohit Devanagari", system-ui, Arial, sans-serif'
    : 'Arial, sans-serif';

  // Replace inline font-family styles in the HTML template to match the language
  // Always perform font replacement for all languages (except Gujarati which needs special handling)
  
  // Always replace Times New Roman with the appropriate font for the language
  processedHtml = processedHtml.replace(/font-family:\s*"Times New Roman",?\s*serif/gi, `font-family: ${fontFamily}`);
  processedHtml = processedHtml.replace(/font-family:\s*Times New Roman,?\s*serif/gi, `font-family: ${fontFamily}`);
  processedHtml = processedHtml.replace(/font-family:\s*["']?Times New Roman["']?/gi, `font-family: ${fontFamily}`);
  
  // Handle style attributes with Times New Roman
  processedHtml = processedHtml.replace(/style="([^"]*?)font-family:\s*"Times New Roman",?\s*serif([^"]*?)"/gi, 
    (match, before, after) => `style="${before}font-family: ${fontFamily}${after}"`);
  processedHtml = processedHtml.replace(/style="([^"]*?)font-family:\s*Times New Roman,?\s*serif([^"]*?)"/gi, 
    (match, before, after) => `style="${before}font-family: ${fontFamily}${after}"`);
  processedHtml = processedHtml.replace(/style="([^"]*?)font-family:\s*["']?Times New Roman["']?([^"]*?)"/gi, 
    (match, before, after) => `style="${before}font-family: ${fontFamily}${after}"`);
  
  // For non-Gujarati languages, also replace other common system fonts that might interfere
  if (language !== 'gujarati') {
    // Replace any remaining system fonts that aren't the target font
    if (fontFamily !== 'Arial, sans-serif') {
      processedHtml = processedHtml.replace(/font-family:\s*Arial,\s*sans-serif/gi, `font-family: ${fontFamily}`);
      processedHtml = processedHtml.replace(/font-family:\s*["']?Arial["']?/gi, `font-family: ${fontFamily}`);
      processedHtml = processedHtml.replace(/font-family:\s*system-ui,\s*Arial,\s*sans-serif/gi, `font-family: ${fontFamily}`);
      
      processedHtml = processedHtml.replace(/style="([^"]*?)font-family:\s*Arial,?\s*sans-serif([^"]*?)"/gi, 
        (match, before, after) => `style="${before}font-family: ${fontFamily}${after}"`);
      processedHtml = processedHtml.replace(/style="([^"]*?)font-family:\s*["']?Arial["']?([^"]*?)"/gi, 
        (match, before, after) => `style="${before}font-family: ${fontFamily}${after}"`);
    }
  }
  
  // Add page break control CSS if not already present
  const pageBreakCSS = `
<style>
/* PDF-specific styling - clean, professional appearance */
body {
  counter-reset: content-pages;
}

.content-page {
  counter-increment: content-pages;
}

/* All pages show page numbers by default */
@page {
  margin: 15mm 10mm 20mm 10mm;
  @bottom-right { 
    content: "Page " counter(content-pages);
    font-size: 10px;
    color: #666;
    font-family: Arial, sans-serif;
  }
}

/* Document pages don't show page numbers and don't increment counter */
@page.document-page {
  margin: 15mm 10mm 15mm 10mm;
  @bottom-right { content: none !important; }
}

.document-page {
  page-break-before: always;
  counter-increment: none !important;
}

html, body {
  margin: 0;
  padding: 0;
  font-family: ${fontFamily};
  background: white;
  box-shadow: none !important;
  border: none !important;
  line-height: 1.6 !important;
  font-size: 14px;
}

/* Professional paragraph and heading spacing with explicit font */
p, div, span, h1, h2, h3, h4, h5, h6 {
  line-height: 1.6 !important;
  margin: 8px 0 !important;
  font-family: ${fontFamily} !important;
}

/* Specific overrides for common paragraph spacing */
p {
  margin: 10px 0 !important;
  line-height: 1.6 !important;
  text-align: justify !important;
}

/* Title styling */
h1, h2, h3 {
  font-weight: bold !important;
  text-align: center !important;
  margin: 20px 0 15px 0 !important;
}

h1 {
  font-size: 18px !important;
  margin-bottom: 25px !important;
}

/* Strong text styling */
strong, b {
  font-weight: bold !important;
}

/* Remove excessive spacing from br tags */
br {
  line-height: 1.2 !important;
  margin: 0 !important;
}

/* Compact spacing for list items */
li {
  line-height: 1.4 !important;
  margin: 0.2em 0 !important;
}

/* Reduce spacing in table cells */
td, th {
  line-height: 1.4 !important;
  padding: 4px 8px !important;
}

/* Remove any shadows, borders, or background styling and enforce font */
*, *::before, *::after {
  box-shadow: none !important;
  text-shadow: none !important;
  border: none !important;
  outline: none !important;
  font-family: ${fontFamily} !important;
}

/* Specific overrides for agreement content */
div, p, h1, h2, h3, h4, h5, h6, span, img, iframe, embed {
  box-shadow: none !important;
  border: none !important;
  outline: none !important;
}

/* Page break control for PDF generation */
.no-page-break {
  page-break-inside: avoid;
  break-inside: avoid;
}

.page-break-before {
  page-break-before: always;
  break-before: page;
}

.page-break-after {
  page-break-after: always;
  break-after: page;
}

.keep-together {
  page-break-inside: avoid;
  break-inside: avoid;
  orphans: 3;
  widows: 3;
}

/* Specific content that should stay together */
.agreement-section {
  page-break-inside: avoid;
  break-inside: avoid;
  margin-bottom: 20px;
}

.clause-section {
  page-break-inside: avoid;
  break-inside: avoid;
  margin-bottom: 15px;
}

.signature-section {
  page-break-inside: avoid;
  break-inside: avoid;
  margin-top: 30px;
}

.terms-section {
  page-break-inside: avoid;
  break-inside: avoid;
}

/* Print media specific rules */
@media print {
  .no-page-break, .keep-together, .agreement-section, .clause-section, .signature-section, .terms-section {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
  
  body, html {
    background: white !important;
    box-shadow: none !important;
    border: none !important;
    line-height: 1.4 !important;
    font-family: ${fontFamily} !important;
  }
  
  p, div, span, h1, h2, h3, h4, h5, h6, strong, b, li, td, th {
    line-height: 1.4 !important;
    margin: 0.3em 0 !important;
    font-family: ${fontFamily} !important;
  }
  
  br {
    line-height: 1.2 !important;
    margin: 0 !important;
  }
}
</style>`;

  // Insert CSS into the HTML if it doesn't already contain page break styles
  if (!processedHtml.includes('page-break-inside') && !processedHtml.includes('<style')) {
    // Add CSS at the beginning of the HTML
    processedHtml = pageBreakCSS + processedHtml;
  } else if (!processedHtml.includes('page-break-inside')) {
    // If there's already a style tag, add our CSS rules inside the existing one
    processedHtml = processedHtml.replace('</style>', `
/* Page break control for PDF generation */
.no-page-break, .keep-together, .agreement-section, .clause-section, .signature-section, .terms-section {
  page-break-inside: avoid;
  break-inside: avoid;
}
.page-break-before { page-break-before: always; break-before: page; }
.page-break-after { page-break-after: always; break-after: page; }
@media print {
  .no-page-break, .keep-together, .agreement-section, .clause-section, .signature-section, .terms-section {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
}
</style>`);
  }
  
  // Calculate total content pages more accurately
  // Count main content sections and page breaks
  const documentPageCount = (processedHtml.match(/class="[^"]*document-page[^"]*"/g) || []).length;
  const pageBreakCount = (processedHtml.match(/page-break-before:\s*always/g) || []).length;
  
  // Calculate content pages: 1 base page + non-document page breaks
  let contentPageCount = 1; // Base content page
  
  // Add additional pages from page breaks in content (not document pages)
  const contentPageBreaks = pageBreakCount - documentPageCount;
  if (contentPageBreaks > 0) {
    contentPageCount += contentPageBreaks;
  }
  
  console.log(`[Page Counting] Document pages: ${documentPageCount}, Page breaks: ${pageBreakCount}, Content pages: ${contentPageCount}`);
  
  // Inject the total content pages into the CSS - replace all page number formats
  processedHtml = processedHtml.replace(
    /content: "Page " counter\(content-pages\);/g,
    `content: "Page " counter(content-pages) " of ${contentPageCount}";`
  );
  
  // Also fix the page counter display in the client-side CSS
  processedHtml = processedHtml.replace(
    /content: "Page " counter\(content-pages\) " of " attr\(data-total-pages\);/g,
    `content: "Page " counter(content-pages) " of ${contentPageCount}";`
  );
  
  // Fix any remaining page counter issues
  processedHtml = processedHtml.replace(
    /content: "Page " counter\(page\) " of " counter\(content-pages\);/g,
    `content: "Page " counter(content-pages) " of ${contentPageCount}";`
  );
  
  console.log(`[Page Counting] CSS replacement applied for ${contentPageCount} content pages`);
  
  // Wrap the main content in content-page class to include it in page counting
  // Look for the main content container and add content-page class
  if (processedHtml.includes('<div style="font-family:') || processedHtml.includes('<body')) {
    // Find the main content div or body and add content-page class
    processedHtml = processedHtml.replace(
      /(<div[^>]*style="[^"]*font-family:[^"]*"[^>]*>)/,
      '$1<div class="content-page">'
    );
    
    // If we added a content-page div, we need to close it at the end
    if (processedHtml.includes('<div class="content-page">')) {
      processedHtml = processedHtml.replace(/(.*)<\/div>(\s*<\/body>|\s*$)/, '$1</div></div>$2');
    }
  } else {
    // Fallback: wrap the entire content in content-page
    processedHtml = `<div class="content-page">${processedHtml}</div>`;
  }
  
  return processedHtml;
}

/**
 * OPTIMIZED: Process document URLs and convert them to embeddable content for PDFs
 * Uses caching and parallel processing for better performance
 */
async function processDocumentEmbedding(fieldValues: Record<string, string>, formData: any): Promise<Record<string, string>> {
  const processedFields = { ...fieldValues };
  
  // Document URL fields that should be processed for embedding
  const documentFields = [
    'OWNER_AADHAR_URL',
    'OWNER_PAN_URL', 
    'TENANT_AADHAR_URL',
    'TENANT_PAN_URL',
    'PROPERTY_DOCUMENTS_URL'
  ];

  // Filter out empty/invalid document fields to avoid unnecessary processing
  const validDocumentFields = documentFields.filter(fieldName => {
    const documentUrl = fieldValues[fieldName];
    return documentUrl && 
           documentUrl.trim() && 
           documentUrl !== 'undefined' && 
           documentUrl !== 'null' && 
           documentUrl !== '[object Object]' &&
           documentUrl.length > 10; // Basic length check
  });

  if (validDocumentFields.length === 0) {
    console.log('[PDF Embedding] No valid documents to process, skipping');
    return processedFields;
  }

  console.log(`[PDF Embedding] Processing ${validDocumentFields.length} document fields: ${validDocumentFields.join(', ')}`);

  // Process documents in parallel for better performance
  const processingPromises = validDocumentFields.map(async (fieldName) => {
    try {
      return await processDocumentField(fieldName, fieldValues[fieldName], processedFields);
    } catch (error) {
      console.error(`[PDF Embedding] Error processing ${fieldName}:`, error);
      return null;
    }
  });

  const results = await Promise.allSettled(processingPromises);
  
  // Log results
  const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;
  const failed = results.length - successful;
  console.log(`[PDF Embedding] Completed: ${successful} successful, ${failed} failed`);

  return processedFields;
}

/**
 * Process individual document field with optimized error handling
 */
async function processDocumentField(fieldName: string, documentUrl: string, processedFields: Record<string, string>): Promise<boolean> {
  console.log(`[PDF Embedding] Processing ${fieldName} with URL: ${documentUrl}`);
  
  // Check if this is a cloud storage URL or local file
  const isCloudStorageUrl = documentUrl.includes('storage.googleapis.com') || 
                            (documentUrl.startsWith('https://') && !documentUrl.includes('localhost')) || 
                            (documentUrl.startsWith('http://') && !documentUrl.includes('localhost'));
  const isLocalFile = !isCloudStorageUrl && (
    documentUrl.startsWith('/uploads/') || 
    (!documentUrl.startsWith('http') && !documentUrl.startsWith('/objects/') && !documentUrl.includes('storage.googleapis.com'))
  );
  
  console.log(`[PDF Embedding] isCloudStorageUrl: ${isCloudStorageUrl}, isLocalFile: ${isLocalFile}`);
  
  if (isCloudStorageUrl) {
    return await handleCloudStorageDocument(fieldName, documentUrl, processedFields);
  } else if (isLocalFile) {
    return await handleLocalDocument(fieldName, documentUrl, processedFields);
  } else {
    console.warn(`[PDF Embedding] Unsupported URL format for ${fieldName}: ${documentUrl}`);
    return false;
  }
}

/**
 * Handle cloud storage documents with optimized downloading
 */
async function handleCloudStorageDocument(fieldName: string, documentUrl: string, processedFields: Record<string, string>): Promise<boolean> {
  try {
    console.log(`[PDF Embedding] Processing cloud storage URL: ${documentUrl}`);
    const objectStorageService = new ObjectStorageService();
    const localFileName = await downloadFileFromObjectStorage(documentUrl, fieldName, objectStorageService);
    
    if (localFileName) {
      console.log(`[PDF Embedding] Successfully downloaded to local file: ${localFileName}`);
      
      // Now process the downloaded file like a local file
      const filePath = path.join(process.cwd(), 'uploads', localFileName);
      return await processLocalFile(fieldName, filePath, processedFields);
    } else {
      console.error(`[PDF Embedding] Failed to download cloud file for ${fieldName}`);
      return false;
    }
  } catch (error) {
    console.error(`[PDF Embedding] Error processing cloud storage for ${fieldName}:`, error);
    return false;
  }
}

/**
 * Handle local documents with file validation
 */
async function handleLocalDocument(fieldName: string, documentUrl: string, processedFields: Record<string, string>): Promise<boolean> {
  try {
    let filePath: string;
    
    if (documentUrl.startsWith('/uploads/')) {
      filePath = path.join(process.cwd(), documentUrl.substring(1));
    } else {
      filePath = path.join(process.cwd(), 'uploads', documentUrl);
    }
    
    return await processLocalFile(fieldName, filePath, processedFields);
  } catch (error) {
    console.error(`[PDF Embedding] Error processing local file for ${fieldName}:`, error);
    return false;
  }
}

/**
 * Process local file with improved error handling and validation
 */
async function processLocalFile(fieldName: string, filePath: string, processedFields: Record<string, string>): Promise<boolean> {
  if (!fs.existsSync(filePath)) {
    console.error(`[PDF Embedding] File not found: ${filePath}`);
    return false;
  }

  try {
    const fileStats = fs.statSync(filePath);
    if (fileStats.size === 0) {
      console.error(`[PDF Embedding] File is empty: ${filePath}`);
      return false;
    }

    if (fileStats.size > 50 * 1024 * 1024) { // 50MB limit
      console.error(`[PDF Embedding] File too large (${Math.round(fileStats.size / 1024 / 1024)}MB): ${filePath}`);
      return false;
    }

    const fileBuffer = fs.readFileSync(filePath);
    const fileHeader = fileBuffer.slice(0, 8);
    const headerString = fileHeader.toString('ascii');
    const isPdf = headerString.startsWith('%PDF');
    const isJpeg = fileBuffer[0] === 0xFF && fileBuffer[1] === 0xD8;
    const isPng = fileBuffer[0] === 0x89 && fileBuffer[1] === 0x50;
    
    console.log(`[PDF Embedding] File analysis: PDF=${isPdf}, JPEG=${isJpeg}, PNG=${isPng}, Size=${Math.round(fileStats.size / 1024)}KB`);
    
    const documentType = getDocumentTypeFromFieldName(fieldName);
    
    if (isPdf) {
      const imageHtml = await convertPdfToImages(filePath, documentType);
      
      if (imageHtml) {
        processedFields[fieldName] = imageHtml;
        console.log(`[PDF Embedding] ✅ Successfully processed PDF ${fieldName}`);
        return true;
      } else {
        console.error(`[PDF Embedding] ❌ Failed to convert PDF ${fieldName}`);
        return false;
      }
    } else if (isJpeg || isPng) {
      const base64Image = fileBuffer.toString('base64');
      const mimeType = isJpeg ? 'image/jpeg' : 'image/png';
      const imageHtml = `
        <div class="document-page" style="page-break-before: always; text-align: center; padding: 20px;">
          <h3 style="font-size: 16px; margin-bottom: 15px; color: #333;">${documentType}</h3>
          <img src="data:${mimeType};base64,${base64Image}" 
               style="width: auto; height: auto; max-width: 100%; max-height: 600px; border: none; display: block; margin: 0 auto;" 
               alt="${documentType}" />
        </div>`;
      
      processedFields[fieldName] = imageHtml;
      console.log(`[PDF Embedding] ✅ Successfully processed image ${fieldName}`);
      return true;
    } else {
      console.error(`[PDF Embedding] ❌ Unsupported file format for ${fieldName}`);
      return false;
    }
  } catch (error) {
    console.error(`[PDF Embedding] Error processing file ${filePath}:`, error);
    return false;
  }
}

/**
 * Get file extension from URL
 */
function getFileExtensionFromUrl(url: string): string {
  const urlPath = url.split('?')[0]; // Remove query parameters
  const lastDot = urlPath.lastIndexOf('.');
  if (lastDot === -1) return ''; // No extension found
  return urlPath.substring(lastDot);
}

/**
 * Download file from object storage and save locally
 */
async function downloadFileFromObjectStorage(documentUrl: string, fieldName: string, objectStorageService: any): Promise<string | null> {
  try {
    console.log(`[PDF Embedding] Downloading from object storage: ${documentUrl}`);
    
    // Use the object storage service to download the file
    const fileName = `${fieldName}_${Date.now()}${getFileExtensionFromUrl(documentUrl)}`;
    const localPath = path.join(process.cwd(), 'uploads', fileName);
    
    // Download the file
    const success = await objectStorageService.downloadFile(documentUrl, localPath);
    
    if (success) {
      console.log(`[PDF Embedding] Successfully downloaded to: ${fileName}`);
      return fileName;
    } else {
      console.error(`[PDF Embedding] Failed to download file: ${documentUrl}`);
      return null;
    }
  } catch (error) {
    console.error(`[PDF Embedding] Error downloading file:`, error);
    return null;
  }
}

/**
 * Convert PDF to images for embedding in documents
 */
async function convertPdfToImages(filePath: string, documentType: string): Promise<string | null> {
  try {
    // For now, return a placeholder since PDF conversion is complex
    // This can be enhanced with libraries like pdf2pic or pdf-poppler
    console.log(`[PDF Embedding] PDF conversion not implemented for ${filePath}`);
    return `
      <div class="document-page" style="page-break-before: always; text-align: center; padding: 20px;">
        <h3 style="font-size: 16px; margin-bottom: 15px; color: #333;">${documentType}</h3>
        <p style="color: #666; font-style: italic;">PDF document attached but preview not available</p>
      </div>`;
  } catch (error) {
    console.error(`[PDF Embedding] Error converting PDF:`, error);
    return null;
  }
}

/**
 * Get document type from field name for display purposes
 */
function getDocumentTypeFromFieldName(fieldName: string): string {
  const documentTypeMap: { [key: string]: string } = {
    'OWNER_AADHAR_URL': 'Owner Aadhaar Card',
    'OWNER_PAN_URL': 'Owner PAN Card',
    'TENANT_AADHAR_URL': 'Tenant Aadhaar Card',
    'TENANT_PAN_URL': 'Tenant PAN Card',
    'PROPERTY_DOCUMENTS_URL': 'Property Documents'
  };
  
  return documentTypeMap[fieldName] || 'Document';
}
