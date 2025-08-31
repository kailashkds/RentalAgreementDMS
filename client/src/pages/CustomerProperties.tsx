import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building, MapPin, Plus, Eye, ArrowLeft, Shield } from "lucide-react";
import { AddPropertyDialog } from "@/components/AddPropertyDialog";
import { useState } from "react";
import { usePermissions } from "@/hooks/usePermissions";

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
  const { hasPermission } = usePermissions();
  
  // Check if user can view properties - customers can view their own properties, admins can view all
  const canViewProperties = hasPermission('customer.manage') || hasPermission('system.admin') || hasPermission('customer.view.all') || hasPermission('agreement.view.own');

  const { data: customer, isLoading: customerLoading } = useQuery<Customer>({
    queryKey: [`/api/customers/${customerId}`],
    enabled: !!customerId
  });

  const { data: properties, isLoading: propertiesLoading, refetch } = useQuery<Property[]>({
    queryKey: [`/api/properties?customerId=${customerId}`],
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

  if (!canViewProperties) {
    return (
      <div className="container mx-auto px-4 py-6">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <Shield className="h-12 w-12 text-red-500" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Access Denied</h3>
                <p className="text-sm text-gray-500 mt-2">
                  You don't have permission to view customer properties.
                </p>
              </div>
              <Link href="/customers">
                <Button variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Customers
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
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
        <Card>
          <CardContent className="p-0">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Property
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Address
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Purpose
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {properties?.map((property) => (
                  <tr key={property.id} data-testid={`row-property-${property.id}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {property.flatNumber}
                        </div>
                        {property.building && (
                          <div className="text-sm text-gray-500">
                            {property.building}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {property.society}
                      </div>
                      <div className="text-sm text-gray-500">
                        {property.area}, {property.city}, {property.state} - {property.pincode}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant={property.propertyType === 'commercial' ? 'secondary' : 'default'}>
                        {property.propertyType}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {property.purpose || 'Not specified'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link href={`/customers/${customerId}/properties/${property.id}/agreements`}>
                        <Button size="sm" variant="outline" data-testid={`button-view-agreements-${property.id}`}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Agreements
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {customerId && (
        <AddPropertyDialog
          open={showAddDialog}
          onClose={() => setShowAddDialog(false)}
          customerId={customerId}
          onPropertyAdded={handlePropertyAdded}
        />
      )}
    </div>
  );
}