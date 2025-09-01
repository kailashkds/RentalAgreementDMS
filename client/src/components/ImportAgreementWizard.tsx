import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Upload, FileText, Shield, ArrowLeft, ArrowRight, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { LocalFileUploader } from "@/components/LocalFileUploader";
import { FilePreview } from "@/components/FilePreview";

interface ImportAgreementWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ImportAgreementData {
  customer: {
    id?: string;
    name: string;
    mobile?: string;
  };
  language: string;
  ownerDetails: {
    name: string;
    mobile: string;
    address?: {
      flatNo?: string;
      society?: string;
      area?: string;
      city?: string;
      state?: string;
      pincode?: string;
      district?: string;
      landmark?: string;
    };
  };
  tenantDetails: {
    name: string;
    mobile: string;
    address?: {
      flatNo?: string;
      society?: string;
      area?: string;
      city?: string;
      state?: string;
      pincode?: string;
      district?: string;
      landmark?: string;
    };
  };
  agreementPeriod: {
    startDate: string;
    endDate: string;
    tenure: "11_months" | "custom";
  };
  propertyAddress: {
    flatNo: string;
    society: string;
    area: string;
    city: string;
    state: string;
    pincode: string;
  };
}

export default function ImportAgreementWizard({ isOpen, onClose }: ImportAgreementWizardProps) {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  
  // Use permission-based check instead of role check
  const canViewAllCustomers = hasPermission('customer.view.all') || hasPermission('customer.manage');
  
  const [currentStep, setCurrentStep] = useState(!canViewAllCustomers ? 2 : 1); // Skip step 1 for customers
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Autofill and autocomplete state
  const mobileTimeout = useRef<NodeJS.Timeout | null>(null);
  const addressTimeout = useRef<NodeJS.Timeout | null>(null);
  const [societySuggestions, setSocietySuggestions] = useState<Array<{
    id: string;
    societyName: string;
    area: string;
    city: string;
    pincode: string;
    state: string;
  }>>([]);
  const [showSocietySuggestions, setShowSocietySuggestions] = useState(false);
  const [documents, setDocuments] = useState<Record<string, string | { filename: string; fileType: string; size: number } | undefined>>({});

  const [formData, setFormData] = useState<ImportAgreementData>({
    customer: { 
      id: !canViewAllCustomers ? (user as any)?.id || "" : "", 
      name: !canViewAllCustomers ? (user as any)?.name || "" : "", 
      mobile: !canViewAllCustomers ? (user as any)?.mobile || (user as any)?.phone || "" : "" 
    },
    language: "english",
    ownerDetails: { name: "", mobile: "" },
    tenantDetails: { name: "", mobile: "" },
    agreementPeriod: { 
      startDate: "", 
      endDate: "",
      tenure: "11_months"
    },
    propertyAddress: {
      flatNo: "",
      society: "",
      area: "",
      city: "",
      state: "",
      pincode: ""
    }
  });

  // Fetch customers for autocomplete
  const { data: customersData } = useQuery({
    queryKey: ["/api/customers"],
  });

  const customers = (customersData as any)?.customers || [];

  const handleNext = () => {
    if (validateStepWithToast(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 5));
    }
  };

  const handlePrevious = () => {
    const minStep = !canViewAllCustomers ? 2 : 1; // Customers can't go to step 1
    setCurrentStep(prev => Math.max(prev - 1, minStep));
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        // Skip validation for step 1 if customer is logged in
        if (!canViewAllCustomers) return true;
        return !!(formData.customer.id && formData.language);
      case 2:
        return !!(formData.ownerDetails.name && formData.ownerDetails.mobile);
      case 3:
        return !!(formData.tenantDetails.name && formData.tenantDetails.mobile);
      case 4:
        return !!(formData.agreementPeriod.startDate && formData.agreementPeriod.endDate &&
                 formData.propertyAddress.flatNo && formData.propertyAddress.society &&
                 formData.propertyAddress.area && formData.propertyAddress.city &&
                 formData.propertyAddress.state && formData.propertyAddress.pincode);
      default:
        return true;
    }
  };

  const validateStepWithToast = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!formData.customer.id || !formData.language) {
          toast({
            title: "Required fields missing",
            description: "Please select a customer and language",
            variant: "destructive",
          });
          return false;
        }
        return true;
      case 2:
        if (!formData.ownerDetails.name || !formData.ownerDetails.mobile) {
          toast({
            title: "Required fields missing",
            description: "Please fill in owner name and mobile number",
            variant: "destructive",
          });
          return false;
        }
        return true;
      case 3:
        if (!formData.tenantDetails.name || !formData.tenantDetails.mobile) {
          toast({
            title: "Required fields missing",
            description: "Please fill in tenant name and mobile number",
            variant: "destructive",
          });
          return false;
        }
        return true;
      case 4:
        if (!formData.agreementPeriod.startDate || !formData.agreementPeriod.endDate ||
            !formData.propertyAddress.flatNo || !formData.propertyAddress.society ||
            !formData.propertyAddress.area || !formData.propertyAddress.city ||
            !formData.propertyAddress.state || !formData.propertyAddress.pincode) {
          toast({
            title: "Required fields missing",
            description: "Please fill in all agreement period and property address fields",
            variant: "destructive",
          });
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleSubmit = async () => {
    if (!documents.notarizedDocument || !documents.policeVerificationDocument) {
      toast({
        title: "Required documents missing",
        description: "Please upload both notarized agreement and police verification certificate",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Submit agreement data with document URLs
      const agreementData = {
        customer: formData.customer,
        language: formData.language,
        ownerDetails: formData.ownerDetails,
        tenantDetails: formData.tenantDetails,
        agreementPeriod: formData.agreementPeriod,
        propertyAddress: formData.propertyAddress,
        notarizedDocumentUrl: documents.notarizedDocument,
        policeVerificationDocumentUrl: documents.policeVerificationDocument,
        status: 'active', // Imported agreements are active
        isImported: true
      };

      const response = await fetch('/api/agreements/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(agreementData),
      });

      if (!response.ok) {
        throw new Error('Failed to import agreement');
      }

      toast({
        title: "Agreement imported successfully",
        description: "The existing agreement has been added to your database",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/agreements"] });
      onClose();
    } catch (error) {
      console.error('Error importing agreement:', error);
      toast({
        title: "Import failed",
        description: "Failed to import the agreement. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setCurrentStep(1);
    setDocuments({});
    setFormData({
      customer: { id: "", name: "", mobile: "" },
      language: "english",
      ownerDetails: { name: "", mobile: "" },
      tenantDetails: { name: "", mobile: "" },
      agreementPeriod: { 
      startDate: "", 
      endDate: "",
      tenure: "11_months"
    },
      propertyAddress: {
        flatNo: "",
        society: "",
        area: "",
        city: "",
        state: "",
        pincode: ""
      }
    });
    onClose();
  };


  const handleDocumentUpload = (docType: string, result: any) => {
    // LocalFileUploader returns { url, filename, originalName, size } format
    if (result.url) {
      setDocuments(prev => ({
        ...prev,
        [docType]: result.url,
        [`${docType}_metadata`]: {
          filename: result.originalName || result.filename || "Uploaded Document",
          fileType: "application/pdf",
          size: result.size || 0
        }
      }));
      
      toast({
        title: "Upload successful",
        description: `${docType === 'notarizedDocument' ? 'Notarized document' : 'Police verification document'} uploaded successfully`,
      });
    }
  };

  // Address autocomplete from societies database
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

  const handleSocietySelect = (society: any, fieldType: 'property') => {
    setFormData(prev => ({
      ...prev,
      propertyAddress: {
        ...prev.propertyAddress,
        society: society.societyName,
        area: society.area,
        city: society.city,
        pincode: society.pincode,
        state: society.state
      }
    }));
    
    setShowSocietySuggestions(false);
    
    toast({
      title: "Address Auto-filled",
      description: `Auto-filled from ${society.societyName}`,
    });
  };

  // Enhanced customer lookup for mobile numbers
  const fetchCustomerInfo = async (searchTerm: string, searchType: 'mobile' | 'name', userType: 'owner' | 'tenant') => {
    if (!searchTerm || searchTerm.trim().length < 1) return;
    
    try {
      let customer = null;
      
      if (searchType === 'mobile' && searchTerm.replace(/\D/g, '').length === 10) {
        console.log(`Looking up customer by mobile: ${searchTerm}`);
        const response = await apiRequest("GET", `/api/customers/by-mobile?mobile=${encodeURIComponent(searchTerm)}`);
        customer = await response.json();
      } else if (searchType === 'name' && searchTerm.trim().length >= 1) {
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
      setFormData(prev => ({
        ...prev,
        ownerDetails: {
          ...prev.ownerDetails,
          name: customer.name,
          mobile: customer.mobile
        }
      }));
      
      // Fill address if available (from most recent agreement)
      fillAssociatedAddress(customer.id, userType);
    } else {
      setFormData(prev => ({
        ...prev,
        tenantDetails: {
          ...prev.tenantDetails,
          name: customer.name,
          mobile: customer.mobile
        }
      }));
      
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
          if (userType === 'owner') {
            setFormData(prev => ({
              ...prev,
              ownerDetails: {
                ...prev.ownerDetails,
                address: {
                  flatNo: addressData.flatNo || "",
                  society: addressData.society || "",
                  area: addressData.area || "",
                  city: addressData.city || "",
                  state: addressData.state || "",
                  pincode: addressData.pincode || "",
                  district: addressData.district || "",
                  landmark: addressData.landmark || ""
                }
              }
            }));
          } else {
            setFormData(prev => ({
              ...prev,
              tenantDetails: {
                ...prev.tenantDetails,
                address: {
                  flatNo: addressData.flatNo || "",
                  society: addressData.society || "",
                  area: addressData.area || "",
                  city: addressData.city || "",
                  state: addressData.state || "",
                  pincode: addressData.pincode || "",
                  district: addressData.district || "",
                  landmark: addressData.landmark || ""
                }
              }
            }));
          }
          
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

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Step 1: Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="customerId">Select Customer <span className="text-red-500">*</span></Label>
                  <Select
                    value={formData.customer.id || ""}
                    onValueChange={(value) => {
                      const selectedCustomer = customers.find((c: any) => c.id === value);
                      setFormData(prev => ({
                        ...prev,
                        customer: {
                          id: value,
                          name: selectedCustomer ? selectedCustomer.name : "",
                          mobile: selectedCustomer ? selectedCustomer.mobile : ""
                        }
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.filter((customer: any) => customer.id && customer.id.trim() !== '').map((customer: any) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name} - {customer.mobile}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">
                    Select an existing customer to import agreement for
                  </p>
                </div>

                <div>
                  <Label htmlFor="language">Language <span className="text-red-500">*</span></Label>
                  <Select
                    value={formData.language}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, language: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="english">English</SelectItem>
                      <SelectItem value="hindi">Hindi (हिंदी)</SelectItem>
                      <SelectItem value="gujarati">Gujarati (ગુજરાતી)</SelectItem>
                      <SelectItem value="tamil">Tamil (தமிழ்)</SelectItem>
                      <SelectItem value="marathi">Marathi (मराठी)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        );

      case 2:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Step 2: Owner Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="owner-name">Owner Name *</Label>
                <Input
                  id="owner-name"
                  value={formData.ownerDetails.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setFormData(prev => ({
                      ...prev,
                      ownerDetails: { ...prev.ownerDetails, name }
                    }));
                    
                    // Clear previous timeout
                    if (mobileTimeout.current) {
                      clearTimeout(mobileTimeout.current);
                    }
                    // Auto-lookup when user finishes typing name (3+ chars)
                    if (name.trim().length >= 3) {
                      mobileTimeout.current = setTimeout(() => {
                        fetchCustomerInfo(name, 'name', 'owner');
                      }, 500);
                    }
                  }}
                  onBlur={(e) => fetchCustomerInfo(e.target.value, 'name', 'owner')}
                  placeholder="Enter owner's full name"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter name to auto-fill mobile and details
                </p>
              </div>

              <div>
                <Label htmlFor="owner-mobile">Owner Mobile Number *</Label>
                <Input
                  id="owner-mobile"
                  value={formData.ownerDetails.mobile}
                  onChange={(e) => {
                    const mobile = e.target.value;
                    setFormData(prev => ({
                      ...prev,
                      ownerDetails: { ...prev.ownerDetails, mobile }
                    }));
                    
                    // Clear previous timeout
                    if (mobileTimeout.current) {
                      clearTimeout(mobileTimeout.current);
                    }
                    // Auto-lookup when user finishes typing 10 digits
                    if (mobile.replace(/\D/g, '').length === 10) {
                      mobileTimeout.current = setTimeout(() => {
                        fetchCustomerInfo(mobile, 'mobile', 'owner');
                      }, 500);
                    }
                  }}
                  onBlur={(e) => fetchCustomerInfo(e.target.value, 'mobile', 'owner')}
                  placeholder="Enter owner's mobile number"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter mobile number to auto-fill name and details
                </p>
              </div>
            </CardContent>
          </Card>
        );

      case 3:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Step 3: Tenant Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="tenant-name">Tenant Name *</Label>
                <Input
                  id="tenant-name"
                  value={formData.tenantDetails.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setFormData(prev => ({
                      ...prev,
                      tenantDetails: { ...prev.tenantDetails, name }
                    }));
                    
                    // Clear previous timeout
                    if (mobileTimeout.current) {
                      clearTimeout(mobileTimeout.current);
                    }
                    // Auto-lookup when user finishes typing name (3+ chars)
                    if (name.trim().length >= 3) {
                      mobileTimeout.current = setTimeout(() => {
                        fetchCustomerInfo(name, 'name', 'tenant');
                      }, 500);
                    }
                  }}
                  onBlur={(e) => fetchCustomerInfo(e.target.value, 'name', 'tenant')}
                  placeholder="Enter tenant's full name"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter name to auto-fill mobile and details
                </p>
              </div>

              <div>
                <Label htmlFor="tenant-mobile">Tenant Mobile Number *</Label>
                <Input
                  id="tenant-mobile"
                  value={formData.tenantDetails.mobile}
                  onChange={(e) => {
                    const mobile = e.target.value;
                    setFormData(prev => ({
                      ...prev,
                      tenantDetails: { ...prev.tenantDetails, mobile }
                    }));
                    
                    // Clear previous timeout
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
                  placeholder="Enter tenant's mobile number"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter mobile number to auto-fill name and details
                </p>
              </div>
            </CardContent>
          </Card>
        );

      case 4:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Step 4: Agreement Period & Property Address</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Agreement Duration Section */}
              <div className="space-y-4">
                <h4 className="text-md font-semibold text-gray-800">Agreement Duration</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="start-date">Agreement Start Date *</Label>
                    <Input
                      id="start-date"
                      type="date"
                      value={formData.agreementPeriod.startDate}
                      onChange={(e) => {
                        const startDate = e.target.value;
                        setFormData(prev => ({
                          ...prev,
                          agreementPeriod: { ...prev.agreementPeriod, startDate }
                        }));
                        // Auto-calculate end date if 11 months tenure is selected
                        if (formData.agreementPeriod.tenure === "11_months" && startDate) {
                          const start = new Date(startDate);
                          const end = new Date(start);
                          end.setMonth(end.getMonth() + 11);
                          setFormData(prev => ({
                            ...prev,
                            agreementPeriod: { ...prev.agreementPeriod, endDate: end.toISOString().split('T')[0] }
                          }));
                        }
                      }}
                    />
                  </div>
                  <div>
                    <Label htmlFor="tenure">Agreement Tenure *</Label>
                    <Select 
                      value={formData.agreementPeriod.tenure} 
                      onValueChange={(value: "11_months" | "custom") => {
                        setFormData(prev => ({
                          ...prev,
                          agreementPeriod: { ...prev.agreementPeriod, tenure: value }
                        }));
                        // Auto-calculate end date if 11 months is selected and start date exists
                        if (value === "11_months" && formData.agreementPeriod.startDate) {
                          const start = new Date(formData.agreementPeriod.startDate);
                          const end = new Date(start);
                          end.setMonth(end.getMonth() + 11);
                          setFormData(prev => ({
                            ...prev,
                            agreementPeriod: { ...prev.agreementPeriod, endDate: end.toISOString().split('T')[0] }
                          }));
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
                    <Label htmlFor="end-date">Agreement End Date *</Label>
                    <Input
                      id="end-date"
                      type="date"
                      value={formData.agreementPeriod.endDate}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        agreementPeriod: { ...prev.agreementPeriod, endDate: e.target.value }
                      }))}
                      disabled={formData.agreementPeriod.tenure === "11_months"}
                      className={formData.agreementPeriod.tenure === "11_months" ? "bg-gray-100" : ""}
                    />
                    {formData.agreementPeriod.tenure === "11_months" && (
                      <p className="text-xs text-gray-500 mt-1">Auto-calculated</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Property Address Section */}
              <div className="space-y-4">
                <h4 className="text-md font-semibold text-gray-800">Property Address</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="flat-no">Flat/House Number *</Label>
                    <Input
                      id="flat-no"
                      value={formData.propertyAddress.flatNo}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        propertyAddress: { ...prev.propertyAddress, flatNo: e.target.value }
                      }))}
                      placeholder="e.g., A-101"
                    />
                  </div>
                  <div className="relative">
                    <Label htmlFor="society">Society/Building *</Label>
                    <Input
                      id="society"
                      value={formData.propertyAddress.society}
                      onChange={(e) => {
                        const value = e.target.value;
                        setFormData(prev => ({
                          ...prev,
                          propertyAddress: { ...prev.propertyAddress, society: value }
                        }));
                        fetchSocietyAddresses(value);
                      }}
                      placeholder="e.g., ABC Apartments"
                    />
                    {showSocietySuggestions && societySuggestions.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                        {societySuggestions.map((society) => (
                          <div
                            key={society.id}
                            className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                            onClick={() => handleSocietySelect(society, 'property')}
                          >
                            <div className="font-medium">{society.societyName}</div>
                            <div className="text-gray-600">{society.area}, {society.city} - {society.pincode}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      Start typing to search for existing societies
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="area">Area *</Label>
                    <Input
                      id="area"
                      value={formData.propertyAddress.area}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        propertyAddress: { ...prev.propertyAddress, area: e.target.value }
                      }))}
                      placeholder="e.g., Satellite"
                    />
                  </div>
                  <div>
                    <Label htmlFor="city">City *</Label>
                    <Input
                      id="city"
                      value={formData.propertyAddress.city}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        propertyAddress: { ...prev.propertyAddress, city: e.target.value }
                      }))}
                      placeholder="e.g., Ahmedabad"
                    />
                  </div>
                  <div>
                    <Label htmlFor="state">State *</Label>
                    <Input
                      id="state"
                      value={formData.propertyAddress.state}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        propertyAddress: { ...prev.propertyAddress, state: e.target.value }
                      }))}
                      placeholder="e.g., Gujarat"
                    />
                  </div>
                  <div>
                    <Label htmlFor="pincode">Pincode *</Label>
                    <Input
                      id="pincode"
                      value={formData.propertyAddress.pincode}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        propertyAddress: { ...prev.propertyAddress, pincode: e.target.value }
                      }))}
                      placeholder="e.g., 380015"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );

      case 5:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Step 5: Upload Documents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    <Label className="text-sm font-medium text-gray-700">Notarized Rent Agreement *</Label>
                  </div>
                  {documents.notarizedDocument ? (
                    <FilePreview
                      fileUrl={documents.notarizedDocument as string}
                      fileName={(documents.notarizedDocument_metadata as any)?.filename || "Notarized Rent Agreement"}
                      fileType={(documents.notarizedDocument_metadata as any)?.fileType}
                      onRemove={() => setDocuments(prev => ({ ...prev, notarizedDocument: "", notarizedDocument_metadata: undefined }))}
                      className="w-full"
                    />
                  ) : (
                    <LocalFileUploader
                      maxSize={5242880} // 5MB
                      onUploadComplete={(result) => handleDocumentUpload("notarizedDocument", result)}
                      className="w-full"
                    >
                      <div className="border-2 border-dashed rounded-lg p-6 text-center transition-all cursor-pointer border-gray-300 bg-gray-50 hover:bg-gray-100">
                        <div className="flex flex-col items-center space-y-2">
                          <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                            <FileText className="w-6 h-6 text-gray-500" />
                          </div>
                          <p className="text-sm text-gray-600">Click to upload notarized agreement</p>
                          <p className="text-xs text-gray-500">PDF only (Max 5MB)</p>
                        </div>
                      </div>
                    </LocalFileUploader>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Shield className="h-5 w-5 text-green-600" />
                    <Label className="text-sm font-medium text-gray-700">Police Verification Certificate *</Label>
                  </div>
                  {documents.policeVerificationDocument ? (
                    <FilePreview
                      fileUrl={documents.policeVerificationDocument as string}
                      fileName={(documents.policeVerificationDocument_metadata as any)?.filename || "Police Verification Certificate"}
                      fileType={(documents.policeVerificationDocument_metadata as any)?.fileType}
                      onRemove={() => setDocuments(prev => ({ ...prev, policeVerificationDocument: "", policeVerificationDocument_metadata: undefined }))}
                      className="w-full"
                    />
                  ) : (
                    <LocalFileUploader
                      maxSize={5242880} // 5MB
                      onUploadComplete={(result) => handleDocumentUpload("policeVerificationDocument", result)}
                      className="w-full"
                    >
                      <div className="border-2 border-dashed rounded-lg p-6 text-center transition-all cursor-pointer border-gray-300 bg-gray-50 hover:bg-gray-100">
                        <div className="flex flex-col items-center space-y-2">
                          <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                            <Shield className="w-6 h-6 text-gray-500" />
                          </div>
                          <p className="text-sm text-gray-600">Click to upload police verification</p>
                          <p className="text-xs text-gray-500">PDF only (Max 5MB)</p>
                        </div>
                      </div>
                    </LocalFileUploader>
                  )}
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Both documents are required to import an existing agreement. 
                  The agreement will be saved as "Active" status once imported.
                </p>
              </div>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  const progress = (currentStep / 5) * 100;

  const STEPS = [
    { id: 1, title: "Customer Info" },
    { id: 2, title: "Owner Details" },
    { id: 3, title: "Tenant Details" },
    { id: 4, title: "Agreement & Property" },
    { id: 5, title: "Documents" },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-screen overflow-y-auto">
        <DialogHeader className="bg-gray-800 text-white p-6 -m-6 mb-6">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold">
              Import Existing Agreement
            </DialogTitle>
            <div className="flex items-center space-x-3">
              <div className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                Import Mode
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="text-white hover:bg-white/20 border border-white/30"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
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

        <div className="space-y-6">

          {/* Step content */}
          {renderStep()}

          {/* Navigation buttons */}
          <div className="flex items-center justify-between pt-6 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === (!canViewAllCustomers ? 2 : 1)}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Previous
            </Button>
            <div className="flex space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="text-gray-600 hover:bg-gray-100"
              >
                <X className="mr-2 h-4 w-4" />
                Close
              </Button>
              {currentStep < 5 ? (
                <Button 
                  type="button" 
                  onClick={handleNext} 
                  disabled={!validateStep(currentStep)}
                  className={`${
                    validateStep(currentStep) 
                      ? "bg-blue-600 hover:bg-blue-700" 
                      : "bg-gray-400 cursor-not-allowed"
                  }`}
                >
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isSubmitting ? "Importing..." : "Import Agreement"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}