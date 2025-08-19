import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building, MapPin, Eye, Users, FileText } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";

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
}

interface PropertyWithCustomer extends Property {
  customer: Customer;
  agreementCount: number;
}

export default function Properties() {
  const { data: properties, isLoading } = useQuery<PropertyWithCustomer[]>({
    queryKey: ['/api/properties/all'],
  });

  if (isLoading) {
    return (
      <AdminLayout title="Properties" subtitle="Manage all properties">
        <div className="p-6">Loading...</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Properties" subtitle="Manage all properties across customers">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold" data-testid="text-properties-count">
            {properties?.length || 0} Properties
          </h2>
        </div>

        {properties && properties.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Building className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Properties Found</h3>
              <p className="text-muted-foreground mb-4">
                No properties have been created yet. Properties are created through the customer management section.
              </p>
              <Link href="/customers">
                <Button data-testid="button-go-to-customers">
                  <Users className="h-4 w-4 mr-2" />
                  Go to Customers
                </Button>
              </Link>
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
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Address
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Agreements
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
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {property.customer.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {property.customer.mobile}
                          </div>
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
                          {property.agreementCount} agreements
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap space-x-2">
                        <Link href={`/customers/${property.customerId}/properties/${property.id}/agreements`}>
                          <Button size="sm" variant="outline" data-testid={`button-view-agreements-${property.id}`}>
                            <FileText className="h-4 w-4 mr-2" />
                            View Agreements
                          </Button>
                        </Link>
                        <Link href={`/customers/${property.customerId}/properties`}>
                          <Button size="sm" variant="ghost" data-testid={`button-view-customer-${property.customerId}`}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Customer
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
      </div>
    </AdminLayout>
  );
}