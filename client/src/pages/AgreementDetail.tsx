import { useParams, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileText, Download, Eye, Upload, Calendar, MapPin, User, DollarSign, Clock } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

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
  notarizedDocument?: {
    filename: string;
    originalName: string;
    uploadDate: string;
    size: number;
    url: string;
  };
  notarizedDocumentUrl?: string;
  customer?: {
    id: string;
    name: string;
    mobile: string;
    email?: string;
  };
}

export default function AgreementDetail() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const [uploadingNotarized, setUploadingNotarized] = useState(false);
  const { toast } = useToast();

  const { data: agreement, isLoading, error } = useQuery<Agreement>({
    queryKey: [`/api/agreements/${id}`],
    enabled: !!id
  });

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

  const handleDownloadPdf = async () => {
    if (!agreement) return;
    
    try {
      console.log('Starting PDF download for agreement:', agreement.id);
      
      const response = await fetch(`/api/agreements/${agreement.id}/pdf`);
      console.log('PDF generation response status:', response.status);

      if (response.ok) {
        const data = await response.json();
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
        
        toast({
          title: "Agreement ready",
          description: "Agreement opened in new window for download.",
        });
      } else {
        const errorText = await response.text();
        console.error('PDF generation failed:', response.status, errorText);
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Download Error",
        description: `Failed to generate agreement PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    }
  };

  const handleUploadNotarizedDocument = async (file: File) => {
    if (!agreement) return;
    
    setUploadingNotarized(true);
    try {
      const formData = new FormData();
      formData.append('notarizedDocument', file);

      const response = await fetch(`/api/agreements/${agreement.id}/upload-notarized`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        
        queryClient.invalidateQueries({ queryKey: [`/api/agreements/${agreement.id}`] });

        toast({
          title: "Notarized Document Uploaded",
          description: `Successfully uploaded ${result.originalName}`,
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload notarized document');
      }
    } catch (error) {
      console.error('Notarized upload error:', error);
      toast({
        title: "Upload Error",
        description: error instanceof Error ? error.message : "Failed to upload notarized document.",
        variant: "destructive",
      });
    } finally {
      setUploadingNotarized(false);
    }
  };

  const handleNotarizedUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        handleUploadNotarizedDocument(file);
      }
    };
    input.click();
  };

  const handleDownloadNotarized = () => {
    if (!agreement) return;
    
    const notarizedUrl = agreement.notarizedDocument?.url || agreement.notarizedDocumentUrl;
    if (notarizedUrl) {
      const link = document.createElement('a');
      link.href = notarizedUrl;
      link.download = agreement.notarizedDocument?.originalName || `${agreement.agreementNumber}-notarized.pdf`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading agreement details...</div>;
  }

  if (error || !agreement) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Agreement Not Found</h1>
          <p className="text-gray-600 mb-4">The agreement you're looking for doesn't exist or you don't have permission to view it.</p>
          <Button onClick={() => navigate("/agreements")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Agreements
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="sm" onClick={() => navigate("/agreements")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Agreements
        </Button>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            Agreement Details
          </h1>
          <p className="text-muted-foreground" data-testid="text-agreement-number">
            Agreement #{agreement.agreementNumber}
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Overview Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-xl">
                  {agreement.agreementNumber}
                </CardTitle>
                <div className="flex items-center gap-2 mt-2">
                  <Badge className={getStatusColor(agreement.status)}>
                    {agreement.status}
                  </Badge>
                  <Badge variant="outline">
                    {agreement.language}
                  </Badge>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleDownloadPdf} data-testid="button-download-pdf">
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
                {agreement.status === 'active' && (
                  <>
                    {agreement.notarizedDocument?.url || agreement.notarizedDocumentUrl ? (
                      <Button variant="outline" onClick={handleDownloadNotarized} data-testid="button-download-notarized">
                        <Download className="h-4 w-4 mr-2" />
                        Download Notarized
                      </Button>
                    ) : (
                      <Button 
                        variant="outline" 
                        onClick={handleNotarizedUpload} 
                        disabled={uploadingNotarized}
                        data-testid="button-upload-notarized"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {uploadingNotarized ? "Uploading..." : "Upload Notarized"}
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Agreement Period</div>
                  <div className="text-sm text-muted-foreground">
                    {formatDate(agreement.startDate)} - {formatDate(agreement.endDate)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Agreement Date</div>
                  <div className="text-sm text-muted-foreground">
                    {formatDate(agreement.agreementDate)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Created</div>
                  <div className="text-sm text-muted-foreground">
                    {formatDate(agreement.createdAt)}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Parties Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Owner Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Owner Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-sm font-medium text-gray-700">Name</div>
                <div className="text-sm text-gray-900">{agreement.ownerDetails?.name || 'Not provided'}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-700">Age</div>
                <div className="text-sm text-gray-900">{agreement.ownerDetails?.age || 'Not provided'}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-700">Mobile</div>
                <div className="text-sm text-gray-900">{agreement.ownerDetails?.mobile || 'Not provided'}</div>
              </div>
              {agreement.ownerDetails?.address && (
                <div>
                  <div className="text-sm font-medium text-gray-700">Address</div>
                  <div className="text-sm text-gray-900">
                    {[
                      agreement.ownerDetails.address.flatNo,
                      agreement.ownerDetails.address.society,
                      agreement.ownerDetails.address.area,
                      agreement.ownerDetails.address.city,
                      agreement.ownerDetails.address.state,
                      agreement.ownerDetails.address.pincode
                    ].filter(Boolean).join(', ')}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tenant Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Tenant Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-sm font-medium text-gray-700">Name</div>
                <div className="text-sm text-gray-900">{agreement.tenantDetails?.name || 'Not provided'}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-700">Age</div>
                <div className="text-sm text-gray-900">{agreement.tenantDetails?.age || 'Not provided'}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-700">Mobile</div>
                <div className="text-sm text-gray-900">{agreement.tenantDetails?.mobile || 'Not provided'}</div>
              </div>
              {agreement.tenantDetails?.address && (
                <div>
                  <div className="text-sm font-medium text-gray-700">Address</div>
                  <div className="text-sm text-gray-900">
                    {[
                      agreement.tenantDetails.address.flatNo,
                      agreement.tenantDetails.address.society,
                      agreement.tenantDetails.address.area,
                      agreement.tenantDetails.address.city,
                      agreement.tenantDetails.address.state,
                      agreement.tenantDetails.address.pincode
                    ].filter(Boolean).join(', ')}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Property & Financial Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Property Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Property Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {agreement.propertyDetails?.address && (
                <div>
                  <div className="text-sm font-medium text-gray-700">Address</div>
                  <div className="text-sm text-gray-900">
                    {[
                      agreement.propertyDetails.address.flatNo,
                      agreement.propertyDetails.address.society,
                      agreement.propertyDetails.address.area,
                      agreement.propertyDetails.address.city,
                      agreement.propertyDetails.address.state,
                      agreement.propertyDetails.address.pincode
                    ].filter(Boolean).join(', ')}
                  </div>
                </div>
              )}
              <div>
                <div className="text-sm font-medium text-gray-700">Purpose</div>
                <div className="text-sm text-gray-900">{agreement.propertyDetails?.purpose || 'Not specified'}</div>
              </div>
            </CardContent>
          </Card>

          {/* Financial Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Financial Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-sm font-medium text-gray-700">Monthly Rent</div>
                <div className="text-sm text-gray-900">₹{agreement.rentalTerms?.monthlyRent || 'Not specified'}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-700">Security Deposit</div>
                <div className="text-sm text-gray-900">₹{agreement.rentalTerms?.securityDeposit || 'Not specified'}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-700">Notice Period</div>
                <div className="text-sm text-gray-900">{agreement.rentalTerms?.noticePeriod || 'Not specified'} months</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Notarized Document Status */}
        {agreement.status === 'active' && (
          <Card>
            <CardHeader>
              <CardTitle>Notarized Document Status</CardTitle>
            </CardHeader>
            <CardContent>
              {agreement.notarizedDocument?.url || agreement.notarizedDocumentUrl ? (
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <FileText className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <div className="font-medium text-green-900">Notarized document uploaded</div>
                      <div className="text-sm text-green-700">
                        {agreement.notarizedDocument?.originalName || 'Document available'}
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" onClick={handleDownloadNotarized}>
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between p-4 bg-amber-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                      <Upload className="h-4 w-4 text-amber-600" />
                    </div>
                    <div>
                      <div className="font-medium text-amber-900">Waiting for notarized document</div>
                      <div className="text-sm text-amber-700">
                        Upload the notarized document to complete the process
                      </div>
                    </div>
                  </div>
                  <Button onClick={handleNotarizedUpload} disabled={uploadingNotarized}>
                    <Upload className="h-4 w-4 mr-2" />
                    {uploadingNotarized ? "Uploading..." : "Upload Document"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}