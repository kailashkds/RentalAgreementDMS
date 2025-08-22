import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight, Plus, Trash2, Copy, Download, Loader2, FileText, Users, DollarSign } from "lucide-react";
import { useForm } from "react-hook-form";
import { LocalFileUploader } from "@/components/LocalFileUploader";
import { FilePreview } from "@/components/FilePreview";
import CustomerModal from "@/components/CustomerModal";
import AdminLayout from "@/components/AdminLayout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getTranslation } from "@/lib/i18n";
import type { UploadResult } from "@uppy/core";
import type { OwnerDetails, TenantDetails, PropertyDetails, RentalTerms } from "@shared/schema";

interface AgreementFormData {
  customerId?: string;
  language: string;
  ownerDetails: OwnerDetails;
  tenantDetails: TenantDetails;
  propertyDetails: PropertyDetails;
  rentalTerms: RentalTerms;
  additionalClauses: string[];
}

const getSteps = (t: (key: string) => string) => [
  { id: 1, title: t("stepTitle1") },
  { id: 2, title: t("stepTitle2") },
  { id: 3, title: t("stepTitle3") },
  { id: 4, title: t("stepTitle4") },
  { id: 5, title: t("stepTitle5") },
];

const LANGUAGES = [
  { value: "english", label: "English" },
  { value: "hindi", label: "Hindi (हिन्दी)" },
  { value: "gujarati", label: "Gujarati (ગુજરાતી)" },
  { value: "tamil", label: "Tamil (தமிழ்)" },
  { value: "marathi", label: "Marathi (मराठी)" },
];

export default function CreateAgreement() {
  const [location, navigate] = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [customer, setCustomer] = useState<any>(null);
  const [property, setProperty] = useState<any>(null);
  const [documents, setDocuments] = useState<Record<string, string | { filename: string; fileType: string; size: number } | undefined>>({});
  const [addressSearch, setAddressSearch] = useState({
    owner: "",
    tenant: "",
    property: ""
  });
  const [showAddressSuggestions, setShowAddressSuggestions] = useState({
    owner: false,
    tenant: false,
    property: false
  });
  const [societySuggestions, setSocietySuggestions] = useState<Array<{
    id: string;
    societyName: string;
    area: string;
    city: string;
    pincode: string;
    state: string;
  }>>([]);
  const [showSocietySuggestions, setShowSocietySuggestions] = useState(false);
  
  // PDF Generation state
  const [pdfState, setPdfState] = useState<'idle' | 'creating' | 'ready'>('idle');
  const [pdfData, setPdfData] = useState<{ html: string; agreementNumber: string } | null>(null);
  const [createdAgreementId, setCreatedAgreementId] = useState<string | null>(null);
  
  const { toast } = useToast();
  const mobileTimeout = useRef<NodeJS.Timeout | null>(null);
  const addressTimeout = useRef<NodeJS.Timeout | null>(null);

  // Get URL parameters
  const urlParams = new URLSearchParams(location.split('?')[1] || '');
  const customerId = urlParams.get('customerId');
  const propertyId = urlParams.get('propertyId');

  const { register, handleSubmit, watch, setValue, reset, formState: { errors }, trigger } = useForm<AgreementFormData>({
    defaultValues: {
      language: "english",
      additionalClauses: [],
      rentalTerms: {
        tenure: "11_months", // Default to 11 months
        startDate: "",
        endDate: "",
        deposit: 0,
        monthlyRent: 0,
        dueDate: 1,
        maintenance: "included",
        noticePeriod: 1,
        furniture: ""
      }
    },
  });

  const watchedLanguage = watch("language");
  const watchedCustomerId = watch("customerId");
  const t = (key: string) => getTranslation(key, watchedLanguage);
  const STEPS = getSteps(t);

  // Load customer and property data
  useEffect(() => {
    const loadData = async () => {
      console.log("CreateAgreement: Current location:", location);
      console.log("CreateAgreement: Parsed customerId:", customerId);
      console.log("CreateAgreement: Parsed propertyId:", propertyId);
      
      if (!customerId || !propertyId) {
        console.error("CreateAgreement: Missing required parameters - customerId:", customerId, "propertyId:", propertyId);
        toast({
          title: "Error",
          description: "Customer ID and Property ID are required.",
          variant: "destructive",
        });
        navigate('/customers');
        return;
      }

      try {
        setIsLoading(true);
        
        // Load customer data
        const customerResponse = await apiRequest(`/api/customers/${customerId}`, 'GET');
        if (customerResponse.ok) {
          const customerData = await customerResponse.json();
          setCustomer(customerData);
          setValue('customerId', customerId);
        }

        // Load property data
        const propertyResponse = await apiRequest(`/api/properties/${propertyId}`, 'GET');
        if (propertyResponse.ok) {
          const propertyData = await propertyResponse.json();
          setProperty(propertyData);
        }
      } catch (error) {
        console.error('Error loading data:', error);
        toast({
          title: "Error",
          description: "Failed to load customer and property data.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [customerId, propertyId, navigate, toast, setValue]);

  const fetchSocietyAddresses = async (searchValue: string) => {
    if (searchValue.length < 2) {
      setSocietySuggestions([]);
      setShowSocietySuggestions(false);
      return;
    }

    // Clear previous timeout
    if (addressTimeout.current) {
      clearTimeout(addressTimeout.current);
    }

    addressTimeout.current = setTimeout(async () => {
      try {
        console.log(`Fetching societies for: ${searchValue}`);
        const response = await fetch(`/api/societies?search=${encodeURIComponent(searchValue)}&limit=10`);
        const societies = await response.json() as any[];
        console.log(`Found ${societies.length} societies:`, societies);
        
        setSocietySuggestions(societies.map(society => ({
          id: society.id,
          societyName: society.societyName,
          area: society.area,
          city: society.city,
          pincode: society.pincode,
          state: society.state || "Gujarat"
        })));
        setShowSocietySuggestions(societies.length > 0);
      } catch (error) {
        console.error("Error fetching society addresses:", error);
        setSocietySuggestions([]);
        setShowSocietySuggestions(false);
      }
    }, 300);
  };

  const handleSocietySelect = (society: any, fieldPrefix: string) => {
    if (fieldPrefix === 'ownerDetails.address') {
      setValue('ownerDetails.address.society', society.societyName, { shouldValidate: true, shouldDirty: true });
      setValue('ownerDetails.address.area', society.area, { shouldValidate: true, shouldDirty: true });
      setValue('ownerDetails.address.city', society.city, { shouldValidate: true, shouldDirty: true });
      setValue('ownerDetails.address.pincode', society.pincode, { shouldValidate: true, shouldDirty: true });
      setValue('ownerDetails.address.state', society.state, { shouldValidate: true, shouldDirty: true });
    } else if (fieldPrefix === 'tenantDetails.address') {
      setValue('tenantDetails.address.society', society.societyName, { shouldValidate: true, shouldDirty: true });
      setValue('tenantDetails.address.area', society.area, { shouldValidate: true, shouldDirty: true });
      setValue('tenantDetails.address.city', society.city, { shouldValidate: true, shouldDirty: true });
      setValue('tenantDetails.address.pincode', society.pincode, { shouldValidate: true, shouldDirty: true });
      setValue('tenantDetails.address.state', society.state, { shouldValidate: true, shouldDirty: true });
    }
    
    setShowSocietySuggestions(false);
    
    toast({
      title: "Address Auto-filled",
      description: `Auto-filled from ${society.societyName}`,
    });
  };

  const fetchCustomerInfo = async (searchValue: string, searchBy: 'name' | 'mobile', targetType: 'owner' | 'tenant') => {
    if (!searchValue || searchValue.trim().length < 3) return;
    
    try {
      console.log(`[${targetType.toUpperCase()}] Searching for customer by ${searchBy}: "${searchValue}"`);
      const queryParam = searchBy === 'mobile' ? `mobile=${encodeURIComponent(searchValue)}` : `name=${encodeURIComponent(searchValue)}`;
      const response = await fetch(`/api/customers/search?${queryParam}`);
      
      if (!response.ok) {
        console.log(`[${targetType.toUpperCase()}] No customer data found for ${searchBy}: "${searchValue}"`);
        return;
      }
      
      const customers = await response.json();
      console.log(`[${targetType.toUpperCase()}] Found ${customers.length} customers:`, customers);
      
      if (customers.length > 0) {
        const foundCustomer = customers[0];
        console.log(`[${targetType.toUpperCase()}] Auto-filling data from customer:`, foundCustomer);
        
        // Auto-fill the matching fields
        if (foundCustomer.name) {
          setValue(`${targetType}Details.name`, foundCustomer.name, { shouldValidate: true, shouldDirty: true });
        }
        if (foundCustomer.mobile) {
          setValue(`${targetType}Details.mobile`, foundCustomer.mobile, { shouldValidate: true, shouldDirty: true });
        }
        if (foundCustomer.email) {
          setValue(`${targetType}Details.email`, foundCustomer.email, { shouldValidate: true, shouldDirty: true });
        }
        
        // Auto-fill address if available
        if (foundCustomer.address) {
          if (foundCustomer.address.flatNumber) {
            setValue(`${targetType}Details.address.flatNo`, foundCustomer.address.flatNumber, { shouldValidate: true, shouldDirty: true });
          }
          if (foundCustomer.address.society) {
            setValue(`${targetType}Details.address.society`, foundCustomer.address.society, { shouldValidate: true, shouldDirty: true });
          }
          if (foundCustomer.address.area) {
            setValue(`${targetType}Details.address.area`, foundCustomer.address.area, { shouldValidate: true, shouldDirty: true });
          }
          if (foundCustomer.address.city) {
            setValue(`${targetType}Details.address.city`, foundCustomer.address.city, { shouldValidate: true, shouldDirty: true });
          }
          if (foundCustomer.address.state) {
            setValue(`${targetType}Details.address.state`, foundCustomer.address.state, { shouldValidate: true, shouldDirty: true });
          }
          if (foundCustomer.address.pincode) {
            setValue(`${targetType}Details.address.pincode`, foundCustomer.address.pincode, { shouldValidate: true, shouldDirty: true });
          }
        }
        
        // Force form to re-render
        trigger([
          `${targetType}Details.name`,
          `${targetType}Details.mobile`,
          `${targetType}Details.email`,
          `${targetType}Details.address.flatNo`,
          `${targetType}Details.address.society`,
          `${targetType}Details.address.area`,
          `${targetType}Details.address.city`,
          `${targetType}Details.address.state`,
          `${targetType}Details.address.pincode`
        ]);
        
        toast({
          title: "Auto-filled",
          description: `Auto-filled ${targetType} details from existing customer data`,
        });
      }
    } catch (error) {
      console.error(`[${targetType.toUpperCase()}] Error searching for customer:`, error);
    }
  };

  const copyFromCustomer = () => {
    if (!customer) return;
    
    setValue("tenantDetails.name", customer.name || "", { shouldValidate: true, shouldDirty: true });
    setValue("tenantDetails.mobile", customer.mobile || "", { shouldValidate: true, shouldDirty: true });
    setValue("tenantDetails.email", customer.email || "", { shouldValidate: true, shouldDirty: true });
    
    if (customer.address) {
      setValue("tenantDetails.address.flatNo", customer.address.flatNumber || "", { shouldValidate: true, shouldDirty: true });
      setValue("tenantDetails.address.society", customer.address.society || "", { shouldValidate: true, shouldDirty: true });
      setValue("tenantDetails.address.area", customer.address.area || "", { shouldValidate: true, shouldDirty: true });
      setValue("tenantDetails.address.city", customer.address.city || "", { shouldValidate: true, shouldDirty: true });
      setValue("tenantDetails.address.state", customer.address.state || "", { shouldValidate: true, shouldDirty: true });
      setValue("tenantDetails.address.pincode", customer.address.pincode || "", { shouldValidate: true, shouldDirty: true });
    }
    
    toast({
      title: "Copied",
      description: "Customer details copied to tenant section",
    });
  };

  const copyCustomerAsOwner = () => {
    if (!customer) return;
    
    setValue("ownerDetails.name", customer.name || "", { shouldValidate: true, shouldDirty: true });
    setValue("ownerDetails.mobile", customer.mobile || "", { shouldValidate: true, shouldDirty: true });
    setValue("ownerDetails.email", customer.email || "", { shouldValidate: true, shouldDirty: true });
    
    if (customer.address) {
      setValue("ownerDetails.address.flatNo", customer.address.flatNumber || "", { shouldValidate: true, shouldDirty: true });
      setValue("ownerDetails.address.society", customer.address.society || "", { shouldValidate: true, shouldDirty: true });
      setValue("ownerDetails.address.area", customer.address.area || "", { shouldValidate: true, shouldDirty: true });
      setValue("ownerDetails.address.city", customer.address.city || "", { shouldValidate: true, shouldDirty: true });
      setValue("ownerDetails.address.state", customer.address.state || "", { shouldValidate: true, shouldDirty: true });
      setValue("ownerDetails.address.pincode", customer.address.pincode || "", { shouldValidate: true, shouldDirty: true });
    }
    
    toast({
      title: "Copied",
      description: "Customer details copied to owner section",
    });
  };

  const handleDocumentUpload = (documentType: string, result: UploadResult) => {
    if (result.successful && result.successful[0]) {
      const file = result.successful[0];
      const fileUrl = file.uploadURL || '';
      
      setDocuments(prev => ({
        ...prev,
        [documentType]: fileUrl,
        [`${documentType}_metadata`]: {
          filename: file.name,
          fileType: file.type || 'application/octet-stream',
          size: file.size || 0
        }
      }));
      
      toast({
        title: "Upload Successful",
        description: `${file.name} uploaded successfully`,
      });
    }
  };

  const addClause = () => {
    const currentClauses = watch("additionalClauses") || [];
    setValue("additionalClauses", [...currentClauses, ""]);
  };

  const removeClause = (index: number) => {
    const currentClauses = watch("additionalClauses") || [];
    setValue("additionalClauses", currentClauses.filter((_, i) => i !== index));
  };

  const canProceed = (step: number): boolean => {
    const formData = watch();
    
    switch (step) {
      case 1:
        return !!formData.customerId;
      case 2:
        return !!(formData.ownerDetails?.name && formData.ownerDetails?.mobile);
      case 3:
        return !!(formData.tenantDetails?.name && formData.tenantDetails?.mobile);
      case 4:
        return !!(formData.propertyDetails?.type && formData.rentalTerms?.monthlyRent && formData.rentalTerms?.startDate && formData.rentalTerms?.endDate);
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (currentStep < 5 && canProceed(currentStep)) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const saveDraft = async (data: AgreementFormData) => {
    try {
      const agreementData = {
        customerId: customerId,
        propertyId: propertyId,
        language: data.language || 'english',
        agreementDate: new Date().toISOString().split('T')[0],
        startDate: data.rentalTerms?.startDate,
        endDate: data.rentalTerms?.endDate,
        status: 'draft',
        ownerDetails: data.ownerDetails,
        tenantDetails: data.tenantDetails,
        propertyDetails: {
          ...data.propertyDetails,
          ...property ? {
            flatNumber: property.flatNumber,
            society: property.society,
            area: property.area,
            city: property.city,
            state: property.state,
            pincode: property.pincode,
            purpose: property.purpose,
          } : {}
        },
        rentalTerms: data.rentalTerms,
        additionalClauses: data.additionalClauses || [],
      };

      const response = await apiRequest('/api/agreements', 'POST', agreementData);

      if (response.ok) {
        const createdAgreement = await response.json();
        toast({
          title: "Draft Saved",
          description: "Agreement draft saved successfully!",
        });
        setCreatedAgreementId(createdAgreement.id);
      } else {
        throw new Error('Failed to save draft');
      }
    } catch (error) {
      console.error('Error saving draft:', error);
      toast({
        title: "Error",
        description: "Failed to save draft. Please try again.",
        variant: "destructive",
      });
    }
  };

  const createAgreement = async (data: AgreementFormData) => {
    try {
      setPdfState('creating');
      
      const agreementData = {
        customerId: customerId,
        propertyId: propertyId,
        language: data.language || 'english',
        agreementDate: new Date().toISOString().split('T')[0],
        startDate: data.rentalTerms?.startDate,
        endDate: data.rentalTerms?.endDate,
        status: 'active',
        ownerDetails: data.ownerDetails,
        tenantDetails: data.tenantDetails,
        propertyDetails: {
          ...data.propertyDetails,
          ...property ? {
            flatNumber: property.flatNumber,
            society: property.society,
            area: property.area,
            city: property.city,
            state: property.state,
            pincode: property.pincode,
            purpose: property.purpose,
          } : {}
        },
        rentalTerms: data.rentalTerms,
        additionalClauses: data.additionalClauses || [],
        documents: documents,
      };

      const response = await apiRequest('/api/agreements', 'POST', agreementData);

      if (response.ok) {
        const createdAgreement = await response.json();
        setCreatedAgreementId(createdAgreement.id);
        
        // Navigate to agreement editor for PDF generation
        const editorUrl = `/agreement-editor?agreementId=${createdAgreement.id}&returnTo=${encodeURIComponent(`/customers/${customerId}/properties/${propertyId}/agreements`)}`;
        window.open(editorUrl, '_blank');
        
        setPdfState('ready');
        setPdfData({
          html: '',
          agreementNumber: createdAgreement.agreementNumber
        });
        
        toast({
          title: "Success",
          description: "Agreement created successfully!",
        });
      } else {
        throw new Error('Failed to create agreement');
      }
    } catch (error) {
      console.error('Error creating agreement:', error);
      toast({
        title: "Error",
        description: "Failed to create agreement. Please try again.",
        variant: "destructive",
      });
      setPdfState('idle');
    }
  };

  const handleGoBack = () => {
    if (customerId && propertyId) {
      navigate(`/customers/${customerId}/properties/${propertyId}/agreements`);
    } else {
      navigate('/customers');
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800">{t("step1Title")}</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="customerId">{t("selectCustomer")} <span className="text-red-500">*</span></Label>
                <div className="p-3 border border-gray-200 rounded-md bg-gray-50">
                  <div className="font-medium">{customer?.name}</div>
                  <div className="text-sm text-gray-600">{customer?.mobile}</div>
                  <div className="text-sm text-gray-600">{customer?.email}</div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Customer selected from URL parameters
                </p>
              </div>

              <div>
                <Label htmlFor="language">{t("selectLanguage")}</Label>
                <Select value={watchedLanguage} onValueChange={(value) => setValue("language", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">{t("step2Title")}</h3>
              <Button
                type="button"
                variant="outline"
                onClick={copyCustomerAsOwner}
                disabled={!watchedCustomerId}
                className={!watchedCustomerId ? "opacity-50" : ""}
              >
                <Copy className="mr-2 h-4 w-4" />
                {t("copyCustomerDetails")}
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="ownerName">{t("ownerName")}</Label>
                <Input 
                  {...register("ownerDetails.name", { 
                    required: "Name is required",
                    onChange: (e) => {
                      const name = e.target.value;
                      // Clear previous timeout
                      if (mobileTimeout.current) {
                        clearTimeout(mobileTimeout.current);
                      }
                      // Auto-lookup when user finishes typing name (3+ chars)
                      if (name.trim().length >= 3) {
                        mobileTimeout.current = setTimeout(() => {
                          fetchCustomerInfo(name, 'name', 'owner');
                        }, 800);
                      }
                    }
                  })} 
                  placeholder={t("ownerName")}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter name to auto-fill mobile and address
                </p>
                {errors.ownerDetails?.name && (
                  <p className="text-sm text-red-600 mt-1">{errors.ownerDetails.name.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="ownerMobile">{t("ownerMobile")}</Label>
                <Input 
                  {...register("ownerDetails.mobile", { 
                    required: "Mobile is required",
                    onChange: (e) => {
                      const mobile = e.target.value;
                      // Clear previous timeout to prevent multiple lookups
                      if (mobileTimeout.current) {
                        clearTimeout(mobileTimeout.current);
                      }
                      // Auto-lookup when user finishes typing 10 digits
                      if (mobile.replace(/\D/g, '').length === 10) {
                        mobileTimeout.current = setTimeout(() => {
                          fetchCustomerInfo(mobile, 'mobile', 'owner');
                        }, 500);
                      }
                    }
                  })} 
                  placeholder={t("mobileNumberPlaceholder")}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter mobile number to auto-fill name and email
                </p>
              </div>
              <div>
                <Label htmlFor="ownerAge">{t("ownerAge")}</Label>
                <Input 
                  type="number" 
                  min="18" 
                  max="100" 
                  step="1"
                  {...register("ownerDetails.age", { 
                    required: "Age is required",
                    min: { value: 18, message: "Age must be at least 18" },
                    max: { value: 100, message: "Age must be less than 100" }
                  })} 
                  placeholder={t("agePlaceholder")}
                  onWheel={(e) => e.currentTarget.blur()} // Prevent scroll wheel issues
                />
                {errors.ownerDetails?.age && (
                  <p className="text-sm text-red-600 mt-1">{errors.ownerDetails.age.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="ownerOccupation">{t("ownerOccupation")}</Label>
                <Input {...register("ownerDetails.occupation")} placeholder={t("occupationPlaceholder")} />
              </div>
              <div>
                <Label htmlFor="ownerAadhar">{t("ownerAadhar")}</Label>
                <Input {...register("ownerDetails.aadhar")} placeholder={t("aadharPlaceholder")} />
              </div>
              <div>
                <Label htmlFor="ownerPan">{t("ownerPan")}</Label>
                <Input {...register("ownerDetails.pan")} placeholder={t("panPlaceholder")} />
              </div>
            </div>

            {/* Address Section */}
            <div>
              <h4 className="text-md font-semibold text-gray-800 mb-4">{t("addressDetails")}</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>{t("flatNo")}</Label>
                  <Input {...register("ownerDetails.address.flatNo", { required: "Flat/House No. is required" })} />
                </div>
                <div className="relative">
                  <Label>{t("society")}</Label>
                  <Input 
                    {...register("ownerDetails.address.society", { 
                      required: "Society/Apartment name is required",
                      onChange: (e) => {
                        const value = e.target.value;
                        console.log(`Owner society input changed to: "${value}"`);
                        fetchSocietyAddresses(value);
                      }
                    })}
                    placeholder={t("startTypingSociety")}
                    onBlur={() => setTimeout(() => setShowSocietySuggestions(false), 200)}
                  />
                  {showSocietySuggestions && societySuggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                      {societySuggestions.map((society) => (
                        <div
                          key={society.id}
                          className="p-3 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
                          onClick={() => handleSocietySelect(society, 'ownerDetails.address')}
                        >
                          <div className="font-medium">{society.societyName}</div>
                          <div className="text-sm text-gray-600">{society.area}, {society.city} - {society.pincode}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Start typing to see address suggestions
                  </p>
                </div>
                <div>
                  <Label>{t("area")}</Label>
                  <Input {...register("ownerDetails.address.area", { required: "Area is required" })} />
                </div>
                <div>
                  <Label>{t("city")}</Label>
                  <Input {...register("ownerDetails.address.city", { required: "City is required" })} />
                </div>
                <div>
                  <Label>{t("state")}</Label>
                  <Input {...register("ownerDetails.address.state", { required: "State is required" })} placeholder="e.g., Gujarat, Maharashtra" />
                </div>
                <div>
                  <Label>{t("pincode")}</Label>
                  <Input {...register("ownerDetails.address.pincode", { required: "Pincode is required" })} placeholder="e.g., 380001" />
                </div>
              </div>
            </div>

            {/* Document Upload */}
            <div>
              <h4 className="text-md font-semibold text-gray-800 mb-4">{t("documents")} {t("optional")}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">{t("aadharCard")}</Label>
                  {documents.ownerAadhar ? (
                    <FilePreview
                      fileUrl={documents.ownerAadhar}
                      fileName={documents.ownerAadhar_metadata?.filename || "Owner Aadhar Card"}
                      fileType={documents.ownerAadhar_metadata?.fileType}
                      onRemove={() => setDocuments(prev => ({ ...prev, ownerAadhar: "", ownerAadhar_metadata: undefined }))}
                      className="w-full"
                    />
                  ) : (
                    <LocalFileUploader
                      maxSize={5242880} // 5MB
                      onUploadComplete={(result) => handleDocumentUpload("ownerAadhar", result)}
                      className="w-full"
                    >
                      <div className="border-2 border-dashed rounded-lg p-4 text-center transition-all cursor-pointer border-gray-300 bg-gray-50 hover:bg-gray-100">
                        <div className="flex flex-col items-center space-y-2">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-200 text-gray-500">
                            <Plus className="w-4 h-4" />
                          </div>
                          <p className="text-sm text-gray-600">{t("uploadAadharCard")}</p>
                          <p className="text-xs text-gray-500">{t("fileSizeNote")}</p>
                        </div>
                      </div>
                    </LocalFileUploader>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">{t("panCardLabel")}</Label>
                  {documents.ownerPan ? (
                    <FilePreview
                      fileUrl={documents.ownerPan}
                      fileName={documents.ownerPan_metadata?.filename || "Owner PAN Card"}
                      fileType={documents.ownerPan_metadata?.fileType}
                      onRemove={() => setDocuments(prev => ({ ...prev, ownerPan: "", ownerPan_metadata: undefined }))}
                      className="w-full"
                    />
                  ) : (
                    <LocalFileUploader
                      maxSize={5242880} // 5MB
                      onUploadComplete={(result) => handleDocumentUpload("ownerPan", result)}
                      className="w-full"
                    >
                      <div className="border-2 border-dashed rounded-lg p-4 text-center transition-all cursor-pointer border-gray-300 bg-gray-50 hover:bg-gray-100">
                        <div className="flex flex-col items-center space-y-2">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-200 text-gray-500">
                            <Plus className="w-4 h-4" />
                          </div>
                          <p className="text-sm text-gray-600">{t("uploadPanCard")}</p>
                          <p className="text-xs text-gray-500">{t("fileSizeNote")}</p>
                        </div>
                      </div>
                    </LocalFileUploader>
                  )}
                </div>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">{t("step3Title")}</h3>
              <Button
                type="button"
                variant="outline"
                onClick={copyFromCustomer}
                disabled={!watchedCustomerId}
                className={!watchedCustomerId ? "opacity-50" : ""}
              >
                <Copy className="mr-2 h-4 w-4" />
                {t("copyFromCustomer")}
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label>{t("fullName")}</Label>
                <Input 
                  {...register("tenantDetails.name", { 
                    required: "Name is required",
                    onChange: (e) => {
                      const name = e.target.value;
                      // Clear previous timeout
                      if (mobileTimeout.current) {
                        clearTimeout(mobileTimeout.current);
                      }
                      // Auto-lookup when user finishes typing name (3+ chars)
                      if (name.trim().length >= 3) {
                        mobileTimeout.current = setTimeout(() => {
                          fetchCustomerInfo(name, 'name', 'tenant');
                        }, 800);
                      }
                    }
                  })} 
                  placeholder={t("enterTenantFullName")}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter name to auto-fill mobile and address
                </p>
              </div>
              <div>
                <Label>{t("mobileNumber")}</Label>
                <Input 
                  {...register("tenantDetails.mobile", { 
                    required: "Mobile is required",
                    onChange: (e) => {
                      const mobile = e.target.value;
                      // Clear previous timeout to prevent multiple lookups
                      if (mobileTimeout.current) {
                        clearTimeout(mobileTimeout.current);
                      }
                      // Auto-lookup when user finishes typing 10 digits
                      if (mobile.replace(/\D/g, '').length === 10) {
                        mobileTimeout.current = setTimeout(() => {
                          fetchCustomerInfo(mobile, 'mobile', 'tenant');
                        }, 500);
                      }
                    }
                  })} 
                  placeholder={t("enterMobileNumber")}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter mobile number to auto-fill name and email
                </p>
              </div>
              <div>
                <Label>{t("age")}</Label>
                <Input 
                  type="number" 
                  min="18" 
                  max="100" 
                  step="1"
                  {...register("tenantDetails.age", { 
                    required: "Age is required",
                    min: { value: 18, message: "Age must be at least 18" },
                    max: { value: 100, message: "Age must be less than 100" }
                  })} 
                  placeholder={t("agePlaceholder")}
                  onWheel={(e) => e.currentTarget.blur()}
                />
              </div>
              <div>
                <Label>{t("occupation")}</Label>
                <Input {...register("tenantDetails.occupation")} placeholder={t("occupationPlaceholder")} />
              </div>
              <div>
                <Label>{t("aadharNumber")}</Label>
                <Input {...register("tenantDetails.aadhar")} placeholder={t("aadharPlaceholder")} />
              </div>
              <div>
                <Label>{t("panNumber")}</Label>
                <Input {...register("tenantDetails.pan")} placeholder={t("panPlaceholder")} />
              </div>
            </div>

            {/* Tenant Address Section */}
            <div>
              <h4 className="text-md font-semibold text-gray-800 mb-4">{t("addressDetails")}</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>{t("flatNo")}</Label>
                  <Input {...register("tenantDetails.address.flatNo", { required: "Flat/House No. is required" })} />
                </div>
                <div className="relative">
                  <Label>{t("society")}</Label>
                  <Input 
                    {...register("tenantDetails.address.society", { 
                      required: "Society/Apartment name is required",
                      onChange: (e) => {
                        const value = e.target.value;
                        console.log(`Tenant society input changed to: "${value}"`);
                        fetchSocietyAddresses(value);
                      }
                    })}
                    placeholder={t("startTypingSociety")}
                    onBlur={() => setTimeout(() => setShowSocietySuggestions(false), 200)}
                  />
                  {showSocietySuggestions && societySuggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                      {societySuggestions.map((society) => (
                        <div
                          key={society.id}
                          className="p-3 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
                          onClick={() => handleSocietySelect(society, 'tenantDetails.address')}
                        >
                          <div className="font-medium">{society.societyName}</div>
                          <div className="text-sm text-gray-600">{society.area}, {society.city} - {society.pincode}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Start typing to see address suggestions
                  </p>
                </div>
                <div>
                  <Label>{t("area")}</Label>
                  <Input {...register("tenantDetails.address.area", { required: "Area is required" })} />
                </div>
                <div>
                  <Label>{t("city")}</Label>
                  <Input {...register("tenantDetails.address.city", { required: "City is required" })} />
                </div>
                <div>
                  <Label>{t("state")}</Label>
                  <Input {...register("tenantDetails.address.state", { required: "State is required" })} placeholder="e.g., Gujarat, Maharashtra" />
                </div>
                <div>
                  <Label>{t("pincode")}</Label>
                  <Input {...register("tenantDetails.address.pincode", { required: "Pincode is required" })} placeholder="e.g., 380001" />
                </div>
              </div>
            </div>

            {/* Tenant Document Upload */}
            <div>
              <h4 className="text-md font-semibold text-gray-800 mb-4">{t("documents")} {t("optional")}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">{t("aadharCard")}</Label>
                  {documents.tenantAadhar ? (
                    <FilePreview
                      fileUrl={documents.tenantAadhar}
                      fileName={documents.tenantAadhar_metadata?.filename || "Tenant Aadhar Card"}
                      fileType={documents.tenantAadhar_metadata?.fileType}
                      onRemove={() => setDocuments(prev => ({ ...prev, tenantAadhar: "", tenantAadhar_metadata: undefined }))}
                      className="w-full"
                    />
                  ) : (
                    <LocalFileUploader
                      maxSize={5242880} // 5MB
                      onUploadComplete={(result) => handleDocumentUpload("tenantAadhar", result)}
                      className="w-full"
                    >
                      <div className="border-2 border-dashed rounded-lg p-4 text-center transition-all cursor-pointer border-gray-300 bg-gray-50 hover:bg-gray-100">
                        <div className="flex flex-col items-center space-y-2">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-200 text-gray-500">
                            <Plus className="w-4 h-4" />
                          </div>
                          <p className="text-sm text-gray-600">{t("uploadAadharCard")}</p>
                          <p className="text-xs text-gray-500">{t("fileSizeNote")}</p>
                        </div>
                      </div>
                    </LocalFileUploader>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">{t("panCardLabel")}</Label>
                  {documents.tenantPan ? (
                    <FilePreview
                      fileUrl={documents.tenantPan}
                      fileName={documents.tenantPan_metadata?.filename || "Tenant PAN Card"}
                      fileType={documents.tenantPan_metadata?.fileType}
                      onRemove={() => setDocuments(prev => ({ ...prev, tenantPan: "", tenantPan_metadata: undefined }))}
                      className="w-full"
                    />
                  ) : (
                    <LocalFileUploader
                      maxSize={5242880} // 5MB
                      onUploadComplete={(result) => handleDocumentUpload("tenantPan", result)}
                      className="w-full"
                    >
                      <div className="border-2 border-dashed rounded-lg p-4 text-center transition-all cursor-pointer border-gray-300 bg-gray-50 hover:bg-gray-100">
                        <div className="flex flex-col items-center space-y-2">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-200 text-gray-500">
                            <Plus className="w-4 h-4" />
                          </div>
                          <p className="text-sm text-gray-600">{t("uploadPanCard")}</p>
                          <p className="text-xs text-gray-500">{t("fileSizeNote")}</p>
                        </div>
                      </div>
                    </LocalFileUploader>
                  )}
                </div>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800">{t("step4Title")}</h3>
            
            <div>
              <h4 className="text-md font-semibold text-gray-800 mb-4">{t("propertyInformation")}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>{t("propertyType")}</Label>
                  <Input {...register("propertyDetails.type", { required: "Property type is required" })} placeholder="e.g., 2BHK Apartment" />
                </div>
                <div>
                  <Label>{t("placeOfAgreement")}</Label>
                  <Input {...register("propertyDetails.place")} placeholder={t("cityName")} />
                </div>
              </div>
              
              <div className="mt-4">
                <h5 className="text-sm font-semibold text-gray-700 mb-3">{t("propertyAddress")}</h5>
                <div className="p-4 border border-gray-200 rounded-md bg-gray-50">
                  <div className="font-medium">{property?.flatNumber} {property?.society}</div>
                  <div className="text-sm text-gray-600">{property?.area}, {property?.city} - {property?.pincode}</div>
                  <div className="text-sm text-gray-600">{property?.state}</div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Property address loaded from URL parameters
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>{t("areaInSqFt")}</Label>
                  <Input 
                    type="number" 
                    min="1"
                    step="1"
                    {...register("propertyDetails.areaInSqFt", {
                      min: { value: 1, message: "Area must be at least 1 sq ft" }
                    })} 
                    placeholder="e.g., 1200"
                    onWheel={(e) => e.currentTarget.blur()}
                  />
                </div>
                <div>
                  <Label>{t("purpose")}</Label>
                  <Select 
                    value={watch("propertyDetails.purpose")} 
                    onValueChange={(value) => setValue("propertyDetails.purpose", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("selectPurpose")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="residential">{t("residential")}</SelectItem>
                      <SelectItem value="commercial">{t("commercial")}</SelectItem>
                      <SelectItem value="mixed">{t("mixedUse")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("furnishedStatus")}</Label>
                  <Select 
                    value={watch("propertyDetails.furnishedStatus")} 
                    onValueChange={(value) => setValue("propertyDetails.furnishedStatus", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("selectStatus")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fully_furnished">Fully Furnished</SelectItem>
                      <SelectItem value="semi_furnished">Semi Furnished</SelectItem>
                      <SelectItem value="unfurnished">Unfurnished</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label>{t("additionalItems")}</Label>
                  <Textarea 
                    {...register("propertyDetails.additionalItems")} 
                    rows={3} 
                    placeholder={t("listItems")}
                  />
                </div>
              </div>
            </div>

            {/* Property Documents Upload Section */}
            <div className="space-y-4">
              <h4 className="text-md font-semibold text-gray-800 mb-4">Property Documents (Optional)</h4>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Property Documents (NOC, Sale Deed, etc.)</Label>
                  {documents.propertyDocuments ? (
                    <FilePreview
                      fileUrl={documents.propertyDocuments}
                      fileName={documents.propertyDocuments_metadata?.filename || "Property Documents"}
                      fileType={documents.propertyDocuments_metadata?.fileType}
                      onRemove={() => setDocuments(prev => ({ ...prev, propertyDocuments: "", propertyDocuments_metadata: undefined }))}
                      className="w-full"
                    />
                  ) : (
                    <LocalFileUploader
                      maxSize={5242880} // 5MB
                      onUploadComplete={(result) => handleDocumentUpload("propertyDocuments", result)}
                      className="w-full"
                    >
                      <div className="border-2 border-dashed rounded-lg p-6 text-center transition-all cursor-pointer border-gray-300 bg-gray-50 hover:bg-gray-100">
                        <div className="flex flex-col items-center space-y-2">
                          <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                            <Plus className="w-6 h-6 text-gray-500" />
                          </div>
                          <p className="text-sm text-gray-600">Click to upload property documents</p>
                          <p className="text-xs text-gray-500">NOC, Sale Deed, Property Papers (Max 5MB)</p>
                        </div>
                      </div>
                    </LocalFileUploader>
                  )}
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-md font-semibold text-gray-800 mb-4">{t("agreementDuration")}</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>{t("agreementStartDate")}</Label>
                  <Input 
                    type="date" 
                    {...register("rentalTerms.startDate", { required: "Start date is required" })}
                    onChange={(e) => {
                      setValue("rentalTerms.startDate", e.target.value);
                      // Auto-calculate end date if 11 months tenure is selected
                      if (watch("rentalTerms.tenure") === "11_months" && e.target.value) {
                        const startDate = new Date(e.target.value);
                        const endDate = new Date(startDate);
                        endDate.setMonth(endDate.getMonth() + 11);
                        setValue("rentalTerms.endDate", endDate.toISOString().split('T')[0]);
                      }
                    }}
                  />
                  {errors.rentalTerms?.startDate && (
                    <p className="text-sm text-red-600 mt-1">{errors.rentalTerms.startDate.message}</p>
                  )}
                </div>
                <div>
                  <Label>{t("agreementTenure")}</Label>
                  <Select 
                    value={watch("rentalTerms.tenure")} 
                    onValueChange={(value) => {
                      setValue("rentalTerms.tenure", value as "11_months" | "custom");
                      // Auto-calculate end date if 11 months is selected and start date exists
                      if (value === "11_months" && watch("rentalTerms.startDate")) {
                        const startDate = new Date(watch("rentalTerms.startDate"));
                        const endDate = new Date(startDate);
                        endDate.setMonth(endDate.getMonth() + 11);
                        setValue("rentalTerms.endDate", endDate.toISOString().split('T')[0]);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("selectTenure")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="11_months">{t("months11")}</SelectItem>
                      <SelectItem value="custom">{t("customDuration")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("agreementEndDate")}</Label>
                  <Input 
                    type="date" 
                    {...register("rentalTerms.endDate", { required: "End date is required" })}
                    disabled={watch("rentalTerms.tenure") === "11_months"}
                    className={watch("rentalTerms.tenure") === "11_months" ? "bg-gray-100" : ""}
                  />
                  {errors.rentalTerms?.endDate && (
                    <p className="text-sm text-red-600 mt-1">{errors.rentalTerms.endDate.message}</p>
                  )}
                  {watch("rentalTerms.tenure") === "11_months" && (
                    <p className="text-xs text-gray-500 mt-1">{t("autoCalculated")}</p>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div>
                  <Label>{t("monthlyRentAmount")}</Label>
                  <Input 
                    type="number" 
                    min="1"
                    step="1"
                    {...register("rentalTerms.monthlyRent", { 
                      required: "Monthly rent is required",
                      min: { value: 1, message: "Rent must be at least ₹1" }
                    })} 
                    placeholder="e.g., 15000"
                    onWheel={(e) => e.currentTarget.blur()}
                  />
                  {errors.rentalTerms?.monthlyRent && (
                    <p className="text-sm text-red-600 mt-1">{errors.rentalTerms.monthlyRent.message}</p>
                  )}
                </div>
                <div>
                  <Label>{t("securityDeposit")}</Label>
                  <Input 
                    type="number" 
                    min="0"
                    step="1"
                    {...register("rentalTerms.deposit", { 
                      min: { value: 0, message: "Deposit cannot be negative" }
                    })} 
                    placeholder="e.g., 30000"
                    onWheel={(e) => e.currentTarget.blur()}
                  />
                </div>
                <div>
                  <Label>{t("dueDate")}</Label>
                  <Input 
                    type="number" 
                    min="1" 
                    max="31"
                    step="1"
                    {...register("rentalTerms.dueDate", {
                      min: { value: 1, message: "Due date must be between 1-31" },
                      max: { value: 31, message: "Due date must be between 1-31" }
                    })} 
                    placeholder="e.g., 5"
                    onWheel={(e) => e.currentTarget.blur()}
                  />
                </div>
                <div>
                  <Label>{t("maintenanceCharge")}</Label>
                  <Select 
                    value={watch("rentalTerms.maintenance")} 
                    onValueChange={(value) => setValue("rentalTerms.maintenance", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("selectMaintenance")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="included">{t("included")}</SelectItem>
                      <SelectItem value="excluded">{t("excluded")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("noticePeriod")}</Label>
                  <Input 
                    type="number" 
                    min="1"
                    step="1"
                    {...register("rentalTerms.noticePeriod", {
                      required: "Notice period is required",
                      min: { value: 1, message: "Notice period must be at least 1 month" }
                    })} 
                    placeholder="e.g., 1"
                    onWheel={(e) => e.currentTarget.blur()}
                  />
                  {errors.rentalTerms?.noticePeriod && (
                    <p className="text-sm text-red-600 mt-1">{errors.rentalTerms.noticePeriod.message}</p>
                  )}
                </div>
                <div>
                  <Label>{t("furniture")}</Label>
                  <Textarea 
                    {...register("rentalTerms.furniture")} 
                    rows={2} 
                    placeholder={t("furniturePlaceholder")}
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800">{t("step5Title")}</h3>
            
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-md font-semibold text-gray-800">{t("additionalClauses")}</h4>
                <Button type="button" onClick={addClause} size="sm" className="bg-green-600 hover:bg-green-700">
                  <Plus className="mr-2 h-4 w-4" />
                  {t("addClause")}
                </Button>
              </div>
              {watch("additionalClauses")?.map((clause, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <Label>{t("clause")} {index + 1}</Label>
                      <Textarea
                        {...register(`additionalClauses.${index}` as const)}
                        rows={2}
                        placeholder={t("enterAdditionalTerms")}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeClause(index)}
                      className="ml-4 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Agreement Summary */}
            <Card className="bg-gray-50">
              <CardContent className="p-6">
                <h4 className="text-md font-semibold text-gray-800 mb-4">{t("agreementSummary")}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">{t("customer")}:</span>
                    <span className="ml-2 font-medium">
                      {customer?.name || t("notSelected")}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">{t("language")}:</span>
                    <span className="ml-2 font-medium">
                      {LANGUAGES.find(l => l.value === watchedLanguage)?.label || "English"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">{t("ownerName")}:</span>
                    <span className="ml-2 font-medium">
                      {watch("ownerDetails.name") || t("notFilled")}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">{t("tenantName")}:</span>
                    <span className="ml-2 font-medium">
                      {watch("tenantDetails.name") || t("notFilled")}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">{t("propertyType")}:</span>
                    <span className="ml-2 font-medium">
                      {watch("propertyDetails.type") || t("notFilled")}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">{t("monthlyRent")}:</span>
                    <span className="ml-2 font-medium">
                      ₹{watch("rentalTerms.monthlyRent") || 0}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">{t("securityDeposit")}:</span>
                    <span className="ml-2 font-medium">
                      ₹{watch("rentalTerms.deposit") || 0}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">{t("agreementDuration")}:</span>
                    <span className="ml-2 font-medium">
                      {watch("rentalTerms.startDate")} to {watch("rentalTerms.endDate")}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* PDF Generation Section */}
            <Card className="bg-blue-50">
              <CardContent className="p-6 text-center">
                <h4 className="text-md font-semibold text-gray-800 mb-4">{t("finalStep")}</h4>
                <p className="text-sm text-gray-600 mb-6">
                  {t("reviewAndGenerate")}
                </p>
                
                <Button
                  type="button"
                  onClick={handleSubmit(createAgreement)}
                  disabled={pdfState === 'creating' || !canProceed(4)}
                  className={`px-8 py-3 text-lg font-semibold transition-all duration-200 ${
                    pdfState === 'idle' 
                      ? "bg-blue-600 hover:bg-blue-700 text-white" 
                      : pdfState === 'creating'
                      ? "bg-blue-400 cursor-not-allowed text-white"
                      : "bg-green-600 hover:bg-green-700 text-white"
                  }`}
                  aria-live="polite"
                >
                  {pdfState === 'creating' && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                  {pdfState === 'idle' && "Edit & Generate PDF"}
                  {pdfState === 'creating' && "Preparing Editor..."}
                </Button>
                {pdfState === 'ready' && pdfData && (
                  <p className="text-sm text-green-600 mt-2 text-center">
                    ✓ Agreement {pdfData.agreementNumber} created successfully! Click above to download the PDF.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  const progress = (currentStep / STEPS.length) * 100;

  if (isLoading) {
    return (
      <AdminLayout title="Create Agreement" subtitle="Loading...">
        <div className="flex items-center justify-center min-h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </AdminLayout>
    );
  }

  if (!customer || !property) {
    return (
      <AdminLayout title="Create Agreement" subtitle="Data not found">
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Customer or Property Not Found</h3>
            <p className="text-muted-foreground mb-4">
              Unable to load the required customer and property information.
            </p>
            <Button onClick={handleGoBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Create Agreement" subtitle={`For ${customer.name} - ${property.flatNumber} ${property.society}`}>
      <Card className="max-w-5xl mx-auto">
        <CardHeader className="bg-gray-800 text-white p-6">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-bold">
              Create New Agreement
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGoBack}
              className="text-white hover:bg-white/20 border border-white/30"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Agreements
            </Button>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-6">
            <Progress value={progress} className="mb-4" />
            <div className="flex items-center justify-between text-sm">
              {STEPS.map((step) => (
                <div key={step.id} className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-medium ${
                      step.id <= currentStep
                        ? "bg-blue-600 text-white"
                        : "bg-gray-600 text-gray-300"
                    }`}
                  >
                    {step.id}
                  </div>
                  <span className="ml-2">{step.title}</span>
                </div>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          <form onSubmit={handleSubmit(() => {})} className="space-y-6">
            {renderStep()}
            
            <div className="flex items-center justify-between pt-6 border-t border-gray-200">
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 1}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("previous")}
              </Button>
              <div className="flex space-x-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGoBack}
                  className="text-gray-600 hover:bg-gray-100"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSubmit(saveDraft)}
                  className="bg-amber-600 text-white hover:bg-amber-700"
                >
                  {t("saveDraft")}
                </Button>
                {currentStep < 5 && (
                  <Button 
                    type="button" 
                    onClick={nextStep} 
                    disabled={!canProceed(currentStep)}
                    className={`${
                      canProceed(currentStep) 
                        ? "bg-blue-600 hover:bg-blue-700" 
                        : "bg-gray-400 cursor-not-allowed"
                    }`}
                  >
                    {t("next")}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <CustomerModal
        isOpen={showCustomerModal}
        onClose={() => setShowCustomerModal(false)}
        onCustomerCreated={(customerId) => {
          setValue("customerId", customerId);
          setShowCustomerModal(false);
        }}
      />
    </AdminLayout>
  );
}