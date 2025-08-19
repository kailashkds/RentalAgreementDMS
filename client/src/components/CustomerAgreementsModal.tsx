import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAgreements } from "@/hooks/useAgreements";
import { useState } from "react";
import { 
  FileSignature, 
  Calendar,
  MapPin,
  User,
  Download,
  Eye,
  FileText,
  Folder,
  X,
  ArrowLeft,
  Loader2
} from "lucide-react";

interface Customer {
  id: string;
  name: string;
  mobile: string;
  email?: string;
  agreementCount: number;
}

interface CustomerAgreementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
}

export default function CustomerAgreementsModal({ isOpen, onClose, customer }: CustomerAgreementsModalProps) {
  const { toast } = useToast();
  const [selectedAgreement, setSelectedAgreement] = useState<any>(null);
  const [showAgreementDetails, setShowAgreementDetails] = useState(false);
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  
  const { data: agreementsData, isLoading } = useAgreements({
    customerId: customer?.id || "",
  });

  const downloadAgreementPdf = async (agreementId: string) => {
    setLoadingStates(prev => ({ ...prev, [`pdf-${agreementId}`]: true }));
    
    try {
      const agreement = agreementsData?.agreements.find(a => a.id === agreementId);
      if (!agreement) {
        throw new Error('Agreement not found');
      }

      console.log('Starting PDF generation for agreement:', agreement.id);
      console.log('Agreement data:', {
        hasOwnerDetails: !!agreement.ownerDetails,
        hasTenantDetails: !!agreement.tenantDetails,
        hasPropertyDetails: !!agreement.propertyDetails,
        hasRentalTerms: !!agreement.rentalTerms,
        agreementNumber: agreement.agreementNumber
      });

      const response = await fetch('/api/agreements/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ownerDetails: agreement.ownerDetails || {},
          tenantDetails: agreement.tenantDetails || {},
          propertyDetails: agreement.propertyDetails || {},
          rentalTerms: agreement.rentalTerms || {},
          agreementDate: agreement.agreementDate,
          createdAt: agreement.createdAt,
          language: agreement.language || 'english',
          additionalClauses: agreement.additionalClauses || [],
          agreementNumber: agreement.agreementNumber,
          // Include document data for embedding
          documents: agreement.documents || {},
          ownerDocuments: agreement.ownerDocuments || {},
          tenantDocuments: agreement.tenantDocuments || {},
          propertyDocuments: agreement.propertyDocuments || {}
        }),
      });

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
        title: "Error",
        description: `Failed to generate agreement PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setLoadingStates(prev => ({ ...prev, [`pdf-${agreementId}`]: false }));
    }
  };

  const downloadWordDocument = async (agreementId: string) => {
    setLoadingStates(prev => ({ ...prev, [`word-${agreementId}`]: true }));
    
    try {
      const agreement = agreementsData?.agreements.find(a => a.id === agreementId);
      if (!agreement) {
        throw new Error('Agreement not found');
      }

      console.log('Starting Word document generation for agreement:', agreement.id);

      const response = await fetch('/api/agreements/generate-word', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ownerDetails: agreement.ownerDetails || {},
          tenantDetails: agreement.tenantDetails || {},
          propertyDetails: agreement.propertyDetails || {},
          rentalTerms: agreement.rentalTerms || {},
          agreementDate: agreement.agreementDate,
          createdAt: agreement.createdAt,
          language: agreement.language || 'english',
          additionalClauses: agreement.additionalClauses || [],
          agreementNumber: agreement.agreementNumber,
          documents: agreement.documents || {},
          ownerDocuments: agreement.ownerDocuments || {},
          tenantDocuments: agreement.tenantDocuments || {},
          propertyDocuments: agreement.propertyDocuments || {}
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${agreement.agreementNumber || 'agreement'}.docx`;
        link.click();
        window.URL.revokeObjectURL(url);
        
        toast({
          title: "Word Document Downloaded",
          description: `${agreement.agreementNumber}.docx downloaded successfully`,
        });
      } else {
        const errorData = await response.json();
        console.error('Word generation error:', errorData);
        throw new Error(errorData.message || 'Failed to generate Word document');
      }
    } catch (error) {
      console.error('Word download error:', error);
      toast({
        title: "Error",
        description: "Failed to download Word document.",
        variant: "destructive",
      });
    } finally {
      setLoadingStates(prev => ({ ...prev, [`word-${agreementId}`]: false }));
    }
  };

  const downloadNotarizedDocument = async (agreement: any) => {
    try {
      if (agreement.notarizedDocument?.url) {
        const link = document.createElement('a');
        link.href = agreement.notarizedDocument.url;
        link.download = agreement.notarizedDocument.originalName || 'notarized-document.pdf';
        link.click();
        
        toast({
          title: "Document Downloaded",
          description: `${agreement.notarizedDocument.originalName} downloaded successfully`,
        });
      } else if (agreement.notarizedDocumentUrl) {
        const link = document.createElement('a');
        link.href = agreement.notarizedDocumentUrl;
        link.download = `notarized-${agreement.agreementNumber}.pdf`;
        link.click();
        
        toast({
          title: "Document Downloaded",
          description: "Notarized document downloaded successfully",
        });
      } else {
        toast({
          title: "No Document",
          description: "No notarized document available for this agreement",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error downloading document:', error);
      toast({
        title: "Download Failed",
        description: "Failed to download document. Please try again.",
        variant: "destructive",
      });
    }
  };



  const viewAgreement = (agreement: any) => {
    setSelectedAgreement(agreement);
    setShowAgreementDetails(true);
  };

  const handleCloseDetailsView = () => {
    setShowAgreementDetails(false);
    setSelectedAgreement(null);
  };

  if (!customer) return null;

  const agreements = (agreementsData as any)?.agreements || [];

  if (showAgreementDetails && selectedAgreement) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCloseDetailsView}
                  className="mr-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to List
                </Button>
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Agreement Details</h2>
                  <p className="text-sm text-gray-500">Agreement #{selectedAgreement?.agreementNumber}</p>
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 pt-6">
            {/* Step 1: Customer & Language Selection */}
            <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm">
              <div className="bg-gradient-to-r from-slate-600 to-slate-700 px-6 py-4">
                <h3 className="text-lg font-semibold text-white flex items-center">
                  <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center mr-3">
                    <span className="text-xs font-bold text-white">1</span>
                  </div>
                  Customer & Language Selection
                </h3>
              </div>
              <div className="bg-slate-50 p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div>
                    <label className="text-sm font-medium text-slate-700">Customer</label>
                    <p className="mt-1 text-sm text-gray-900 font-medium">{customer?.name || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Mobile</label>
                    <p className="mt-1 text-sm text-gray-900">{customer?.mobile || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Language</label>
                    <p className="mt-1 text-sm text-gray-900 capitalize">{selectedAgreement.language || 'English'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2: Owner Details */}
            <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm">
              <div className="bg-gradient-to-r from-slate-600 to-slate-700 px-6 py-4">
                <h3 className="text-lg font-semibold text-white flex items-center">
                  <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center mr-3">
                    <span className="text-xs font-bold text-white">2</span>
                  </div>
                  Owner Details
                </h3>
              </div>
              <div className="bg-slate-50 p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div>
                    <label className="text-sm font-medium text-slate-700">Full Name</label>
                    <p className="mt-1 text-sm text-gray-900 font-medium">{selectedAgreement.ownerDetails?.name || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Mobile Number</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedAgreement.ownerDetails?.mobile || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Email Address</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedAgreement.ownerDetails?.email || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Age</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedAgreement.ownerDetails?.age || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Occupation</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedAgreement.ownerDetails?.occupation || 'Not provided'}</p>
                  </div>
                  <div className="col-span-full">
                    <label className="text-sm font-medium text-slate-700">Address</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {selectedAgreement.ownerDetails?.address ? 
                        `${selectedAgreement.ownerDetails.address.flatNo || ''}, ${selectedAgreement.ownerDetails.address.society || ''}, ${selectedAgreement.ownerDetails.address.area || ''}, ${selectedAgreement.ownerDetails.address.city || ''}, ${selectedAgreement.ownerDetails.address.state || ''} - ${selectedAgreement.ownerDetails.address.pincode || ''}` 
                        : 'Not provided'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3: Tenant Details */}
            <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm">
              <div className="bg-gradient-to-r from-slate-600 to-slate-700 px-6 py-4">
                <h3 className="text-lg font-semibold text-white flex items-center">
                  <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center mr-3">
                    <span className="text-xs font-bold text-white">3</span>
                  </div>
                  Tenant Details
                </h3>
              </div>
              <div className="bg-slate-50 p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div>
                    <label className="text-sm font-medium text-slate-700">Full Name</label>
                    <p className="mt-1 text-sm text-gray-900 font-medium">{selectedAgreement.tenantDetails?.name || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Mobile Number</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedAgreement.tenantDetails?.mobile || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Email Address</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedAgreement.tenantDetails?.email || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Age</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedAgreement.tenantDetails?.age || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Occupation</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedAgreement.tenantDetails?.occupation || 'Not provided'}</p>
                  </div>
                  <div className="col-span-full">
                    <label className="text-sm font-medium text-slate-700">Address</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {selectedAgreement.tenantDetails?.address ? 
                        `${selectedAgreement.tenantDetails.address.flatNo || ''}, ${selectedAgreement.tenantDetails.address.society || ''}, ${selectedAgreement.tenantDetails.address.area || ''}, ${selectedAgreement.tenantDetails.address.city || ''}, ${selectedAgreement.tenantDetails.address.state || ''} - ${selectedAgreement.tenantDetails.address.pincode || ''}` 
                        : 'Not provided'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 4: Property & Rental Details */}
            <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm">
              <div className="bg-gradient-to-r from-slate-600 to-slate-700 px-6 py-4">
                <h3 className="text-lg font-semibold text-white flex items-center">
                  <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center mr-3">
                    <span className="text-xs font-bold text-white">4</span>
                  </div>
                  Property & Rental Details
                </h3>
              </div>
              <div className="bg-slate-50 p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div>
                    <label className="text-sm font-medium text-slate-700">Monthly Rent</label>
                    <p className="mt-1 text-lg text-green-600 font-bold">₹{selectedAgreement.rentalTerms?.monthlyRent || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Security Deposit</label>
                    <p className="mt-1 text-lg text-blue-600 font-bold">₹{selectedAgreement.rentalTerms?.securityDeposit || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Duration</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedAgreement.rentalTerms?.duration || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Notice Period</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedAgreement.rentalTerms?.noticePeriod || 'Not provided'} months</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Property Type</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedAgreement.propertyDetails?.type || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Purpose</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedAgreement.propertyDetails?.purpose || 'Not provided'}</p>
                  </div>
                  <div className="col-span-full">
                    <label className="text-sm font-medium text-slate-700">Property Address</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {selectedAgreement.propertyDetails?.address ? 
                        `${selectedAgreement.propertyDetails.address.flatNo || ''}, ${selectedAgreement.propertyDetails.address.society || ''}, ${selectedAgreement.propertyDetails.address.area || ''}, ${selectedAgreement.propertyDetails.address.city || ''}, ${selectedAgreement.propertyDetails.address.state || ''} - ${selectedAgreement.propertyDetails.address.pincode || ''}` 
                        : 'Not provided'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 5: Additional Clauses & Documents */}
            <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm">
              <div className="bg-gradient-to-r from-slate-600 to-slate-700 px-6 py-4">
                <h3 className="text-lg font-semibold text-white flex items-center">
                  <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center mr-3">
                    <span className="text-xs font-bold text-white">5</span>
                  </div>
                  Additional Clauses & Actions
                </h3>
              </div>
              <div className="bg-slate-50 p-6">
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">Additional Clauses</h4>
                  {selectedAgreement.additionalClauses && selectedAgreement.additionalClauses.length > 0 ? (
                    <div className="space-y-2">
                      {selectedAgreement.additionalClauses.map((clause: any, index: number) => (
                        <div key={index} className="bg-white p-3 rounded-lg border border-slate-200">
                          <p className="text-sm text-gray-900">{clause.text || clause}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No additional clauses added</p>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">Download Options</h4>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      onClick={() => downloadAgreementPdf(selectedAgreement)}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      PDF
                    </Button>
                    <Button
                      onClick={() => downloadWordDocument(selectedAgreement)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Word
                    </Button>
                    {(selectedAgreement.notarizedDocument?.url || selectedAgreement.notarizedDocumentUrl) && (
                      <Button
                        onClick={() => downloadNotarizedDocument(selectedAgreement)}
                        className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Document
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button
                variant="outline"
                onClick={handleCloseDetailsView}
                className="px-6 py-2"
              >
                <X className="h-4 w-4 mr-2" />
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5" />
            Agreements for {customer.name}
            <Badge variant="secondary" className="ml-2">
              {customer.agreementCount} Total
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Customer Info */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white text-lg font-medium">
                  {customer.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h3 className="font-medium">{customer.name}</h3>
                <p className="text-sm text-gray-500">{customer.mobile}</p>
                {customer.email && <p className="text-sm text-gray-500">{customer.email}</p>}
              </div>
            </div>
          </div>

          {/* Agreements List */}
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">
              Loading agreements...
            </div>
          ) : agreements.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileSignature className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No agreements found for this customer.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {agreements.map((agreement: any, index: number) => {
                // Create a safe key
                const safeKey = agreement?.id || `agreement-${index}`;
                
                return (
                  <div 
                    key={safeKey} 
                    className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-medium">
                            {agreement?.agreementNumber || "N/A"}
                          </h4>
                          <Badge variant="outline">
                            {agreement?.status || "unknown"}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {agreement?.language || "N/A"}
                          </Badge>
                        </div>
                        
                        <div className="text-sm text-gray-600 space-y-1">
                          <div>Agreement Date: {agreement?.agreementDate || "N/A"}</div>
                          <div>Start Date: {agreement?.startDate || "N/A"}</div>
                          <div>End Date: {agreement?.endDate || "N/A"}</div>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => viewAgreement(agreement)}
                          title="View Agreement"
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        

                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => downloadAgreementPdf(agreement.id)}
                          title="Download PDF"
                          disabled={loadingStates[`pdf-${agreement.id}`]}
                          className="text-green-600 hover:text-green-900"
                        >
                          {loadingStates[`pdf-${agreement.id}`] ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4 mr-1" />
                          )}
                          PDF
                        </Button>

                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => downloadWordDocument(agreement.id)}
                          title="Download Word Document"
                          disabled={loadingStates[`word-${agreement.id}`]}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          {loadingStates[`word-${agreement.id}`] ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <FileText className="h-4 w-4 mr-1" />
                          )}
                          Word
                        </Button>
                        
                        {(agreement.notarizedDocument?.url || agreement.notarizedDocumentUrl) && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => downloadNotarizedDocument(agreement)}
                            title="Download Notarized Document"
                            className="text-amber-600 hover:text-amber-900"
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            Document
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={onClose} data-testid="button-close-agreements">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}