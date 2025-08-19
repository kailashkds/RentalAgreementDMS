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
                      
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          const agreementId = agreement?.id;
                          if (agreementId) {
                            window.open(`/agreements?id=${agreementId}`, '_blank');
                          }
                        }}
                        data-testid={`button-view-agreement-${safeKey}`}
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