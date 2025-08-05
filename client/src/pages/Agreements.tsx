import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AgreementWizard from "@/components/AgreementWizard";
import { useAgreements } from "@/hooks/useAgreements";
import {
  Plus,
  Search,
  Eye,
  RotateCcw,
  Copy,
  Edit,
  Trash2,
  Download,
  Send
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Agreements() {
  const [showWizard, setShowWizard] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();

  const { data: agreementsData, isLoading } = useAgreements({
    search: searchTerm,
    status: statusFilter,
    limit: 20,
    offset: (currentPage - 1) * 20,
  });

  const handleRenewAgreement = async (agreementId: string) => {
    try {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 11);

      await apiRequest("POST", `/api/agreements/${agreementId}/renew`, {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      });

      queryClient.invalidateQueries({ queryKey: ["/api/agreements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });

      toast({
        title: "Agreement renewed",
        description: "Agreement has been renewed successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to renew agreement.",
        variant: "destructive",
      });
    }
  };

  const handleDuplicateAgreement = async (agreementId: string) => {
    try {
      await apiRequest("POST", `/api/agreements/${agreementId}/duplicate`);

      queryClient.invalidateQueries({ queryKey: ["/api/agreements"] });

      toast({
        title: "Agreement duplicated",
        description: "Agreement has been duplicated successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to duplicate agreement.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteAgreement = async (agreementId: string) => {
    if (!window.confirm("Are you sure you want to delete this agreement?")) {
      return;
    }

    try {
      await apiRequest("DELETE", `/api/agreements/${agreementId}`);

      queryClient.invalidateQueries({ queryKey: ["/api/agreements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });

      toast({
        title: "Agreement deleted",
        description: "Agreement has been deleted successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete agreement.",
        variant: "destructive",
      });
    }
  };

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
    <AdminLayout title="Agreements" subtitle="Manage rental agreements">
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search agreements..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full sm:w-64"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="renewed">Renewed</SelectItem>
                <SelectItem value="terminated">Terminated</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => setShowWizard(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="mr-2 h-4 w-4" />
            Create Agreement
          </Button>
        </div>

        {/* Agreements Table */}
        <Card className="border border-gray-200">
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="p-6 text-center text-gray-500">Loading agreements...</div>
            ) : agreementsData?.agreements?.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                {searchTerm || statusFilter ? (
                  <>
                    No agreements found matching your criteria.
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setSearchTerm("");
                        setStatusFilter("");
                      }}
                      className="ml-2 text-blue-600 hover:text-blue-700"
                    >
                      Clear filters
                    </Button>
                  </>
                ) : (
                  <>
                    No agreements found. Create your first agreement to get started.
                    <Button
                      onClick={() => setShowWizard(true)}
                      className="ml-2 bg-blue-600 hover:bg-blue-700"
                    >
                      Create Agreement
                    </Button>
                  </>
                )}
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
                      Rent
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Period
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
                  {agreementsData?.agreements?.map((agreement: any) => (
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
                        <div className="text-sm text-gray-500">
                          {agreement.propertyDetails?.place || ""}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          ₹{agreement.rentalTerms?.monthlyRent?.toLocaleString() || "0"}
                        </div>
                        <div className="text-sm text-gray-500">
                          Deposit: ₹{agreement.rentalTerms?.deposit?.toLocaleString() || "0"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(agreement.startDate).toLocaleDateString()} - {new Date(agreement.endDate).toLocaleDateString()}
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
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-green-600 hover:text-green-900"
                              onClick={() => handleRenewAgreement(agreement.id)}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-purple-600 hover:text-purple-900"
                            onClick={() => handleDuplicateAgreement(agreement.id)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          {agreement.status === "draft" && (
                            <>
                              <Button variant="ghost" size="sm" className="text-amber-600 hover:text-amber-900">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-red-600 hover:text-red-900"
                                onClick={() => handleDeleteAgreement(agreement.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {agreement.status === "active" && (
                            <>
                              <Button variant="ghost" size="sm" className="text-indigo-600 hover:text-indigo-900">
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" className="text-green-600 hover:text-green-900">
                                <Send className="h-4 w-4" />
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

        {/* Pagination */}
        {agreementsData && agreementsData.total > 20 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing {((currentPage - 1) * 20) + 1} to {Math.min(currentPage * 20, agreementsData.total)} of{" "}
              {agreementsData.total} results
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                onClick={() => setCurrentPage(page => page + 1)}
                disabled={currentPage * 20 >= agreementsData.total}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      <AgreementWizard
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
      />
    </AdminLayout>
  );
}
