import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { X, ArrowLeft, ArrowRight, Plus, Trash2, Copy, Download } from "lucide-react";
import { useForm } from "react-hook-form";
import { useCustomers } from "@/hooks/useCustomers";
import { useSocieties } from "@/hooks/useSocieties";
import { useAddresses } from "@/hooks/useAddresses";
import { ObjectUploader } from "@/components/ObjectUploader";
import CustomerModal from "@/components/CustomerModal";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getTranslation } from "@/lib/i18n";
import type { UploadResult } from "@uppy/core";
import type { OwnerDetails, TenantDetails, PropertyDetails, RentalTerms } from "@shared/schema";

interface AgreementWizardProps {
  isOpen: boolean;
  onClose: () => void;
  agreementId?: string; // For editing existing agreements
}

interface AgreementFormData {
  customerId: string;
  language: string;
  ownerDetails: OwnerDetails;
  tenantDetails: TenantDetails;
  propertyDetails: PropertyDetails;
  rentalTerms: RentalTerms;
  additionalClauses: string[];
}

const STEPS = [
  { id: 1, title: "Customer & Language" },
  { id: 2, title: "Landlord Details" },
  { id: 3, title: "Tenant Details" },
  { id: 4, title: "Property Details" },
  { id: 5, title: "Finalize" },
];

const LANGUAGES = [
  { value: "english", label: "English" },
  { value: "hindi", label: "Hindi (हिन्दी)" },
  { value: "gujarati", label: "Gujarati (ગુજરાતી)" },
  { value: "tamil", label: "Tamil (தமிழ்)" },
  { value: "marathi", label: "Marathi (मराठी)" },
];

export default function AgreementWizard({ isOpen, onClose, agreementId }: AgreementWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [documents, setDocuments] = useState<Record<string, string>>({});
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
  const { toast } = useToast();

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<AgreementFormData>({
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

  const { data: customersData } = useCustomers({ search: "", limit: 100 });
  const { data: societies } = useSocieties({ limit: 100 });
  
  // Address search hooks
  const { data: ownerAddresses = [] } = useAddresses({ search: addressSearch.owner });
  const { data: tenantAddresses = [] } = useAddresses({ search: addressSearch.tenant });
  const { data: propertyAddresses = [] } = useAddresses({ search: addressSearch.property });

  const watchedLanguage = watch("language");
  const watchedCustomerId = watch("customerId");
  const formData = watch();

  // Get current language for translations
  const currentLanguage = watchedLanguage || "english";
  const t = (key: string) => getTranslation(currentLanguage, key);

  // Helper functions for address autocomplete
  const handleAddressSelect = (addressType: 'owner' | 'tenant' | 'property', address: any) => {
    const fieldPrefix = addressType === 'owner' ? 'ownerDetails.address' : 
                       addressType === 'tenant' ? 'tenantDetails.address' : 
                       'propertyDetails.address';
    
    setValue(`${fieldPrefix}.society`, address.society);
    setValue(`${fieldPrefix}.area`, address.area);
    setValue(`${fieldPrefix}.city`, address.city);
    setValue(`${fieldPrefix}.pincode`, address.pincode);
    
    setShowAddressSuggestions(prev => ({ ...prev, [addressType]: false }));
    setAddressSearch(prev => ({ ...prev, [addressType]: address.society }));
  };

  const handleSocietyInputChange = (addressType: 'owner' | 'tenant' | 'property', value: string) => {
    const fieldPrefix = addressType === 'owner' ? 'ownerDetails.address' : 
                       addressType === 'tenant' ? 'tenantDetails.address' : 
                       'propertyDetails.address';
    
    setValue(`${fieldPrefix}.society`, value);
    setAddressSearch(prev => ({ ...prev, [addressType]: value }));
    setShowAddressSuggestions(prev => ({ ...prev, [addressType]: value.length >= 2 }));
  };

  const saveAddressWhenSubmitting = async () => {
    const addressesToSave = [];
    
    // Check owner address
    const ownerAddress = formData.ownerDetails?.address;
    if (ownerAddress?.society && ownerAddress?.area && ownerAddress?.city && ownerAddress?.pincode) {
      addressesToSave.push({
        society: ownerAddress.society,
        area: ownerAddress.area,
        city: ownerAddress.city,
        state: ownerAddress.state || "Gujarat",
        pincode: ownerAddress.pincode,
        district: ownerAddress.district || "",
        landmark: ownerAddress.landmark || ""
      });
    }

    // Check tenant address  
    const tenantAddress = formData.tenantDetails?.address;
    if (tenantAddress?.society && tenantAddress?.area && tenantAddress?.city && tenantAddress?.pincode) {
      addressesToSave.push({
        society: tenantAddress.society,
        area: tenantAddress.area,
        city: tenantAddress.city,
        state: tenantAddress.state || "Gujarat",
        pincode: tenantAddress.pincode,
        district: tenantAddress.district || "",
        landmark: tenantAddress.landmark || ""
      });
    }

    // Check property address
    const propertyAddress = formData.propertyDetails?.address;
    if (propertyAddress?.society && propertyAddress?.area && propertyAddress?.city && propertyAddress?.pincode) {
      addressesToSave.push({
        society: propertyAddress.society,
        area: propertyAddress.area,
        city: propertyAddress.city,
        state: propertyAddress.state || "Gujarat",
        pincode: propertyAddress.pincode,
        district: propertyAddress.district || "",
        landmark: propertyAddress.landmark || ""
      });
    }

    // Save addresses to database
    for (const address of addressesToSave) {
      try {
        await apiRequest("/api/addresses", "POST", address);
      } catch (error) {
        console.error("Error saving address:", error);
      }
    }
  };

  // Step validation functions
  const validateStep = (stepNumber: number): boolean => {
    switch (stepNumber) {
      case 1:
        return !!(formData.customerId && formData.language);
      case 2:
        return !!(
          formData.ownerDetails?.name &&
          formData.ownerDetails?.mobile &&
          formData.ownerDetails?.age &&
          formData.ownerDetails?.address
        );
      case 3:
        return !!(
          formData.tenantDetails?.name &&
          formData.tenantDetails?.mobile &&
          formData.tenantDetails?.age &&
          formData.tenantDetails?.address
        );
      case 4:
        return !!(
          formData.propertyDetails?.address &&
          formData.propertyDetails?.type &&
          formData.rentalTerms?.monthlyRent &&
          formData.rentalTerms?.startDate &&
          formData.rentalTerms?.endDate &&
          formData.rentalTerms?.tenure &&
          formData.rentalTerms?.deposit
        );
      case 5:
        return true; // Finalize step doesn't need validation
      default:
        return false;
    }
  };

  const canProceed = (stepNumber: number): boolean => {
    return validateStep(stepNumber);
  };

  // Load existing agreement data when editing
  useEffect(() => {
    if (isOpen && agreementId) {
      // Fetch and populate form with existing agreement data
      const loadAgreement = async () => {
        try {
          const agreement = await apiRequest("GET", `/api/agreements/${agreementId}`) as any;
          
          // Convert agreement data to form format, handling address structure
          const formData: AgreementFormData = {
            customerId: agreement.customerId || "",
            language: agreement.language || "english",
            ownerDetails: {
              ...agreement.ownerDetails,
              // Ensure granular address fields are populated from nested structure if needed
              houseNumber: agreement.ownerDetails?.houseNumber || agreement.ownerDetails?.address?.flatNo || "",
              society: agreement.ownerDetails?.society || agreement.ownerDetails?.address?.society || "",
              area: agreement.ownerDetails?.area || agreement.ownerDetails?.address?.area || "",
              city: agreement.ownerDetails?.city || agreement.ownerDetails?.address?.city || "",
              state: agreement.ownerDetails?.state || agreement.ownerDetails?.address?.state || "",
              pincode: agreement.ownerDetails?.pincode || agreement.ownerDetails?.address?.pincode || "",
              // Keep nested address structure for compatibility
              address: agreement.ownerDetails?.address || {
                flatNo: agreement.ownerDetails?.houseNumber || "",
                society: agreement.ownerDetails?.society || "",
                area: agreement.ownerDetails?.area || "",
                city: agreement.ownerDetails?.city || "",
                state: agreement.ownerDetails?.state || "",
                pincode: agreement.ownerDetails?.pincode || "",
                district: agreement.ownerDetails?.address?.district || "",
                landmark: agreement.ownerDetails?.address?.landmark || ""
              }
            },
            tenantDetails: {
              ...agreement.tenantDetails,
              // Ensure granular address fields are populated from nested structure if needed
              houseNumber: agreement.tenantDetails?.houseNumber || agreement.tenantDetails?.address?.flatNo || "",
              society: agreement.tenantDetails?.society || agreement.tenantDetails?.address?.society || "",
              area: agreement.tenantDetails?.area || agreement.tenantDetails?.address?.area || "",
              city: agreement.tenantDetails?.city || agreement.tenantDetails?.address?.city || "",
              state: agreement.tenantDetails?.state || agreement.tenantDetails?.address?.state || "",
              pincode: agreement.tenantDetails?.pincode || agreement.tenantDetails?.address?.pincode || "",
              // Keep nested address structure for compatibility
              address: agreement.tenantDetails?.address || {
                flatNo: agreement.tenantDetails?.houseNumber || "",
                society: agreement.tenantDetails?.society || "",
                area: agreement.tenantDetails?.area || "",
                city: agreement.tenantDetails?.city || "",
                state: agreement.tenantDetails?.state || "",
                pincode: agreement.tenantDetails?.pincode || "",
                district: agreement.tenantDetails?.address?.district || "",
                landmark: agreement.tenantDetails?.address?.landmark || ""
              }
            },
            propertyDetails: {
              ...agreement.propertyDetails,
              // Ensure granular address fields are populated from nested structure if needed
              houseNumber: agreement.propertyDetails?.houseNumber || agreement.propertyDetails?.address?.flatNo || "",
              society: agreement.propertyDetails?.society || agreement.propertyDetails?.address?.society || "",
              area: agreement.propertyDetails?.area || agreement.propertyDetails?.address?.area || "",
              city: agreement.propertyDetails?.city || agreement.propertyDetails?.address?.city || "",
              state: agreement.propertyDetails?.state || agreement.propertyDetails?.address?.state || "",
              pincode: agreement.propertyDetails?.pincode || agreement.propertyDetails?.address?.pincode || "",
              // Keep nested address structure for compatibility
              address: agreement.propertyDetails?.address || {
                flatNo: agreement.propertyDetails?.houseNumber || "",
                society: agreement.propertyDetails?.society || "",
                area: agreement.propertyDetails?.area || "",
                city: agreement.propertyDetails?.city || "",
                state: agreement.propertyDetails?.state || "",
                pincode: agreement.propertyDetails?.pincode || "",
                district: agreement.propertyDetails?.address?.district || "",
                landmark: agreement.propertyDetails?.address?.landmark || ""
              }
            },
            rentalTerms: {
              ...agreement.rentalTerms,
              // Ensure all rental terms have default values
              tenure: agreement.rentalTerms?.tenure || "11_months",
              maintenance: agreement.rentalTerms?.maintenance || "included"
            },
            additionalClauses: agreement.additionalClauses || []
          };
          
          reset(formData);
          
          // Set documents if they exist
          if (agreement.documents) {
            setDocuments(agreement.documents);
          }
          
        } catch (error) {
          console.error("Error loading agreement:", error);
          toast({
            title: "Error",
            description: "Failed to load agreement data",
            variant: "destructive"
          });
        }
      };
      
      loadAgreement();
    } else if (!isOpen) {
      // Reset form when modal is closed
      setCurrentStep(1);
      setDocuments({});
      reset();
    }
  }, [isOpen, agreementId, reset, toast]);

  const nextStep = async () => {
    if (currentStep < STEPS.length && canProceed(currentStep)) {
      // If we're about to go to the final step (step 5), auto-save the agreement
      if (currentStep === STEPS.length - 1) {
        try {
          await finalizeAgreement(watch());
          return; // Don't increment step, the modal will close after saving
        } catch (error) {
          console.error("Failed to auto-save agreement:", error);
          // Still proceed to final step if auto-save fails
        }
      }
      setCurrentStep(currentStep + 1);
    } else if (!canProceed(currentStep)) {
      toast({
        title: "Please complete all required fields",
        description: "Fill in all required information before proceeding to the next step.",
        variant: "destructive",
      });
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
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

  const copyFromCustomer = () => {
    const customer = customersData?.customers.find(c => c.id === watchedCustomerId);
    if (customer) {
      setValue("tenantDetails.name", customer.name);
      setValue("tenantDetails.mobile", customer.mobile);
      // Set other fields as needed
    }
  };

  const copyCustomerAsOwner = () => {
    const selectedCustomer = customersData?.customers.find(c => c.id === watchedCustomerId);
    
    if (!selectedCustomer) {
      toast({
        title: "No Customer Selected",
        description: "Please select a customer first to copy their details.",
        variant: "destructive",
      });
      return;
    }

    // Copy customer details to owner fields
    setValue("ownerDetails.name", selectedCustomer.name);
    setValue("ownerDetails.mobile", selectedCustomer.mobile);
    setValue("ownerDetails.email", selectedCustomer.email || "");
    
    // If customer has address information, copy that too
    if (selectedCustomer.address) {
      setValue("ownerDetails.address.flatNo", selectedCustomer.address.flatNo || "");
      setValue("ownerDetails.address.society", selectedCustomer.address.society || "");
      setValue("ownerDetails.address.area", selectedCustomer.address.area || "");
      setValue("ownerDetails.address.city", selectedCustomer.address.city || "");
      setValue("ownerDetails.address.state", selectedCustomer.address.state || "");
      setValue("ownerDetails.address.pincode", selectedCustomer.address.pincode || "");
    }
    
    toast({
      title: "Details Copied",
      description: `${selectedCustomer.name}'s details have been copied to landlord fields.`,
    });
  };

  const fetchMobileInfo = async (mobile: string, userType: 'owner' | 'tenant') => {
    if (mobile && mobile.length >= 10) {
      try {
        const customer = await apiRequest(`/api/customers/by-mobile?mobile=${encodeURIComponent(mobile)}`) as any;
        if (customer) {
          if (userType === 'owner') {
            setValue("ownerDetails.name", customer.name);
            setValue("ownerDetails.email", customer.email || "");
            // If customer has address information, copy that too
            if (customer.address) {
              setValue("ownerDetails.address.flatNo", customer.address.flatNo || "");
              setValue("ownerDetails.address.society", customer.address.society || "");
              setValue("ownerDetails.address.area", customer.address.area || "");
              setValue("ownerDetails.address.city", customer.address.city || "");
              setValue("ownerDetails.address.state", customer.address.state || "");
              setValue("ownerDetails.address.pincode", customer.address.pincode || "");
              setValue("ownerDetails.address.district", customer.address.district || "");
              setValue("ownerDetails.address.landmark", customer.address.landmark || "");
            }
          } else {
            setValue("tenantDetails.name", customer.name);
            setValue("tenantDetails.email", customer.email || "");
            // If customer has address information, copy that too
            if (customer.address) {
              setValue("tenantDetails.address.flatNo", customer.address.flatNo || "");
              setValue("tenantDetails.address.society", customer.address.society || "");
              setValue("tenantDetails.address.area", customer.address.area || "");
              setValue("tenantDetails.address.city", customer.address.city || "");
              setValue("tenantDetails.address.state", customer.address.state || "");
              setValue("tenantDetails.address.pincode", customer.address.pincode || "");
              setValue("tenantDetails.address.district", customer.address.district || "");
              setValue("tenantDetails.address.landmark", customer.address.landmark || "");
            }
          }
          toast({
            title: "Customer details found",
            description: `Auto-filled details for ${customer.name}`,
          });
        }
      } catch (error) {
        // Check if it's a 404 (customer not found) vs other errors
        if (error instanceof Error && error.message.includes('404')) {
          // Customer not found - this is expected behavior, no toast needed
          console.log(`No existing customer found for mobile: ${mobile}`);
        } else {
          // Other error - show error toast
          toast({
            title: "Error",
            description: "Failed to lookup customer details",
            variant: "destructive",
          });
        }
      }
    }
  };

  const handleDocumentUpload = (type: string, result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    if (result.successful && result.successful.length > 0) {
      const uploadURL = result.successful[0].uploadURL;
      setDocuments(prev => ({ ...prev, [type]: uploadURL || "" }));
      toast({
        title: "Document uploaded",
        description: "Document has been uploaded successfully.",
      });
    }
  };

  const getUploadParameters = async () => {
    const response = await apiRequest("POST", "/api/objects/upload");
    const data = await response.json();
    return {
      method: "PUT" as const,
      url: data.uploadURL,
    };
  };

  const saveDraft = async (data: AgreementFormData) => {
    try {
      // Save addresses to database first
      await saveAddressWhenSubmitting();

      const agreementData = {
        customerId: data.customerId || "",
        language: data.language || "english",
        status: "draft",
        ownerDetails: data.ownerDetails || {},
        tenantDetails: data.tenantDetails || {},
        propertyDetails: data.propertyDetails || {},
        rentalTerms: data.rentalTerms || {},
        additionalClauses: data.additionalClauses || [],
        documents: documents,
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 11 * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        agreementDate: new Date().toISOString().split('T')[0],
      };

      const response = await apiRequest("POST", "/api/agreements", agreementData);
      const agreement = await response.json();

      queryClient.invalidateQueries({ queryKey: ["/api/agreements"] });
      
      toast({
        title: "Draft saved",
        description: "Agreement has been saved as draft. You can continue editing.",
      });
    } catch (error) {
      console.error("Save draft error:", error);
      toast({
        title: "Error",
        description: "Failed to save draft.",
        variant: "destructive",
      });
    }
  };

  const downloadAgreement = async () => {
    const formData = watch();
    if (!formData || !formData.customerId) {
      toast({
        title: "Error",
        description: "Please complete the agreement form first.",
        variant: "destructive",
      });
      return;
    }

    try {
      const selectedLanguage = formData.language || 'english';
      console.log('Downloading agreement with language:', selectedLanguage);
      
      // First get the active PDF template for rental agreements in the selected language
      const templatesResponse = await fetch(`/api/pdf-templates?documentType=rental_agreement&language=${selectedLanguage}`);
      const templates = await templatesResponse.json();
      const activeTemplate = templates.find((t: any) => t.isActive);
      
      if (!activeTemplate) {
        toast({
          title: "Error",
          description: `No active PDF template found for ${selectedLanguage} language.`,
          variant: "destructive",
        });
        return;
      }
      
      console.log('Using template:', activeTemplate.name, 'for language:', selectedLanguage);

      // Generate PDF with the active template
      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          templateId: activeTemplate.id,
          agreementData: formData
        }),
      });

      if (response.ok) {
        const result = await response.json();
        
        // Create a new window to show the PDF content
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Rental Agreement</title>
              <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                @media print { 
                  body { margin: 0; }
                  .no-print { display: none; }
                }
              </style>
            </head>
            <body>
              <div class="no-print" style="margin-bottom: 20px;">
                <button onclick="window.print()" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px;">Print PDF</button>
                <button onclick="window.close()" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 4px; margin-left: 10px;">Close</button>
              </div>
              ${result.html}
            </body>
            </html>
          `);
          printWindow.document.close();
        }
        
        toast({
          title: "PDF Generated",
          description: "Agreement PDF opened in new window. You can print it from there.",
        });
      } else {
        throw new Error('Failed to generate PDF');
      }
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  const finalizeAgreement = async (data: AgreementFormData) => {
    try {
      // Save addresses to database first
      await saveAddressWhenSubmitting();

      const agreementData = {
        customerId: data.customerId || "",
        language: data.language || "english",
        status: "active",
        ownerDetails: data.ownerDetails || {},
        tenantDetails: data.tenantDetails || {},
        propertyDetails: data.propertyDetails || {},
        rentalTerms: data.rentalTerms || {},
        additionalClauses: data.additionalClauses || [],
        documents: documents,
        startDate: data.rentalTerms?.startDate || new Date().toISOString().split('T')[0],
        endDate: data.rentalTerms?.endDate || new Date(Date.now() + 11 * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        agreementDate: new Date().toISOString().split('T')[0],
      };

      console.log('Creating agreement with language:', agreementData.language);

      const response = await apiRequest("POST", "/api/agreements", agreementData);
      const agreement = await response.json();

      queryClient.invalidateQueries({ queryKey: ["/api/agreements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      
      toast({
        title: "Agreement created",
        description: `Agreement ${agreement.agreementNumber} has been created successfully.`,
      });

      // Close the modal after successful creation
      onClose();
    } catch (error) {
      console.error("Finalize agreement error:", error);
      toast({
        title: "Error",
        description: "Failed to create agreement.",
        variant: "destructive",
      });
      throw error; // Re-throw to prevent step progression in nextStep
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
                <Label htmlFor="customerId">{t("selectCustomer")}</Label>
                <Select value={watch("customerId")} onValueChange={(value) => setValue("customerId", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("searchCustomer")} />
                  </SelectTrigger>
                  <SelectContent>
                    {customersData?.customers.filter(customer => customer.id && customer.id.trim() !== '').map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name} - {customer.mobile}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCustomerModal(true)}
                  className="mt-2 text-blue-600 hover:text-blue-700"
                >
                  <Plus className="mr-1 h-4 w-4" />
                  {t("createNewCustomer")}
                </Button>
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
              >
                <Copy className="mr-2 h-4 w-4" />
                {t("copyCustomerDetails")}
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="ownerName">{t("ownerName")}</Label>
                <Input {...register("ownerDetails.name", { required: "Name is required" })} placeholder={t("ownerName")} />
                {errors.ownerDetails?.name && (
                  <p className="text-sm text-red-600 mt-1">{errors.ownerDetails.name.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="ownerMobile">{t("ownerMobile")}</Label>
                <div className="relative">
                  <Input 
                    {...register("ownerDetails.mobile", { required: "Mobile is required" })} 
                    placeholder="+91 XXXXXXXXXX"
                    onBlur={(e) => fetchMobileInfo(e.target.value, 'owner')}
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="text-xs text-blue-500 bg-blue-50 px-2 py-1 rounded">
                      {t("autoFill")}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {t("autoFillMessage")}
                </p>
              </div>
              <div>
                <Label htmlFor="ownerAge">{t("ownerAge")}</Label>
                <Input type="number" {...register("ownerDetails.age", { required: "Age is required" })} placeholder="Age" />
              </div>
              <div>
                <Label htmlFor="ownerOccupation">{t("ownerOccupation")}</Label>
                <Input {...register("ownerDetails.occupation")} placeholder="Occupation" />
              </div>
              <div>
                <Label htmlFor="ownerAadhar">{t("ownerAadhar")}</Label>
                <Input {...register("ownerDetails.aadhar")} placeholder="XXXX XXXX XXXX" />
              </div>
              <div>
                <Label htmlFor="ownerPan">{t("ownerPan")}</Label>
                <Input {...register("ownerDetails.pan")} placeholder="ABCDE1234F" />
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
                  <Label>{t("societyApartment")}</Label>
                  <Input 
                    value={watch("ownerDetails.address.society") || ""}
                    onChange={(e) => handleSocietyInputChange('owner', e.target.value)}
                    placeholder={t("startTypingSociety")}
                    onFocus={() => setShowAddressSuggestions(prev => ({ ...prev, owner: addressSearch.owner.length >= 2 }))}
                    onBlur={() => setTimeout(() => setShowAddressSuggestions(prev => ({ ...prev, owner: false })), 200)}
                  />
                  {showAddressSuggestions.owner && ownerAddresses.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                      {ownerAddresses.map((address) => (
                        <div
                          key={address.id}
                          className="p-3 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
                          onClick={() => handleAddressSelect('owner', address)}
                        >
                          <div className="font-medium">{address.society}</div>
                          <div className="text-sm text-gray-600">{address.area}, {address.city} - {address.pincode}</div>
                        </div>
                      ))}
                    </div>
                  )}
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
                  <ObjectUploader
                    maxFileSize={5242880} // 5MB
                    onGetUploadParameters={getUploadParameters}
                    onComplete={(result) => handleDocumentUpload("ownerAadhar", result)}
                    buttonClassName="w-full h-auto p-0"
                  >
                    <div className={`border-2 border-dashed rounded-lg p-4 text-center transition-all cursor-pointer ${
                      documents.ownerAadhar 
                        ? "border-green-300 bg-green-50 hover:bg-green-100" 
                        : "border-gray-300 bg-gray-50 hover:bg-gray-100"
                    }`}>
                      <div className="flex flex-col items-center space-y-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          documents.ownerAadhar ? "bg-green-100 text-green-600" : "bg-gray-200 text-gray-500"
                        }`}>
                          <Plus className="w-4 h-4" />
                        </div>
                        <p className="text-sm text-gray-600">
                          {documents.ownerAadhar ? t("aadharCardUploaded") : t("uploadAadharCard")}
                        </p>
                        <p className="text-xs text-gray-500">{t("fileSizeNote")}</p>
                      </div>
                    </div>
                  </ObjectUploader>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">{t("panCardLabel")}</Label>
                  <ObjectUploader
                    maxFileSize={5242880} // 5MB
                    onGetUploadParameters={getUploadParameters}
                    onComplete={(result) => handleDocumentUpload("ownerPan", result)}
                    buttonClassName="w-full h-auto p-0"
                  >
                    <div className={`border-2 border-dashed rounded-lg p-4 text-center transition-all cursor-pointer ${
                      documents.ownerPan 
                        ? "border-green-300 bg-green-50 hover:bg-green-100" 
                        : "border-gray-300 bg-gray-50 hover:bg-gray-100"
                    }`}>
                      <div className="flex flex-col items-center space-y-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          documents.ownerPan ? "bg-green-100 text-green-600" : "bg-gray-200 text-gray-500"
                        }`}>
                          <Plus className="w-4 h-4" />
                        </div>
                        <p className="text-sm text-gray-600">
                          {documents.ownerPan ? t("panCardUploaded") : t("uploadPanCard")}
                        </p>
                        <p className="text-xs text-gray-500">{t("fileSizeNote")}</p>
                      </div>
                    </div>
                  </ObjectUploader>
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
              >
                <Copy className="mr-2 h-4 w-4" />
                {t("copyFromCustomer")}
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label>{t("fullName")}</Label>
                <Input {...register("tenantDetails.name", { required: "Name is required" })} placeholder={t("enterTenantFullName")} />
              </div>
              <div>
                <Label>{t("mobileNumber")}</Label>
                <div className="relative">
                  <Input 
                    {...register("tenantDetails.mobile", { required: "Mobile is required" })} 
                    placeholder="+91 XXXXXXXXXX" 
                    onBlur={(e) => fetchMobileInfo(e.target.value, 'tenant')}
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="text-xs text-blue-500 bg-blue-50 px-2 py-1 rounded">
                      {t("autoFill")}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {t("autoFillMessage")}
                </p>
              </div>
              <div>
                <Label>{t("tenantAge")}</Label>
                <Input type="number" {...register("tenantDetails.age", { required: "Age is required" })} placeholder={t("tenantAge")} />
              </div>
              <div>
                <Label>{t("tenantOccupation")}</Label>
                <Input {...register("tenantDetails.occupation")} placeholder={t("occupationPlaceholder")} />
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
                  <Label>{t("societyApartment")}</Label>
                  <Input 
                    value={watch("tenantDetails.address.society") || ""}
                    onChange={(e) => handleSocietyInputChange('tenant', e.target.value)}
                    placeholder={t("startTypingSociety")}
                    onFocus={() => setShowAddressSuggestions(prev => ({ ...prev, tenant: addressSearch.tenant.length >= 2 }))}
                    onBlur={() => setTimeout(() => setShowAddressSuggestions(prev => ({ ...prev, tenant: false })), 200)}
                  />
                  {showAddressSuggestions.tenant && tenantAddresses.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                      {tenantAddresses.map((address) => (
                        <div
                          key={address.id}
                          className="p-3 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
                          onClick={() => handleAddressSelect('tenant', address)}
                        >
                          <div className="font-medium">{address.society}</div>
                          <div className="text-sm text-gray-600">{address.area}, {address.city} - {address.pincode}</div>
                        </div>
                      ))}
                    </div>
                  )}
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
                  <Input {...register("tenantDetails.address.state", { required: "State is required" })} placeholder={t("stateExamplePlaceholder")} />
                </div>
                <div>
                  <Label>{t("pincode")}</Label>
                  <Input {...register("tenantDetails.address.pincode", { required: "Pincode is required" })} placeholder={t("pincodeExamplePlaceholder")} />
                </div>
              </div>
            </div>

            {/* Document Upload for Tenant */}
            <div>
              <h4 className="text-md font-semibold text-gray-800 mb-4">{t("documents")} {t("optional")}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">{t("aadharCard")}</Label>
                  <ObjectUploader
                    maxFileSize={5242880} // 5MB
                    onGetUploadParameters={getUploadParameters}
                    onComplete={(result) => handleDocumentUpload("tenantAadhar", result)}
                    buttonClassName="w-full h-auto p-0"
                  >
                    <div className={`border-2 border-dashed rounded-lg p-4 text-center transition-all cursor-pointer ${
                      documents.tenantAadhar 
                        ? "border-green-300 bg-green-50 hover:bg-green-100" 
                        : "border-gray-300 bg-gray-50 hover:bg-gray-100"
                    }`}>
                      <div className="flex flex-col items-center space-y-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          documents.tenantAadhar ? "bg-green-100 text-green-600" : "bg-gray-200 text-gray-500"
                        }`}>
                          <Plus className="w-4 h-4" />
                        </div>
                        <p className="text-sm text-gray-600">
                          {documents.tenantAadhar ? t("aadharCardUploaded") : t("uploadAadharCard")}
                        </p>
                        <p className="text-xs text-gray-500">{t("fileSizeNote")}</p>
                      </div>
                    </div>
                  </ObjectUploader>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">{t("panCardLabel")}</Label>
                  <ObjectUploader
                    maxFileSize={5242880} // 5MB
                    onGetUploadParameters={getUploadParameters}
                    onComplete={(result) => handleDocumentUpload("tenantPan", result)}
                    buttonClassName="w-full h-auto p-0"
                  >
                    <div className={`border-2 border-dashed rounded-lg p-4 text-center transition-all cursor-pointer ${
                      documents.tenantPan 
                        ? "border-green-300 bg-green-50 hover:bg-green-100" 
                        : "border-gray-300 bg-gray-50 hover:bg-gray-100"
                    }`}>
                      <div className="flex flex-col items-center space-y-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          documents.tenantPan ? "bg-green-100 text-green-600" : "bg-gray-200 text-gray-500"
                        }`}>
                          <Plus className="w-4 h-4" />
                        </div>
                        <p className="text-sm text-gray-600">
                          {documents.tenantPan ? t("panCardUploaded") : t("uploadPanCard")}
                        </p>
                        <p className="text-xs text-gray-500">{t("fileSizeNote")}</p>
                      </div>
                    </div>
                  </ObjectUploader>
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
                  <Input {...register("propertyDetails.type", { required: "Property type is required" })} placeholder={t("propertyTypeExample")} />
                </div>
                <div>
                  <Label>{t("placeOfAgreement")}</Label>
                  <Input {...register("propertyDetails.place")} placeholder={t("cityName")} />
                </div>
              </div>
              
              <div className="mt-4">
                <h5 className="text-sm font-semibold text-gray-700 mb-3">{t("propertyAddress")}</h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>{t("flatNo")}</Label>
                    <Input {...register("propertyDetails.address.flatNo", { required: "Property address is required" })} />
                  </div>
                  <div className="relative">
                    <Label>{t("societyBuilding")}</Label>
                    <Input 
                      value={watch("propertyDetails.address.society") || ""}
                      onChange={(e) => handleSocietyInputChange('property', e.target.value)}
                      placeholder={t("startTypingSociety")}
                      onFocus={() => setShowAddressSuggestions(prev => ({ ...prev, property: addressSearch.property.length >= 2 }))}
                      onBlur={() => setTimeout(() => setShowAddressSuggestions(prev => ({ ...prev, property: false })), 200)}
                    />
                    {showAddressSuggestions.property && propertyAddresses.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                        {propertyAddresses.map((address) => (
                          <div
                            key={address.id}
                            className="p-3 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
                            onClick={() => handleAddressSelect('property', address)}
                          >
                            <div className="font-medium">{address.society}</div>
                            <div className="text-sm text-gray-600">{address.area}, {address.city} - {address.pincode}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label>{t("area")}</Label>
                    <Input {...register("propertyDetails.address.area", { required: "Area is required" })} />
                  </div>
                  <div>
                    <Label>{t("city")}</Label>
                    <Input {...register("propertyDetails.address.city", { required: "City is required" })} />
                  </div>
                  <div>
                    <Label>{t("state")}</Label>
                    <Input {...register("propertyDetails.address.state", { required: "State is required" })} placeholder={t("stateExamplePlaceholder")} />
                  </div>
                  <div>
                    <Label>{t("pincode")}</Label>
                    <Input {...register("propertyDetails.address.pincode", { required: "Pincode is required" })} placeholder={t("pincodeExamplePlaceholder")} />
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <h5 className="text-sm font-semibold text-gray-700 mb-3">{t("propertyDetails")}</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>{t("propertyAreaSquareFeet")}</Label>
                    <Input 
                      type="number" 
                      {...register("propertyDetails.areaInSqFt")} 
                      placeholder={t("areaSquareFeetExample")} 
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
                        <SelectItem value="fully_furnished">{t("fullyFurnished")}</SelectItem>
                        <SelectItem value="semi_furnished">{t("semiFurnished")}</SelectItem>
                        <SelectItem value="unfurnished">{t("unfurnished")}</SelectItem>
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
            </div>

            <div>
              <h4 className="text-md font-semibold text-gray-800 mb-4">{t("rentalTerms")}</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>{t("deposit")} (₹)</Label>
                  <Input type="number" {...register("rentalTerms.deposit", { required: "Security deposit is required" })} placeholder={t("amountPlaceholder")} />
                </div>
                <div>
                  <Label>{t("monthlyRent")} (₹)</Label>
                  <Input type="number" {...register("rentalTerms.monthlyRent", { required: "Monthly rent is required" })} placeholder={t("amountPlaceholder")} />
                </div>
                <div>
                  <Label>{t("dueDate")} (Day of Month)</Label>
                  <Input type="number" {...register("rentalTerms.dueDate", { required: "Due date is required" })} placeholder={t("dueDateExample")} />
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-md font-semibold text-gray-800 mb-4">{t("additionalTerms")}</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>{t("maintenanceCharge")}</Label>
                  <Select value={watch("rentalTerms.maintenance")} onValueChange={(value) => setValue("rentalTerms.maintenance", value as "included" | "excluded")}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("selectOption")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="included">{t("included")}</SelectItem>
                      <SelectItem value="excluded">{t("excluded")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("noticePeriod")} (Months)</Label>
                  <Input type="number" {...register("rentalTerms.noticePeriod")} placeholder={t("noticePeriodExample")} />
                </div>
                <div>
                  <Label>{t("minimumStay")}</Label>
                  <Input {...register("rentalTerms.minimumStay")} placeholder={t("minimumStayExample")} />
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
                      {customersData?.customers.find(c => c.id === watchedCustomerId)?.name || t("notSelected")}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">{t("language")}:</span>
                    <span className="ml-2 font-medium">
                      {LANGUAGES.find(l => l.value === watchedLanguage)?.label || "English"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">{t("property")}:</span>
                    <span className="ml-2 font-medium">{watch("propertyDetails.type") || t("notSpecified")}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">{t("monthlyRent")}:</span>
                    <span className="ml-2 font-medium">₹{watch("rentalTerms.monthlyRent") || "0"}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">{t("deposit")}:</span>
                    <span className="ml-2 font-medium">₹{watch("rentalTerms.deposit") || "0"}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">{t("startDate")}:</span>
                    <span className="ml-2 font-medium">{watch("rentalTerms.startDate") || t("notSet")}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">{t("endDate")}:</span>
                    <span className="ml-2 font-medium">{watch("rentalTerms.endDate") || t("notSet")}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">{t("tenure")}:</span>
                    <span className="ml-2 font-medium">
                      {watch("rentalTerms.tenure") === "11_months" ? t("months11") : t("customDuration")}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  const progress = (currentStep / STEPS.length) * 100;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-screen overflow-y-auto">
          <DialogHeader className="bg-gray-800 text-white p-6 -m-6 mb-6">
            <div className="flex items-center">
              <DialogTitle className="text-xl font-bold">{t("createNewAgreement")}</DialogTitle>
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
          </DialogHeader>

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
                  onClick={handleSubmit(saveDraft)}
                  className="bg-amber-600 text-white hover:bg-amber-700"
                >
                  {t("saveDraft")}
                </Button>
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
                  {currentStep === STEPS.length - 1 ? t("createAgreement") : t("next")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <CustomerModal
        isOpen={showCustomerModal}
        onClose={() => setShowCustomerModal(false)}
        onCustomerCreated={(customerId) => {
          setValue("customerId", customerId);
          setShowCustomerModal(false);
        }}
      />
    </>
  );
}
