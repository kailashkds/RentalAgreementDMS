import { useState } from "react";
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
  };
  tenantDetails: {
    name: string;
    mobile: string;
  };
  agreementPeriod: {
    startDate: string;
    endDate: string;
  };
  propertyAddress: {
    flatNo: string;
    society: string;
    area: string;
    city: string;
    state: string;
    pincode: string;
  };
  notarizedDocument?: File;
  policeVerificationDocument?: File;
}

export default function ImportAgreementWizard({ isOpen, onClose }: ImportAgreementWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState<ImportAgreementData>({
    customer: { name: "", mobile: "" },
    language: "english",
    ownerDetails: { name: "", mobile: "" },
    tenantDetails: { name: "", mobile: "" },
    agreementPeriod: { startDate: "", endDate: "" },
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
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!(formData.customer.name && formData.language);
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
        if (!formData.customer.name || !formData.language) {
          toast({
            title: "Required fields missing",
            description: "Please fill in customer name and select language",
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
    if (!formData.notarizedDocument || !formData.policeVerificationDocument) {
      toast({
        title: "Required documents missing",
        description: "Please upload both notarized agreement and police verification certificate",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Create form data for file upload
      const uploadFormData = new FormData();
      
      // Upload notarized document
      uploadFormData.append('notarizedDocument', formData.notarizedDocument);
      uploadFormData.append('policeDocument', formData.policeVerificationDocument);
      
      // Add agreement data
      uploadFormData.append('agreementData', JSON.stringify({
        customer: formData.customer,
        language: formData.language,
        ownerDetails: formData.ownerDetails,
        tenantDetails: formData.tenantDetails,
        agreementPeriod: formData.agreementPeriod,
        propertyAddress: formData.propertyAddress,
        status: 'active', // Imported agreements are active
        isImported: true
      }));

      const response = await fetch('/api/agreements/import', {
        method: 'POST',
        body: uploadFormData,
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
    setFormData({
      customer: { name: "", mobile: "" },
      language: "english",
      ownerDetails: { name: "", mobile: "" },
      tenantDetails: { name: "", mobile: "" },
      agreementPeriod: { startDate: "", endDate: "" },
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

  const handleFileChange = (field: 'notarizedDocument' | 'policeVerificationDocument', file: File | null) => {
    setFormData(prev => ({
      ...prev,
      [field]: file
    }));
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Step 1: Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="customer-name">Customer Name *</Label>
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
                    {customers.map((customer: any) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!formData.customer.id && (
                  <div className="mt-2">
                    <Input
                      placeholder="Or enter customer name manually"
                      value={formData.customer.name}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        customer: { ...prev.customer, name: e.target.value }
                      }))}
                    />
                    <Input
                      placeholder="Customer mobile number"
                      className="mt-2"
                      value={formData.customer.mobile || ""}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        customer: { ...prev.customer, mobile: e.target.value }
                      }))}
                    />
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="language">Language *</Label>
                <Select
                  value={formData.language}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, language: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="english">English</SelectItem>
                    <SelectItem value="hindi">Hindi</SelectItem>
                    <SelectItem value="gujarati">Gujarati</SelectItem>
                    <SelectItem value="tamil">Tamil</SelectItem>
                    <SelectItem value="marathi">Marathi</SelectItem>
                  </SelectContent>
                </Select>
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
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    ownerDetails: { ...prev.ownerDetails, name: e.target.value }
                  }))}
                  placeholder="Enter owner's full name"
                />
              </div>

              <div>
                <Label htmlFor="owner-mobile">Owner Mobile Number *</Label>
                <Input
                  id="owner-mobile"
                  value={formData.ownerDetails.mobile}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    ownerDetails: { ...prev.ownerDetails, mobile: e.target.value }
                  }))}
                  placeholder="Enter owner's mobile number"
                />
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
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    tenantDetails: { ...prev.tenantDetails, name: e.target.value }
                  }))}
                  placeholder="Enter tenant's full name"
                />
              </div>

              <div>
                <Label htmlFor="tenant-mobile">Tenant Mobile Number *</Label>
                <Input
                  id="tenant-mobile"
                  value={formData.tenantDetails.mobile}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    tenantDetails: { ...prev.tenantDetails, mobile: e.target.value }
                  }))}
                  placeholder="Enter tenant's mobile number"
                />
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
              <div className="space-y-4">
                <h4 className="font-medium">Agreement Period</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start-date">Start Date *</Label>
                    <Input
                      id="start-date"
                      type="date"
                      value={formData.agreementPeriod.startDate}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        agreementPeriod: { ...prev.agreementPeriod, startDate: e.target.value }
                      }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="end-date">End Date *</Label>
                    <Input
                      id="end-date"
                      type="date"
                      value={formData.agreementPeriod.endDate}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        agreementPeriod: { ...prev.agreementPeriod, endDate: e.target.value }
                      }))}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">Property Address</h4>
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
                  <div>
                    <Label htmlFor="society">Society/Building *</Label>
                    <Input
                      id="society"
                      value={formData.propertyAddress.society}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        propertyAddress: { ...prev.propertyAddress, society: e.target.value }
                      }))}
                      placeholder="e.g., ABC Apartments"
                    />
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
                    <Label htmlFor="notarized-doc">Notarized Rent Agreement *</Label>
                  </div>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <input
                      id="notarized-doc"
                      type="file"
                      accept=".pdf"
                      onChange={(e) => handleFileChange('notarizedDocument', e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    <div className="space-y-2">
                      <Upload className="h-8 w-8 text-gray-400 mx-auto" />
                      {formData.notarizedDocument ? (
                        <p className="text-sm text-green-600">
                          ✓ {formData.notarizedDocument.name}
                        </p>
                      ) : (
                        <p className="text-sm text-gray-500">
                          Click to upload notarized agreement (PDF only)
                        </p>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('notarized-doc')?.click()}
                      >
                        Choose File
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Shield className="h-5 w-5 text-green-600" />
                    <Label htmlFor="police-doc">Police Verification Certificate *</Label>
                  </div>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <input
                      id="police-doc"
                      type="file"
                      accept=".pdf"
                      onChange={(e) => handleFileChange('policeVerificationDocument', e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    <div className="space-y-2">
                      <Upload className="h-8 w-8 text-gray-400 mx-auto" />
                      {formData.policeVerificationDocument ? (
                        <p className="text-sm text-green-600">
                          ✓ {formData.policeVerificationDocument.name}
                        </p>
                      ) : (
                        <p className="text-sm text-gray-500">
                          Click to upload police verification (PDF only)
                        </p>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('police-doc')?.click()}
                      >
                        Choose File
                      </Button>
                    </div>
                  </div>
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
              disabled={currentStep === 1}
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