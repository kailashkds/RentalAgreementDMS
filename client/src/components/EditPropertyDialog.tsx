import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

const propertySchema = z.object({
  flatNumber: z.string().min(1, "Flat/House number is required"),
  building: z.string().optional(),
  society: z.string().min(1, "Society/Building name is required"),
  area: z.string().min(1, "Area is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  pincode: z.string().min(1, "Pincode is required"),
  district: z.string().optional(),
  landmark: z.string().optional(),
  propertyType: z.enum(["residential", "commercial"]),
  purpose: z.string().optional(),
});

type PropertyFormData = z.infer<typeof propertySchema>;

interface Property {
  id: string;
  customerId: string;
  flatNumber: string;
  building?: string;
  society: string;
  area: string;
  city: string;
  state: string;
  pincode: string;
  district?: string;
  landmark?: string;
  propertyType: string;
  purpose?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface EditPropertyDialogProps {
  open: boolean;
  onClose: () => void;
  property: Property | null;
  onPropertyUpdated: () => void;
}

export function EditPropertyDialog({ open, onClose, property, onPropertyUpdated }: EditPropertyDialogProps) {
  const { toast } = useToast();
  const [buildingFilter, setBuildingFilter] = useState("");

  const { data: societies = [] } = useQuery<any[]>({
    queryKey: ['/api/societies'],
    enabled: open
  });

  // Get unique buildings/societies for autocomplete
  const buildingOptions = societies
    .map(s => s.societyName)
    .filter(name => name && buildingFilter ? name.toLowerCase().includes(buildingFilter.toLowerCase()) : name)
    .slice(0, 10); // Limit to 10 suggestions

  const form = useForm<PropertyFormData>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      flatNumber: "",
      building: "",
      society: "",
      area: "",
      city: "",
      state: "",
      pincode: "",
      district: "",
      landmark: "",
      propertyType: "residential",
      purpose: "",
    },
  });

  // Update form when property changes
  useEffect(() => {
    if (property && open) {
      form.reset({
        flatNumber: property.flatNumber || "",
        building: property.building || "",
        society: property.society || "",
        area: property.area || "",
        city: property.city || "",
        state: property.state || "",
        pincode: property.pincode || "",
        district: property.district || "",
        landmark: property.landmark || "",
        propertyType: (property.propertyType as "residential" | "commercial") || "residential",
        purpose: property.purpose || "",
      });
    }
  }, [property, open, form]);

  const updatePropertyMutation = useMutation({
    mutationFn: (data: PropertyFormData) => 
      apiRequest('PUT', `/api/properties/${property?.id}`, data),
    onSuccess: () => {
      toast({ 
        title: "Success", 
        description: "Property updated successfully" 
      });
      queryClient.invalidateQueries({ queryKey: ['/api/properties/all'] });
      queryClient.invalidateQueries({ queryKey: [`/api/properties?customerId=${property?.customerId}`] });
      onPropertyUpdated();
      onClose();
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to update property",
        variant: "destructive"
      });
    }
  });

  const handleBuildingSelect = (selectedBuilding: string) => {
    const society = societies.find(s => s.societyName === selectedBuilding);
    if (society) {
      form.setValue('society', society.societyName);
      form.setValue('area', society.area || '');
      form.setValue('city', society.city || '');
      form.setValue('state', society.state || '');
      form.setValue('pincode', society.pincode || '');
      form.setValue('district', society.district || '');
      form.setValue('landmark', society.landmark || '');
    } else {
      // If no matching society found, just set the building name
      form.setValue('society', selectedBuilding);
    }
    setBuildingFilter("");
  };

  const onSubmit = (data: PropertyFormData) => {
    updatePropertyMutation.mutate(data);
  };

  if (!property) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Property</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="flatNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Flat/House Number *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., A-101, 123" data-testid="input-flat-number" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="building"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Building/Wing</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., A Block, Tower 1" data-testid="input-building" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">Address Details</h3>
              
              <FormField
                control={form.control}
                name="society"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Society/Building Name *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input 
                          {...field}
                          onChange={(e) => {
                            field.onChange(e);
                            setBuildingFilter(e.target.value);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              setBuildingFilter("");
                            }
                          }}
                          placeholder="Start typing to search societies..."
                          data-testid="input-society" 
                        />
                        {buildingFilter && buildingOptions.length > 0 && (
                          <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                            {buildingOptions.map((option, index) => (
                              <div
                                key={index}
                                className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm border-b border-gray-100 last:border-b-0"
                                onClick={() => handleBuildingSelect(option)}
                              >
                                {option}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="area"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Area/Locality *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Andheri West" data-testid="input-area" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Mumbai" data-testid="input-city" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Maharashtra" data-testid="input-state" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="pincode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pincode *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., 400058" maxLength={10} data-testid="input-pincode" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="district"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>District</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Mumbai Suburban" data-testid="input-district" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="landmark"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Landmark</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Near Metro Station" data-testid="input-landmark" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">Property Details</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="propertyType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Property Type *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-property-type">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="residential">Residential</SelectItem>
                          <SelectItem value="commercial">Commercial</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="purpose"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purpose</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Family, Business" data-testid="input-purpose" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={updatePropertyMutation.isPending}
                data-testid="button-update-property"
              >
                {updatePropertyMutation.isPending ? "Updating..." : "Update Property"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}