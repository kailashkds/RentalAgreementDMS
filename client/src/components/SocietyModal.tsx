import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";
import { useForm } from "react-hook-form";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface SocietyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SocietyFormData {
  societyName: string;
  area: string;
  district: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
}

export default function SocietyModal({ isOpen, onClose }: SocietyModalProps) {
  const { toast } = useToast();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<SocietyFormData>();

  const onSubmit = async (data: SocietyFormData) => {
    try {
      const response = await apiRequest("POST", "/api/societies", data);
      const society = await response.json();
      
      queryClient.invalidateQueries({ queryKey: ["/api/societies"] });
      
      toast({
        title: "Society added",
        description: `Society ${society.societyName} has been added successfully.`,
      });
      
      reset();
      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add society.",
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
      <DialogContent className="max-w-lg">
        <DialogHeader className="border-b border-gray-200 pb-6">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold text-gray-800">
              Add New Society
            </DialogTitle>
            <Button variant="ghost" size="sm" onClick={handleClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="societyName">Society/Apartment Name</Label>
            <Input
              {...register("societyName", { required: "Society name is required" })}
              placeholder="Enter society/apartment name"
            />
            {errors.societyName && (
              <p className="text-sm text-red-600 mt-1">{errors.societyName.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="area">Area</Label>
              <Input
                {...register("area", { required: "Area is required" })}
                placeholder="Enter area"
              />
              {errors.area && (
                <p className="text-sm text-red-600 mt-1">{errors.area.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="district">District</Label>
              <Input
                {...register("district", { required: "District is required" })}
                placeholder="Enter district"
              />
              {errors.district && (
                <p className="text-sm text-red-600 mt-1">{errors.district.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="city">City</Label>
              <Input
                {...register("city", { required: "City is required" })}
                placeholder="Enter city"
              />
              {errors.city && (
                <p className="text-sm text-red-600 mt-1">{errors.city.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="state">State</Label>
              <Input
                {...register("state", { required: "State is required" })}
                placeholder="Enter state"
              />
              {errors.state && (
                <p className="text-sm text-red-600 mt-1">{errors.state.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="pincode">Pincode</Label>
              <Input
                {...register("pincode", { 
                  required: "Pincode is required",
                  pattern: {
                    value: /^\d{6}$/,
                    message: "Please enter a valid 6-digit pincode"
                  }
                })}
                placeholder="000000"
              />
              {errors.pincode && (
                <p className="text-sm text-red-600 mt-1">{errors.pincode.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="landmark">Landmark (Optional)</Label>
              <Input
                {...register("landmark")}
                placeholder="Enter landmark"
              />
            </div>
          </div>

          <div className="flex space-x-3 pt-4 border-t border-gray-200">
            <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1 bg-purple-600 hover:bg-purple-700">
              {isSubmitting ? "Adding..." : "Add Society"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
