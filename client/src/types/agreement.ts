export interface AgreementFormData {
  customerId: string;
  language: string;
  ownerDetails: OwnerDetails;
  tenantDetails: TenantDetails;
  propertyDetails: PropertyDetails;
  rentalTerms: RentalTerms;
  additionalClauses: string[];
  documents?: AgreementDocuments;
}

export interface OwnerDetails {
  name: string;
  mobile: string;
  age: number;
  occupation: string;
  aadhar: string;
  pan: string;
  address: AddressDetails;
}

export interface TenantDetails {
  name: string;
  mobile: string;
  age: number;
  occupation: string;
  aadhar: string;
  pan: string;
  address: AddressDetails;
}

export interface AddressDetails {
  flatNo: string;
  society: string;
  area: string;
  district: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
}

export interface PropertyDetails {
  type: string;
  address: AddressDetails;
  place: string;
}

export interface RentalTerms {
  startDate?: string;
  endDate?: string;
  duration?: number; // in months
  deposit: number;
  monthlyRent: number;
  dueDate: number; // day of month
  maintenance: "included" | "excluded";
  noticePeriod: number; // in months
  furniture: string;
}

export interface AgreementDocuments {
  ownerAadhar?: string;
  ownerPan?: string;
  tenantAadhar?: string;
  tenantPan?: string;
  signedAgreement?: string;
}

export interface AgreementStatus {
  status: "draft" | "active" | "expired" | "renewed" | "terminated";
  createdAt: string;
  updatedAt: string;
  agreementNumber: string;
}

export interface ValidationErrors {
  [key: string]: string | ValidationErrors;
}

export interface WizardStep {
  id: number;
  title: string;
  isValid?: boolean;
  isCompleted?: boolean;
}

export const AGREEMENT_STEPS: WizardStep[] = [
  { id: 1, title: "Customer & Language" },
  { id: 2, title: "Landlord Details" },
  { id: 3, title: "Tenant Details" },
  { id: 4, title: "Property Details" },
  { id: 5, title: "Finalize" },
];

export const AGREEMENT_STATUSES = [
  { value: "draft", label: "Draft", color: "bg-blue-100 text-blue-800" },
  { value: "active", label: "Active", color: "bg-green-100 text-green-800" },
  { value: "expired", label: "Expired", color: "bg-red-100 text-red-800" },
  { value: "renewed", label: "Renewed", color: "bg-purple-100 text-purple-800" },
  { value: "terminated", label: "Terminated", color: "bg-gray-100 text-gray-800" },
] as const;

export const MAINTENANCE_OPTIONS = [
  { value: "included", label: "Included in rent" },
  { value: "excluded", label: "Excluded from rent" },
] as const;

export const RENT_DUE_DATES = [
  { value: 1, label: "1st of month" },
  { value: 5, label: "5th of month" },
  { value: 10, label: "10th of month" },
  { value: 15, label: "15th of month" },
  { value: 20, label: "20th of month" },
  { value: 25, label: "25th of month" },
] as const;

export const DURATION_OPTIONS = [
  { value: 11, label: "11 months" },
  { value: 12, label: "12 months" },
  { value: 24, label: "24 months" },
  { value: 36, label: "36 months" },
] as const;

// Helper functions
export const getStatusColor = (status: string): string => {
  const statusConfig = AGREEMENT_STATUSES.find(s => s.value === status);
  return statusConfig?.color || "bg-gray-100 text-gray-800";
};

export const getStatusLabel = (status: string): string => {
  const statusConfig = AGREEMENT_STATUSES.find(s => s.value === status);
  return statusConfig?.label || status;
};

export const calculateEndDate = (startDate: string, duration: number): string => {
  const start = new Date(startDate);
  const end = new Date(start);
  end.setMonth(end.getMonth() + duration);
  return end.toISOString().split('T')[0];
};

export const isAgreementExpiringSoon = (endDate: string, daysThreshold: number = 30): boolean => {
  const end = new Date(endDate);
  const today = new Date();
  const diffTime = end.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays <= daysThreshold && diffDays > 0;
};

export const isAgreementExpired = (endDate: string): boolean => {
  const end = new Date(endDate);
  const today = new Date();
  return end < today;
};

// Form validation helpers
export const validateStep1 = (data: Partial<AgreementFormData>): ValidationErrors => {
  const errors: ValidationErrors = {};
  
  if (!data.customerId) {
    errors.customerId = "Please select a customer";
  }
  
  if (!data.language) {
    errors.language = "Please select a language";
  }
  
  return errors;
};

export const validateStep2 = (data: Partial<AgreementFormData>): ValidationErrors => {
  const errors: ValidationErrors = {};
  
  if (!data.ownerDetails?.name) {
    errors.ownerName = "Owner name is required";
  }
  
  if (!data.ownerDetails?.mobile) {
    errors.ownerMobile = "Owner mobile is required";
  }
  
  if (!data.ownerDetails?.age || data.ownerDetails.age < 18) {
    errors.ownerAge = "Owner must be at least 18 years old";
  }
  
  return errors;
};

export const validateStep3 = (data: Partial<AgreementFormData>): ValidationErrors => {
  const errors: ValidationErrors = {};
  
  if (!data.tenantDetails?.name) {
    errors.tenantName = "Tenant name is required";
  }
  
  if (!data.tenantDetails?.mobile) {
    errors.tenantMobile = "Tenant mobile is required";
  }
  
  if (!data.tenantDetails?.age || data.tenantDetails.age < 18) {
    errors.tenantAge = "Tenant must be at least 18 years old";
  }
  
  return errors;
};

export const validateStep4 = (data: Partial<AgreementFormData>): ValidationErrors => {
  const errors: ValidationErrors = {};
  
  if (!data.propertyDetails?.type) {
    errors.propertyType = "Property type is required";
  }
  
  if (!data.rentalTerms?.monthlyRent || data.rentalTerms.monthlyRent <= 0) {
    errors.monthlyRent = "Monthly rent must be greater than 0";
  }
  
  if (!data.rentalTerms?.deposit || data.rentalTerms.deposit <= 0) {
    errors.deposit = "Deposit must be greater than 0";
  }
  
  if (!data.rentalTerms?.dueDate) {
    errors.dueDate = "Rent due date is required";
  }
  
  return errors;
};

export const validateFormData = (data: Partial<AgreementFormData>, step: number): ValidationErrors => {
  switch (step) {
    case 1: return validateStep1(data);
    case 2: return validateStep2(data);
    case 3: return validateStep3(data);
    case 4: return validateStep4(data);
    default: return {};
  }
};
