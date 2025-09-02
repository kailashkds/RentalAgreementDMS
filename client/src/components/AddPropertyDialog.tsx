import { useState } from "react";
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
  customerId: z.string().min(1, "Customer is required"),
  flatNumber: z.string().min(1, "Flat/House number is required"),
  society: z.string().min(1, "Society/Building name is required"),
  area: z.string().min(1, "Area is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  pincode: z.string().min(1, "Pincode is required"),
  propertyType: z.enum(["residential", "commercial"]),
});

type PropertyFormData = z.infer<typeof propertySchema>;

interface AddPropertyDialogProps {
  open: boolean;
  onClose: () => void;
  customerId?: string; // Optional for cases where customer needs to be selected
  onPropertyAdded: () => void;
}

export function AddPropertyDialog({ open, onClose, customerId, onPropertyAdded }: AddPropertyDialogProps) {
  const { toast } = useToast();
  const [buildingFilter, setBuildingFilter] = useState("");

  const { data: societies = [] } = useQuery<any[]>({
    queryKey: ['/api/societies'],
    enabled: open
  });

  // Fetch customers when no customerId is provided (for general property creation)
  const { data: customersData } = useQuery<{ customers: any[] }>({
    queryKey: ['/api/customers'],
    enabled: open && !customerId
  });
  
  const customers = customersData?.customers || [];

  // Get unique buildings/societies for autocomplete
  const buildingOptions = societies
    .map(s => s.societyName)
    .filter(name => name && buildingFilter ? name.toLowerCase().includes(buildingFilter.toLowerCase()) : name)
    .slice(0, 10); // Limit to 10 suggestions

  const form = useForm<PropertyFormData>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      customerId: customerId || "",
      flatNumber: "",
      society: "",
      area: "",
      city: "",
      state: "",
      pincode: "",
      propertyType: "residential",
    },
  });

  const createPropertyMutation = useMutation({
    mutationFn: (data: PropertyFormData) => 
      apiRequest('POST', '/api/properties', data),
    onSuccess: () => {
      toast({ 
        title: "Success", 
        description: "Property added successfully" 
      });
      // Invalidate both specific customer properties and all properties
      if (customerId) {
        queryClient.invalidateQueries({ queryKey: [`/api/properties?customerId=${customerId}`] });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/properties/all'] });
      onPropertyAdded();
      form.reset();
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to add property",
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
    } else {
      // If no matching society found, just set the building name
      form.setValue('society', selectedBuilding);
    }
    setBuildingFilter("");
  };

  const onSubmit = (data: PropertyFormData) => {
    createPropertyMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Property</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {!customerId && (
              <FormField
                control={form.control}
                name="customerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-customer">
                          <SelectValue placeholder="Select a customer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {customers.map((customer: any) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.name} - {customer.mobile}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
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
                      <FormLabel>Area *</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-area" />
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
                        <Input {...field} data-testid="input-city" />
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
            </div>

            <FormField
              control={form.control}
              name="propertyType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Property Type *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-property-type">
                        <SelectValue placeholder="Select property type" />
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

            <div className="flex justify-end gap-2 pt-4">
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
                disabled={createPropertyMutation.isPending}
                data-testid="button-add-property"
              >
                {createPropertyMutation.isPending ? "Adding..." : "Add Property"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}