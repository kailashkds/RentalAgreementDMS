import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileText, Calendar, Download, Eye } from "lucide-react";
import { useState } from "react";

interface Agreement {
  id: string;
  agreementNumber: string;
  customerId: string;
  propertyId?: string;
  language: string;
  ownerDetails: any;
  tenantDetails: any;
  propertyDetails: any;
  rentalTerms: any;
  startDate: string;
  endDate: string;
  agreementDate: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  customer?: {
    id: string;
    name: string;
    mobile: string;
    email?: string;
  };
}

interface Property {
  id: string;
  customerId: string;
  flatNumber: string;
  building?: string;
  society: string;
  area: string;
  city: string;
  state: string;
  pincode: string;
  propertyType: string;
  purpose?: string;
}

interface Customer {
  id: string;
  name: string;
  mobile: string;
  email?: string;
}

export default function PropertyAgreements() {
  const { customerId, propertyId } = useParams();
  const [selectedAgreement, setSelectedAgreement] = useState<Agreement | null>(null);

  const { data: customer } = useQuery<Customer>({
    queryKey: [`/api/customers/${customerId}`],
    enabled: !!customerId
  });

  const { data: property } = useQuery<Property>({
    queryKey: [`/api/properties/${propertyId}`],
    enabled: !!propertyId
  });

  const { data: agreementsData, isLoading } = useQuery<{ agreements: Agreement[]; total: number }>({
    queryKey: [`/api/properties/${propertyId}/agreements`],
    enabled: !!propertyId
  });

  const agreements = agreementsData?.agreements || [];

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'draft': return 'bg-yellow-100 text-yellow-800';
      case 'expired': return 'bg-red-100 text-red-800';
      case 'terminated': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const handleDownloadPdf = async (agreementId: string) => {
    try {
      const response = await fetch(`/api/agreements/${agreementId}/pdf`);
      if (response.ok) {
        const data = await response.json();
        if (data.html) {
          // Import html2pdf dynamically
          const html2pdf = (await import('html2pdf.js' as any)).default;
          
          // Create a temporary container for the HTML content
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = data.html;
          tempDiv.style.width = '210mm'; // A4 width
          tempDiv.style.fontFamily = 'Arial, sans-serif';
          document.body.appendChild(tempDiv);
          
          // Configure pdf options
          const options = {
            margin: [15, 10, 15, 10], // mm
            filename: data.filename || `agreement-${agreementId}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { 
              scale: 2, 
              useCORS: true,
              letterRendering: true 
            },
            jsPDF: { 
              unit: 'mm', 
              format: 'a4', 
              orientation: 'portrait' 
            }
          };
          
          // Generate and download PDF
          await html2pdf().set(options).from(tempDiv).save();
          
          // Clean up
          document.body.removeChild(tempDiv);
        }
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!property || !customer) {
    return <div className="p-6">Property or customer not found</div>;
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/customers/${customerId}/properties`}>
          <Button variant="outline" size="sm" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Properties
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            Agreements for {property.flatNumber}
          </h1>
          <p className="text-muted-foreground" data-testid="text-property-info">
            {property.society}, {property.area}, {property.city} • {customer.name}
          </p>
        </div>
      </div>

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold" data-testid="text-agreements-count">
          {agreements.length} Agreement{agreements.length !== 1 ? 's' : ''}
        </h2>
        <Link href={`/create-agreement?customerId=${customerId}&propertyId=${propertyId}`}>
          <Button data-testid="button-create-agreement">
            <FileText className="h-4 w-4 mr-2" />
            Create Agreement
          </Button>
        </Link>
      </div>

      {agreements.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Agreements Found</h3>
            <p className="text-muted-foreground mb-4">
              This property doesn't have any agreements yet.
            </p>
            <Link href={`/create-agreement?customerId=${customerId}&propertyId=${propertyId}`}>
              <Button data-testid="button-create-first-agreement">
                <FileText className="h-4 w-4 mr-2" />
                Create First Agreement
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {agreements.map((agreement) => (
            <Card key={agreement.id} className="hover:shadow-md transition-shadow" data-testid={`card-agreement-${agreement.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{agreement.agreementNumber}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={getStatusColor(agreement.status)}>
                        {agreement.status}
                      </Badge>
                      <Badge variant="outline">
                        {agreement.language}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <div>Created: {formatDate(agreement.createdAt)}</div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <div className="text-sm font-medium">Agreement Period</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(agreement.startDate)} - {formatDate(agreement.endDate)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium">Owner</div>
                    <div className="text-sm text-muted-foreground">
                      {agreement.ownerDetails?.name || 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium">Tenant</div>
                    <div className="text-sm text-muted-foreground">
                      {agreement.tenantDetails?.name || 'N/A'}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <div className="text-sm font-medium">Monthly Rent</div>
                    <div className="text-sm text-muted-foreground">
                      ₹{agreement.rentalTerms?.monthlyRent || 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium">Security Deposit</div>
                    <div className="text-sm text-muted-foreground">
                      ₹{agreement.rentalTerms?.securityDeposit || 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium">Agreement Date</div>
                    <div className="text-sm text-muted-foreground">
                      {formatDate(agreement.agreementDate)}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Link href={`/agreements/${agreement.id}`}>
                    <Button
                      variant="outline"
                      size="sm"
                      data-testid={`button-view-${agreement.id}`}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadPdf(agreement.id)}
                    data-testid={`button-download-${agreement.id}`}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}


    </div>
  );
}