import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
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
  ArrowLeft
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
  
  const { data: agreementsData, isLoading } = useQuery({
    queryKey: ["/api/agreements", customer?.id],
    queryFn: async () => {
      if (!customer?.id) return { agreements: [] };
      const response = await fetch(`/api/agreements?customerId=${customer.id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch agreements');
      }
      return response.json();
    },
    enabled: !!customer?.id && isOpen,
  });

  const downloadAgreementPdf = async (agreement: any) => {
    try {
      const response = await fetch(`/api/agreements/${agreement.id}/pdf`);
      if (!response.ok) {
        throw new Error('Failed to get PDF data');
      }
      
      const data = await response.json();
      
      // Use the same client-side PDF generation as the main app
      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;
      
      // Create a temporary container for the HTML
      const tempContainer = document.createElement('div');
      tempContainer.innerHTML = data.html;
      tempContainer.style.position = 'absolute';
      tempContainer.style.left = '-9999px';
      tempContainer.style.top = '-9999px';
      tempContainer.style.width = '794px'; // A4 width in pixels
      document.body.appendChild(tempContainer);
      
      // Generate PDF from HTML
      const canvas = await html2canvas(tempContainer, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        width: 794,
        height: 1123
      });
      
      // Clean up
      document.body.removeChild(tempContainer);
      
      // Create PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`${agreement.agreementNumber || 'agreement'}.pdf`);
      
      toast({
        title: "Download Complete",
        description: `${agreement.agreementNumber} PDF downloaded successfully`,
      });
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast({
        title: "Download Failed",
        description: "Failed to download PDF. Please try again.",
        variant: "destructive",
      });
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

  const downloadWordDocument = async (agreement: any) => {
    try {
      console.log('Starting Word generation for agreement:', agreement.id);

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

      console.log('Word generation response status:', response.status);

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rental_agreement_${agreement.agreementNumber || 'document'}.docx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        toast({
          title: "Word Document Downloaded",
          description: `Agreement ${agreement.agreementNumber} downloaded as Word document.`,
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCloseDetailsView}
                  className="mr-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to List
                </Button>
                <FileSignature className="h-5 w-5" />
                Agreement Details: {selectedAgreement.agreementNumber}
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Agreement Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <FileSignature className="h-4 w-4" />
                    Agreement Information
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div><span className="font-medium">Number:</span> {selectedAgreement.agreementNumber}</div>
                    <div><span className="font-medium">Status:</span> 
                      <Badge variant="outline" className="ml-2">
                        {selectedAgreement.status}
                      </Badge>
                    </div>
                    <div><span className="font-medium">Language:</span> {selectedAgreement.language}</div>
                    <div><span className="font-medium">Agreement Date:</span> {selectedAgreement.agreementDate}</div>
                    <div><span className="font-medium">Start Date:</span> {selectedAgreement.startDate}</div>
                    <div><span className="font-medium">End Date:</span> {selectedAgreement.endDate}</div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Download Options
                  </h3>
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadAgreementPdf(selectedAgreement)}
                      className="w-full justify-start"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download PDF
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadWordDocument(selectedAgreement)}
                      className="w-full justify-start"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Download Word
                    </Button>
                    
                    {(selectedAgreement.notarizedDocument?.url || selectedAgreement.notarizedDocumentUrl) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadNotarizedDocument(selectedAgreement)}
                        className="w-full justify-start"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Download Notarized Document
                      </Button>
                    )}
                    
                    {!selectedAgreement.notarizedDocument?.url && !selectedAgreement.notarizedDocumentUrl && (
                      <div className="text-xs text-gray-500 p-2 bg-yellow-50 rounded border">
                        No notarized document available
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Property Details */}
            {selectedAgreement.propertyDetails && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Property Details
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="font-medium">Address:</span> {selectedAgreement.propertyDetails.address || 'N/A'}</div>
                  <div><span className="font-medium">City:</span> {selectedAgreement.propertyDetails.city || 'N/A'}</div>
                  <div><span className="font-medium">State:</span> {selectedAgreement.propertyDetails.state || 'N/A'}</div>
                  <div><span className="font-medium">Pin Code:</span> {selectedAgreement.propertyDetails.pinCode || 'N/A'}</div>
                </div>
              </div>
            )}

            {/* Rental Terms */}
            {selectedAgreement.rentalTerms && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Rental Terms
                </h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div><span className="font-medium">Monthly Rent:</span> ₹{selectedAgreement.rentalTerms.monthlyRent || 'N/A'}</div>
                  <div><span className="font-medium">Security Deposit:</span> ₹{selectedAgreement.rentalTerms.securityDeposit || 'N/A'}</div>
                  <div><span className="font-medium">Lock-in Period:</span> {selectedAgreement.rentalTerms.lockInPeriod || 'N/A'} months</div>
                  <div><span className="font-medium">Notice Period:</span> {selectedAgreement.rentalTerms.noticePeriod || 'N/A'} months</div>
                  <div><span className="font-medium">Rent Due:</span> {selectedAgreement.rentalTerms.rentDueDate || 'N/A'}</div>
                  <div><span className="font-medium">Late Fee:</span> ₹{selectedAgreement.rentalTerms.lateFeeAmount || 'N/A'}</div>
                </div>
              </div>
            )}

            {/* Owner & Tenant Details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Owner Details
                </h3>
                <div className="space-y-2 text-sm">
                  <div><span className="font-medium">Name:</span> {selectedAgreement.ownerDetails?.name || 'N/A'}</div>
                  <div><span className="font-medium">Mobile:</span> {selectedAgreement.ownerDetails?.mobile || 'N/A'}</div>
                  <div><span className="font-medium">Email:</span> {selectedAgreement.ownerDetails?.email || 'N/A'}</div>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Tenant Details
                </h3>
                <div className="space-y-2 text-sm">
                  <div><span className="font-medium">Name:</span> {selectedAgreement.tenantDetails?.name || 'N/A'}</div>
                  <div><span className="font-medium">Mobile:</span> {selectedAgreement.tenantDetails?.mobile || 'N/A'}</div>
                  <div><span className="font-medium">Email:</span> {selectedAgreement.tenantDetails?.email || 'N/A'}</div>
                </div>
              </div>
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
                          onClick={() => downloadAgreementPdf(agreement)}
                          title="Download PDF"
                          className="text-green-600 hover:text-green-900"
                        >
                          <Download className="h-4 w-4 mr-1" />
                          PDF
                        </Button>

                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => downloadWordDocument(agreement)}
                          title="Download Word Document"
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <FileText className="h-4 w-4 mr-1" />
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