import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, FileText, User, Home, Calendar, DollarSign, Users } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import AdminLayout from "@/components/AdminLayout";

interface Customer {
  id: string;
  name: string;
  email?: string;
  mobile?: string;
}

interface Property {
  id: string;
  flatNumber: string;
  society: string;
  area: string;
  city: string;
  state: string;
  pincode: string;
  purpose: "residential" | "commercial";
}

export default function CreateAgreement() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  // Get URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const customerId = urlParams.get('customerId');
  const propertyId = urlParams.get('propertyId');
  
  // State
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  
  // Form state
  const [agreementData, setAgreementData] = useState({
    language: 'english',
    agreementDate: new Date().toISOString().split('T')[0],
    startDate: '',
    endDate: '',
    monthlyRent: '',
    securityDeposit: '',
    noticeperiod: '1',
    maintenance: 'excluded',
    ownerName: '',
    ownerMobile: '',
    ownerEmail: '',
    tenantName: '',
    tenantMobile: '',
    tenantEmail: '',
  });

  // Load customer and property data
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        
        if (!customerId || !propertyId) {
          toast({
            title: "Missing Parameters",
            description: "Customer ID and Property ID are required to create an agreement.",
            variant: "destructive",
          });
          navigate('/customers');
          return;
        }

        // Load customer
        const customerResponse = await fetch(`/api/customers/${customerId}`);
        if (customerResponse.ok) {
          const customerData = await customerResponse.json();
          setCustomer(customerData);
        }

        // Load property
        const propertyResponse = await fetch(`/api/properties/${propertyId}`);
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
  }, [customerId, propertyId, navigate, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      // Validate required fields
      if (!agreementData.startDate || !agreementData.endDate || !agreementData.monthlyRent || 
          !agreementData.securityDeposit || !agreementData.ownerName || !agreementData.tenantName) {
        toast({
          title: "Validation Error",
          description: "Please fill in all required fields.",
          variant: "destructive",
        });
        return;
      }

      // Create agreement with proper data structure
      const newAgreement = {
        customerId,
        propertyId,
        language: agreementData.language || 'english',
        agreementDate: agreementData.agreementDate,
        startDate: agreementData.startDate,
        endDate: agreementData.endDate,
        status: 'active',
        ownerDetails: {
          name: agreementData.ownerName || '',
          mobile: agreementData.ownerMobile || '',
          email: agreementData.ownerEmail || '',
          age: 25, // Default value
          occupation: '', // Default value
          aadhar: '', // Default value
          pan: '', // Default value
          address: {
            flatNo: property?.flatNumber || '',
            society: property?.society || '',
            area: property?.area || '',
            city: property?.city || '',
            state: property?.state || 'Gujarat',
            pincode: property?.pincode || '',
          }
        },
        tenantDetails: {
          name: agreementData.tenantName || '',
          mobile: agreementData.tenantMobile || '',
          email: agreementData.tenantEmail || '',
          age: 25, // Default value
          occupation: '', // Default value
          aadhar: '', // Default value
          pan: '', // Default value
          address: {
            flatNo: '',
            society: '',
            area: '',
            city: '',
            state: 'Gujarat',
            pincode: '',
          }
        },
        propertyDetails: {
          type: property?.purpose || 'residential',
          flatNumber: property?.flatNumber || '',
          society: property?.society || '',
          area: property?.area || '',
          city: property?.city || '',
          state: property?.state || 'Gujarat',
          pincode: property?.pincode || '',
          purpose: property?.purpose || 'residential',
          areaInSqFt: 0, // Default value
          furnishedStatus: 'unfurnished', // Default value
          additionalItems: '',
          place: property?.city || '',
          address: {
            flatNo: property?.flatNumber || '',
            society: property?.society || '',
            area: property?.area || '',
            city: property?.city || '',
            state: property?.state || 'Gujarat',
            pincode: property?.pincode || '',
          }
        },
        rentalTerms: {
          monthlyRent: parseInt(agreementData.monthlyRent) || 0,
          securityDeposit: parseInt(agreementData.securityDeposit) || 0,
          noticeperiod: parseInt(agreementData.noticeperiod) || 1,
          maintenance: agreementData.maintenance || 'included',
          dueDate: 5, // Default value
          tenure: '11_months', // Default value
        },
        additionalClauses: [],
      };

      const response = await apiRequest('/api/agreements', 'POST', newAgreement);

      if (response.ok) {
        const createdAgreement = await response.json();
        toast({
          title: "Success",
          description: "Agreement created successfully!",
        });
        
        // Navigate to the created agreement
        navigate(`/agreements/${createdAgreement.id}`);
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
    } finally {
      setIsCreating(false);
    }
  };

  const handleGoBack = () => {
    if (customerId && propertyId) {
      navigate(`/customers/${customerId}/properties/${propertyId}/agreements`);
    } else {
      navigate('/customers');
    }
  };

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
    <AdminLayout title="Create Agreement" subtitle={`For ${property.flatNumber}, ${property.society}`}>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={handleGoBack} data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Agreements
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Customer & Property Info */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Customer
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div>
                    <div className="font-medium">{customer.name}</div>
                    {customer.email && (
                      <div className="text-sm text-muted-foreground">{customer.email}</div>
                    )}
                    {customer.mobile && (
                      <div className="text-sm text-muted-foreground">{customer.mobile}</div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Home className="h-5 w-5" />
                  Property
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="font-medium">{property.flatNumber}</div>
                  <div className="text-sm text-muted-foreground">
                    {property.society}<br />
                    {property.area}, {property.city}<br />
                    {property.state} - {property.pincode}
                  </div>
                  <div className="text-sm">
                    <span className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                      {property.purpose}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Agreement Form */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Agreement Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Basic Info */}
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="language">Select Language</Label>
                        <Select
                          value={agreementData.language}
                          onValueChange={(value) => setAgreementData(prev => ({ ...prev, language: value }))}
                        >
                          <SelectTrigger data-testid="select-language">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="english">English</SelectItem>
                            <SelectItem value="gujarati">Gujarati</SelectItem>
                            <SelectItem value="hindi">Hindi</SelectItem>
                            <SelectItem value="tamil">Tamil</SelectItem>
                            <SelectItem value="marathi">Marathi</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="agreementDate">Agreement Date</Label>
                        <Input
                          id="agreementDate"
                          type="date"
                          value={agreementData.agreementDate}
                          onChange={(e) => setAgreementData(prev => ({ ...prev, agreementDate: e.target.value }))}
                          data-testid="input-agreement-date"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Owner Details */}
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold text-gray-800">Owner Details</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="ownerName">Owner Name</Label>
                        <Input
                          id="ownerName"
                          value={agreementData.ownerName}
                          onChange={(e) => setAgreementData(prev => ({ ...prev, ownerName: e.target.value }))}
                          placeholder="Owner Name"
                          data-testid="input-owner-name"
                          required
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Enter name to auto-fill mobile and address
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="ownerMobile">Owner Mobile</Label>
                        <Input
                          id="ownerMobile"
                          value={agreementData.ownerMobile}
                          onChange={(e) => setAgreementData(prev => ({ ...prev, ownerMobile: e.target.value }))}
                          placeholder="Enter mobile number"
                          data-testid="input-owner-mobile"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Enter mobile number to auto-fill name and email
                        </p>
                      </div>
                      
                      <div>
                        <Label htmlFor="ownerEmail">Owner Email</Label>
                        <Input
                          id="ownerEmail"
                          type="email"
                          value={agreementData.ownerEmail}
                          onChange={(e) => setAgreementData(prev => ({ ...prev, ownerEmail: e.target.value }))}
                          placeholder="Enter email address"
                          data-testid="input-owner-email"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Tenant Details */}
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold text-gray-800">Tenant Details</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="tenantName">Full Name</Label>
                        <Input
                          id="tenantName"
                          value={agreementData.tenantName}
                          onChange={(e) => setAgreementData(prev => ({ ...prev, tenantName: e.target.value }))}
                          placeholder="Enter tenant full name"
                          data-testid="input-tenant-name"
                          required
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Enter name to auto-fill mobile and address
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="tenantMobile">Mobile Number</Label>
                        <Input
                          id="tenantMobile"
                          value={agreementData.tenantMobile}
                          onChange={(e) => setAgreementData(prev => ({ ...prev, tenantMobile: e.target.value }))}
                          placeholder="Enter mobile number"
                          data-testid="input-tenant-mobile"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Enter mobile number to auto-fill name and email
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="tenantEmail">Email Address</Label>
                        <Input
                          id="tenantEmail"
                          type="email"
                          value={agreementData.tenantEmail}
                          onChange={(e) => setAgreementData(prev => ({ ...prev, tenantEmail: e.target.value }))}
                          placeholder="Enter email address"
                          data-testid="input-tenant-email"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Rental Terms */}
                  <div className="space-y-6">
                    <h4 className="text-md font-semibold text-gray-800 mb-4">Agreement Duration</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="startDate">Agreement Start Date</Label>
                        <Input
                          id="startDate"
                          type="date"
                          value={agreementData.startDate}
                          onChange={(e) => setAgreementData(prev => ({ ...prev, startDate: e.target.value }))}
                          data-testid="input-start-date"
                          required
                        />
                      </div>

                      <div>
                        <Label htmlFor="endDate">Agreement End Date</Label>
                        <Input
                          id="endDate"
                          type="date"
                          value={agreementData.endDate}
                          onChange={(e) => setAgreementData(prev => ({ ...prev, endDate: e.target.value }))}
                          data-testid="input-end-date"
                          required
                        />
                      </div>

                      <div>
                        <Label htmlFor="noticeperiod">Notice Period (Months)</Label>
                        <Input
                          id="noticeperiod"
                          type="number"
                          min="1"
                          step="1"
                          value={agreementData.noticeperiod}
                          onChange={(e) => setAgreementData(prev => ({ ...prev, noticeperiod: e.target.value }))}
                          placeholder="e.g., 1"
                          data-testid="input-notice-period"
                          onWheel={(e) => e.currentTarget.blur()}
                          required
                        />
                      </div>
                    </div>

                    <h4 className="text-md font-semibold text-gray-800 mb-4">Rental Terms</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="monthlyRent">Monthly Rent Amount (₹)</Label>
                        <Input
                          id="monthlyRent"
                          type="number"
                          min="1"
                          step="1"
                          value={agreementData.monthlyRent}
                          onChange={(e) => setAgreementData(prev => ({ ...prev, monthlyRent: e.target.value }))}
                          placeholder="e.g., 15000"
                          data-testid="input-monthly-rent"
                          onWheel={(e) => e.currentTarget.blur()}
                          required
                        />
                      </div>

                      <div>
                        <Label htmlFor="securityDeposit">Security Deposit (₹)</Label>
                        <Input
                          id="securityDeposit"
                          type="number"
                          min="0"
                          step="1"
                          value={agreementData.securityDeposit}
                          onChange={(e) => setAgreementData(prev => ({ ...prev, securityDeposit: e.target.value }))}
                          placeholder="e.g., 30000"
                          data-testid="input-security-deposit"
                          onWheel={(e) => e.currentTarget.blur()}
                          required
                        />
                      </div>

                      <div>
                        <Label htmlFor="maintenance">Maintenance Charge</Label>
                        <Select
                          value={agreementData.maintenance}
                          onValueChange={(value) => setAgreementData(prev => ({ ...prev, maintenance: value }))}
                        >
                          <SelectTrigger data-testid="select-maintenance">
                            <SelectValue placeholder="Select maintenance" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="included">Included</SelectItem>
                            <SelectItem value="excluded">Excluded</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Submit */}
                  <div className="flex gap-4 pt-6">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleGoBack}
                      data-testid="button-cancel"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isCreating}
                      data-testid="button-create"
                    >
                      {isCreating ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Creating...
                        </>
                      ) : (
                        <>
                          <FileText className="h-4 w-4 mr-2" />
                          Create Agreement
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}