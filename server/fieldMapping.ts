// Field mapping utilities for PDF template generation
// Maps form field names to template field names

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
  const skipFormattingPatterns = ['ID', 'NUMBER', 'AMOUNT', 'PHONE', 'EMAIL', 'PINCODE'];
  const shouldSkip = skipFormattingPatterns.some(pattern => templateField.includes(pattern));
  
  if (shouldFormatString && !shouldSkip) {
    return { shouldFormat: true, formatType: 'string' };
  }
  
  return { shouldFormat: false, formatType: 'none' };
}

// Generic function to apply formatting based on value characteristics
function applySmartFormatting(value: string, templateField: string): string {
  const { shouldFormat, formatType } = shouldFormatValue(value, templateField);
  
  if (!shouldFormat) {
    return value;
  }
  
  switch (formatType) {
    case 'date':
      return formatDateToDDMMYYYY(value);
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
export function mapFormDataToTemplateFields(formData: any): Record<string, string> {
  const templateFields: Record<string, string> = {};

  // Debug: Log the form data to understand its structure
  console.log("Mapping form data to template fields...");
  console.log("Form data keys:", Object.keys(formData));
  
  // Map all configured fields, handling precedence for granular vs nested
  for (const [formPath, templateField] of Object.entries(FIELD_MAPPINGS)) {
    const value = getNestedProperty(formData, formPath);
    if (value !== undefined && value !== null) {
      // Only set if we haven't already set this template field
      // This gives precedence to granular fields over nested address fields
      if (!templateFields[templateField]) {
        let formattedValue = String(value);
        
        // Apply smart formatting based on value characteristics and field patterns
        formattedValue = applySmartFormatting(formattedValue, templateField);
        
        templateFields[templateField] = formattedValue;
        
        // Debug: Log successful mappings
        console.log(`Mapped ${formPath} = "${value}" -> ${templateField} = "${formattedValue}"`);
      }
    }
  }

  // Debug: Log total number of mapped fields
  console.log(`Total fields mapped: ${Object.keys(templateFields).length}`);
  console.log("All mapped fields:", Object.keys(templateFields));

  // Add computed fields (amounts in words)
  // Handle both monthlyRent and rentAmount fields
  const rentAmount = formData.rentalTerms?.rentAmount || formData.rentalTerms?.monthlyRent;
  if (rentAmount) {
    const rentAmountNum = Number(rentAmount);
    templateFields['RENT_AMOUNT_WORDS'] = numberToWords(rentAmountNum);
    console.log(`Added computed field: RENT_AMOUNT_WORDS = "${templateFields['RENT_AMOUNT_WORDS']}"`);
  }

  // Handle both deposit and securityDeposit fields
  const securityDeposit = formData.rentalTerms?.securityDeposit || formData.rentalTerms?.deposit;
  if (securityDeposit) {
    const securityDepositNum = Number(securityDeposit);
    templateFields['SECURITY_DEPOSIT_WORDS'] = numberToWords(securityDepositNum);
  }

  // Additional computed fields for payment dates
  if (formData.rentalTerms?.dueDate && !templateFields['PAYMENT_DUE_DATE_TO']) {
    // If we only have a single due date, set both from and to
    const dueDate = formData.rentalTerms.dueDate;
    templateFields['PAYMENT_DUE_DATE_FROM'] = String(dueDate);
    templateFields['PAYMENT_DUE_DATE_TO'] = String(Math.min(Number(dueDate) + 7, 31)); // Default 7-day window
  }

  // Handle conditional logic for maintenance charge
  const maintenanceCharge = formData.rentalTerms?.maintenanceCharge;
  if (maintenanceCharge) {
    if (maintenanceCharge.toLowerCase() === 'included in rent') {
      templateFields['MAINTENANCE_INCLUSION'] = 'Inclusion of Maintenance';
      templateFields['MAINTENANCE_EXCLUSION'] = '';
    } else {
      templateFields['MAINTENANCE_INCLUSION'] = '';
      templateFields['MAINTENANCE_EXCLUSION'] = 'Exclusion of Maintenance';
    }
  } else {
    templateFields['MAINTENANCE_INCLUSION'] = '';
    templateFields['MAINTENANCE_EXCLUSION'] = '';
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

  return templateFields;
}

/**
 * Processes HTML template by replacing template fields with actual values
 */
export function processTemplate(htmlTemplate: string, fieldValues: Record<string, string>): string {
  let processedTemplate = htmlTemplate;

  // Debug: Find all placeholders in the template
  const placeholdersInTemplate = htmlTemplate.match(/\{\{[^}]*\}\}/g) || [];
  console.log("Placeholders found in template:", placeholdersInTemplate);
  console.log("Field values available:", Object.keys(fieldValues));
  
  // Replace all template fields with actual values
  for (const [fieldName, value] of Object.entries(fieldValues)) {
    const templateField = `{{${fieldName}}}`;
    const regex = new RegExp(templateField.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const beforeCount = (processedTemplate.match(regex) || []).length;
    processedTemplate = processedTemplate.replace(regex, value || '');
    const afterCount = (processedTemplate.match(regex) || []).length;
    
    if (beforeCount > 0) {
      console.log(`Replaced ${beforeCount} instances of ${templateField} with "${value}"`);
    }
  }

  // Replace any remaining empty placeholders with empty string
  const remainingPlaceholders = processedTemplate.match(/\{\{[^}]*\}\}/g) || [];
  console.log("Remaining unreplaced placeholders:", remainingPlaceholders);
  processedTemplate = processedTemplate.replace(/\{\{[^}]*\}\}/g, '');

  return processedTemplate;
}

/**
 * Generates PDF-ready HTML from form data and template
 */
export function generatePdfHtml(formData: any, htmlTemplate: string): string {
  const fieldValues = mapFormDataToTemplateFields(formData);
  return processTemplate(htmlTemplate, fieldValues);
}