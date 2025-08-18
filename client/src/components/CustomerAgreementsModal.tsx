import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { 
  FileSignature, 
  Calendar,
  MapPin,
  User,
  ExternalLink
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
              {agreements.map((agreement: any) => {
                // Safely extract values to prevent React rendering errors
                const agreementNumber = String(agreement?.agreementNumber || "N/A");
                const status = String(agreement?.status || "unknown");
                const language = String(agreement?.language || "N/A");
                const agreementId = String(agreement?.id || "");
                
                // Safely parse nested objects
                let ownerName = "N/A";
                let tenantName = "N/A";
                let propertyAddress = "No address";
                let monthlyRent = 0;
                let startDate = "N/A";
                let endDate = "N/A";
                
                try {
                  if (agreement.ownerDetails) {
                    if (typeof agreement.ownerDetails === 'string') {
                      const parsed = JSON.parse(agreement.ownerDetails);
                      ownerName = parsed?.name || "N/A";
                    } else if (typeof agreement.ownerDetails === 'object') {
                      ownerName = agreement.ownerDetails?.name || "N/A";
                    }
                  }
                } catch (e) {
                  ownerName = "N/A";
                }
                
                try {
                  if (agreement.tenantDetails) {
                    if (typeof agreement.tenantDetails === 'string') {
                      const parsed = JSON.parse(agreement.tenantDetails);
                      tenantName = parsed?.name || "N/A";
                    } else if (typeof agreement.tenantDetails === 'object') {
                      tenantName = agreement.tenantDetails?.name || "N/A";
                    }
                  }
                } catch (e) {
                  tenantName = "N/A";
                }
                
                try {
                  if (agreement.propertyDetails) {
                    if (typeof agreement.propertyDetails === 'string') {
                      const parsed = JSON.parse(agreement.propertyDetails);
                      propertyAddress = parsed?.address || "No address";
                    } else if (typeof agreement.propertyDetails === 'object') {
                      propertyAddress = agreement.propertyDetails?.address || "No address";
                    }
                  }
                } catch (e) {
                  propertyAddress = "No address";
                }
                
                try {
                  if (agreement.rentalTerms) {
                    if (typeof agreement.rentalTerms === 'string') {
                      const parsed = JSON.parse(agreement.rentalTerms);
                      monthlyRent = Number(parsed?.monthlyRent) || 0;
                    } else if (typeof agreement.rentalTerms === 'object') {
                      monthlyRent = Number(agreement.rentalTerms?.monthlyRent) || 0;
                    }
                  }
                } catch (e) {
                  monthlyRent = 0;
                }
                
                try {
                  if (agreement.startDate) {
                    startDate = new Date(agreement.startDate).toLocaleDateString();
                  }
                  if (agreement.endDate) {
                    endDate = new Date(agreement.endDate).toLocaleDateString();
                  }
                } catch (e) {
                  // Keep default values
                }
                
                return (
                  <div 
                    key={agreementId} 
                    className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-medium">{agreementNumber}</h4>
                          <Badge 
                            variant={
                              status === "active" ? "default" :
                              status === "expired" ? "destructive" :
                              status === "draft" ? "secondary" : "outline"
                            }
                          >
                            {status}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {language}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            <span>{ownerName} → {tenantName}</span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            <span className="truncate">{propertyAddress}</span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span>{startDate} - {endDate}</span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className="font-medium">₹{monthlyRent}</span>
                            <span>/month</span>
                          </div>
                        </div>
                      </div>
                      
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          // Navigate to agreement details
                          window.open(`/agreements?id=${agreementId}`, '_blank');
                        }}
                        data-testid={`button-view-agreement-${agreementId}`}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View
                      </Button>
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