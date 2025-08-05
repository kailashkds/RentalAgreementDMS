import { useQuery } from "@tanstack/react-query";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import AgreementWizard from "@/components/AgreementWizard";
import CustomerModal from "@/components/CustomerModal";
import SocietyModal from "@/components/SocietyModal";
import { useState } from "react";
import {
  FileSignature,
  CheckCircle,
  Clock,
  Users,
  Plus,
  UserPlus,
  Building,
  Upload,
  Eye,
  RotateCcw,
  Copy,
  Edit,
  Trash2
} from "lucide-react";
import { useAgreements } from "@/hooks/useAgreements";

interface DashboardStats {
  totalAgreements: number;
  activeAgreements: number;
  expiringSoon: number;
  totalCustomers: number;
}

export default function Dashboard() {
  const [showAgreementWizard, setShowAgreementWizard] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showSocietyModal, setShowSocietyModal] = useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: recentAgreements, isLoading: agreementsLoading } = useAgreements({
    limit: 5,
  });

  const statsCards = [
    {
      title: "Total Agreements",
      value: stats?.totalAgreements || 0,
      icon: FileSignature,
      bgColor: "bg-blue-100",
      iconColor: "text-blue-600",
    },
    {
      title: "Active Agreements",
      value: stats?.activeAgreements || 0,
      icon: CheckCircle,
      bgColor: "bg-green-100",
      iconColor: "text-green-600",
    },
    {
      title: "Expiring Soon",
      value: stats?.expiringSoon || 0,
      icon: Clock,
      bgColor: "bg-amber-100",
      iconColor: "text-amber-600",
    },
    {
      title: "Total Customers",
      value: stats?.totalCustomers || 0,
      icon: Users,
      bgColor: "bg-purple-100",
      iconColor: "text-purple-600",
    },
  ];

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: "bg-green-100 text-green-800",
      expired: "bg-red-100 text-red-800",
      expiring: "bg-amber-100 text-amber-800",
      draft: "bg-blue-100 text-blue-800",
      renewed: "bg-purple-100 text-purple-800",
      terminated: "bg-gray-100 text-gray-800",
    };
    
    return statusConfig[status as keyof typeof statusConfig] || "bg-gray-100 text-gray-800";
  };

  return (
    <AdminLayout title="Dashboard" subtitle="Manage rental agreements and documents">
      {/* Dashboard Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {statsCards.map((card) => (
          <Card key={card.title} className="border border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className={`p-3 ${card.bgColor} rounded-lg`}>
                  <card.icon className={`${card.iconColor} h-6 w-6`} />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-600">{card.title}</p>
                  <p className="text-2xl font-bold text-gray-800">
                    {statsLoading ? "..." : card.value}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions & Recent Agreements */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="lg:col-span-1">
          <Card className="border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">Quick Actions</h3>
            </div>
            <div className="p-6 space-y-4">
              <Button
                onClick={() => setShowAgreementWizard(true)}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create New Agreement
              </Button>
              <Button
                onClick={() => setShowCustomerModal(true)}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Add Customer
              </Button>
              <Button
                onClick={() => setShowSocietyModal(true)}
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                <Building className="mr-2 h-4 w-4" />
                Add Society
              </Button>
              <Button className="w-full bg-amber-600 hover:bg-amber-700">
                <Upload className="mr-2 h-4 w-4" />
                Bulk Import
              </Button>
            </div>
          </Card>
        </div>

        {/* Recent Agreements */}
        <div className="lg:col-span-2">
          <Card className="border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-800">Recent Agreements</h3>
                <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700">
                  View All
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              {agreementsLoading ? (
                <div className="p-6 text-center text-gray-500">Loading agreements...</div>
              ) : recentAgreements?.agreements?.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  No agreements found. Create your first agreement to get started.
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Agreement ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Property
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {recentAgreements?.agreements?.map((agreement: any) => (
                      <tr key={agreement.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-mono font-medium text-gray-900">
                            {agreement.agreementNumber}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {agreement.customer?.name || "Unknown"}
                            </div>
                            <div className="text-sm text-gray-500">
                              {agreement.customer?.mobile || ""}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {agreement.propertyDetails?.type || "Property"}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(
                              agreement.status
                            )}`}
                          >
                            {agreement.status.charAt(0).toUpperCase() + agreement.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-900">
                              <Eye className="h-4 w-4" />
                            </Button>
                            {agreement.status === "active" && (
                              <Button variant="ghost" size="sm" className="text-green-600 hover:text-green-900">
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" className="text-purple-600 hover:text-purple-900">
                              <Copy className="h-4 w-4" />
                            </Button>
                            {agreement.status === "draft" && (
                              <>
                                <Button variant="ghost" size="sm" className="text-amber-600 hover:text-amber-900">
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-900">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Modals */}
      <AgreementWizard
        isOpen={showAgreementWizard}
        onClose={() => setShowAgreementWizard(false)}
      />
      <CustomerModal
        isOpen={showCustomerModal}
        onClose={() => setShowCustomerModal(false)}
      />
      <SocietyModal
        isOpen={showSocietyModal}
        onClose={() => setShowSocietyModal(false)}
      />
    </AdminLayout>
  );
}
