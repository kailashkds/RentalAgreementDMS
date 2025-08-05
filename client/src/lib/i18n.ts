export const LANGUAGES = [
  { value: "english", label: "English" },
  { value: "hindi", label: "Hindi (हिन्दी)" },
  { value: "gujarati", label: "Gujarati (ગુજરાતી)" },
  { value: "tamil", label: "Tamil (தமிழ்)" },
  { value: "marathi", label: "Marathi (मराठी)" },
];

export const getLanguageLabel = (value: string): string => {
  const language = LANGUAGES.find(lang => lang.value === value);
  return language?.label || "English";
};

// Translation keys for form labels based on selected language
export const translations = {
  english: {
    // Step 1
    selectCustomer: "Select Customer",
    agreementLanguage: "Agreement Language",
    createNewCustomer: "Create New Customer",
    
    // Step 2 - Landlord
    landlordDetails: "Landlord Details",
    fullName: "Full Name",
    mobileNumber: "Mobile Number",
    age: "Age",
    occupation: "Occupation",
    aadharNumber: "Aadhar Number",
    panCardNumber: "PAN Card Number",
    addressDetails: "Address Details",
    flatHouseNo: "Flat/House No.",
    societyApartment: "Society/Apartment",
    area: "Area",
    city: "City",
    documents: "Documents (Optional)",
    aadharCard: "Aadhar Card",
    panCard: "PAN Card",
    
    // Step 3 - Tenant
    tenantDetails: "Tenant Details",
    copyFromCustomer: "Copy from Customer",
    
    // Step 4 - Property
    propertyDetails: "Property Details & Rental Terms",
    propertyInformation: "Property Information",
    propertyType: "Property Type",
    placeOfAgreement: "Place of Agreement",
    rentalTerms: "Rental Terms",
    advanceDeposit: "Advance Deposit (₹)",
    monthlyRent: "Monthly Rent (₹)",
    rentDueDate: "Rent Due Date",
    additionalTerms: "Additional Terms",
    maintenanceCharge: "Maintenance Charge",
    noticePeriod: "Notice Period (Months)",
    furnitureItems: "Furniture/Items Included",
    
    // Step 5 - Finalize
    additionalConditions: "Additional Conditions & Finalize",
    additionalClauses: "Additional Clauses",
    addClause: "Add Clause",
    agreementSummary: "Agreement Summary",
    
    // Common
    customer: "Customer",
    language: "Language",
    property: "Property",
    duration: "Duration",
    deposit: "Deposit",
    saveDraft: "Save as Draft",
    createAgreement: "Create Agreement",
    previous: "Previous",
    next: "Next",
  },
  hindi: {
    // Basic translations - in a real app, you'd have comprehensive translations
    selectCustomer: "ग्राहक चुनें",
    agreementLanguage: "समझौते की भाषा",
    fullName: "पूरा नाम",
    mobileNumber: "मोबाइल नंबर",
    // ... more translations would go here
  },
  // Add other languages as needed
};

export const getTranslation = (key: string, language: string = "english"): string => {
  const langTranslations = translations[language as keyof typeof translations] || translations.english;
  return langTranslations[key as keyof typeof langTranslations] || key;
};

// Date formatting based on locale
export const formatDate = (date: Date | string, language: string = "english"): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  const localeMap = {
    english: 'en-US',
    hindi: 'hi-IN',
    gujarati: 'gu-IN',
    tamil: 'ta-IN',
    marathi: 'mr-IN',
  };
  
  const locale = localeMap[language as keyof typeof localeMap] || 'en-US';
  
  return dateObj.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

// Currency formatting for Indian Rupees
export const formatCurrency = (amount: number, language: string = "english"): string => {
  const localeMap = {
    english: 'en-IN',
    hindi: 'hi-IN',
    gujarati: 'gu-IN',
    tamil: 'ta-IN',
    marathi: 'mr-IN',
  };
  
  const locale = localeMap[language as keyof typeof localeMap] || 'en-IN';
  
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Number formatting for different locales
export const formatNumber = (number: number, language: string = "english"): string => {
  const localeMap = {
    english: 'en-IN',
    hindi: 'hi-IN',
    gujarati: 'gu-IN',
    tamil: 'ta-IN',
    marathi: 'mr-IN',
  };
  
  const locale = localeMap[language as keyof typeof localeMap] || 'en-IN';
  
  return new Intl.NumberFormat(locale).format(number);
};
