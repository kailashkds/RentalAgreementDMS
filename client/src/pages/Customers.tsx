import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import CustomerModal from "@/components/CustomerModal";
import CustomerEditModal from "@/components/CustomerEditModal";
import CustomerAgreementsModal from "@/components/CustomerAgreementsModal";
import PasswordManagementModal from "@/components/PasswordManagementModal";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCustomers } from "@/hooks/useCustomers";
import {
  Plus,
  Search,
  Eye,
  Edit,
  Trash2,
  Phone,
  Mail,
  FileSignature,
  RotateCcw,
  Power,
  PowerOff,
  AlertTriangle,
  Key
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Customers() {
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAgreementsModal, setShowAgreementsModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();

  const { data: customersData, isLoading } = useCustomers({
    search: searchTerm,
    limit: 20,
    offset: (currentPage - 1) * 20,
  });

  const handleDeleteCustomer = async (customer: any) => {
    if (customer.agreementCount > 0) {
      toast({
        title: "Cannot delete customer",
        description: "Customer has existing agreements and cannot be deleted.",
        variant: "destructive",
      });
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${customer.name}? This action cannot be undone.`)) {
      return;
    }

    try {
      await apiRequest("DELETE", `/api/customers/${customer.id}`);

      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });

      toast({
        title: "Customer deleted",
        description: "Customer has been deleted successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to delete customer.",
        variant: "destructive",
      });
    }
  };

  const handleEditCustomer = (customer: any) => {
    setSelectedCustomer(customer);
    setShowEditModal(true);
  };

  const handleViewAgreements = (customer: any) => {
    setSelectedCustomer(customer);
    setShowAgreementsModal(true);
  };

  const handlePasswordManagement = (customer: any) => {
    setSelectedCustomer(customer);
    setShowPasswordModal(true);
  };

  const handleToggleStatus = async (customer: any) => {
    try {
      const newStatus = !customer.isActive;
      await apiRequest("PATCH", `/api/customers/${customer.id}/toggle-status`, {
        isActive: newStatus
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      
      toast({
        title: `Customer ${newStatus ? "activated" : "deactivated"}`,
        description: `${customer.name} has been ${newStatus ? "activated" : "deactivated"} successfully.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update customer status.",
        variant: "destructive",
      });
    }
  };

  return (
    <AdminLayout title="Customers" subtitle="Manage customer information">
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full sm:w-64"
            />
          </div>
          <Button onClick={() => setShowModal(true)} className="bg-green-600 hover:bg-green-700">
            <Plus className="mr-2 h-4 w-4" />
            Add Customer
          </Button>
        </div>

        {/* Customers Table */}
        <Card className="border border-gray-200">
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="p-6 text-center text-gray-500">Loading customers...</div>
            ) : customersData?.customers?.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                {searchTerm ? (
                  <>
                    No customers found matching your search.
                    <Button
                      variant="ghost"
                      onClick={() => setSearchTerm("")}
                      className="ml-2 text-blue-600 hover:text-blue-700"
                    >
                      Clear search
                    </Button>
                  </>
                ) : (
                  <>
                    No customers found. Add your first customer to get started.
                    <Button
                      onClick={() => setShowModal(true)}
                      className="ml-2 bg-green-600 hover:bg-green-700"
                    >
                      Add Customer
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Agreements
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {customersData?.customers?.map((customer: any) => (
                    <tr key={customer.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                            <span className="text-white text-sm font-medium">
                              {customer.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {customer.name}
                            </div>
                            <div className="text-sm text-gray-500">
                              ID: {customer.id.slice(-8)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <div className="flex items-center text-sm text-gray-900">
                            <Phone className="h-4 w-4 mr-2 text-gray-400" />
                            {customer.mobile}
                          </div>
                          {customer.email && (
                            <div className="flex items-center text-sm text-gray-500">
                              <Mail className="h-4 w-4 mr-2 text-gray-400" />
                              {customer.email}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Button
                          variant="ghost"
                          className="flex items-center text-sm text-gray-900 hover:text-blue-600 p-0 h-auto"
                          onClick={() => handleViewAgreements(customer)}
                          data-testid={`button-view-agreements-${customer.id}`}
                        >
                          <FileSignature className="h-4 w-4 mr-2 text-gray-400" />
                          {customer.agreementCount || 0} agreements
                        </Button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            customer.isActive
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {customer.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(customer.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <TooltipProvider>
                          <div className="flex space-x-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="text-amber-600 hover:text-amber-900"
                                  onClick={() => handleEditCustomer(customer)}
                                  data-testid={`button-edit-customer-${customer.id}`}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Edit Customer</p>
                              </TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="text-blue-600 hover:text-blue-900"
                                  onClick={() => handlePasswordManagement(customer)}
                                  data-testid={`button-password-${customer.id}`}
                                >
                                  <Key className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Password Management</p>
                              </TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className={customer.isActive ? "text-orange-600 hover:text-orange-900" : "text-green-600 hover:text-green-900"}
                                  onClick={() => handleToggleStatus(customer)}
                                  data-testid={`button-toggle-status-${customer.id}`}
                                >
                                  {customer.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{customer.isActive ? "Deactivate Customer" : "Activate Customer"}</p>
                              </TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className={`${customer.agreementCount > 0 ? 'text-gray-400 cursor-not-allowed' : 'text-red-600 hover:text-red-900'}`}
                                  onClick={() => handleDeleteCustomer(customer)}
                                  disabled={customer.agreementCount > 0}
                                  data-testid={`button-delete-customer-${customer.id}`}
                                >
                                  {customer.agreementCount > 0 ? <AlertTriangle className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{customer.agreementCount > 0 ? "Cannot delete: Has agreements" : "Delete Customer"}</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TooltipProvider>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        {/* Pagination */}
        {customersData && customersData.total > 20 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing {((currentPage - 1) * 20) + 1} to {Math.min(currentPage * 20, customersData.total)} of{" "}
              {customersData.total} results
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
                disabled={currentPage * 20 >= customersData.total}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      <CustomerModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
      
      <CustomerEditModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedCustomer(null);
        }}
        customer={selectedCustomer}
      />
      
      <CustomerAgreementsModal
        isOpen={showAgreementsModal}
        onClose={() => {
          setShowAgreementsModal(false);
          setSelectedCustomer(null);
        }}
        customer={selectedCustomer}
      />

      <PasswordManagementModal
        isOpen={showPasswordModal}
        onClose={() => {
          setShowPasswordModal(false);
          setSelectedCustomer(null);
        }}
        customer={selectedCustomer}
        onPasswordReset={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
          setShowPasswordModal(false);
          setSelectedCustomer(null);
        }}
      />
    </AdminLayout>
  );
}
