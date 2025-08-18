import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Eye, 
  EyeOff, 
  RotateCcw, 
  Power, 
  PowerOff, 
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
    isActive: true,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (customer) {
      setFormData({
        name: customer.name,
        mobile: customer.mobile,
        email: customer.email || "",
        isActive: customer.isActive,
      });
      setNewPassword("");
      setShowPassword(false);
    }
  }, [customer]);

  const handleUpdateCustomer = async () => {
    if (!customer) return;
    
    setIsLoading(true);
    try {
      await apiRequest("PUT", `/api/customers/${customer.id}`, formData);
      
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      
      toast({
        title: "Customer updated",
        description: "Customer information has been updated successfully.",
      });
      
      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update customer.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!customer || !newPassword || newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await apiRequest("PATCH", `/api/customers/${customer.id}/reset-password`, {
        newPassword
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      
      toast({
        title: "Password reset",
        description: "Customer password has been reset successfully.",
      });
      
      setNewPassword("");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reset password.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!customer) return;
    
    setIsLoading(true);
    try {
      const newStatus = !customer.isActive;
      await apiRequest("PATCH", `/api/customers/${customer.id}/toggle-status`, {
        isActive: newStatus
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      
      toast({
        title: `Customer ${newStatus ? "activated" : "deactivated"}`,
        description: `Customer has been ${newStatus ? "activated" : "deactivated"} successfully.`,
      });
      
      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update customer status.",
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

          <Separator />

          {/* Password Management */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Password Management</h3>
            
            <div className="space-y-2">
              <Label>Current Password</Label>
              <div className="flex items-center gap-2">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={showPassword ? customer.password : "••••••••••"}
                  readOnly
                  className="bg-gray-50 font-mono"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowPassword(!showPassword)}
                  data-testid="button-toggle-password-view"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {showPassword && (
                <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded border font-mono">
                  {customer.password}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="Enter new password (min 6 chars)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  data-testid="input-new-password"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleResetPassword}
                  disabled={!newPassword || newPassword.length < 6 || isLoading}
                  data-testid="button-reset-password"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <Separator />

          {/* Account Status */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Account Status</h3>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">Customer Status</p>
                <p className="text-xs text-gray-500">
                  {customer.isActive ? "Customer can log in" : "Customer cannot log in"}
                </p>
              </div>
              <Button
                variant={customer.isActive ? "destructive" : "default"}
                size="sm"
                onClick={handleToggleStatus}
                disabled={isLoading}
                data-testid="button-toggle-status"
              >
                {customer.isActive ? (
                  <>
                    <PowerOff className="h-4 w-4 mr-2" />
                    Deactivate
                  </>
                ) : (
                  <>
                    <Power className="h-4 w-4 mr-2" />
                    Activate
                  </>
                )}
              </Button>
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