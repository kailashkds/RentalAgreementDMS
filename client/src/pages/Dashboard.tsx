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
  Trash2,
  Download
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
      title: "Total Documents",
      value: stats?.totalAgreements || 0,
      icon: FileSignature,
      bgColor: "bg-primary/10",
      iconColor: "text-primary",
      description: "All document types"
    },
    {
      title: "Active Documents",
      value: stats?.activeAgreements || 0,
      icon: CheckCircle,
      bgColor: "bg-green-100",
      iconColor: "text-green-600",
      description: "Currently valid"
    },
    {
      title: "Pending Review",
      value: stats?.expiringSoon || 0,
      icon: Clock,
      bgColor: "bg-accent/20",
      iconColor: "text-accent",
      description: "Needs attention"
    },
    {
      title: "Total Clients",
      value: stats?.totalCustomers || 0,
      icon: Users,
      bgColor: "bg-primary/10",
      iconColor: "text-primary",
      description: "Registered users"
    },
  ];

  const getStatusBadge = (status: string | undefined) => {
    if (!status) return "bg-gray-100 text-gray-800";
    
    const statusConfig = {
      active: "bg-green-100 text-green-800",
      expired: "bg-red-100 text-red-800",
      expiring: "bg-accent/20 text-accent",
      draft: "bg-primary/10 text-primary",
      renewed: "bg-purple-100 text-purple-800",
      terminated: "bg-gray-100 text-gray-800",
    };
    
    return statusConfig[status as keyof typeof statusConfig] || "bg-gray-100 text-gray-800";
  };

  return (
    <AdminLayout title="Dashboard" subtitle="Manage rental agreements and documents">
      {/* Dashboard Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statsCards.map((card) => (
          <Card key={card.title} className="border border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className={`p-3 ${card.bgColor} rounded-lg`}>
                  <card.icon className={`${card.iconColor} h-6 w-6`} />
                </div>
                <div className="ml-4 flex-1">
                  <p className="text-sm text-gray-600">{card.title}</p>
                  <p className="text-2xl font-bold text-gray-800">
                    {statsLoading ? "..." : card.value}
                  </p>
                  <p className="text-xs text-gray-500">{card.description}</p>
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
                className="w-full"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create New Document
              </Button>
              <Button
                onClick={() => setShowCustomerModal(true)}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Add Client
              </Button>
              <Button
                onClick={() => setShowSocietyModal(true)}
                variant="outline"
                className="w-full border-primary text-primary hover:bg-primary hover:text-white"
              >
                <Building className="mr-2 h-4 w-4" />
                Add Location
              </Button>
              <Button className="w-full bg-accent hover:bg-accent/90">
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
                <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">
                  View All
                </Button>
              </div>
            </div>
            <div className="p-6">
              {agreementsLoading ? (
                <div className="text-center text-gray-500">Loading agreements...</div>
              ) : recentAgreements?.agreements?.length === 0 ? (
                <div className="text-center text-gray-500">
                  No agreements found. Create your first agreement to get started.
                </div>
              ) : (
                <div className="space-y-3">
                  {recentAgreements?.agreements?.slice(0, 5).map((agreement: any, index: number) => (
                    <div key={agreement.id || index} className="p-4 bg-gray-50 rounded-lg border">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4 flex-1">
                          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                            <FileSignature className="w-5 h-5 text-primary" />
                          </div>
                          <div className="flex-1">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 md:gap-4">
                              <div>
                                <h4 className="font-medium text-gray-900 text-sm">
                                  {agreement.agreementNumber}
                                </h4>
                                <p className="text-xs text-gray-400">Document ID</p>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {agreement.customer?.name || "Unknown"}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {agreement.customer?.mobile || "No phone"}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-900">
                                  {agreement.propertyDetails?.type || "Document"}
                                </p>
                                <p className="text-xs text-gray-400">Type/Details</p>
                              </div>
                              <div>
                                <span
                                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(
                                    agreement.status
                                  )}`}
                                >
                                  {agreement.status ? agreement.status.charAt(0).toUpperCase() + agreement.status.slice(1) : 'Unknown'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 ml-4">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-blue-600 hover:text-blue-900 p-2"
                            title="View Agreement"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-green-600 hover:text-green-900 p-2"
                            title="Download PDF"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-amber-600 hover:text-amber-900 p-2"
                            title="Edit Agreement"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
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
