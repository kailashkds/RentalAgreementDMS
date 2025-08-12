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
  Send,
  FileText
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Agreements() {
  const [showWizard, setShowWizard] = useState(false);
  const [editingAgreement, setEditingAgreement] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();

  const { data: agreementsData, isLoading } = useAgreements({
    search: searchTerm,
    status: statusFilter === "all" ? "" : statusFilter,
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

  const handleDownloadWordAgreement = async (agreement: any) => {
    try {
      console.log('Starting Word generation for agreement:', agreement.id);

      const response = await fetch('/api/agreements/generate-word', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ownerDetails: agreement.ownerDetails || {},
          tenantDetails: agreement.tenantDetails || {},
          propertyDetails: agreement.propertyDetails || {},
          rentalTerms: agreement.rentalTerms || {},
          agreementDate: agreement.agreementDate,
          createdAt: agreement.createdAt,
          language: agreement.language || 'english',
          additionalClauses: agreement.additionalClauses || [],
          agreementNumber: agreement.agreementNumber,
          documents: agreement.documents || {},
          ownerDocuments: agreement.ownerDocuments || {},
          tenantDocuments: agreement.tenantDocuments || {},
          propertyDocuments: agreement.propertyDocuments || {}
        }),
      });

      console.log('Word generation response status:', response.status);

      if (response.ok) {
        // Create download link for Word document
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rental_agreement_${agreement.agreementNumber || 'document'}.docx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        toast({
          title: "Word Document Downloaded",
          description: `Agreement ${agreement.agreementNumber} has been downloaded as Word document.`,
        });
      } else {
        const errorData = await response.json();
        console.error('Word generation error:', errorData);
        throw new Error(errorData.message || 'Failed to generate Word document');
      }
    } catch (error) {
      console.error('Word download error:', error);
      toast({
        title: "Error",
        description: "Failed to download Word document.",
        variant: "destructive",
      });
    }
  };

  const handleViewAgreement = (agreementId: string) => {
    const agreement = agreementsData?.agreements.find(a => a.id === agreementId);
    if (agreement) {
      setEditingAgreement(agreement);
    }
  };



  const handleDownloadAgreement = async (agreement: any) => {
    try {
      console.log('Starting PDF generation for agreement:', agreement.id);
      console.log('Agreement data:', {
        hasOwnerDetails: !!agreement.ownerDetails,
        hasTenantDetails: !!agreement.tenantDetails,
        hasPropertyDetails: !!agreement.propertyDetails,
        hasRentalTerms: !!agreement.rentalTerms,
        agreementNumber: agreement.agreementNumber
      });

      const response = await fetch('/api/agreements/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ownerDetails: agreement.ownerDetails || {},
          tenantDetails: agreement.tenantDetails || {},
          propertyDetails: agreement.propertyDetails || {},
          rentalTerms: agreement.rentalTerms || {},
          agreementDate: agreement.agreementDate,
          createdAt: agreement.createdAt,
          language: agreement.language || 'english',
          additionalClauses: agreement.additionalClauses || [],
          agreementNumber: agreement.agreementNumber,
          // Include document data for embedding
          documents: agreement.documents || {},
          ownerDocuments: agreement.ownerDocuments || {},
          tenantDocuments: agreement.tenantDocuments || {},
          propertyDocuments: agreement.propertyDocuments || {}
        }),
      });

      console.log('PDF generation response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('PDF generation successful, received HTML');
        
        // Create a temporary HTML page for printing/PDF generation
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Rental Agreement - ${agreement.agreementNumber || 'Agreement'}</title>
              <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Gujarati:wght@300;400;500;600;700&family=Noto+Sans+Devanagari:wght@300;400;500;600;700&family=Noto+Sans+Tamil:wght@300;400;500;600;700&display=swap" rel="stylesheet">
              <style>
                body { 
                  font-family: ${agreement.language === 'gujarati' 
                    ? '"Noto Sans Gujarati", "Shruti", "Lohit Gujarati", system-ui, Arial, sans-serif' 
                    : agreement.language === 'hindi'
                    ? '"Noto Sans Devanagari", "Mangal", "Lohit Devanagari", system-ui, Arial, sans-serif'
                    : agreement.language === 'tamil'
                    ? '"Noto Sans Tamil", "Latha", "Lohit Tamil", system-ui, Arial, sans-serif'
                    : agreement.language === 'marathi'
                    ? '"Noto Sans Devanagari", "Mangal", "Lohit Devanagari", system-ui, Arial, sans-serif'
                    : 'Arial, sans-serif'}; 
                  margin: 0;
                  padding: 20px;
                  line-height: 1.6;
                  background: white;
                  font-size: 14px;
                  text-rendering: optimizeLegibility;
                  -webkit-font-smoothing: antialiased;
                  -moz-osx-font-smoothing: grayscale;
                  font-feature-settings: "kern" 1, "liga" 1;
                }
                
                .agreement-content {
                  max-width: 800px;
                  margin: 0 auto;
                  padding: 20px;
                  background: white;
                  box-shadow: 0 0 10px rgba(0,0,0,0.1);
                  min-height: 1056px;
                }
                
                /* Enhanced Gujarati font support */
                .gujarati-content, .gujarati-content * {
                  font-family: "Noto Sans Gujarati", "Shruti", "Lohit Gujarati", system-ui, Arial, sans-serif !important;
                }
                
                /* Party details spacing - match PDF */
                .party-details p {
                  margin: 2px 0 !important;
                  line-height: 1.4 !important;
                }
                
                h1, h2, h3 {
                  font-weight: bold !important;
                  margin: 15px 0 10px 0 !important;
                }
                
                p {
                  margin: 8px 0 !important;
                  line-height: 1.6 !important;
                }
                
                /* Passport photo styling - only for screen preview */
                @media screen {
                  div[style*="130px"][style*="160px"]:empty,
                  div[style*="130px"][style*="160px"]:contains("પાસપોર્ટ સાઈઝ ફોટો"),
                  div[style*="130px"][style*="160px"]:contains("Passport Size Photo") {
                    border: 1px dashed #ccc !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    background: #f9f9f9 !important;
                    font-size: 12px !important;
                    text-align: center !important;
                    color: #666 !important;
                  }
                }
                
                /* Remove borders for PDF/print */
                @media print {
                  div[style*="130px"][style*="160px"] {
                    border: none !important;
                    background: transparent !important;
                  }
                }
                
                /* Page break control classes for PDF generation */
                .no-page-break,
                .keep-together,
                .agreement-section,
                .clause-section,
                .signature-section,
                .terms-section {
                  page-break-inside: avoid;
                  break-inside: avoid;
                }
                
                .page-break-before {
                  page-break-before: always;
                  break-before: page;
                }
                
                .page-break-after {
                  page-break-after: always;
                  break-after: page;
                }
                
                @media print {
                  body { margin: 0; }
                  .no-print { display: none; }
                  
                  /* Enforce page break controls for print/PDF */
                  .no-page-break,
                  .keep-together,
                  .agreement-section,
                  .clause-section,
                  .signature-section,
                  .terms-section {
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                  }
                  
                  .page-break-before {
                    page-break-before: always !important;
                    break-before: page !important;
                  }
                  
                  .page-break-after {
                    page-break-after: always !important;
                    break-after: page !important;
                  }
                }
              </style>
            </head>
            <body>
              <div class="no-print" style="margin-bottom: 20px;">
                <button onclick="window.print()">Print / Save as PDF</button>
                <button onclick="window.close()">Close</button>
              </div>
              <div class="agreement-content ${agreement.language === 'gujarati' ? 'gujarati-content' : ''}">
                ${data.html || '<p>No agreement content available</p>'}
              </div>
            </body>
            </html>
          `);
          printWindow.document.close();
        } else {
          throw new Error('Could not open print window - popup blocked?');
        }
        
        toast({
          title: "Agreement ready",
          description: "Agreement opened in new window for download.",
        });
      } else {
        const errorText = await response.text();
        console.error('PDF generation failed:', response.status, errorText);
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Error",
        description: `Failed to generate agreement PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string | undefined) => {
    if (!status) return "bg-gray-100 text-gray-800";
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
                <SelectItem value="all">All Status</SelectItem>
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
                {searchTerm || (statusFilter && statusFilter !== "all") ? (
                  <>
                    No agreements found matching your criteria.
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setSearchTerm("");
                        setStatusFilter("all");
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
                      Customer Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Property Address
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Landlord Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tenant Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Agreement Period
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
                  {agreementsData?.agreements?.map((agreement: any, index: number) => (
                    <tr key={agreement.id || index}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-mono font-medium text-gray-900">
                          {agreement.agreementNumber}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {agreement.customer?.name || "Unknown"}
                        </div>
                        <div className="text-sm text-gray-500">
                          {agreement.customer?.mobile || ""}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {(() => {
                            // Try multiple possible property address sources
                            const propertyAddr = agreement.propertyDetails?.address || agreement.ownerDetails?.address;
                            if (propertyAddr) {
                              return [
                                propertyAddr.flatNo,
                                propertyAddr.society,
                                propertyAddr.area,
                                propertyAddr.city
                              ].filter(Boolean).join(', ');
                            }
                            return 'Property address not available';
                          })()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {agreement.ownerDetails?.name || 'Landlord name not available'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {agreement.tenantDetails?.name || 'Tenant name not available'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {(() => {
                            // Try rental terms or fallback to top-level dates
                            const startDate = agreement.rentalTerms?.startDate || agreement.startDate;
                            const endDate = agreement.rentalTerms?.endDate || agreement.endDate;
                            
                            if (startDate && endDate) {
                              return `${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`;
                            }
                            return 'Period not available';
                          })()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(
                            agreement.status
                          )}`}
                        >
                          {agreement.status ? agreement.status.charAt(0).toUpperCase() + agreement.status.slice(1) : 'Unknown'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-blue-600 hover:text-blue-900"
                            onClick={() => handleViewAgreement(agreement.id)}
                            title="View Agreement"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-green-600 hover:text-green-900"
                            onClick={() => handleDownloadAgreement(agreement)}
                            title="Download PDF"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-blue-600 hover:text-blue-900"
                            onClick={() => handleDownloadWordAgreement(agreement)}
                            title="Download Word Document"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-amber-600 hover:text-amber-900"
                            onClick={() => setEditingAgreement(agreement)}
                            title="Edit Agreement"
                          >
                            <Edit className="h-4 w-4" />
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
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-red-600 hover:text-red-900"
                              onClick={() => handleDeleteAgreement(agreement.id)}
                              title="Delete Agreement"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
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

      {editingAgreement && (
        <AgreementWizard
          isOpen={!!editingAgreement}
          onClose={() => setEditingAgreement(null)}
          editingAgreement={editingAgreement}
        />
      )}
    </AdminLayout>
  );
}
