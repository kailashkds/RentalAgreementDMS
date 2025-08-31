import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Building, MapPin, Plus, FileSignature } from "lucide-react";
import { Link } from "wouter";

interface Property {
  id: string;
  name: string;
  type: string;
  purpose: string;
  address: string;
  area: string;
  agreementCount: number;
}

export default function MyProperties() {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();

  // Fetch customer's own properties
  const { data: properties, isLoading } = useQuery<Property[]>({
    queryKey: ['/api/properties'],
    enabled: !!user && hasPermission('agreement.view.own'),
  });

  if (!hasPermission('agreement.view.own')) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
          <p className="text-gray-500">You don't have permission to view properties.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="text-my-properties-title">My Properties</h1>
          <p className="text-gray-600">View and manage your properties and agreements</p>
        </div>
      </div>

      {!properties || properties.length === 0 ? (
        <Card className="p-8 text-center">
          <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Properties Found</h3>
          <p className="text-gray-500 mb-4">
            You don't have any properties yet. Contact your administrator to add properties to your account.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map((property) => (
            <Card key={property.id} className="p-6 hover:shadow-lg transition-shadow" data-testid={`card-property-${property.id}`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <Building className="h-5 w-5 text-blue-600 mr-2" />
                  <h3 className="font-semibold text-gray-900" data-testid={`text-property-name-${property.id}`}>
                    {property.name}
                  </h3>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center text-sm text-gray-600">
                  <MapPin className="h-4 w-4 mr-2" />
                  <span className="truncate" data-testid={`text-property-address-${property.id}`}>
                    {property.address}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Type:</span>
                  <span className="font-medium" data-testid={`text-property-type-${property.id}`}>
                    {property.type}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Purpose:</span>
                  <span className="font-medium" data-testid={`text-property-purpose-${property.id}`}>
                    {property.purpose}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Area:</span>
                  <span className="font-medium" data-testid={`text-property-area-${property.id}`}>
                    {property.area}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t">
                <div className="flex items-center text-sm text-gray-600">
                  <FileSignature className="h-4 w-4 mr-1" />
                  <span data-testid={`text-agreements-count-${property.id}`}>
                    {property.agreementCount || 0} agreements
                  </span>
                </div>
                <Link href={`/customers/${(user as any)?.id}/properties/${property.id}`}>
                  <Button variant="outline" size="sm" data-testid={`button-view-agreements-${property.id}`}>
                    View Agreements
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}