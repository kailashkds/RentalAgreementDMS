import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { X, ArrowLeft, ArrowRight, Plus, Trash2, Copy } from "lucide-react";
import { useForm } from "react-hook-form";
import { useCustomers } from "@/hooks/useCustomers";
import { useSocieties } from "@/hooks/useSocieties";
import { useAddresses } from "@/hooks/useAddresses";
import { ObjectUploader } from "@/components/ObjectUploader";
import CustomerModal from "@/components/CustomerModal";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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

  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(1);
      setDocuments({});
      reset();
    }
  }, [isOpen, reset]);

  const nextStep = () => {
    if (currentStep < STEPS.length && canProceed(currentStep)) {
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

      const response = await apiRequest("POST", "/api/agreements", agreementData);
      const agreement = await response.json();

      queryClient.invalidateQueries({ queryKey: ["/api/agreements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      
      toast({
        title: "Agreement created",
        description: `Agreement ${agreement.agreementNumber} has been created successfully.`,
      });
      
      onClose();
    } catch (error) {
      console.error("Finalize agreement error:", error);
      toast({
        title: "Error",
        description: "Failed to create agreement.",
        variant: "destructive",
      });
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800">Step 1: Customer Selection & Language</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="customerId">Select Customer</Label>
                <Select value={watch("customerId")} onValueChange={(value) => setValue("customerId", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Search for existing customer..." />
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
                  Create New Customer
                </Button>
              </div>

              <div>
                <Label htmlFor="language">Agreement Language</Label>
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
            <h3 className="text-lg font-semibold text-gray-800">Step 2: Landlord Details</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="ownerName">Full Name</Label>
                <Input {...register("ownerDetails.name", { required: "Name is required" })} placeholder="Enter landlord's full name" />
                {errors.ownerDetails?.name && (
                  <p className="text-sm text-red-600 mt-1">{errors.ownerDetails.name.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="ownerMobile">Mobile Number</Label>
                <Input {...register("ownerDetails.mobile", { required: "Mobile is required" })} placeholder="+91 XXXXXXXXXX" />
              </div>
              <div>
                <Label htmlFor="ownerAge">Age</Label>
                <Input type="number" {...register("ownerDetails.age", { required: "Age is required" })} placeholder="Age" />
              </div>
              <div>
                <Label htmlFor="ownerOccupation">Occupation</Label>
                <Input {...register("ownerDetails.occupation")} placeholder="Occupation" />
              </div>
              <div>
                <Label htmlFor="ownerAadhar">Aadhar Number</Label>
                <Input {...register("ownerDetails.aadhar")} placeholder="XXXX XXXX XXXX" />
              </div>
              <div>
                <Label htmlFor="ownerPan">PAN Card Number</Label>
                <Input {...register("ownerDetails.pan")} placeholder="ABCDE1234F" />
              </div>
            </div>

            {/* Address Section */}
            <div>
              <h4 className="text-md font-semibold text-gray-800 mb-4">Address Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Flat/House No.</Label>
                  <Input {...register("ownerDetails.address.flatNo", { required: "Flat/House No. is required" })} />
                </div>
                <div className="relative">
                  <Label>Society/Apartment</Label>
                  <Input 
                    value={watch("ownerDetails.address.society") || ""}
                    onChange={(e) => handleSocietyInputChange('owner', e.target.value)}
                    placeholder="Start typing society name..."
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
                  <Label>Area</Label>
                  <Input {...register("ownerDetails.address.area", { required: "Area is required" })} />
                </div>
                <div>
                  <Label>City</Label>
                  <Input {...register("ownerDetails.address.city", { required: "City is required" })} />
                </div>
              </div>
            </div>

            {/* Document Upload */}
            <div>
              <h4 className="text-md font-semibold text-gray-800 mb-4">Documents (Optional)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Aadhar Card</Label>
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
                          {documents.ownerAadhar ? "Aadhar Card Uploaded" : "Upload Aadhar Card"}
                        </p>
                        <p className="text-xs text-gray-500">PDF, JPG, PNG (Max 5MB)</p>
                      </div>
                    </div>
                  </ObjectUploader>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">PAN Card</Label>
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
                          {documents.ownerPan ? "PAN Card Uploaded" : "Upload PAN Card"}
                        </p>
                        <p className="text-xs text-gray-500">PDF, JPG, PNG (Max 5MB)</p>
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
              <h3 className="text-lg font-semibold text-gray-800">Step 3: Tenant Details</h3>
              <Button
                type="button"
                variant="outline"
                onClick={copyFromCustomer}
                disabled={!watchedCustomerId}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy from Customer
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label>Full Name</Label>
                <Input {...register("tenantDetails.name", { required: "Name is required" })} placeholder="Enter tenant's full name" />
              </div>
              <div>
                <Label>Mobile Number</Label>
                <Input {...register("tenantDetails.mobile", { required: "Mobile is required" })} placeholder="+91 XXXXXXXXXX" />
              </div>
              <div>
                <Label>Age</Label>
                <Input type="number" {...register("tenantDetails.age", { required: "Age is required" })} placeholder="Age" />
              </div>
              <div>
                <Label>Occupation</Label>
                <Input {...register("tenantDetails.occupation")} placeholder="Occupation" />
              </div>
            </div>

            {/* Tenant Address Section */}
            <div>
              <h4 className="text-md font-semibold text-gray-800 mb-4">Address Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Flat/House No.</Label>
                  <Input {...register("tenantDetails.address.flatNo", { required: "Flat/House No. is required" })} />
                </div>
                <div className="relative">
                  <Label>Society/Apartment</Label>
                  <Input 
                    value={watch("tenantDetails.address.society") || ""}
                    onChange={(e) => handleSocietyInputChange('tenant', e.target.value)}
                    placeholder="Start typing society name..."
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
                  <Label>Area</Label>
                  <Input {...register("tenantDetails.address.area", { required: "Area is required" })} />
                </div>
                <div>
                  <Label>City</Label>
                  <Input {...register("tenantDetails.address.city", { required: "City is required" })} />
                </div>
              </div>
            </div>

            {/* Document Upload for Tenant */}
            <div>
              <h4 className="text-md font-semibold text-gray-800 mb-4">Documents (Optional)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Aadhar Card</Label>
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
                          {documents.tenantAadhar ? "Aadhar Card Uploaded" : "Upload Aadhar Card"}
                        </p>
                        <p className="text-xs text-gray-500">PDF, JPG, PNG (Max 5MB)</p>
                      </div>
                    </div>
                  </ObjectUploader>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">PAN Card</Label>
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
                          {documents.tenantPan ? "PAN Card Uploaded" : "Upload PAN Card"}
                        </p>
                        <p className="text-xs text-gray-500">PDF, JPG, PNG (Max 5MB)</p>
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
            <h3 className="text-lg font-semibold text-gray-800">Step 4: Property Details & Rental Terms</h3>
            
            <div>
              <h4 className="text-md font-semibold text-gray-800 mb-4">Property Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Property Type</Label>
                  <Input {...register("propertyDetails.type", { required: "Property type is required" })} placeholder="e.g., 2BHK Apartment" />
                </div>
                <div>
                  <Label>Place of Agreement</Label>
                  <Input {...register("propertyDetails.place")} placeholder="City name" />
                </div>
              </div>
              
              <div className="mt-4">
                <h5 className="text-sm font-semibold text-gray-700 mb-3">Property Address</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Flat/House No.</Label>
                    <Input {...register("propertyDetails.address.flatNo", { required: "Property address is required" })} />
                  </div>
                  <div className="relative">
                    <Label>Society/Building</Label>
                    <Input 
                      value={watch("propertyDetails.address.society") || ""}
                      onChange={(e) => handleSocietyInputChange('property', e.target.value)}
                      placeholder="Start typing society name..."
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
                    <Label>Area</Label>
                    <Input {...register("propertyDetails.address.area", { required: "Area is required" })} />
                  </div>
                  <div>
                    <Label>City</Label>
                    <Input {...register("propertyDetails.address.city", { required: "City is required" })} />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-md font-semibold text-gray-800 mb-4">Agreement Duration</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Agreement Start Date</Label>
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
                  <Label>Agreement Tenure</Label>
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
                      <SelectValue placeholder="Select tenure" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="11_months">11 Months</SelectItem>
                      <SelectItem value="custom">Custom Duration</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Agreement End Date</Label>
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
                    <p className="text-xs text-gray-500 mt-1">Auto-calculated based on start date</p>
                  )}
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-md font-semibold text-gray-800 mb-4">Rental Terms</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Security Deposit (₹)</Label>
                  <Input type="number" {...register("rentalTerms.deposit", { required: "Security deposit is required" })} placeholder="Amount" />
                </div>
                <div>
                  <Label>Monthly Rent (₹)</Label>
                  <Input type="number" {...register("rentalTerms.monthlyRent", { required: "Monthly rent is required" })} placeholder="Amount" />
                </div>
                <div>
                  <Label>Due Date (Day of Month)</Label>
                  <Input type="number" {...register("rentalTerms.dueDate", { required: "Due date is required" })} placeholder="e.g., 5, 15" />
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-md font-semibold text-gray-800 mb-4">Additional Terms</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Maintenance Charge</Label>
                  <Select value={watch("rentalTerms.maintenance")} onValueChange={(value) => setValue("rentalTerms.maintenance", value as "included" | "excluded")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select option" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="included">Included in rent</SelectItem>
                      <SelectItem value="excluded">Excluded from rent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Notice Period (Months)</Label>
                  <Input type="number" {...register("rentalTerms.noticePeriod")} placeholder="1-3 months" />
                </div>
              </div>
              <div className="mt-4">
                <Label>Furniture/Items Included</Label>
                <Textarea {...register("rentalTerms.furniture")} rows={3} placeholder="List all furniture and items included..." />
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800">Step 5: Additional Conditions & Finalize</h3>
            
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-md font-semibold text-gray-800">Additional Clauses</h4>
                <Button type="button" onClick={addClause} size="sm" className="bg-green-600 hover:bg-green-700">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Clause
                </Button>
              </div>
              {watch("additionalClauses")?.map((clause, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <Label>Clause {index + 1}</Label>
                      <Textarea
                        {...register(`additionalClauses.${index}` as const)}
                        rows={2}
                        placeholder="Enter additional terms and conditions..."
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
                <h4 className="text-md font-semibold text-gray-800 mb-4">Agreement Summary</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Customer:</span>
                    <span className="ml-2 font-medium">
                      {customersData?.customers.find(c => c.id === watchedCustomerId)?.name || "Not selected"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Language:</span>
                    <span className="ml-2 font-medium">
                      {LANGUAGES.find(l => l.value === watchedLanguage)?.label || "English"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Property:</span>
                    <span className="ml-2 font-medium">{watch("propertyDetails.type") || "Not specified"}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Monthly Rent:</span>
                    <span className="ml-2 font-medium">₹{watch("rentalTerms.monthlyRent") || "0"}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Deposit:</span>
                    <span className="ml-2 font-medium">₹{watch("rentalTerms.deposit") || "0"}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Start Date:</span>
                    <span className="ml-2 font-medium">{watch("rentalTerms.startDate") || "Not set"}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">End Date:</span>
                    <span className="ml-2 font-medium">{watch("rentalTerms.endDate") || "Not set"}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Tenure:</span>
                    <span className="ml-2 font-medium">
                      {watch("rentalTerms.tenure") === "11_months" ? "11 Months" : "Custom Duration"}
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
              <DialogTitle className="text-xl font-bold">Create New Agreement</DialogTitle>
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

          <form onSubmit={handleSubmit(currentStep === STEPS.length ? finalizeAgreement : () => {})} className="space-y-6">
            {renderStep()}
            
            <div className="flex items-center justify-between pt-6 border-t border-gray-200">
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 1}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Previous
              </Button>
              <div className="flex space-x-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSubmit(saveDraft)}
                  className="bg-amber-600 text-white hover:bg-amber-700"
                >
                  Save as Draft
                </Button>
                {currentStep === STEPS.length ? (
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                    Create Agreement
                  </Button>
                ) : (
                  <Button 
                    type="button" 
                    onClick={nextStep} 
                    disabled={!canProceed(currentStep)}
                    className={`${
                      canProceed(currentStep) 
                        ? "bg-primary hover:bg-primary/90" 
                        : "bg-gray-400 cursor-not-allowed"
                    }`}
                  >
                    Next
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
