import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Info } from "lucide-react";
import { useForm } from "react-hook-form";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCustomerCreated?: (customerId: string) => void;
}

interface CustomerFormData {
  name: string;
  mobile: string;
  email: string;
}

export default function CustomerModal({ isOpen, onClose, onCustomerCreated }: CustomerModalProps) {
  const { toast } = useToast();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CustomerFormData>();

  const onSubmit = async (data: CustomerFormData) => {
    try {
      const response = await apiRequest("POST", "/api/customers", data);
      const customer = await response.json();
      
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      
      toast({
        title: "Customer created",
        description: `Customer ${customer.name} has been created successfully.`,
      });
      
      onCustomerCreated?.(customer.id);
      reset();
      onClose();
    } catch (error: any) {
      let errorMessage = "Failed to create customer.";
      
      // Parse error response for specific error messages
      if (error.message.includes("mobile number already exists")) {
        errorMessage = "A customer with this mobile number already exists.";
      } else if (error.message.includes("email address already exists")) {
        errorMessage = "A customer with this email address already exists.";
      } else if (error.message.includes("information already exists")) {
        errorMessage = "A customer with this information already exists.";
      } else if (error.message.includes("unique constraint")) {
        errorMessage = "A customer with this mobile number or email already exists.";
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-gray-800">
            Create New Customer
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="name">Full Name</Label>
            <Input
              {...register("name", { required: "Name is required" })}
              placeholder="Enter full name"
            />
            {errors.name && (
              <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="mobile">Mobile Number</Label>
            <Input
              {...register("mobile", { 
                required: "Mobile number is required",
                pattern: {
                  value: /^\+?[1-9]\d{1,14}$/,
                  message: "Please enter a valid mobile number"
                }
              })}
              placeholder="+91 XXXXXXXXXX"
            />
            {errors.mobile && (
              <p className="text-sm text-red-600 mt-1">{errors.mobile.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="email">Email Address</Label>
            <Input
              type="email"
              {...register("email", {
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: "Please enter a valid email address"
                }
              })}
              placeholder="email@example.com"
            />
            {errors.email && (
              <p className="text-sm text-red-600 mt-1">{errors.email.message}</p>
            )}
          </div>

          <Alert className="bg-blue-50 border-blue-200">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              <strong>Auto-Generated Password</strong>
              <br />
              A default password will be generated and can be sent to the customer via WhatsApp.
            </AlertDescription>
          </Alert>

          <div className="flex space-x-3 pt-4 border-t border-gray-200">
            <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1 bg-blue-600 hover:bg-blue-700">
              {isSubmitting ? "Creating..." : "Create Customer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
