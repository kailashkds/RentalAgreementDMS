import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  FileText,
  X,
  Upload,
  File,
  CheckCircle
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Agreements() {
  const [showWizard, setShowWizard] = useState(false);
  const [editingAgreement, setEditingAgreement] = useState<any>(null);
  const [viewingAgreement, setViewingAgreement] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [uploadingNotarized, setUploadingNotarized] = useState(false);
  const [notarizedFileInput, setNotarizedFileInput] = useState<HTMLInputElement | null>(null);
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
      setViewingAgreement(agreement);
    }
  };

  const handleUploadNotarizedDocument = async (agreementId: string, file: File) => {
    setUploadingNotarized(true);
    try {
      const formData = new FormData();
      formData.append('notarizedDocument', file);

      const response = await fetch(`/api/agreements/${agreementId}/upload-notarized`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        
        // Update the viewing agreement with the new notarized document data
        if (viewingAgreement && viewingAgreement.id === agreementId) {
          setViewingAgreement({
            ...viewingAgreement,
            notarizedDocument: {
              filename: result.filename,
              originalName: result.originalName,
              uploadDate: result.uploadDate,
              size: result.size,
              url: result.url
            }
          });
        }

        // Invalidate cache to refresh data
        queryClient.invalidateQueries({ queryKey: ["/api/agreements"] });

        toast({
          title: "Notarized Document Uploaded",
          description: `Successfully uploaded ${result.originalName}`,
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload notarized document');
      }
    } catch (error) {
      console.error('Notarized upload error:', error);
      toast({
        title: "Upload Error",
        description: error instanceof Error ? error.message : "Failed to upload notarized document.",
        variant: "destructive",
      });
    } finally {
      setUploadingNotarized(false);
    }
  };

  const handleNotarizedFileSelect = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file && viewingAgreement) {
        if (file.type !== 'application/pdf') {
          toast({
            title: "Invalid File Type",
            description: "Please select a PDF file for notarized document.",
            variant: "destructive",
          });
          return;
        }
        handleUploadNotarizedDocument(viewingAgreement.id, file);
      }
    };
    input.click();
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
                @page {
                  margin: 15mm 10mm 20mm 10mm;
                  @bottom-center { content: none; }
                  @bottom-left { content: none; }
                  @bottom-right { 
                    content: "Page " counter(page) " of " counter(pages);
                    font-size: 10px;
                    color: #666;
                    font-family: ${agreement.language === 'gujarati' 
                      ? '"Noto Sans Gujarati", "Shruti", "Lohit Gujarati", system-ui, Arial, sans-serif'
                      : agreement.language === 'hindi'
                      ? '"Noto Sans Devanagari", "Mangal", "Lohit Devanagari", system-ui, Arial, sans-serif'
                      : agreement.language === 'tamil'
                      ? '"Noto Sans Tamil", "Latha", "Lohit Tamil", system-ui, Arial, sans-serif'
                      : agreement.language === 'marathi'
                      ? '"Noto Sans Devanagari", "Mangal", "Lohit Devanagari", system-ui, Arial, sans-serif'
                      : 'Arial, sans-serif'};
                  }
                  @top-center { content: none; }
                  @top-left { content: none; }
                  @top-right { content: none; }
                }
                
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
                  min-height: 1056px;
                }
                
                /* Enhanced font support for all languages */
                .gujarati-content, .gujarati-content * {
                  font-family: "Noto Sans Gujarati", "Shruti", "Lohit Gujarati", system-ui, Arial, sans-serif !important;
                }
                
                /* Enhanced English font support and styling */
                .english-content, .english-content * {
                  font-family: Arial, sans-serif !important;
                  font-size: 14px !important;
                }
                
                /* Consistent spacing for all languages */
                .party-details p {
                  margin: 3px 0 !important;
                  line-height: 1.5 !important;
                }
                
                /* Title styling */
                h1, h2, h3 {
                  font-weight: bold !important;
                  margin: 20px 0 15px 0 !important;
                  text-align: center !important;
                }
                
                h1 {
                  font-size: 18px !important;
                  margin-bottom: 25px !important;
                }
                
                /* Paragraph styling with consistent spacing */
                p {
                  margin: 10px 0 !important;
                  line-height: 1.6 !important;
                  text-align: justify !important;
                  text-indent: 0 !important;
                  padding: 0 !important;
                }
                
                /* List styling */
                ol, ul {
                  margin: 10px 0 !important;
                  padding-left: 30px !important;
                }
                
                li {
                  margin: 5px 0 !important;
                  line-height: 1.6 !important;
                }
                
                /* Strong text styling */
                strong, b {
                  font-weight: bold !important;
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
              <div class="agreement-content ${agreement.language === 'gujarati' ? 'gujarati-content' : 'english-content'}">
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

      {/* Read-only Agreement Viewer */}
      <Dialog open={!!viewingAgreement} onOpenChange={() => setViewingAgreement(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Agreement Details</h2>
                  <p className="text-sm text-gray-500">Agreement #{viewingAgreement?.agreementNumber}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewingAgreement(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          
          {viewingAgreement && (
            <div className="space-y-6 pt-6">
              {/* Owner Details */}
              <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                <div className="bg-gradient-to-r from-slate-600 to-slate-700 px-6 py-4">
                  <h3 className="text-lg font-semibold text-white flex items-center">
                    <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center mr-3">
                      <span className="text-xs font-bold text-white">1</span>
                    </div>
                    Owner Details
                  </h3>
                </div>
                <div className="bg-slate-50 p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div>
                      <label className="text-sm font-medium text-slate-700">Full Name</label>
                      <p className="mt-1 text-sm text-gray-900 font-medium">{viewingAgreement.ownerDetails?.name || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Age</label>
                      <p className="mt-1 text-sm text-gray-900">{viewingAgreement.ownerDetails?.age || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Gender</label>
                      <p className="mt-1 text-sm text-gray-900">{viewingAgreement.ownerDetails?.gender || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Mobile Number</label>
                      <p className="mt-1 text-sm text-gray-900">{viewingAgreement.ownerDetails?.mobile || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Email Address</label>
                      <p className="mt-1 text-sm text-gray-900">{viewingAgreement.ownerDetails?.email || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Occupation</label>
                      <p className="mt-1 text-sm text-gray-900">{viewingAgreement.ownerDetails?.occupation || 'Not provided'}</p>
                    </div>
                    <div className="col-span-full">
                      <label className="text-sm font-medium text-slate-700">Address</label>
                      <p className="mt-1 text-sm text-gray-900">
                        {viewingAgreement.ownerDetails?.address ? 
                          `${viewingAgreement.ownerDetails.address.flatNo || ''}, ${viewingAgreement.ownerDetails.address.society || ''}, ${viewingAgreement.ownerDetails.address.area || ''}, ${viewingAgreement.ownerDetails.address.city || ''}, ${viewingAgreement.ownerDetails.address.state || ''} - ${viewingAgreement.ownerDetails.address.pincode || ''}` 
                          : 'Not provided'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Aadhar Number</label>
                      <p className="mt-1 text-sm text-gray-900">{viewingAgreement.ownerDetails?.aadhar || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">PAN Number</label>
                      <p className="mt-1 text-sm text-gray-900">{viewingAgreement.ownerDetails?.pan || 'Not provided'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tenant Details */}
              <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                <div className="bg-gradient-to-r from-slate-600 to-slate-700 px-6 py-4">
                  <h3 className="text-lg font-semibold text-white flex items-center">
                    <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center mr-3">
                      <span className="text-xs font-bold text-white">2</span>
                    </div>
                    Tenant Details
                  </h3>
                </div>
                <div className="bg-slate-50 p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div>
                      <label className="text-sm font-medium text-slate-700">Full Name</label>
                      <p className="mt-1 text-sm text-gray-900 font-medium">{viewingAgreement.tenantDetails?.name || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Age</label>
                      <p className="mt-1 text-sm text-gray-900">{viewingAgreement.tenantDetails?.age || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Gender</label>
                      <p className="mt-1 text-sm text-gray-900">{viewingAgreement.tenantDetails?.gender || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Mobile Number</label>
                      <p className="mt-1 text-sm text-gray-900">{viewingAgreement.tenantDetails?.mobile || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Email Address</label>
                      <p className="mt-1 text-sm text-gray-900">{viewingAgreement.tenantDetails?.email || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Occupation</label>
                      <p className="mt-1 text-sm text-gray-900">{viewingAgreement.tenantDetails?.occupation || 'Not provided'}</p>
                    </div>
                    <div className="col-span-full">
                      <label className="text-sm font-medium text-slate-700">Address</label>
                      <p className="mt-1 text-sm text-gray-900">
                        {viewingAgreement.tenantDetails?.address ? 
                          `${viewingAgreement.tenantDetails.address.flatNo || ''}, ${viewingAgreement.tenantDetails.address.society || ''}, ${viewingAgreement.tenantDetails.address.area || ''}, ${viewingAgreement.tenantDetails.address.city || ''}, ${viewingAgreement.tenantDetails.address.state || ''} - ${viewingAgreement.tenantDetails.address.pincode || ''}` 
                          : 'Not provided'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Aadhar Number</label>
                      <p className="mt-1 text-sm text-gray-900">{viewingAgreement.tenantDetails?.aadhar || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">PAN Number</label>
                      <p className="mt-1 text-sm text-gray-900">{viewingAgreement.tenantDetails?.pan || 'Not provided'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Property Details */}
              <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                <div className="bg-gradient-to-r from-slate-600 to-slate-700 px-6 py-4">
                  <h3 className="text-lg font-semibold text-white flex items-center">
                    <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center mr-3">
                      <span className="text-xs font-bold text-white">3</span>
                    </div>
                    Property Details
                  </h3>
                </div>
                <div className="bg-slate-50 p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div>
                      <label className="text-sm font-medium text-slate-700">Property Type</label>
                      <p className="mt-1 text-sm text-gray-900 font-medium">{viewingAgreement.propertyDetails?.type || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Area (sq ft)</label>
                      <p className="mt-1 text-sm text-gray-900">{viewingAgreement.propertyDetails?.areaSqft || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Purpose</label>
                      <p className="mt-1 text-sm text-gray-900">{viewingAgreement.propertyDetails?.purpose || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Furnishing</label>
                      <p className="mt-1 text-sm text-gray-900">{viewingAgreement.propertyDetails?.furnishing || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Floor</label>
                      <p className="mt-1 text-sm text-gray-900">{viewingAgreement.propertyDetails?.floor || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Total Floors</label>
                      <p className="mt-1 text-sm text-gray-900">{viewingAgreement.propertyDetails?.totalFloors || 'Not provided'}</p>
                    </div>
                    <div className="col-span-full">
                      <label className="text-sm font-medium text-slate-700">Property Address</label>
                      <p className="mt-1 text-sm text-gray-900">
                        {viewingAgreement.propertyDetails?.address ? 
                          `${viewingAgreement.propertyDetails.address.flatNo || ''}, ${viewingAgreement.propertyDetails.address.society || ''}, ${viewingAgreement.propertyDetails.address.area || ''}, ${viewingAgreement.propertyDetails.address.city || ''}, ${viewingAgreement.propertyDetails.address.state || ''} - ${viewingAgreement.propertyDetails.address.pincode || ''}` 
                          : 'Not provided'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Rental Terms */}
              <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                <div className="bg-gradient-to-r from-slate-600 to-slate-700 px-6 py-4">
                  <h3 className="text-lg font-semibold text-white flex items-center">
                    <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center mr-3">
                      <span className="text-xs font-bold text-white">4</span>
                    </div>
                    Rental Terms
                  </h3>
                </div>
                <div className="bg-slate-50 p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div>
                      <label className="text-sm font-medium text-slate-700">Monthly Rent</label>
                      <p className="mt-1 text-lg text-gray-900 font-bold text-green-600">₹{viewingAgreement.rentalTerms?.monthlyRent || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Security Deposit</label>
                      <p className="mt-1 text-lg text-gray-900 font-bold text-blue-600">₹{viewingAgreement.rentalTerms?.securityDeposit || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Duration</label>
                      <p className="mt-1 text-sm text-gray-900">{viewingAgreement.rentalTerms?.duration || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Start Date</label>
                      <p className="mt-1 text-sm text-gray-900">{viewingAgreement.rentalTerms?.startDate ? new Date(viewingAgreement.rentalTerms.startDate).toLocaleDateString() : 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">End Date</label>
                      <p className="mt-1 text-sm text-gray-900">{viewingAgreement.rentalTerms?.endDate ? new Date(viewingAgreement.rentalTerms.endDate).toLocaleDateString() : 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Due Date</label>
                      <p className="mt-1 text-sm text-gray-900">{viewingAgreement.rentalTerms?.dueDate || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Maintenance</label>
                      <p className="mt-1 text-sm text-gray-900">{viewingAgreement.rentalTerms?.maintenance || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Notice Period</label>
                      <p className="mt-1 text-sm text-gray-900">{viewingAgreement.rentalTerms?.noticePeriod || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Minimum Stay</label>
                      <p className="mt-1 text-sm text-gray-900">{viewingAgreement.rentalTerms?.minimumStay || 'Not provided'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional Clauses - Step 5 */}
              <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                <div className="bg-gradient-to-r from-slate-600 to-slate-700 px-6 py-4">
                  <h3 className="text-lg font-semibold text-white flex items-center">
                    <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center mr-3">
                      <span className="text-xs font-bold text-white">5</span>
                    </div>
                    Additional Clauses
                  </h3>
                </div>
                <div className="bg-slate-50 p-6">
                  {viewingAgreement.additionalClauses && viewingAgreement.additionalClauses.length > 0 ? (
                    <div className="space-y-3">
                      {viewingAgreement.additionalClauses.map((clause: any, index: number) => (
                        <div key={index} className="bg-white p-4 rounded-lg border border-slate-200">
                          <p className="text-sm text-gray-900">{clause.text || clause}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-sm text-gray-500">No additional clauses added</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Agreement Information & Actions */}
              <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                <div className="bg-gradient-to-r from-slate-600 to-slate-700 px-6 py-4">
                  <h3 className="text-lg font-semibold text-white flex items-center">
                    <Download className="h-5 w-5 mr-3 text-white" />
                    Agreement Actions
                  </h3>
                </div>
                <div className="bg-slate-50 p-6">
                  <div className="flex flex-wrap gap-3 mb-6">
                    <Button
                      onClick={() => downloadAgreementPdf(viewingAgreement)}
                      className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 shadow-sm"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download PDF
                    </Button>

                    <Button
                      onClick={() => downloadWordDocument(viewingAgreement)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 shadow-sm"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Download Word
                    </Button>
                    
                    {(viewingAgreement.notarizedDocument?.url || viewingAgreement.notarizedDocumentUrl) && (
                      <Button
                        onClick={() => downloadNotarizedDocument(viewingAgreement)}
                        className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-2 shadow-sm"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Download Notarized Document
                      </Button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div>
                      <label className="text-sm font-medium text-slate-700">Agreement Number</label>
                      <p className="mt-1 text-sm text-gray-900 font-mono font-bold">{viewingAgreement.agreementNumber || 'Not assigned'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Agreement Date</label>
                      <p className="mt-1 text-sm text-gray-900">{viewingAgreement.agreementDate ? new Date(viewingAgreement.agreementDate).toLocaleDateString() : 'Not set'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Language</label>
                      <p className="mt-1 text-sm text-gray-900 capitalize">{viewingAgreement.language || 'English'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Status</label>
                      <p className="mt-1">
                        <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getStatusBadge(viewingAgreement.status)}`}>
                          {viewingAgreement.status ? viewingAgreement.status.charAt(0).toUpperCase() + viewingAgreement.status.slice(1) : 'Unknown'}
                        </span>
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Created At</label>
                      <p className="mt-1 text-sm text-gray-900">{viewingAgreement.createdAt ? new Date(viewingAgreement.createdAt).toLocaleString() : 'Not available'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Last Updated</label>
                      <p className="mt-1 text-sm text-gray-900">{viewingAgreement.updatedAt ? new Date(viewingAgreement.updatedAt).toLocaleString() : 'Not available'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notarized Document Section */}
              <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                <div className="bg-gradient-to-r from-slate-600 to-slate-700 px-6 py-4">
                  <h3 className="text-lg font-semibold text-white flex items-center">
                    <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center mr-3">
                      <span className="text-xs font-bold text-white">8</span>
                    </div>
                    Notarized Document
                  </h3>
                </div>
                <div className="bg-slate-50 p-6">
                  {viewingAgreement.notarizedDocument && viewingAgreement.notarizedDocument.filename ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-green-100 rounded-lg">
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900">
                              {viewingAgreement.notarizedDocument.originalName}
                            </p>
                            <p className="text-xs text-slate-500">
                              Uploaded on {new Date(viewingAgreement.notarizedDocument.uploadDate).toLocaleDateString()}
                            </p>
                            <p className="text-xs text-slate-500">
                              Size: {Math.round(viewingAgreement.notarizedDocument.size / 1024)} KB
                            </p>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(viewingAgreement.notarizedDocument.url, '_blank')}
                            className="text-slate-600 border-slate-300 hover:bg-slate-50"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = viewingAgreement.notarizedDocument.url;
                              link.download = viewingAgreement.notarizedDocument.originalName;
                              link.click();
                            }}
                            className="bg-slate-600 hover:bg-slate-700 text-white"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </Button>
                        </div>
                      </div>
                      <div className="text-center">
                        <Button
                          variant="outline"
                          onClick={handleNotarizedFileSelect}
                          disabled={uploadingNotarized}
                          className="border-slate-300 hover:bg-slate-50"
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          {uploadingNotarized ? 'Uploading...' : 'Replace Notarized Document'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="flex flex-col items-center space-y-4">
                        <div className="p-4 bg-slate-100 rounded-full">
                          <File className="h-8 w-8 text-slate-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">No notarized document uploaded</p>
                          <p className="text-xs text-slate-500 mt-1">
                            After getting this agreement notarized, upload the signed PDF here
                          </p>
                        </div>
                        <Button
                          onClick={handleNotarizedFileSelect}
                          disabled={uploadingNotarized}
                          className="bg-slate-600 hover:bg-slate-700 text-white"
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          {uploadingNotarized ? 'Uploading...' : 'Upload Notarized Document'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="bg-gradient-to-r from-slate-50 to-slate-100 p-6 rounded-lg border border-slate-200 shadow-sm">
                <div className="flex flex-wrap justify-center gap-3">
                  <Button
                    onClick={() => {
                      setEditingAgreement(viewingAgreement);
                      setViewingAgreement(null);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 shadow-sm"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Agreement
                  </Button>
                  <Button
                    onClick={() => handleDownloadAgreement(viewingAgreement)}
                    className="bg-slate-600 hover:bg-slate-700 text-white px-6 py-2 shadow-sm"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </Button>
                  <Button
                    onClick={() => handleDownloadWordAgreement(viewingAgreement)}
                    className="bg-slate-700 hover:bg-slate-800 text-white px-6 py-2 shadow-sm"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Download Word
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setViewingAgreement(null)}
                    className="border-slate-300 hover:bg-slate-50 px-6 py-2 shadow-sm"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Close
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
