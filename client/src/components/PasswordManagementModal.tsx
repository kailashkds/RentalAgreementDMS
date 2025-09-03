import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Key, Eye, EyeOff, RotateCcw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Customer {
  id: string;
  name: string;
  mobile: string;
  email?: string;
  password: string;
  encryptedPassword?: string; // Encrypted password for secure admin viewing
  isActive: boolean;
}

interface PasswordManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  onPasswordReset: () => void;
}

export default function PasswordManagementModal({ 
  isOpen, 
  onClose, 
  customer, 
  onPasswordReset 
}: PasswordManagementModalProps) {
  const [decryptedPassword, setDecryptedPassword] = useState<string | null>(null);
  const [decryptInProgress, setDecryptInProgress] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const { toast } = useToast();

  // Reset state when modal opens/closes or customer changes
  useEffect(() => {
    if (!isOpen) {
      setDecryptedPassword(null);
      setIsPasswordVisible(false);
      setNewPassword("");
    }
  }, [isOpen, customer?.id]);

  if (!customer) return null;

  const handleDecryptPassword = async () => {
    if (decryptInProgress) return;
    
    setDecryptInProgress(true);
    try {
      const response = await apiRequest(`/api/customers/${customer.id}/decrypt-password`);
      setDecryptedPassword(response.password);
      setIsPasswordVisible(true);
    } catch (error) {
      console.error('Failed to decrypt password:', error);
      toast({
        title: "Error",
        description: "Failed to decrypt password",
        variant: "destructive",
      });
    } finally {
      setDecryptInProgress(false);
    }
  };

  const togglePasswordVisibility = () => {
    if (!decryptedPassword) {
      // If password hasn't been fetched yet, fetch it
      handleDecryptPassword();
    } else {
      // If password is already fetched, just toggle visibility
      setIsPasswordVisible(!isPasswordVisible);
    }
  };

  const validatePassword = (password: string): string | null => {
    if (!password || password.length < 8) {
      return "Password must be at least 8 characters long";
    }
    if (!/[A-Z]/.test(password)) {
      return "Password must contain at least one uppercase letter";
    }
    if (!/[a-z]/.test(password)) {
      return "Password must contain at least one lowercase letter";
    }
    if (!/[0-9]/.test(password)) {
      return "Password must contain at least one number";
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      return "Password must contain at least one special character";
    }
    return null;
  };

  const handleResetPassword = async () => {
    if (!newPassword.trim()) {
      toast({
        title: "Error",
        description: "Please enter a new password",
        variant: "destructive",
      });
      return;
    }

    const validationError = validatePassword(newPassword.trim());
    if (validationError) {
      toast({
        title: "Weak Password",
        description: validationError,
        variant: "destructive",
      });
      return;
    }

    try {
      setIsResetting(true);
      await apiRequest(`/api/customers/${customer.id}/reset-password`, "PATCH", {
        newPassword: newPassword.trim()
      });

      toast({
        title: "Password Reset",
        description: `Password successfully reset for ${customer.name}`,
      });

      onPasswordReset();
      setNewPassword("");
    } catch (error: any) {
      console.error("Error resetting password:", error);
      
      // Handle specific error messages from server
      const errorMessage = error?.response?.data?.message || 
                          error?.message || 
                          "Failed to reset password. Please try again.";
      
      toast({
        title: "Password Reset Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Password Management
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Customer Info */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {customer.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h3 className="font-medium">{customer.name}</h3>
                <p className="text-sm text-gray-500">{customer.mobile}</p>
                <Badge 
                  variant={customer.isActive ? "default" : "destructive"}
                  className="mt-1"
                >
                  {customer.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
          </div>

          {/* Current Password Display */}
          <div className="space-y-2">
            <Label htmlFor="current-password">Current Password</Label>
            <div className="relative">
              <Input
                id="current-password"
                type="text"
                value={isPasswordVisible ? decryptedPassword || "•••••••••••" : "•••••••••••"}
                readOnly
                className="pr-10 bg-gray-50"
                data-testid="input-current-password"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={togglePasswordVisibility}
                disabled={decryptInProgress}
                data-testid="button-toggle-password-visibility"
              >
                {decryptInProgress ? (
                  <div className="animate-spin h-4 w-4 border border-gray-400 border-t-transparent rounded-full" />
                ) : isPasswordVisible ? (
                  <EyeOff className="h-4 w-4 text-gray-400" />
                ) : (
                  <Eye className="h-4 w-4 text-gray-400" />
                )}
              </Button>
            </div>
          </div>

          {/* New Password Input */}
          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <Input
              id="new-password"
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              data-testid="input-new-password"
            />
            <div className="text-xs text-gray-600 space-y-1">
              <p className="font-medium">Password Requirements:</p>
              <ul className="list-disc list-inside space-y-0.5 ml-2">
                <li>At least 8 characters</li>
                <li>One uppercase letter (A-Z)</li>
                <li>One lowercase letter (a-z)</li>
                <li>One number (0-9)</li>
                <li>One special character (!@#$%^&*)</li>
              </ul>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3">
            <Button 
              variant="outline" 
              onClick={onClose}
              data-testid="button-cancel-password"
            >
              Cancel
            </Button>
            <Button
              onClick={handleResetPassword}
              disabled={isResetting || !newPassword.trim()}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="button-reset-password"
            >
              {isResetting ? (
                <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Key className="h-4 w-4 mr-2" />
              )}
              {isResetting ? "Resetting..." : "Reset Password"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}