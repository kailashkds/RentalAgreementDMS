import { useState } from "react";
import React from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import AgreementWizard from "@/components/AgreementWizard";
import ImportAgreementWizard from "@/components/ImportAgreementWizard";
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
  CheckCircle,
  Award
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

export default function Agreements() {
  const [, navigate] = useLocation();
  const [showWizard, setShowWizard] = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [editingAgreement, setEditingAgreement] = useState<any>(null);
  const [viewingAgreement, setViewingAgreement] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [notaryFilter, setNotaryFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [tenantFilter, setTenantFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [customStartDate, setCustomStartDate] = useState<Date>();
  const [customEndDate, setCustomEndDate] = useState<Date>();
  const [currentPage, setCurrentPage] = useState(1);
  const [uploadingNotarized, setUploadingNotarized] = useState(false);
  const [notarizedFileInput, setNotarizedFileInput] = useState<HTMLInputElement | null>(null);
  const { toast } = useToast();

  // Date range calculation helper function
  const getDateRange = (filterType: string) => {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    switch (filterType) {
      case "today":
        return { 
          start: startOfToday, 
          end: new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1) 
        };
      case "tomorrow":
        const tomorrow = new Date(startOfToday);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return { 
          start: tomorrow, 
          end: new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000 - 1) 
        };
      case "thisWeek":
        const startOfWeek = new Date(startOfToday);
        startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        return { start: startOfWeek, end: endOfWeek };
      case "thisMonth":
        const startOfMonth = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 1);
        const endOfMonth = new Date(startOfToday.getFullYear(), startOfToday.getMonth() + 1, 0);
        endOfMonth.setHours(23, 59, 59, 999);
        return { start: startOfMonth, end: endOfMonth };
      case "next3Months":
        const next3MonthsEnd = new Date(startOfToday);
        next3MonthsEnd.setMonth(next3MonthsEnd.getMonth() + 3);
        next3MonthsEnd.setHours(23, 59, 59, 999);
        return { start: startOfToday, end: next3MonthsEnd };
      case "next6Months":
        const next6MonthsEnd = new Date(startOfToday);
        next6MonthsEnd.setMonth(next6MonthsEnd.getMonth() + 6);
        next6MonthsEnd.setHours(23, 59, 59, 999);
        return { start: startOfToday, end: next6MonthsEnd };
      case "thisYear":
        const startOfYear = new Date(startOfToday.getFullYear(), 0, 1);
        const endOfYear = new Date(startOfToday.getFullYear(), 11, 31);
        endOfYear.setHours(23, 59, 59, 999);
        return { start: startOfYear, end: endOfYear };
      case "custom":
        if (customStartDate && customEndDate) {
          const customEnd = new Date(customEndDate);
          customEnd.setHours(23, 59, 59, 999);
          return { start: customStartDate, end: customEnd };
        }
        return null;
      default:
        return null;
    }
  };

  // Calculate actual date ranges for predefined filters
  const calculateDateRange = () => {
    if (dateFilter === "all" || dateFilter === "") {
      return { dateFilter: undefined, startDate: undefined, endDate: undefined };
    }
    
    if (dateFilter === "custom") {
      return {
        dateFilter: "custom",
        startDate: customStartDate ? customStartDate.toISOString().split('T')[0] : undefined,
        endDate: customEndDate ? customEndDate.toISOString().split('T')[0] : undefined,
      };
    }
    
    // For predefined filters, calculate the actual date range
    const range = getDateRange(dateFilter);
    if (range) {
      return {
        dateFilter: "range",
        startDate: range.start.toISOString().split('T')[0],
        endDate: range.end.toISOString().split('T')[0],
      };
    }
    
    return { dateFilter: undefined, startDate: undefined, endDate: undefined };
  };

  const dateParams = calculateDateRange();
  
  const { data: agreementsData, isLoading } = useAgreements({
    search: searchTerm,
    status: statusFilter === "all" ? "" : statusFilter,
    ...dateParams,
    limit: 20,
    offset: (currentPage - 1) * 20,
  });

  // Extract unique values for dropdown options
  const uniqueCustomers = React.useMemo(() => {
    const customers = agreementsData?.agreements
      ?.map((agreement: any) => agreement.customer?.name)
      .filter((name: string) => name && name.trim() !== '')
      .filter((name: string, index: number, arr: string[]) => arr.indexOf(name) === index)
      .sort() || [];
    return customers;
  }, [agreementsData?.agreements]);

  const uniqueTenants = React.useMemo(() => {
    const tenants = agreementsData?.agreements
      ?.map((agreement: any) => agreement.tenantDetails?.name)
      .filter((name: string) => name && name.trim() !== '')
      .filter((name: string, index: number, arr: string[]) => arr.indexOf(name) === index)
      .sort() || [];
    return tenants;
  }, [agreementsData?.agreements]);

  const uniqueOwners = React.useMemo(() => {
    const owners = agreementsData?.agreements
      ?.map((agreement: any) => agreement.ownerDetails?.name)
      .filter((name: string) => name && name.trim() !== '')
      .filter((name: string, index: number, arr: string[]) => arr.indexOf(name) === index)
      .sort() || [];
    return owners;
  }, [agreementsData?.agreements]);

  // Client-side filtering for customer, tenant, owner, and notary (date filtering is now server-side)
  const filteredAgreements = agreementsData?.agreements?.filter((agreement: any) => {
    // Filter by notary status
    if (notaryFilter && notaryFilter !== "all") {
      const notaryStatus = agreement.status === "draft" 
        ? "complete_first" 
        : agreement.status === "active" 
        ? (agreement.notarizedDocument?.url || agreement.notarizedDocumentUrl) 
          ? "notarized" 
          : "pending"
        : "n_a";
      if (notaryStatus !== notaryFilter) return false;
    }

    // Filter by customer name
    if (customerFilter && customerFilter !== "all") {
      const customerName = agreement.customer?.name || '';
      if (customerName !== customerFilter) {
        return false;
      }
    }

    // Filter by tenant name
    if (tenantFilter && tenantFilter !== "all") {
      const tenantName = agreement.tenantDetails?.name || '';
      if (tenantName !== tenantFilter) {
        return false;
      }
    }

    // Filter by owner name
    if (ownerFilter && ownerFilter !== "all") {
      const ownerName = agreement.ownerDetails?.name || '';
      if (ownerName !== ownerFilter) {
        return false;
      }
    }

    return true;
  }) || [];

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

  const handleNotarizedUploadFromTable = (agreementId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        handleUploadNotarizedDocument(agreementId, file);
      }
    };
    input.click();
  };

  const handleSendWhatsApp = (agreement: any) => {
    // WhatsApp functionality placeholder
    console.log('Send WhatsApp for agreement:', agreement.agreementNumber);
    toast({
      title: "WhatsApp Feature",
      description: "WhatsApp integration will be implemented here",
    });
  };

  const handleDownloadNotarizedFromTable = (agreement: any) => {
    const notarizedUrl = agreement.notarizedDocument?.url || agreement.notarizedDocumentUrl;
    if (notarizedUrl) {
      const link = document.createElement('a');
      link.href = notarizedUrl;
      link.download = agreement.notarizedDocument?.originalName || `${agreement.agreementNumber}-notarized.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const downloadAgreementPdf = async (agreement: any) => {
    try {
      const response = await fetch(`/api/agreements/${agreement.id}/pdf`);
      if (response.ok) {
        const data = await response.json();
        if (data.html) {
          // Import html2pdf dynamically
          const html2pdf = (await import('html2pdf.js' as any)).default;
          
          // Create a temporary container for the HTML content
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = data.html;
          tempDiv.style.width = '210mm'; // A4 width
          tempDiv.style.fontFamily = 'Arial, sans-serif';
          document.body.appendChild(tempDiv);
          
          // Configure pdf options
          const options = {
            margin: [15, 10, 15, 10], // mm
            filename: data.filename || `${agreement.agreementNumber}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { 
              scale: 2, 
              useCORS: true,
              letterRendering: true 
            },
            jsPDF: { 
              unit: 'mm', 
              format: 'a4', 
              orientation: 'portrait' 
            }
          };
          
          // Generate and download PDF
          await html2pdf().set(options).from(tempDiv).save();
          
          // Clean up
          document.body.removeChild(tempDiv);
        }
      }
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Failed to download PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  const downloadNotarizedDocument = async (agreement: any) => {
    try {
      if (agreement.notarizedDocument?.url) {
        const link = document.createElement('a');
        link.href = agreement.notarizedDocument.url;
        link.download = agreement.notarizedDocument.originalName || 'notarized-document.pdf';
        link.click();
        
        toast({
          title: "Document Downloaded",
          description: `${agreement.notarizedDocument.originalName} downloaded successfully`,
        });
      } else if (agreement.notarizedDocumentUrl) {
        const link = document.createElement('a');
        link.href = agreement.notarizedDocumentUrl;
        link.download = `notarized-${agreement.agreementNumber}.pdf`;
        link.click();
        
        toast({
          title: "Document Downloaded",
          description: "Notarized document downloaded successfully",
        });
      } else {
        toast({
          title: "No Document",
          description: "No notarized document available for this agreement",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error downloading document:', error);
      toast({
        title: "Download Failed",
        description: "Failed to download document. Please try again.",
        variant: "destructive",
      });
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
      console.log('Starting PDF download for agreement:', agreement.id);
      console.log('Agreement data:', {
        hasOwnerDetails: !!agreement.ownerDetails,
        hasTenantDetails: !!agreement.tenantDetails,
        hasPropertyDetails: !!agreement.propertyDetails,
        hasRentalTerms: !!agreement.rentalTerms,
        agreementNumber: agreement.agreementNumber,
        hasEditedContent: !!agreement.editedContent
      });

      // Use the dedicated PDF endpoint that checks for edited content first
      const response = await fetch(`/api/agreements/${agreement.id}/pdf`);

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

  // Helper function to check if agreement is imported
  const isImportedAgreement = (agreement: any) => {
    // Only imported agreements have police verification documents
    return agreement?.documents?.policeVerificationDocument?.url;
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
        <div className="flex flex-col justify-between items-start gap-4">
          <div className="flex flex-col lg:flex-row gap-4 w-full">
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
            <Select value={notaryFilter} onValueChange={setNotaryFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="All Notary" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Notary</SelectItem>
                <SelectItem value="notarized">Notarized</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="complete_first">Complete First</SelectItem>
              </SelectContent>
            </Select>
            <Select value={customerFilter} onValueChange={setCustomerFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="All Customers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Customers</SelectItem>
                {uniqueCustomers.map((customer) => (
                  <SelectItem key={customer} value={customer}>
                    {customer}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={tenantFilter} onValueChange={setTenantFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="All Tenants" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tenants</SelectItem>
                {uniqueTenants.map((tenant) => (
                  <SelectItem key={tenant} value={tenant}>
                    {tenant}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={ownerFilter} onValueChange={setOwnerFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="All Owners" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Owners</SelectItem>
                {uniqueOwners.map((owner) => (
                  <SelectItem key={owner} value={owner}>
                    {owner}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Date Filter */}
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by Date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Dates</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="tomorrow">Tomorrow</SelectItem>
                <SelectItem value="thisWeek">This Week</SelectItem>
                <SelectItem value="thisMonth">This Month</SelectItem>
                <SelectItem value="next3Months">Next 3 Months</SelectItem>
                <SelectItem value="next6Months">Next 6 Months</SelectItem>
                <SelectItem value="thisYear">This Year</SelectItem>
                <SelectItem value="custom">Custom Date Range</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Custom Date Range Picker */}
          {dateFilter === "custom" && (
            <div className="flex gap-4 items-center p-4 bg-gray-50 rounded-lg">
              <div className="flex flex-col gap-2">
                <Label htmlFor="start-date" className="text-sm font-medium">Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="start-date"
                      variant="outline"
                      className="w-[240px] justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customStartDate ? format(customStartDate, "PPP") : "Select start date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customStartDate}
                      onSelect={setCustomStartDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="flex flex-col gap-2">
                <Label htmlFor="end-date" className="text-sm font-medium">End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="end-date"
                      variant="outline"
                      className="w-[240px] justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customEndDate ? format(customEndDate, "PPP") : "Select end date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customEndDate}
                      onSelect={setCustomEndDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}
          <div className="flex justify-between items-center w-full">
            {(notaryFilter !== "all" || customerFilter !== "all" || tenantFilter !== "all" || ownerFilter !== "all" || dateFilter !== "all" || searchTerm || (statusFilter && statusFilter !== "all")) && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("all");
                  setNotaryFilter("all");
                  setCustomerFilter("all");
                  setTenantFilter("all");
                  setOwnerFilter("all");
                  setDateFilter("all");
                  setCustomStartDate(undefined);
                  setCustomEndDate(undefined);
                }}
                className="text-gray-600 hover:text-gray-900"
              >
                <X className="mr-2 h-4 w-4" />
                Clear all filters
              </Button>
            )}
            <div className="flex gap-2">
              <Button onClick={() => setShowWizard(true)} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="mr-2 h-4 w-4" />
                Create Agreement
              </Button>
              <Button 
                onClick={() => setShowImportWizard(true)}
                variant="outline"
                className="border-green-600 text-green-600 hover:bg-green-50"
              >
                <Upload className="h-4 w-4 mr-2" />
                Import Existing Agreement
              </Button>
            </div>
          </div>
        </div>

        {/* Agreements Table */}
        <Card className="border border-gray-200">
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="p-6 text-center text-gray-500">Loading agreements...</div>
            ) : filteredAgreements?.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                {searchTerm || notaryFilter !== "all" || customerFilter !== "all" || tenantFilter !== "all" || ownerFilter !== "all" || dateFilter !== "all" || (statusFilter && statusFilter !== "all") ? (
                  <>
                    No agreements found matching your criteria.
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setSearchTerm("");
                        setStatusFilter("all");
                        setNotaryFilter("all");
                        setCustomerFilter("all");
                        setTenantFilter("all");
                        setOwnerFilter("all");
                        setDateFilter("all");
                        setCustomStartDate(undefined);
                        setCustomEndDate(undefined);
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
              <div className="space-y-4">
                {filteredAgreements?.map((agreement: any, index: number) => (
                  <div key={agreement.id || index} className="border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors group">
                    <div className="flex flex-col lg:flex-row">
                      {/* Details Section */}
                      <div className="flex-1 p-6 border-r border-gray-100">
                        {/* Header with Agreement Number and Status */}
                        <div className="flex flex-wrap items-center gap-3 mb-4">
                          <h3 className="text-xl font-bold font-mono text-gray-900">
                            {agreement.agreementNumber}
                          </h3>
                          
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getStatusBadge(
                                agreement.status
                              )}`}
                            >
                              {agreement.status ? agreement.status.charAt(0).toUpperCase() + agreement.status.slice(1) : 'Unknown'}
                            </span>
                            {isImportedAgreement(agreement) && (
                              <span className="inline-flex px-2 py-1 text-xs font-medium rounded-md bg-blue-100 text-blue-700">
                                Imported
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {/* Information Grid - Reorganized Layout */}
                        <div className="space-y-4 text-sm">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <span className="font-medium text-gray-600">Customer:</span>
                              <p className="text-gray-900 font-medium">{agreement.customer?.name || "Unknown"}</p>
                              {agreement.customer?.mobile && (
                                <p className="text-xs text-gray-500 mt-1">{agreement.customer.mobile}</p>
                              )}
                            </div>
                            <div>
                              <span className="font-medium text-gray-600">Landlord:</span>
                              <p className="text-gray-900">{agreement.ownerDetails?.name || 'Not provided'}</p>
                              {agreement.ownerDetails?.mobile && (
                                <p className="text-xs text-gray-500 mt-1">{agreement.ownerDetails.mobile}</p>
                              )}
                            </div>
                            <div>
                              <span className="font-medium text-gray-600">Tenant:</span>
                              <p className="text-gray-900">{agreement.tenantDetails?.name || 'Not provided'}</p>
                              {agreement.tenantDetails?.mobile && (
                                <p className="text-xs text-gray-500 mt-1">{agreement.tenantDetails.mobile}</p>
                              )}
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <span className="font-medium text-gray-600">Agreement Period:</span>
                              <p className="text-gray-900">
                                {(() => {
                                  const startDate = agreement.rentalTerms?.startDate || agreement.startDate;
                                  const endDate = agreement.rentalTerms?.endDate || agreement.endDate;
                                  
                                  if (startDate && endDate) {
                                    return `${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`;
                                  }
                                  return 'Not available';
                                })()}
                              </p>
                            </div>
                            <div>
                              <span className="font-medium text-gray-600">Notary Status:</span>
                              <div className="mt-1">
                                <span
                                  className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                                    agreement.status === "draft"
                                      ? "bg-gray-100 text-gray-800"
                                      : agreement.status === "active"
                                      ? (agreement.notarizedDocument?.url || agreement.notarizedDocumentUrl)
                                        ? "bg-green-100 text-green-800"
                                        : "bg-amber-100 text-amber-800"
                                      : "bg-blue-100 text-blue-800"
                                  }`}
                                >
                                  {agreement.status === "draft"
                                    ? "Draft"
                                    : agreement.status === "active"
                                    ? (agreement.notarizedDocument?.url || agreement.notarizedDocumentUrl)
                                      ? "Complete"
                                      : "Pending"
                                    : "Active"
                                  }
                                </span>
                              </div>
                            </div>
                            <div>
                              <span className="font-medium text-gray-600">Expiry Status:</span>
                              <div className="mt-1">
                                {(() => {
                                  const endDate = agreement.rentalTerms?.endDate || agreement.endDate;
                                  if (!endDate) return <span className="inline-flex px-3 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">No expiry date</span>;
                                  
                                  const today = new Date();
                                  const expiry = new Date(endDate);
                                  const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                                  
                                  let bgColor = 'bg-green-100';
                                  let textColor = 'text-green-800';
                                  let text = `${daysUntilExpiry} days remaining`;
                                  
                                  if (daysUntilExpiry < 0) {
                                    bgColor = 'bg-red-100';
                                    textColor = 'text-red-800';
                                    text = `Expired ${Math.abs(daysUntilExpiry)} days ago`;
                                  } else if (daysUntilExpiry === 0) {
                                    bgColor = 'bg-red-100';
                                    textColor = 'text-red-800';
                                    text = 'Expires today';
                                  } else if (daysUntilExpiry === 1) {
                                    bgColor = 'bg-orange-100';
                                    textColor = 'text-orange-800';
                                    text = 'Expires tomorrow';
                                  } else if (daysUntilExpiry <= 30) {
                                    bgColor = 'bg-orange-100';
                                    textColor = 'text-orange-800';
                                    text = `Expires in ${daysUntilExpiry} days`;
                                  } else if (daysUntilExpiry <= 90) {
                                    bgColor = 'bg-yellow-100';
                                    textColor = 'text-yellow-800';
                                    text = `Expires in ${daysUntilExpiry} days`;
                                  }
                                  
                                  return (
                                    <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${bgColor} ${textColor}`}>
                                      {text}
                                    </span>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                          
                          <div>
                            <span className="font-medium text-gray-600">Property Address:</span>
                            <p className="text-gray-900">
                              {(() => {
                                const propertyAddr = agreement.propertyDetails?.address || agreement.ownerDetails?.address;
                                if (propertyAddr) {
                                  return [
                                    propertyAddr.flatNo,
                                    propertyAddr.society,
                                    propertyAddr.area,
                                    propertyAddr.city
                                  ].filter(Boolean).join(', ');
                                }
                                return 'Not available';
                              })()}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Actions Section */}
                      <div className="flex-shrink-0 lg:w-48 bg-gray-50 p-4 rounded-r-lg">
                        <div className="text-center mb-3">
                          <span className="text-sm font-medium text-gray-700">Actions</span>
                        </div>
                        {/* Action Buttons Grid - Circular buttons like in screenshot */}
                        <div className="grid grid-cols-3 gap-2">
                            {/* View Button */}
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-10 w-10 p-0 text-blue-600 hover:text-blue-900 hover:bg-blue-100 rounded-full border border-gray-200"
                            onClick={() => handleViewAgreement(agreement.id)}
                            title="View Agreement"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {(agreement.notarizedDocument?.url || agreement.notarizedDocumentUrl) ? (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-10 w-10 p-0 text-green-600 hover:text-green-900 hover:bg-green-100 rounded-full border border-gray-200"
                                  title="Download Options"
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-56 p-2">
                                <div className="space-y-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full justify-start text-green-600 hover:text-green-700 hover:bg-green-50"
                                    onClick={() => handleDownloadAgreement(agreement)}
                                  >
                                    <Download className="h-4 w-4 mr-2" />
                                    Agreement PDF
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full justify-start text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                    onClick={() => handleDownloadNotarizedFromTable(agreement)}
                                  >
                                    <Award className="h-4 w-4 mr-2" />
                                    Notarized Document
                                  </Button>
                                </div>
                              </PopoverContent>
                            </Popover>
                          ) : (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-10 w-10 p-0 text-green-600 hover:text-green-900 hover:bg-green-100 rounded-full border border-gray-200"
                              onClick={() => handleDownloadAgreement(agreement)}
                              title="Download PDF"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-10 w-10 p-0 text-amber-600 hover:text-amber-900 hover:bg-amber-100 rounded-full border border-gray-200"
                            onClick={() => setEditingAgreement(agreement)}
                            title="Edit Agreement"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {agreement.status === "active" && !(agreement.notarizedDocument?.url || agreement.notarizedDocumentUrl) && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-10 w-10 p-0 text-purple-600 hover:text-purple-900 hover:bg-purple-100 rounded-full border border-gray-200"
                              onClick={() => handleNotarizedUploadFromTable(agreement.id)}
                              disabled={uploadingNotarized}
                              title="Upload Notarized Document"
                            >
                              <Upload className="h-4 w-4" />
                            </Button>
                          )}
                          {agreement.status === "active" && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-10 w-10 p-0 text-green-600 hover:text-green-900 hover:bg-green-100 rounded-full border border-gray-200"
                              onClick={() => handleRenewAgreement(agreement.id)}
                              title="Renew Agreement"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-10 w-10 p-0 text-purple-600 hover:text-purple-900 hover:bg-purple-100 rounded-full border border-gray-200"
                            onClick={() => handleDuplicateAgreement(agreement.id)}
                            title="Duplicate Agreement"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          {agreement.status === 'draft' && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-10 w-10 p-0 text-orange-600 hover:text-orange-900 hover:bg-orange-100 rounded-full border border-gray-200"
                              onClick={() => handleSendWhatsApp(agreement)}
                              title="Send WhatsApp"
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                          )}
                          
                          {agreement.status === "draft" && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-10 w-10 p-0 text-red-600 hover:text-red-900 hover:bg-red-100 rounded-full border border-gray-200"
                              onClick={() => handleDeleteAgreement(agreement.id)}
                              title="Delete Agreement"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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

      <ImportAgreementWizard
        isOpen={showImportWizard}
        onClose={() => setShowImportWizard(false)}
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
                    {(viewingAgreement.notarizedDocument?.url || viewingAgreement.notarizedDocumentUrl) ? (
                      <div className="flex gap-3">
                        <Button
                          onClick={() => downloadAgreementPdf(viewingAgreement)}
                          className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 shadow-sm"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Agreement PDF
                        </Button>
                        <Button
                          onClick={() => downloadNotarizedDocument(viewingAgreement)}
                          className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-2 shadow-sm"
                        >
                          <Award className="h-4 w-4 mr-2" />
                          Notarized Document
                        </Button>
                      </div>
                    ) : (
                      <Button
                        onClick={() => downloadAgreementPdf(viewingAgreement)}
                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 shadow-sm"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download PDF
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
                      <div className="mt-1 flex items-center gap-2">
                        <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getStatusBadge(viewingAgreement.status)}`}>
                          {viewingAgreement.status ? viewingAgreement.status.charAt(0).toUpperCase() + viewingAgreement.status.slice(1) : 'Unknown'}
                        </span>
                        {isImportedAgreement(viewingAgreement) && (
                          <span className="inline-flex px-2 py-1 text-xs font-medium rounded-md bg-blue-100 text-blue-700">
                            Imported
                          </span>
                        )}
                      </div>
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

              {/* Imported Documents Section - Only show for imported agreements */}
              {isImportedAgreement(viewingAgreement) && (
                <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                  <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
                    <h3 className="text-lg font-semibold text-white flex items-center">
                      <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center mr-3">
                        <span className="text-xs font-bold text-white">📄</span>
                      </div>
                      Imported Documents
                    </h3>
                  </div>
                  <div className="bg-blue-50 p-6">
                    <div className="space-y-4">
                      {/* Notarized Document Preview */}
                      {viewingAgreement.notarizedDocument?.url && (
                        <div className="bg-white rounded-lg border border-blue-200 shadow-sm">
                          <div className="p-4 border-b border-blue-100">
                            <h4 className="text-sm font-medium text-blue-900">Notarized Agreement Document</h4>
                          </div>
                          <div className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className="p-2 bg-blue-100 rounded-lg">
                                  <FileText className="h-5 w-5 text-blue-600" />
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-gray-900">Uploaded Document</p>
                                  <p className="text-xs text-gray-500">PDF Document</p>
                                </div>
                              </div>
                              <div className="flex space-x-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => window.open(viewingAgreement.notarizedDocument.url, '_blank')}
                                  className="text-blue-600 border-blue-300 hover:bg-blue-50"
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  View
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    const link = document.createElement('a');
                                    link.href = viewingAgreement.notarizedDocument.url;
                                    link.download = 'notarized-document.pdf';
                                    link.click();
                                  }}
                                  className="bg-blue-600 hover:bg-blue-700 text-white"
                                >
                                  <Download className="h-4 w-4 mr-2" />
                                  Download
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Police Verification Document Preview */}
                      {viewingAgreement.documents?.policeVerificationDocument?.url && (
                        <div className="bg-white rounded-lg border border-blue-200 shadow-sm">
                          <div className="p-4 border-b border-blue-100">
                            <h4 className="text-sm font-medium text-blue-900">Police Verification Document</h4>
                          </div>
                          <div className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className="p-2 bg-blue-100 rounded-lg">
                                  <FileText className="h-5 w-5 text-blue-600" />
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-gray-900">Uploaded Document</p>
                                  <p className="text-xs text-gray-500">PDF Document</p>
                                </div>
                              </div>
                              <div className="flex space-x-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => window.open(viewingAgreement.documents.policeVerificationDocument.url, '_blank')}
                                  className="text-blue-600 border-blue-300 hover:bg-blue-50"
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  View
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    const link = document.createElement('a');
                                    link.href = viewingAgreement.documents.policeVerificationDocument.url;
                                    link.download = 'police-verification-document.pdf';
                                    link.click();
                                  }}
                                  className="bg-blue-600 hover:bg-blue-700 text-white"
                                >
                                  <Download className="h-4 w-4 mr-2" />
                                  Download
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

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
