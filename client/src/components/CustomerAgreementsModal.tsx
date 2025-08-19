import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { 
  FileSignature, 
  Calendar,
  MapPin,
  User,
  Download,
  Eye,
  FileText,
  Folder,
  Edit,
  Trash2
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
      if (!agreement.notarizedDocumentUrl) {
        toast({
          title: "No Document",
          description: "No notarized document available for this agreement",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch(agreement.notarizedDocumentUrl);
      if (!response.ok) {
        throw new Error('Failed to download document');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${agreement.agreementNumber || 'agreement'}_notarized.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Download Complete",
        description: `Notarized document downloaded successfully`,
      });
    } catch (error) {
      console.error('Error downloading notarized document:', error);
      toast({
        title: "Download Failed",
        description: "Failed to download notarized document. Please try again.",
        variant: "destructive",
      });
    }
  };

  const viewAgreement = (agreement: any) => {
    window.open(`/agreements?id=${agreement.id}`, '_blank');
  };

  const downloadWordDocument = async (agreement: any) => {
    try {
      const response = await fetch('/api/agreements/generate-word', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(agreement),
      });

      if (!response.ok) {
        throw new Error('Failed to generate Word document');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${agreement.agreementNumber || 'agreement'}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download Complete",
        description: `${agreement.agreementNumber} Word document downloaded successfully`,
      });
    } catch (error) {
      console.error('Error downloading Word document:', error);
      toast({
        title: "Download Failed",
        description: "Failed to download Word document. Please try again.",
        variant: "destructive",
      });
    }
  };

  const copyAgreement = async (agreement: any) => {
    try {
      const agreementText = `Agreement: ${agreement.agreementNumber}\nLandlord: ${agreement.ownerDetails?.name}\nTenant: ${agreement.tenantDetails?.name}\nProperty: ${agreement.propertyDetails?.address}\nPeriod: ${agreement.agreementDate} - ${agreement.endDate}`;
      
      await navigator.clipboard.writeText(agreementText);
      
      toast({
        title: "Copied!",
        description: "Agreement details copied to clipboard",
      });
    } catch (error) {
      console.error('Error copying agreement:', error);
      toast({
        title: "Copy Failed",
        description: "Failed to copy agreement details",
        variant: "destructive",
      });
    }
  };

  const deleteAgreement = async (agreement: any) => {
    if (!confirm(`Are you sure you want to delete agreement ${agreement.agreementNumber}? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/agreements/${agreement.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete agreement');
      }

      toast({
        title: "Deleted",
        description: `Agreement ${agreement.agreementNumber} has been deleted`,
      });

      // Refresh the agreements list
      window.location.reload();
    } catch (error) {
      console.error('Error deleting agreement:', error);
      toast({
        title: "Delete Failed",
        description: "Failed to delete agreement. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (!customer) return null;

  const agreements = (agreementsData as any)?.agreements || [];

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
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-3">
                          <h4 className="font-medium text-lg">
                            {agreement?.agreementNumber || "N/A"}
                          </h4>
                          <Badge 
                            variant={agreement?.status === 'active' ? 'default' : 'outline'}
                            className={agreement?.status === 'active' ? 'bg-green-100 text-green-800' : ''}
                          >
                            {agreement?.status || "Draft"}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {agreement?.language || "English"}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-600">
                          <div><span className="font-medium">Property:</span> {agreement?.propertyDetails?.address || "N/A"}</div>
                          <div><span className="font-medium">Landlord:</span> {agreement?.ownerDetails?.name || "N/A"}</div>
                          <div><span className="font-medium">Tenant:</span> {agreement?.tenantDetails?.name || "N/A"}</div>
                          <div><span className="font-medium">Period:</span> {agreement?.agreementDate || "N/A"} - {agreement?.endDate || "N/A"}</div>
                        </div>
                      </div>
                      
                      <div className="flex gap-1">
                        {/* View Icon */}
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="p-2 h-8 w-8 hover:bg-blue-50 hover:text-blue-600"
                          onClick={() => viewAgreement(agreement)}
                          title="View Agreement"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        
                        {/* Download PDF Icon */}
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="p-2 h-8 w-8 hover:bg-green-50 hover:text-green-600"
                          onClick={() => downloadAgreementPdf(agreement)}
                          title="Download PDF"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        
                        {/* Download Word Document Icon */}
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="p-2 h-8 w-8 hover:bg-blue-50 hover:text-blue-600"
                          onClick={() => downloadWordDocument(agreement)}
                          title="Download Word Document"
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                        
                        {/* Download Notarized Document Icon */}
                        {agreement.notarizedDocumentUrl ? (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="p-2 h-8 w-8 hover:bg-orange-50 hover:text-orange-600"
                            onClick={() => downloadNotarizedDocument(agreement)}
                            title="Download Notarized Document"
                          >
                            <Folder className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="p-2 h-8 w-8 text-gray-300 cursor-not-allowed"
                            disabled
                            title="No notarized document available"
                          >
                            <Folder className="h-4 w-4" />
                          </Button>
                        )}
                        
                        {/* Copy Agreement Icon */}
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="p-2 h-8 w-8 hover:bg-purple-50 hover:text-purple-600"
                          onClick={() => copyAgreement(agreement)}
                          title="Copy Agreement Details"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        
                        {/* Delete Agreement Icon */}
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="p-2 h-8 w-8 hover:bg-red-50 hover:text-red-600"
                          onClick={() => deleteAgreement(agreement)}
                          title="Delete Agreement"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        
                        {/* Edit Icon */}
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="p-2 h-8 w-8 hover:bg-yellow-50 hover:text-yellow-600"
                          onClick={() => window.open(`/agreements/edit/${agreement.id}`, '_blank')}
                          title="Edit Agreement"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        
                        {/* Copy Icon */}
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="p-2 h-8 w-8 hover:bg-indigo-50 hover:text-indigo-600"
                          onClick={() => window.open(`/agreements/copy/${agreement.id}`, '_blank')}
                          title="Copy Agreement"
                        >
                          <FileSignature className="h-4 w-4" />
                        </Button>
                        
                        {/* Delete Icon */}
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="p-2 h-8 w-8 hover:bg-red-50 hover:text-red-600"
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete agreement ${agreement.agreementNumber}?`)) {
                              // Add delete functionality here
                              toast({
                                title: "Delete Agreement",
                                description: "Delete functionality will be implemented",
                                variant: "destructive"
                              });
                            }
                          }}
                          title="Delete Agreement"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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