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
              {agreements.map((agreement: any) => (
                <div 
                  key={agreement.id} 
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-medium">{agreement.agreementNumber}</h4>
                        <Badge 
                          variant={
                            agreement.status === "active" ? "default" :
                            agreement.status === "expired" ? "destructive" :
                            agreement.status === "draft" ? "secondary" : "outline"
                          }
                        >
                          {agreement.status}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {agreement.language}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <span>
                            {(() => {
                              try {
                                const ownerName = agreement.ownerDetails && typeof agreement.ownerDetails === 'object' 
                                  ? agreement.ownerDetails.name || "N/A" 
                                  : "N/A";
                                const tenantName = agreement.tenantDetails && typeof agreement.tenantDetails === 'object' 
                                  ? agreement.tenantDetails.name || "N/A" 
                                  : "N/A";
                                return `${ownerName} → ${tenantName}`;
                              } catch (e) {
                                return "N/A → N/A";
                              }
                            })()}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          <span className="truncate">
                            {(() => {
                              try {
                                return agreement.propertyDetails && typeof agreement.propertyDetails === 'object' 
                                  ? agreement.propertyDetails.address || "No address" 
                                  : "No address";
                              } catch (e) {
                                return "No address";
                              }
                            })()}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>
                            {(() => {
                              try {
                                const startDate = agreement.startDate ? new Date(agreement.startDate).toLocaleDateString() : "N/A";
                                const endDate = agreement.endDate ? new Date(agreement.endDate).toLocaleDateString() : "N/A";
                                return `${startDate} - ${endDate}`;
                              } catch (e) {
                                return "N/A - N/A";
                              }
                            })()}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            ₹{(() => {
                              try {
                                return agreement.rentalTerms && typeof agreement.rentalTerms === 'object' 
                                  ? agreement.rentalTerms.monthlyRent || 0 
                                  : 0;
                              } catch (e) {
                                return 0;
                              }
                            })()}
                          </span>
                          <span>/month</span>
                        </div>
                      </div>
                    </div>
                    
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        // Navigate to agreement details
                        window.open(`/agreements?id=${agreement.id}`, '_blank');
                      }}
                      data-testid={`button-view-agreement-${agreement.id}`}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View
                    </Button>
                  </div>
                </div>
              ))}
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