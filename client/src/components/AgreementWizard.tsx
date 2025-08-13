import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { X, ArrowLeft, ArrowRight, Plus, Trash2, Copy, Download, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { useCustomers } from "@/hooks/useCustomers";
import { useSocieties } from "@/hooks/useSocieties";
import { useAddresses } from "@/hooks/useAddresses";
import { LocalFileUploader } from "@/components/LocalFileUploader";
import { FilePreview } from "@/components/FilePreview";
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
  editingAgreement?: any; // The agreement data to edit
}

interface AgreementFormData {
  customerId?: string; // Make optional since manual entry is now allowed
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

export default function AgreementWizard({ isOpen, onClose, agreementId, editingAgreement }: AgreementWizardProps) {
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
  
  // PDF Generation state
  const [pdfState, setPdfState] = useState<'idle' | 'creating' | 'ready'>('idle');
  const [pdfData, setPdfData] = useState<{ html: string; agreementNumber: string } | null>(null);
  const [createdAgreementId, setCreatedAgreementId] = useState<string | null>(null);
  
  const { toast } = useToast();
  const mobileTimeout = useRef<NodeJS.Timeout | null>(null);
  const addressTimeout = useRef<NodeJS.Timeout | null>(null);

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
  
  // Load existing agreement data when editing
  useEffect(() => {
    if (editingAgreement && isOpen) {
      console.log("Loading existing agreement data for editing:", editingAgreement);
      
      // Try to get form data - either from stored formData field or from agreement structure directly
      let existingFormData;
      
      if (editingAgreement.formData) {
        // If formData exists (stored JSON), parse it
        try {
          existingFormData = typeof editingAgreement.formData === 'string' ? 
            JSON.parse(editingAgreement.formData) : editingAgreement.formData;
        } catch (error) {
          console.error("Error parsing stored formData:", error);
          existingFormData = null;
        }
      }
      
      // If no formData or parsing failed, construct from agreement structure
      if (!existingFormData) {
        console.log("No stored formData found, constructing from agreement structure");
        existingFormData = {
          customerId: editingAgreement.customerId || "",
          language: editingAgreement.language || "english",
          ownerDetails: editingAgreement.ownerDetails || {},
          tenantDetails: editingAgreement.tenantDetails || {},
          propertyDetails: editingAgreement.propertyDetails || {},
          rentalTerms: editingAgreement.rentalTerms || {},
          additionalClauses: editingAgreement.additionalClauses || [],
          documents: editingAgreement.documents || {}
        };
      }
      
      console.log("Loading form data:", existingFormData);
      console.log("Owner details in agreement:", existingFormData.ownerDetails);
      console.log("Tenant details in agreement:", existingFormData.tenantDetails);
      console.log("Property details in agreement:", existingFormData.propertyDetails);
      console.log("Rental terms in agreement:", existingFormData.rentalTerms);
      
      // Detailed field debugging for all sections
      if (existingFormData.ownerDetails) {
        console.log("=== OWNER DETAILS BREAKDOWN ===");
        console.log("All owner keys:", Object.keys(existingFormData.ownerDetails));
        console.log("Owner address keys:", existingFormData.ownerDetails.address ? Object.keys(existingFormData.ownerDetails.address) : "No address");
      }
      
      if (existingFormData.tenantDetails) {
        console.log("=== TENANT DETAILS BREAKDOWN ===");
        console.log("All tenant keys:", Object.keys(existingFormData.tenantDetails));
        console.log("Tenant address keys:", existingFormData.tenantDetails.address ? Object.keys(existingFormData.tenantDetails.address) : "No address");
      }
      
      if (existingFormData.propertyDetails) {
        console.log("=== PROPERTY DETAILS BREAKDOWN ===");
        console.log("All property keys:", Object.keys(existingFormData.propertyDetails));
        console.log("Property address keys:", existingFormData.propertyDetails.address ? Object.keys(existingFormData.propertyDetails.address) : "No address");
      }
      
      if (existingFormData.rentalTerms) {
        console.log("=== RENTAL TERMS BREAKDOWN ===");
        console.log("All rental terms keys:", Object.keys(existingFormData.rentalTerms));
      }
      
      // Reset form with existing data
      const formDataToLoad = {
        customerId: existingFormData.customerId || "",
        language: existingFormData.language || "english",
        ownerDetails: {
          name: existingFormData.ownerDetails?.name || "",
          mobile: existingFormData.ownerDetails?.mobile || "",
          email: existingFormData.ownerDetails?.email || "",
          age: existingFormData.ownerDetails?.age || "",
          occupation: existingFormData.ownerDetails?.occupation || "",
          fatherName: existingFormData.ownerDetails?.fatherName || existingFormData.ownerDetails?.father_name || "",
          aadhar: existingFormData.ownerDetails?.aadhar || existingFormData.ownerDetails?.aadharNumber || "",
          pan: existingFormData.ownerDetails?.pan || existingFormData.ownerDetails?.panNumber || "",
          address: {
            flatNo: existingFormData.ownerDetails?.address?.flatNo || existingFormData.ownerDetails?.address?.flat_no || "",
            society: existingFormData.ownerDetails?.address?.society || existingFormData.ownerDetails?.address?.societyName || "",
            area: existingFormData.ownerDetails?.address?.area || "",
            city: existingFormData.ownerDetails?.address?.city || "",
            state: existingFormData.ownerDetails?.address?.state || "",
            pincode: existingFormData.ownerDetails?.address?.pincode || existingFormData.ownerDetails?.address?.pin_code || "",
            district: existingFormData.ownerDetails?.address?.district || "",
            landmark: existingFormData.ownerDetails?.address?.landmark || ""
          }
        },
        tenantDetails: {
          name: existingFormData.tenantDetails?.name || "",
          mobile: existingFormData.tenantDetails?.mobile || "",
          email: existingFormData.tenantDetails?.email || "",
          age: existingFormData.tenantDetails?.age || "",
          occupation: existingFormData.tenantDetails?.occupation || "",
          fatherName: existingFormData.tenantDetails?.fatherName || existingFormData.tenantDetails?.father_name || "",
          aadhar: existingFormData.tenantDetails?.aadhar || existingFormData.tenantDetails?.aadharNumber || "",
          pan: existingFormData.tenantDetails?.pan || existingFormData.tenantDetails?.panNumber || "",
          address: {
            flatNo: existingFormData.tenantDetails?.address?.flatNo || existingFormData.tenantDetails?.address?.flat_no || "",
            society: existingFormData.tenantDetails?.address?.society || existingFormData.tenantDetails?.address?.societyName || "",
            area: existingFormData.tenantDetails?.address?.area || "",
            city: existingFormData.tenantDetails?.address?.city || "",
            state: existingFormData.tenantDetails?.address?.state || "",
            pincode: existingFormData.tenantDetails?.address?.pincode || existingFormData.tenantDetails?.address?.pin_code || "",
            district: existingFormData.tenantDetails?.address?.district || "",
            landmark: existingFormData.tenantDetails?.address?.landmark || ""
          }
        },
        propertyDetails: {
          type: existingFormData.propertyDetails?.type || "",
          place: existingFormData.propertyDetails?.place || "",
          areaInSqFt: existingFormData.propertyDetails?.areaInSqFt || existingFormData.propertyDetails?.area || "",
          purpose: existingFormData.propertyDetails?.purpose || "",
          furnishedStatus: existingFormData.propertyDetails?.furnishedStatus || existingFormData.propertyDetails?.furnishing || "",
          additionalItems: existingFormData.propertyDetails?.additionalItems || existingFormData.propertyDetails?.description || "",
          address: {
            flatNo: existingFormData.propertyDetails?.address?.flatNo || "",
            society: existingFormData.propertyDetails?.address?.society || "",
            area: existingFormData.propertyDetails?.address?.area || "",
            city: existingFormData.propertyDetails?.address?.city || "",
            state: existingFormData.propertyDetails?.address?.state || "",
            pincode: existingFormData.propertyDetails?.address?.pincode || "",
            district: existingFormData.propertyDetails?.address?.district || "",
            landmark: existingFormData.propertyDetails?.address?.landmark || ""
          }
        },
        rentalTerms: {
          startDate: existingFormData.rentalTerms?.startDate || existingFormData.rentalTerms?.start_date || "",
          endDate: existingFormData.rentalTerms?.endDate || existingFormData.rentalTerms?.end_date || "",
          tenure: existingFormData.rentalTerms?.tenure || "11_months",
          deposit: existingFormData.rentalTerms?.deposit || existingFormData.rentalTerms?.security_deposit || 0,
          monthlyRent: existingFormData.rentalTerms?.monthlyRent || existingFormData.rentalTerms?.monthly_rent || 0,
          dueDate: existingFormData.rentalTerms?.dueDate || existingFormData.rentalTerms?.due_date || 1,
          maintenance: existingFormData.rentalTerms?.maintenance || "included",
          maintenanceAmount: existingFormData.rentalTerms?.maintenanceAmount || existingFormData.rentalTerms?.maintenance_amount || 0,
          noticePeriod: existingFormData.rentalTerms?.noticePeriod || existingFormData.rentalTerms?.notice_period || 1,
          minimumStay: existingFormData.rentalTerms?.minimumStay || existingFormData.rentalTerms?.minimum_stay || "",
          furniture: existingFormData.rentalTerms?.furniture || ""
        },
        additionalClauses: existingFormData.additionalClauses || [],
      };
      
      console.log("Form data being loaded:", formDataToLoad);
      reset(formDataToLoad);
      
      // Load existing documents
      if (existingFormData.documents) {
        setDocuments(existingFormData.documents);
      }
      
      // Start from step 1 to allow editing from beginning
      setCurrentStep(1);
      setPdfState('idle');
      
      toast({
        title: "Loaded for Editing",
        description: "Agreement data loaded. You can now make changes and generate an updated PDF.",
      });
    }
  }, [editingAgreement, isOpen, reset, toast]);

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
  
  // Get dynamic steps for current language
  const STEPS = getSteps(t);

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
        await apiRequest("POST", "/api/addresses", address);
      } catch (error) {
        console.error("Error saving address:", error);
      }
    }
  };

  // Step validation functions
  const validateStep = (stepNumber: number): boolean => {
    const currentFormData = watch(); // Get live form data
    switch (stepNumber) {
      case 1:
        return !!(currentFormData.language); // Only require language selection, customer is optional
      case 2:
        console.log("=== STEP 2 VALIDATION DEBUG ===");
        console.log("currentFormData:", JSON.stringify(currentFormData, null, 2));
        console.log("ownerDetails name:", currentFormData.ownerDetails?.name);
        console.log("ownerDetails mobile:", currentFormData.ownerDetails?.mobile);
        console.log("ownerDetails age:", currentFormData.ownerDetails?.age);
        console.log("address flatNo:", currentFormData.ownerDetails?.address?.flatNo);
        console.log("address society:", currentFormData.ownerDetails?.address?.society);
        console.log("address area:", currentFormData.ownerDetails?.address?.area);
        console.log("address city:", currentFormData.ownerDetails?.address?.city);
        console.log("address state:", currentFormData.ownerDetails?.address?.state);
        console.log("address pincode:", currentFormData.ownerDetails?.address?.pincode);
        
        const checks = {
          name: !!currentFormData.ownerDetails?.name,
          mobile: !!currentFormData.ownerDetails?.mobile,
          age: !!currentFormData.ownerDetails?.age,
          flatNo: !!currentFormData.ownerDetails?.address?.flatNo,
          society: !!currentFormData.ownerDetails?.address?.society,
          area: !!currentFormData.ownerDetails?.address?.area,
          city: !!currentFormData.ownerDetails?.address?.city,
          state: !!currentFormData.ownerDetails?.address?.state,
          pincode: !!currentFormData.ownerDetails?.address?.pincode
        };
        
        console.log("Field validation checks:", checks);
        
        const isValid = checks.name && checks.mobile && checks.age && 
                       checks.flatNo && checks.society && checks.area && 
                       checks.city && checks.state && checks.pincode;
        
        console.log("Step 2 is valid:", isValid);
        console.log("=== END STEP 2 VALIDATION DEBUG ===");
        return isValid;
      case 3:
        return !!(
          currentFormData.tenantDetails?.name &&
          currentFormData.tenantDetails?.mobile &&
          currentFormData.tenantDetails?.age &&
          currentFormData.tenantDetails?.address?.flatNo &&
          currentFormData.tenantDetails?.address?.society &&
          currentFormData.tenantDetails?.address?.area &&
          currentFormData.tenantDetails?.address?.city &&
          currentFormData.tenantDetails?.address?.state &&
          currentFormData.tenantDetails?.address?.pincode
        );
      case 4:
        return !!(
          currentFormData.propertyDetails?.address &&
          currentFormData.propertyDetails?.type &&
          currentFormData.rentalTerms?.monthlyRent &&
          currentFormData.rentalTerms?.startDate &&
          currentFormData.rentalTerms?.endDate &&
          currentFormData.rentalTerms?.tenure &&
          currentFormData.rentalTerms?.deposit
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
      setAddressSearch({ owner: "", tenant: "", property: "" });
      setShowAddressSuggestions({ owner: false, tenant: false, property: false });
      // Reset PDF state
      setPdfState('idle');
      setPdfData(null);
      setCreatedAgreementId(null);
      reset();
    }
  }, [isOpen, agreementId, reset, toast]);

  const nextStep = async () => {
    if (currentStep < STEPS.length && canProceed(currentStep)) {
      // Only clear fields when creating new agreements, not when editing
      if (!editingAgreement) {
        // Clear fields when moving between sections (only for new agreements)
        if (currentStep === 1) {
          // Moving from owner to tenant - clear all tenant fields
          setValue("tenantDetails.name", "");
          setValue("tenantDetails.mobile", "");
          setValue("tenantDetails.email", "");
          setValue("tenantDetails.age", 0);
          setValue("tenantDetails.occupation", "");
          setValue("tenantDetails.company", "");
          setValue("tenantDetails.address.flatNo", "");
          setValue("tenantDetails.address.society", "");
          setValue("tenantDetails.address.area", "");
          setValue("tenantDetails.address.city", "");
          setValue("tenantDetails.address.state", "");
          setValue("tenantDetails.address.pincode", "");
          
          console.log("Cleared tenant fields when moving from owner to tenant step");
        } else if (currentStep === 2) {
          // Moving from tenant to property - clear all property fields
          setValue("propertyDetails.type", "");
          setValue("propertyDetails.place", "");
          setValue("propertyDetails.areaInSqFt", 0);
          setValue("propertyDetails.purpose", "");
          setValue("propertyDetails.furnishedStatus", "");
          setValue("propertyDetails.additionalItems", "");
          setValue("propertyDetails.address.flatNo", "");
          setValue("propertyDetails.address.society", "");
          setValue("propertyDetails.address.area", "");
          setValue("propertyDetails.address.city", "");
          setValue("propertyDetails.address.state", "");
          setValue("propertyDetails.address.pincode", "");
          
          console.log("Cleared property fields when moving from tenant to property step");
        } else if (currentStep === 3) {
          // Moving from property to rental terms - clear rental terms
          setValue("rentalTerms.monthlyRent", 0);
          setValue("rentalTerms.deposit", 0);
          setValue("rentalTerms.tenure", "11_months");
          setValue("rentalTerms.startDate", "");
          setValue("rentalTerms.endDate", "");
          setValue("rentalTerms.dueDate", 0);
          setValue("rentalTerms.noticePeriod", 0);
          setValue("rentalTerms.minimumStay", "");
          setValue("rentalTerms.maintenance", "included");
          setValue("rentalTerms.maintenanceCharge", "");
          
          console.log("Cleared rental terms when moving from property to rental terms step");
        } else if (currentStep === 4) {
          // Moving from rental terms to final step - clear additional clauses
          setValue("additionalClauses", []);
          
          console.log("Cleared additional clauses when moving to final step");
        }
      } else {
        console.log("Skipping field clearing in editing mode");
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
    const selectedCustomer = customersData?.customers.find(c => c.id === watchedCustomerId);
    
    if (!selectedCustomer) {
      toast({
        title: "No Customer Selected",
        description: "Please select a customer first to copy their details.",
        variant: "destructive",
      });
      return;
    }

    // Clear any existing tenant details first
    setValue("tenantDetails.name", "");
    setValue("tenantDetails.mobile", "");
    setValue("tenantDetails.email", "");
    setValue("tenantDetails.age", 0);
    setValue("tenantDetails.occupation", "");
    setValue("tenantDetails.company", "");
    setValue("tenantDetails.address.flatNo", "");
    setValue("tenantDetails.address.society", "");
    setValue("tenantDetails.address.area", "");
    setValue("tenantDetails.address.city", "");
    setValue("tenantDetails.address.state", "");
    setValue("tenantDetails.address.pincode", "");

    // Copy customer details to tenant fields
    setValue("tenantDetails.name", selectedCustomer.name);
    setValue("tenantDetails.mobile", selectedCustomer.mobile);
    setValue("tenantDetails.email", selectedCustomer.email || "");
    
    toast({
      title: "Details Copied",
      description: `${selectedCustomer.name}'s details have been copied to tenant fields.`,
    });
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
    
    toast({
      title: "Details Copied",
      description: `${selectedCustomer.name}'s details have been copied to landlord fields.`,
    });
  };

  // Address autocomplete from societies database
  const [societySuggestions, setSocietySuggestions] = useState<Array<{
    id: string;
    societyName: string;
    area: string;
    city: string;
    pincode: string;
    state: string;
  }>>([]);
  const [showSocietySuggestions, setShowSocietySuggestions] = useState(false);
  
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
    setValue(`${fieldPrefix}.address.society`, society.societyName);
    setValue(`${fieldPrefix}.address.area`, society.area);
    setValue(`${fieldPrefix}.address.city`, society.city);
    setValue(`${fieldPrefix}.address.pincode`, society.pincode);
    setValue(`${fieldPrefix}.address.state`, society.state);
    
    setShowSocietySuggestions(false);
    
    toast({
      title: "Address Auto-filled",
      description: `Auto-filled from ${society.societyName}`,
    });
  };

  // Enhanced customer lookup for both mobile and name
  const fetchCustomerInfo = async (searchTerm: string, searchType: 'mobile' | 'name', userType: 'owner' | 'tenant') => {
    if (!searchTerm || searchTerm.trim().length < 3) return;
    
    try {
      let customer = null;
      
      if (searchType === 'mobile' && searchTerm.replace(/\D/g, '').length === 10) {
        console.log(`Looking up customer by mobile: ${searchTerm}`);
        const response = await apiRequest("GET", `/api/customers/by-mobile?mobile=${encodeURIComponent(searchTerm)}`);
        customer = await response.json();
      } else if (searchType === 'name' && searchTerm.trim().length >= 3) {
        console.log(`Looking up customer by name: ${searchTerm}`);
        const response = await apiRequest("GET", `/api/customers?search=${encodeURIComponent(searchTerm)}`);
        const data = await response.json();
        // Find exact or close match
        const customers = data.customers || [];
        customer = customers.find((c: any) => 
          c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          searchTerm.toLowerCase().includes(c.name.toLowerCase())
        );
      }
      
      if (customer) {
        console.log(`Found customer:`, customer);
        fillCustomerDetails(customer, userType);
        
        toast({
          title: "Customer Found ✓",
          description: `Auto-filled details for ${customer.name}`,
          variant: "default",
        });
      }
    } catch (error) {
      console.log("Customer lookup error:", error);
      if (error instanceof Error && error.message.includes('404')) {
        console.log(`No existing customer found for ${searchType}: ${searchTerm}`);
      } else {
        console.error("Customer lookup error:", error);
        toast({
          title: "Lookup Failed",
          description: "Could not check for existing customer details",
          variant: "destructive",
        });
      }
    }
  };

  // Fill customer details including any associated address
  const fillCustomerDetails = (customer: any, userType: 'owner' | 'tenant') => {
    if (userType === 'owner') {
      setValue("ownerDetails.name", customer.name);
      setValue("ownerDetails.mobile", customer.mobile);
      setValue("ownerDetails.email", customer.email || "");
      
      // Fill address if available (from most recent agreement)
      fillAssociatedAddress(customer.id, userType);
    } else {
      setValue("tenantDetails.name", customer.name);
      setValue("tenantDetails.mobile", customer.mobile);
      setValue("tenantDetails.email", customer.email || "");
      
      // Fill address if available (from most recent agreement)
      fillAssociatedAddress(customer.id, userType);
    }
  };

  // Fill associated address from customer's previous agreements
  const fillAssociatedAddress = async (customerId: string, userType: 'owner' | 'tenant') => {
    try {
      const response = await apiRequest("GET", `/api/agreements?customerId=${customerId}&limit=1`);
      const data = await response.json();
      const agreements = data.agreements || [];
      
      if (agreements.length > 0) {
        const lastAgreement = agreements[0];
        let addressData = null;
        
        // Get address from owner or tenant details based on user type
        if (userType === 'owner' && lastAgreement.ownerDetails?.address) {
          addressData = lastAgreement.ownerDetails.address;
        } else if (userType === 'tenant' && lastAgreement.tenantDetails?.address) {
          addressData = lastAgreement.tenantDetails.address;
        }
        
        if (addressData) {
          const prefix = userType === 'owner' ? 'ownerDetails' : 'tenantDetails';
          setValue(`${prefix}.address.flatNo`, addressData.flatNo || "");
          setValue(`${prefix}.address.society`, addressData.society || "");
          setValue(`${prefix}.address.area`, addressData.area || "");
          setValue(`${prefix}.address.city`, addressData.city || "");
          setValue(`${prefix}.address.state`, addressData.state || "");
          setValue(`${prefix}.address.pincode`, addressData.pincode || "");
          setValue(`${prefix}.address.district`, addressData.district || "");
          setValue(`${prefix}.address.landmark`, addressData.landmark || "");
          
          toast({
            title: "Address Auto-filled ✓",
            description: "Filled address from previous agreement",
          });
        }
      }
    } catch (error) {
      console.log("Could not fetch associated address:", error);
    }
  };

  const handleDocumentUpload = (type: string, result: { url: string; filename: string; originalName: string; size: number }) => {
    console.log(`Document upload complete - Type: ${type}, URL: ${result.url}, FileName: ${result.originalName}`);
    
    // Store file information for document processing
    setDocuments(prev => ({ 
      ...prev, 
      [type]: result.url
    }));
    
    toast({
      title: "Document uploaded",
      description: `${result.originalName} has been uploaded successfully.`,
    });
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
        ownerDocuments: {
          aadharUrl: documents.ownerAadhar || null,
          panUrl: documents.ownerPan || null
        },
        tenantDocuments: {
          aadharUrl: documents.tenantAadhar || null,
          panUrl: documents.tenantPan || null
        },
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

  // Enhanced PDF generation function for Step 5
  const handlePdfGeneration = async () => {
    const formData = watch();
    
    if (pdfState === 'idle') {
      setPdfState('creating');
      
      try {
        let agreement;
        
        if (editingAgreement) {
          // Update existing agreement
          agreement = await updateAgreement(formData, editingAgreement.id);
          console.log('Updated existing agreement:', agreement.agreementNumber);
        } else {
          // Create new agreement
          agreement = await finalizeAgreement(formData);
          console.log('Created new agreement:', agreement.agreementNumber);
        }
        
        // Then generate the PDF
        const selectedLanguage = formData.language || 'english';
        console.log('Generating PDF for agreement:', agreement.agreementNumber);
        
        // First get the active PDF template for rental agreements in the selected language
        const templatesResponse = await fetch(`/api/pdf-templates?documentType=rental_agreement&language=${selectedLanguage}`);
        const templates = await templatesResponse.json();
        const activeTemplate = templates.find((t: any) => t.isActive);
        
        if (!activeTemplate) {
          throw new Error(`No active PDF template found for ${selectedLanguage} language.`);
        }
        
        console.log('Using template:', activeTemplate.name, 'for language:', selectedLanguage);

        // Generate PDF with the active template
        const response = await fetch('/api/agreements/generate-pdf', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...formData,
            language: selectedLanguage,
            agreementNumber: agreement.agreementNumber,
            // Include document URLs for embedding
            documents: documents,
            ownerDocuments: {
              aadharUrl: documents.ownerAadhar || null,
              panUrl: documents.ownerPan || null
            },
            tenantDocuments: {
              aadharUrl: documents.tenantAadhar || null,
              panUrl: documents.tenantPan || null
            },
            propertyDocuments: {
              urls: documents.propertyDocuments || null
            }
          }),
        });

        if (response.ok) {
          const result = await response.json();
          setPdfData({
            html: result.html,
            agreementNumber: agreement.agreementNumber
          });
          setPdfState('ready');
          
          toast({
            title: "PDF Generated Successfully", 
            description: `Agreement ${agreement.agreementNumber} PDF is ready for download.${editingAgreement ? ' (Updated)' : ''}`,
          });
        } else {
          throw new Error('Failed to generate PDF');
        }
      } catch (error) {
        console.error('PDF generation error:', error);
        setPdfState('idle');
        toast({
          title: "Error",
          description: "Failed to create agreement and generate PDF.",
          variant: "destructive",
        });
      }
    } else if (pdfState === 'ready' && pdfData) {
      // Download the generated PDF
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Rental Agreement - ${pdfData.agreementNumber}</title>
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
            ${pdfData.html}
          </body>
          </html>
        `);
        printWindow.document.close();
      }
    }
  };

  // Word document generation function
  const handleWordGeneration = async () => {
    const formData = watch();
    
    try {
      let agreement;
      
      if (editingAgreement) {
        // Update existing agreement
        agreement = await updateAgreement(formData, editingAgreement.id);
      } else {
        // Create new agreement
        agreement = await finalizeAgreement(formData);
      }
      
      const selectedLanguage = formData.language || 'english';
      
      // Generate Word document
      const response = await fetch('/api/agreements/generate-word', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          language: selectedLanguage,
          agreementNumber: agreement.agreementNumber,
          documents: documents,
          ownerDocuments: {
            aadharUrl: documents.ownerAadhar || null,
            panUrl: documents.ownerPan || null
          },
          tenantDocuments: {
            aadharUrl: documents.tenantAadhar || null,
            panUrl: documents.tenantPan || null
          },
          propertyDocuments: {
            urls: documents.propertyDocuments || null
          }
        }),
      });

      if (response.ok) {
        // Create download link for Word document
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rental_agreement_${agreement.agreementNumber}.docx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        toast({
          title: "Word Document Downloaded",
          description: `Agreement ${agreement.agreementNumber} has been downloaded as Word document.`,
        });
      } else {
        throw new Error('Failed to generate Word document');
      }
    } catch (error) {
      console.error('Word generation error:', error);
      toast({
        title: "Error",
        description: "Failed to generate Word document.",
        variant: "destructive",
      });
    }
  };

  const downloadAgreement = async () => {
    const formData = watch();
    if (!formData || !formData.language) {
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
      const response = await fetch('/api/agreements/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          language: selectedLanguage
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
        ownerDocuments: {
          aadharUrl: documents.ownerAadhar || null,
          panUrl: documents.ownerPan || null
        },
        tenantDocuments: {
          aadharUrl: documents.tenantAadhar || null,
          panUrl: documents.tenantPan || null
        },
        startDate: data.rentalTerms?.startDate || new Date().toISOString().split('T')[0],
        endDate: data.rentalTerms?.endDate || new Date(Date.now() + 11 * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        agreementDate: new Date().toISOString().split('T')[0],
      };

      console.log('Creating agreement with language:', agreementData.language);

      const response = await apiRequest("POST", "/api/agreements", agreementData);
      const agreement = await response.json();
      
      // Store the created agreement ID for PDF generation
      setCreatedAgreementId(agreement.id);

      queryClient.invalidateQueries({ queryKey: ["/api/agreements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      
      toast({
        title: "Agreement created",
        description: `Agreement ${agreement.agreementNumber} has been created successfully.`,
      });

      return agreement;
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

  const updateAgreement = async (data: AgreementFormData, agreementId: string) => {
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
        ownerDocuments: {
          aadharUrl: documents.ownerAadhar || null,
          panUrl: documents.ownerPan || null
        },
        tenantDocuments: {
          aadharUrl: documents.tenantAadhar || null,
          panUrl: documents.tenantPan || null
        },
        propertyDocuments: {
          urls: documents.propertyDocs || null
        },
        // Keep the original dates if editing, use form data if available
        startDate: data.rentalTerms?.startDate || editingAgreement?.startDate || new Date().toISOString().split('T')[0],
        endDate: data.rentalTerms?.endDate || editingAgreement?.endDate || new Date(Date.now() + 11 * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        agreementDate: editingAgreement?.agreementDate || new Date().toISOString().split('T')[0],
        // Store complete form data for future editing
        formData: JSON.stringify({
          ...data,
          documents: documents
        }),
        updatedAt: new Date().toISOString()
      };

      console.log('Updating agreement with language:', agreementData.language);

      const response = await apiRequest("PUT", `/api/agreements/${agreementId}`, agreementData);
      const agreement = await response.json();
      
      // Use the existing agreement number
      const updatedAgreement = {
        ...agreement,
        agreementNumber: editingAgreement.agreementNumber
      };

      queryClient.invalidateQueries({ queryKey: ["/api/agreements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      
      toast({
        title: "Agreement updated",
        description: `Agreement ${updatedAgreement.agreementNumber} has been updated successfully.`,
      });

      return updatedAgreement;
    } catch (error) {
      console.error("Update agreement error:", error);
      toast({
        title: "Error",
        description: "Failed to update agreement.",
        variant: "destructive",
      });
      throw error;
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
                <Label htmlFor="customerId">{t("selectCustomer")} <span className="text-sm text-gray-500">(Optional)</span></Label>
                <Select value={watch("customerId") || "none"} onValueChange={(value) => setValue("customerId", value === "none" ? "" : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select existing customer (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No customer selected - Enter details manually</SelectItem>
                    {customersData?.customers.filter(customer => customer.id && customer.id.trim() !== '').map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name} - {customer.mobile}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  You can select an existing customer to copy their details, or leave blank to enter landlord/tenant details manually
                </p>
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
                  onBlur={(e) => fetchCustomerInfo(e.target.value, 'mobile', 'owner')}
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
                      fileName="Owner Aadhar Card"
                      fileType="image/jpeg"
                      onRemove={() => setDocuments(prev => ({ ...prev, ownerAadhar: "" }))}
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
                      fileName="Owner PAN Card"
                      fileType="image/jpeg"
                      onRemove={() => setDocuments(prev => ({ ...prev, ownerPan: "" }))}
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
                  {...register("tenantDetails.name", { required: "Name is required" })} 
                  placeholder={t("enterTenantFullName")}
                  onChange={(e) => {
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
                  }}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter name to auto-fill mobile and address
                </p>
              </div>
              <div>
                <Label>{t("mobileNumber")}</Label>
                <Input 
                  {...register("tenantDetails.mobile", { required: "Mobile is required" })} 
                  placeholder={t("mobileNumberPlaceholder")} 
                  onChange={(e) => {
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
                  }}
                  onBlur={(e) => fetchCustomerInfo(e.target.value, 'mobile', 'tenant')}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter mobile number to auto-fill name and email
                </p>
              </div>
              <div>
                <Label>{t("tenantAge")}</Label>
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
                  onWheel={(e) => e.currentTarget.blur()} // Prevent scroll wheel issues
                />
                {errors.tenantDetails?.age && (
                  <p className="text-sm text-red-600 mt-1">{errors.tenantDetails.age.message}</p>
                )}
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

            {/* Document Upload for Tenant */}
            <div>
              <h4 className="text-md font-semibold text-gray-800 mb-4">{t("documents")} {t("optional")}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">{t("aadharCard")}</Label>
                  {documents.tenantAadhar ? (
                    <FilePreview
                      fileUrl={documents.tenantAadhar}
                      fileName="Tenant Aadhar Card"
                      fileType="image/jpeg"
                      onRemove={() => setDocuments(prev => ({ ...prev, tenantAadhar: "" }))}
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
                      fileName="Tenant PAN Card"
                      fileType="image/jpeg"
                      onRemove={() => setDocuments(prev => ({ ...prev, tenantPan: "" }))}
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>{t("flatNo")}</Label>
                    <Input {...register("propertyDetails.address.flatNo", { required: "Property address is required" })} />
                  </div>
                  <div className="relative">
                    <Label>{t("societyBuilding")}</Label>
                    <Input 
                      {...register("propertyDetails.address.society", { 
                        required: "Society/Building name is required",
                        onChange: (e) => {
                          const value = e.target.value;
                          console.log(`Property society input changed to: "${value}"`);
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
                            onClick={() => handleSocietySelect(society, 'propertyDetails.address')}
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
                    <Input {...register("propertyDetails.address.area", { required: "Area is required" })} />
                  </div>
                  <div>
                    <Label>{t("city")}</Label>
                    <Input {...register("propertyDetails.address.city", { required: "City is required" })} />
                  </div>
                  <div>
                    <Label>{t("state")}</Label>
                    <Input {...register("propertyDetails.address.state", { required: "State is required" })} placeholder="e.g., Gujarat, Maharashtra" />
                  </div>
                  <div>
                    <Label>{t("pincode")}</Label>
                    <Input {...register("propertyDetails.address.pincode", { required: "Pincode is required" })} placeholder="e.g., 380001" />
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
                        fileName="Property Documents"
                        fileType="application/pdf"
                        onRemove={() => setDocuments(prev => ({ ...prev, propertyDocuments: "" }))}
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
                  <Input 
                    type="number" 
                    min="0"
                    step="1"
                    {...register("rentalTerms.deposit", { 
                      required: "Security deposit is required",
                      min: { value: 0, message: "Deposit cannot be negative" }
                    })} 
                    placeholder={t("amountPlaceholder")}
                    onWheel={(e) => e.currentTarget.blur()}
                  />
                </div>
                <div>
                  <Label>{t("monthlyRent")} (₹)</Label>
                  <Input 
                    type="number" 
                    min="1"
                    step="1"
                    {...register("rentalTerms.monthlyRent", { 
                      required: "Monthly rent is required",
                      min: { value: 1, message: "Monthly rent must be at least ₹1" }
                    })} 
                    placeholder={t("amountPlaceholder")}
                    onWheel={(e) => e.currentTarget.blur()}
                  />
                </div>
                <div>
                  <Label>{t("dueDateLabel")}</Label>
                  <Input 
                    type="number" 
                    min="1"
                    max="31"
                    step="1"
                    {...register("rentalTerms.dueDate", { 
                      required: "Due date is required",
                      min: { value: 1, message: "Due date must be between 1-31" },
                      max: { value: 31, message: "Due date must be between 1-31" }
                    })} 
                    placeholder={t("dueDateExample")}
                    onWheel={(e) => e.currentTarget.blur()}
                  />
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
                  <Label>{t("noticePeriod")}</Label>
                  <Input 
                    type="number" 
                    min="1"
                    step="1"
                    {...register("rentalTerms.noticePeriod", { required: "Notice period is required" })} 
                    placeholder={t("noticePeriodExample")}
                    onWheel={(e) => e.currentTarget.blur()}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Enter notice period in months
                  </p>
                </div>
                <div>
                  <Label>{t("minimumStay")}</Label>
                  <Input 
                    type="number" 
                    min="1"
                    step="1"
                    {...register("rentalTerms.minimumStay", { required: "Minimum stay is required" })} 
                    placeholder={t("minimumStayExample")}
                    onWheel={(e) => e.currentTarget.blur()}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Enter minimum stay period in months
                  </p>
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

            {/* Document Generation Section */}
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-6">
                <h4 className="text-md font-semibold text-gray-800 mb-4">Create Agreement & Generate Documents</h4>
                <p className="text-sm text-gray-600 mb-4">
                  Review your agreement details above and choose your preferred document format to download.
                </p>
                
                {/* PDF Generation Button */}
                <div className="mb-4">
                  <Button 
                    onClick={handlePdfGeneration}
                    disabled={pdfState === 'creating' || !canProceed(currentStep)}
                    className={`w-full h-12 text-lg font-semibold ${
                      pdfState === 'idle' 
                        ? "bg-blue-600 hover:bg-blue-700 text-white" 
                        : pdfState === 'creating'
                        ? "bg-blue-400 cursor-not-allowed text-white"
                        : "bg-green-600 hover:bg-green-700 text-white"
                    }`}
                    aria-live="polite"
                  >
                    {pdfState === 'creating' && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                    {pdfState === 'idle' && "Create PDF"}
                    {pdfState === 'creating' && "Creating PDF..."}
                    {pdfState === 'ready' && (
                      <>
                        <Download className="mr-2 h-5 w-5" />
                        Download PDF
                      </>
                    )}
                  </Button>
                  {pdfState === 'ready' && pdfData && (
                    <p className="text-sm text-green-600 mt-2 text-center">
                      ✓ Agreement {pdfData.agreementNumber} created successfully! Click above to download the PDF.
                    </p>
                  )}
                </div>

                {/* Word Document Generation Button */}
                <div className="border-t pt-4">
                  <Button 
                    onClick={handleWordGeneration}
                    disabled={!canProceed(currentStep)}
                    className="w-full h-12 text-lg font-semibold bg-green-600 hover:bg-green-700 text-white"
                    variant="outline"
                  >
                    <Download className="mr-2 h-5 w-5" />
                    Download as Word Document (.docx)
                  </Button>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Alternative format for editing in Microsoft Word or similar applications
                  </p>
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
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-bold">
                {editingAgreement ? `Edit Agreement ${editingAgreement.agreementNumber || ''}` : t("createNewAgreement")}
              </DialogTitle>
              {editingAgreement && (
                <div className="bg-amber-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                  Editing Mode
                </div>
              )}
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
