import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileText, Calendar, Download, Eye } from "lucide-react";
import { useState } from "react";
import { apiClient } from "@/lib/apiClient";

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
      // Find the agreement data to get language info
      const agreement = agreements.find(a => a.id === agreementId) || { language: 'english', agreementNumber: agreementId };
      
      console.log('Starting PDF download for agreement:', agreementId);
      
      const data = await apiClient.get(`/api/agreements/${agreementId}/pdf`);
      console.log('PDF generation successful, received HTML');
      
      // Create a temporary HTML page for printing/PDF generation
      const printWindow = window.open('', '_blank');
      if (printWindow) {
          printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Rental Agreement - ${agreement.agreementNumber || 'Agreement'}</title>
              <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Gujarati:wght@300;400;500;600;700&family=Noto+Sans+Devanagari:wght@300;400;500;600;700&family=Noto+Sans+Tamil:wght@300;400;500;600;700&display=swap" rel="stylesheet">
              <style>
                @page {
                  margin: 15mm 10mm 20mm 10mm;
                  @bottom-center { content: none; }
                  @bottom-left { content: none; }
                  @bottom-right { 
                    content: "Page " counter(page) " of " counter(pages);
                    font-size: 10px;
                    color: #666;
                    font-family: ${agreement.language === 'gujarati' 
                      ? '"Noto Sans Gujarati", "Shruti", "Lohit Gujarati", system-ui, Arial, sans-serif'
                      : agreement.language === 'hindi'
                      ? '"Noto Sans Devanagari", "Mangal", "Lohit Devanagari", system-ui, Arial, sans-serif'
                      : agreement.language === 'tamil'
                      ? '"Noto Sans Tamil", "Latha", "Lohit Tamil", system-ui, Arial, sans-serif'
                      : agreement.language === 'marathi'
                      ? '"Noto Sans Devanagari", "Mangal", "Lohit Devanagari", system-ui, Arial, sans-serif'
                      : 'Arial, sans-serif'};
                  }
                  @top-center { content: none; }
                  @top-left { content: none; }
                  @top-right { content: none; }
                }
                
                body { 
                  font-family: ${agreement.language === 'gujarati' 
                    ? '"Noto Sans Gujarati", "Shruti", "Lohit Gujarati", system-ui, Arial, sans-serif' 
                    : agreement.language === 'hindi'
                    ? '"Noto Sans Devanagari", "Mangal", "Lohit Devanagari", system-ui, Arial, sans-serif'
                    : agreement.language === 'tamil'
                    ? '"Noto Sans Tamil", "Latha", "Lohit Tamil", system-ui, Arial, sans-serif'
                    : agreement.language === 'marathi'
                    ? '"Noto Sans Devanagari", "Mangal", "Lohit Devanagari", system-ui, Arial, sans-serif'
                    : 'Arial, sans-serif'}; 
                  margin: 0;
                  padding: 20px;
                  line-height: 1.6;
                  background: white;
                  font-size: 14px;
                  text-rendering: optimizeLegibility;
                  -webkit-font-smoothing: antialiased;
                  -moz-osx-font-smoothing: grayscale;
                  font-feature-settings: "kern" 1, "liga" 1;
                }
                
                .agreement-content {
                  max-width: 800px;
                  margin: 0 auto;
                  padding: 20px;
                  background: white;
                  min-height: 1056px;
                }
                
                /* Enhanced font support for all languages */
                .gujarati-content, .gujarati-content * {
                  font-family: "Noto Sans Gujarati", "Shruti", "Lohit Gujarati", system-ui, Arial, sans-serif !important;
                }
                
                /* Enhanced English font support and styling */
                .english-content, .english-content * {
                  font-family: Arial, sans-serif !important;
                  font-size: 14px !important;
                }
                
                /* Consistent spacing for all languages */
                .party-details p {
                  margin: 3px 0 !important;
                  line-height: 1.5 !important;
                }
                
                /* Title styling */
                h1, h2, h3 {
                  font-weight: bold !important;
                  margin: 20px 0 15px 0 !important;
                  text-align: center !important;
                }
                
                h1 {
                  font-size: 18px !important;
                  margin-bottom: 25px !important;
                }
                
                /* Paragraph styling with consistent spacing */
                p {
                  margin: 10px 0 !important;
                  line-height: 1.6 !important;
                  text-align: justify !important;
                  text-indent: 0 !important;
                  padding: 0 !important;
                }
                
                /* List styling */
                ol, ul {
                  margin: 10px 0 !important;
                  padding-left: 30px !important;
                }
                
                li {
                  margin: 5px 0 !important;
                  line-height: 1.6 !important;
                }
                
                /* Strong text styling */
                strong, b {
                  font-weight: bold !important;
                }
                
                /* Passport photo styling - only for screen preview */
                @media screen {
                  div[style*="130px"][style*="160px"]:empty,
                  div[style*="130px"][style*="160px"]:contains("પાસપોર્ટ સાઈઝ ફોટો"),
                  div[style*="130px"][style*="160px"]:contains("Passport Size Photo") {
                    border: 1px dashed #ccc !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    background: #f9f9f9 !important;
                    font-size: 12px !important;
                    text-align: center !important;
                    color: #666 !important;
                  }
                }
                
                /* Remove borders for PDF/print */
                @media print {
                  div[style*="130px"][style*="160px"] {
                    border: none !important;
                    background: transparent !important;
                  }
                }
                
                /* Page break control classes for PDF generation */
                .no-page-break,
                .keep-together,
                .agreement-section,
                .clause-section,
                .signature-section,
                .terms-section {
                  page-break-inside: avoid;
                  break-inside: avoid;
                }
                
                .page-break-before {
                  page-break-before: always;
                  break-before: page;
                }
                
                .page-break-after {
                  page-break-after: always;
                  break-after: page;
                }
                
                @media print {
                  body { margin: 0; }
                  .no-print { display: none; }
                  
                  /* Enforce page break controls for print/PDF */
                  .no-page-break,
                  .keep-together,
                  .agreement-section,
                  .clause-section,
                  .signature-section,
                  .terms-section {
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                  }
                  
                  .page-break-before {
                    page-break-before: always !important;
                    break-before: page !important;
                  }
                  
                  .page-break-after {
                    page-break-after: always !important;
                    break-after: page !important;
                  }
                }
              </style>
            </head>
            <body>
              <div class="no-print" style="margin-bottom: 20px;">
                <button onclick="window.print()">Print / Save as PDF</button>
                <button onclick="window.close()">Close</button>
              </div>
              <div class="agreement-content ${agreement.language === 'gujarati' ? 'gujarati-content' : 'english-content'}">
                ${data.html || '<p>No agreement content available</p>'}
              </div>
            </body>
            </html>
          `);
          printWindow.document.close();
        } else {
          throw new Error('Could not open print window - popup blocked?');
        }
      } else {
        const errorText = await response.text();
        console.error('PDF generation failed:', response.status, errorText);
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.error('Download error:', error);
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