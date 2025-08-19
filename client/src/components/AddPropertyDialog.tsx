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

interface Society {
  id: string;
  societyName: string;
  area: string;
  city: string;
  state: string;
  district?: string;
  pincode: string;
  landmark?: string;
}

const propertySchema = z.object({
  customerId: z.string(),
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

interface AddPropertyDialogProps {
  open: boolean;
  onClose: () => void;
  customerId: string;
  onPropertyAdded: () => void;
}

export function AddPropertyDialog({ open, onClose, customerId, onPropertyAdded }: AddPropertyDialogProps) {
  const { toast } = useToast();
  const [selectedSociety, setSelectedSociety] = useState<Society | null>(null);

  const { data: societies = [] } = useQuery<Society[]>({
    queryKey: ['/api/societies'],
    enabled: open
  });

  const form = useForm<PropertyFormData>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      customerId,
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

  const createPropertyMutation = useMutation({
    mutationFn: (data: PropertyFormData) => 
      apiRequest('/api/properties', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast({ 
        title: "Success", 
        description: "Property added successfully" 
      });
      queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
      onPropertyAdded();
      form.reset();
      setSelectedSociety(null);
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to add property",
        variant: "destructive"
      });
    }
  });

  const handleSocietySelect = (societyId: string) => {
    const society = societies.find(s => s.id === societyId);
    if (society) {
      setSelectedSociety(society);
      form.setValue('society', society.societyName);
      form.setValue('area', society.area);
      form.setValue('city', society.city);
      form.setValue('state', society.state);
      form.setValue('pincode', society.pincode);
      form.setValue('district', society.district || '');
      form.setValue('landmark', society.landmark || '');
    }
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
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="flatNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Flat/House Number *</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-flat-number" />
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
                      <Input {...field} data-testid="input-building" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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

            <FormField
              control={form.control}
              name="purpose"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Purpose</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., Family, Office, Shop" data-testid="input-purpose" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <h3 className="text-lg font-medium">Address Details</h3>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Select from existing societies</label>
                <Select onValueChange={handleSocietySelect}>
                  <SelectTrigger data-testid="select-society">
                    <SelectValue placeholder="Choose a society or enter manually" />
                  </SelectTrigger>
                  <SelectContent>
                    {societies.map((society) => (
                      <SelectItem key={society.id} value={society.id}>
                        {society.societyName}, {society.area}, {society.city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="society"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Society/Building Name *</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-society" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
              </div>

              <div className="grid grid-cols-3 gap-4">
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

                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State *</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-state" />
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
                        <Input {...field} data-testid="input-pincode" />
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
                        <Input {...field} data-testid="input-district" />
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
                        <Input {...field} data-testid="input-landmark" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

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