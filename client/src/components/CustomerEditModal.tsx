import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Save,
  FileSignature,
  User
} from "lucide-react";

interface Customer {
  id: string;
  name: string;
  mobile: string;
  email?: string;
  password: string;
  isActive: boolean;
  agreementCount: number;
  createdAt: string;
  updatedAt: string;
}

interface CustomerEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
}

export default function CustomerEditModal({ isOpen, onClose, customer }: CustomerEditModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    mobile: "",
    email: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (customer) {
      setFormData({
        name: customer.name,
        mobile: customer.mobile,
        email: customer.email || "",
      });
    }
  }, [customer]);

  const handleUpdateCustomer = async () => {
    if (!customer) return;
    
    setIsLoading(true);
    try {
      console.log("Updating customer:", customer.id, "with data:", formData);
      await apiRequest("PUT", `/api/customers/${customer.id}`, formData);
      
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      
      toast({
        title: "Customer updated",
        description: "Customer information has been updated successfully.",
      });
      
      onClose();
    } catch (error) {
      console.error("Customer update error:", error);
      toast({
        title: "Error",
        description: "Failed to update customer.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };



  if (!customer) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Edit Customer - {customer.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Customer Status Badge */}
          <div className="flex items-center justify-between">
            <Badge variant={customer.isActive ? "default" : "destructive"}>
              {customer.isActive ? "Active" : "Inactive"}
            </Badge>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <FileSignature className="h-4 w-4" />
              {customer.agreementCount} agreements
            </div>
          </div>

          <Separator />

          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Basic Information</h3>
            
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                data-testid="input-customer-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mobile">Mobile</Label>
              <Input
                id="mobile"
                value={formData.mobile}
                onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                data-testid="input-customer-mobile"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email (Optional)</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                data-testid="input-customer-email"
              />
            </div>
          </div>



          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose} data-testid="button-cancel">
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateCustomer} 
              disabled={isLoading}
              data-testid="button-save-customer"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}