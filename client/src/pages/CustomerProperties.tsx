import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building, MapPin, Plus, Eye, ArrowLeft } from "lucide-react";
import { AddPropertyDialog } from "@/components/AddPropertyDialog";
import { useState } from "react";

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

interface Customer {
  id: string;
  name: string;
  mobile: string;
  email?: string;
  isActive: boolean;
}

export default function CustomerProperties() {
  const { customerId } = useParams();
  const [showAddDialog, setShowAddDialog] = useState(false);

  const { data: customer, isLoading: customerLoading } = useQuery<Customer>({
    queryKey: [`/api/customers/${customerId}`],
    enabled: !!customerId
  });

  const { data: properties, isLoading: propertiesLoading, refetch } = useQuery<Property[]>({
    queryKey: [`/api/properties`, { customerId }],
    enabled: !!customerId
  });

  const handlePropertyAdded = () => {
    refetch();
    setShowAddDialog(false);
  };

  if (customerLoading || propertiesLoading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!customer) {
    return <div className="p-6">Customer not found</div>;
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/customers">
          <Button variant="outline" size="sm" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Customers
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            Properties for {customer.name}
          </h1>
          <p className="text-muted-foreground" data-testid="text-customer-info">
            {customer.mobile} • {customer.email}
          </p>
        </div>
      </div>

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold" data-testid="text-properties-count">
          {properties?.length || 0} Properties
        </h2>
        <Button onClick={() => setShowAddDialog(true)} data-testid="button-add-property">
          <Plus className="h-4 w-4 mr-2" />
          Add Property
        </Button>
      </div>

      {properties && properties.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Building className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Properties Found</h3>
            <p className="text-muted-foreground mb-4">
              This customer doesn't have any properties yet.
            </p>
            <Button onClick={() => setShowAddDialog(true)} data-testid="button-add-first-property">
              <Plus className="h-4 w-4 mr-2" />
              Add First Property
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {properties?.map((property) => (
            <Card key={property.id} className="hover:shadow-md transition-shadow" data-testid={`card-property-${property.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{property.flatNumber}</CardTitle>
                  <Badge variant={property.propertyType === 'commercial' ? 'secondary' : 'default'}>
                    {property.propertyType}
                  </Badge>
                </div>
                {property.building && (
                  <p className="text-sm text-muted-foreground">{property.building}</p>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <span>{property.society}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{property.area}, {property.city}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {property.state} - {property.pincode}
                  </div>
                  {property.purpose && (
                    <div className="text-sm">
                      <strong>Purpose:</strong> {property.purpose}
                    </div>
                  )}
                </div>
                <Link href={`/customers/${customerId}/properties/${property.id}/agreements`}>
                  <Button className="w-full" variant="outline" data-testid={`button-view-agreements-${property.id}`}>
                    <Eye className="h-4 w-4 mr-2" />
                    View Agreements
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddPropertyDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        customerId={customerId!}
        onPropertyAdded={handlePropertyAdded}
      />
    </div>
  );
}