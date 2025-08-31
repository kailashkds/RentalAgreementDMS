import { useState } from "react";
import React from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { formatDateToDDMMYYYY, getRelativeDateDescription } from "@/lib/dateUtils";
import AgreementWizard from "@/components/AgreementWizard";
import ImportAgreementWizard from "@/components/ImportAgreementWizard";
import { useAgreements } from "@/hooks/useAgreements";
import {
  Plus,
  Search,
  Eye,
  RotateCcw,
  Edit,
  Trash2,
  Download,
  Send,
  FileText,
  X,
  Upload,
  File,
  CheckCircle,
  Award,
  FileCheck
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { apiClient } from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { LocalFileUploader } from "@/components/LocalFileUploader";
import { FilePreview } from "@/components/FilePreview";
import { usePermissions, PERMISSIONS } from "@/hooks/usePermissions";
import { SensitivePhone, SensitiveAmount, SensitiveAddress, SensitiveAadhar, SensitivePan, SensitiveDocument } from "@/components/SensitiveInfo";

export default function Agreements() {
  const [, navigate] = useLocation();
  const [showWizard, setShowWizard] = useState(false);
  const { hasPermission } = usePermissions();
  
  // Helper function to check if user can edit agreements even after notarized
  const canEditNotarizedAgreement = (agreement: any) => {
    const isNotarized = agreement.notarizedDocument?.url || agreement.notarizedDocumentUrl;
    if (!isNotarized) return true; // Not notarized, normal permissions apply
    
    // Check if user has permission to edit notarized agreements
    const hasNotarizedEditAllPermission = hasPermission(PERMISSIONS.AGREEMENT_EDIT_NOTARIZED_ALL);
    const hasNotarizedEditOwnPermission = hasPermission(PERMISSIONS.AGREEMENT_EDIT_NOTARIZED_OWN);
    
    // If has "all" permission (Super Admin), can edit any notarized agreement
    if (hasNotarizedEditAllPermission) return true;
    
    // If has "own" permission and this is their own agreement
    if (hasNotarizedEditOwnPermission) {
      // Note: For customers, this would check if agreement.customerId matches their user ID
      // For now, we allow editing own notarized agreements for users with this permission
      return true;
    }
    
    // No permission to edit notarized agreements
    return false;
  };
  
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [editingAgreement, setEditingAgreement] = useState<any>(null);
  const [viewingAgreement, setViewingAgreement] = useState<any>(null);
  const [viewingImportedAgreement, setViewingImportedAgreement] = useState<any>(null);
  const [editingImportedAgreement, setEditingImportedAgreement] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [notaryFilter, setNotaryFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [tenantFilter, setTenantFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [sortBy, setSortBy] = useState("expiry_status");
  const [customStartDate, setCustomStartDate] = useState<Date>();
  const [customEndDate, setCustomEndDate] = useState<Date>();
  const [currentPage, setCurrentPage] = useState(1);
  const [uploadingNotarized, setUploadingNotarized] = useState(false);
  const [notarizedFileInput, setNotarizedFileInput] = useState<HTMLInputElement | null>(null);
  const { toast } = useToast();

  // Handle updating expired agreements manually
  const handleUpdateExpiredAgreements = async () => {
    try {
      const response = await fetch('/api/agreements/update-expired', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (data.updatedCount > 0) {
        toast({
          title: "Status Updated",
          description: `Updated ${data.updatedCount} expired agreements to 'expired' status`,
        });
        // Refresh the agreements list
        queryClient.invalidateQueries({ queryKey: ['/api/agreements'] });
      } else {
        toast({
          title: "No Updates Needed",
          description: "All agreements are already up to date",
        });
      }
    } catch (error) {
      console.error('Error updating expired agreements:', error);
      toast({
        title: "Error",
        description: "Failed to update expired agreements",
        variant: "destructive",
      });
    }
  };

  // Reset current page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, notaryFilter, customerFilter, tenantFilter, ownerFilter, dateFilter, sortBy]);

  // Pagination helper function
  const generatePageNumbers = (currentPage: number, totalPages: number) => {
    const pages = [];
    const showPages = 5; // Show 5 page numbers at a time
    
    if (totalPages <= showPages) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Calculate start and end pages
      let startPage = Math.max(1, currentPage - Math.floor(showPages / 2));
      let endPage = Math.min(totalPages, startPage + showPages - 1);
      
      // Adjust if we're near the end
      if (endPage - startPage < showPages - 1) {
        startPage = Math.max(1, endPage - showPages + 1);
      }
      
      // Add first page and ellipsis if needed
      if (startPage > 1) {
        pages.push(1);
        if (startPage > 2) {
          pages.push('...');
        }
      }
      
      // Add middle pages
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
      
      // Add ellipsis and last page if needed
      if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
          pages.push('...');
        }
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

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
        // Show agreements expiring within the next 7 days from today
        const weekEnd = new Date(startOfToday);
        weekEnd.setDate(startOfToday.getDate() + 7);
        weekEnd.setHours(23, 59, 59, 999);
        return { start: startOfToday, end: weekEnd };
      case "thisMonth":
        // Show agreements expiring within the next 30 days from today
        const monthEnd = new Date(startOfToday);
        monthEnd.setDate(startOfToday.getDate() + 30);
        monthEnd.setHours(23, 59, 59, 999);
        return { start: startOfToday, end: monthEnd };
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
    limit: 25,
    offset: (currentPage - 1) * 25,
  });

  // Auto-adjust current page when total agreements change to ensure we don't exceed max pages
  React.useEffect(() => {
    if (agreementsData?.total) {
      const maxPages = Math.ceil(agreementsData.total / 25);
      if (currentPage > maxPages) {
        setCurrentPage(maxPages);
      }
    }
  }, [agreementsData?.total, currentPage]);

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

  // Sort the filtered agreements
  const sortedAgreements = React.useMemo(() => {
    if (!filteredAgreements || filteredAgreements.length === 0) return [];
    
    const sorted = [...filteredAgreements].sort((a, b) => {
      switch (sortBy) {
        case "agreement_number_desc":
          // Sort by agreement number descending (highest number first)
          const aNum = parseInt(a.agreementNumber?.replace(/[^0-9]/g, '') || '0');
          const bNum = parseInt(b.agreementNumber?.replace(/[^0-9]/g, '') || '0');
          return bNum - aNum;
          
        case "agreement_number_asc":
          // Sort by agreement number ascending (oldest first)
          const aNumAsc = parseInt(a.agreementNumber?.replace(/[^0-9]/g, '') || '0');
          const bNumAsc = parseInt(b.agreementNumber?.replace(/[^0-9]/g, '') || '0');
          return aNumAsc - bNumAsc;
          
        case "expiry_status_asc":
          // Sort by expiry status ascending (expired first, then expiring soon, then active)
          const getExpiryPriority = (agreement: any) => {
            const endDate = agreement.rentalTerms?.endDate || agreement.endDate;
            if (!endDate) return 3; // No expiry date - lowest priority
            
            const today = new Date();
            const expiry = new Date(endDate);
            const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            
            if (daysUntilExpiry < 0) return 0; // Expired - highest priority
            if (daysUntilExpiry <= 30) return 1; // Expiring soon
            return 2; // Active
          };
          
          const aPriority = getExpiryPriority(a);
          const bPriority = getExpiryPriority(b);
          
          if (aPriority === bPriority) {
            // If same status, sort by expiry date
            const aEndDate = new Date(a.rentalTerms?.endDate || a.endDate || 0);
            const bEndDate = new Date(b.rentalTerms?.endDate || b.endDate || 0);
            return aEndDate.getTime() - bEndDate.getTime();
          }
          
          return aPriority - bPriority;
          
        case "expiry_status":
          // Sort by expiry urgency (expiring soon first, then later dates, expired at end)
          const getExpiryUrgency = (agreement: any) => {
            // Check agreement status first - if already expired, put at end
            if (agreement.status === 'expired') return 1000; // Expired - lowest priority (at end)
            
            const endDate = agreement.rentalTerms?.endDate || agreement.endDate;
            if (!endDate) return 999; // No expiry date - second lowest priority
            
            const today = new Date();
            const expiry = new Date(endDate);
            const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            
            if (daysUntilExpiry < 0) return 1000; // Expired by date - lowest priority (at end)
            if (daysUntilExpiry === 0) return 1; // Expires today - highest priority
            if (daysUntilExpiry === 1) return 2; // Expires tomorrow
            if (daysUntilExpiry <= 7) return 3; // Expires this week
            if (daysUntilExpiry <= 30) return 4; // Expires this month
            if (daysUntilExpiry <= 90) return 5; // Expires in 3 months
            
            return daysUntilExpiry; // Return days for further dates
          };
          
          const aUrgency = getExpiryUrgency(a);
          const bUrgency = getExpiryUrgency(b);
          
          if (aUrgency === bUrgency) {
            // If same urgency, sort by expiry date (closest first)
            const aEndDate = new Date(a.rentalTerms?.endDate || a.endDate || 0);
            const bEndDate = new Date(b.rentalTerms?.endDate || b.endDate || 0);
            return aEndDate.getTime() - bEndDate.getTime();
          }
          
          return aUrgency - bUrgency;

        case "expiry_status_desc":
          // Sort by expiry status descending (active first, then expiring soon, then expired)
          const getExpiryPriorityDesc = (agreement: any) => {
            const endDate = agreement.rentalTerms?.endDate || agreement.endDate;
            if (!endDate) return 0; // No expiry date - highest priority
            
            const today = new Date();
            const expiry = new Date(endDate);
            const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            
            if (daysUntilExpiry < 0) return 3; // Expired - lowest priority
            if (daysUntilExpiry <= 30) return 2; // Expiring soon
            return 1; // Active
          };
          
          const aPriorityDesc = getExpiryPriorityDesc(a);
          const bPriorityDesc = getExpiryPriorityDesc(b);
          
          if (aPriorityDesc === bPriorityDesc) {
            // If same status, sort by expiry date (farthest first)
            const aEndDateDesc = new Date(a.rentalTerms?.endDate || a.endDate || 0);
            const bEndDateDesc = new Date(b.rentalTerms?.endDate || b.endDate || 0);
            return bEndDateDesc.getTime() - aEndDateDesc.getTime();
          }
          
          return aPriorityDesc - bPriorityDesc;
          
        default:
          return 0;
      }
    });
    
    return sorted;
  }, [filteredAgreements, sortBy]);

  const handleRenewAgreement = async (agreementId: string) => {
    try {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 11);

      await apiRequest(`/api/agreements/${agreementId}/renew`, "POST", {
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


  const handleDeleteAgreement = async (agreementId: string) => {
    if (!window.confirm("Are you sure you want to delete this agreement?")) {
      return;
    }

    try {
      console.log(`[Agreements] Attempting to delete agreement ${agreementId}`);
      await apiRequest(`/api/agreements/${agreementId}`, "DELETE");
      console.log(`[Agreements] Successfully deleted agreement ${agreementId}`);

      queryClient.invalidateQueries({ queryKey: ["/api/agreements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });

      toast({
        title: "Agreement deleted",
        description: "Agreement has been deleted successfully.",
      });
    } catch (error) {
      console.error('[Agreements] Delete error:', error);
      
      // Parse error message from API response
      let errorMessage = "Failed to delete agreement.";
      if (error instanceof Error) {
        try {
          // Try to parse the error message as JSON
          const match = error.message.match(/\d{3}: (.+)/);
          if (match) {
            const errorData = JSON.parse(match[1]);
            if (errorData.message) {
              errorMessage = errorData.message;
            }
          } else {
            errorMessage = error.message;
          }
        } catch {
          // If parsing fails, use the error message as is
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };




  const handleViewAgreement = async (agreementId: string) => {
    // Automatically update expired status when viewing agreements
    try {
      await apiRequest('/api/agreements/update-expired', 'POST');
      // Invalidate cache to refresh agreement data
      queryClient.invalidateQueries({ queryKey: ["/api/agreements"] });
    } catch (error) {
      console.log('Auto status update failed:', error);
      // Don't show error to user, just continue with viewing
    }
    
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
      description: "WhatsApp integration will be done soon",
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

  const handleDownloadPoliceVerification = (agreement: any) => {
    const policeVerificationUrl = agreement.documents?.policeVerificationDocument?.url;
    if (policeVerificationUrl) {
      const link = document.createElement('a');
      link.href = policeVerificationUrl;
      link.download = agreement.documents?.policeVerificationDocument?.originalName || `${agreement.agreementNumber}-police-verification.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleUpdateImportedAgreement = async () => {
    try {
      // Get all form data from the new detailed fields
      const updateData = {
        customer: {
          name: (document.getElementById('edit-customer-name') as HTMLInputElement)?.value,
          mobile: (document.getElementById('edit-customer-mobile') as HTMLInputElement)?.value,
        },
        language: (document.querySelector('[name="edit-language"]') as HTMLSelectElement)?.value || 
                 editingImportedAgreement.language || "english",
        ownerDetails: {
          name: (document.getElementById('edit-owner-name') as HTMLInputElement)?.value,
          mobile: (document.getElementById('edit-owner-mobile') as HTMLInputElement)?.value,
          address: (document.getElementById('edit-owner-address') as HTMLTextAreaElement)?.value,
        },
        tenantDetails: {
          name: (document.getElementById('edit-tenant-name') as HTMLInputElement)?.value,
          mobile: (document.getElementById('edit-tenant-mobile') as HTMLInputElement)?.value,
          address: (document.getElementById('edit-tenant-address') as HTMLTextAreaElement)?.value,
        },
        agreementPeriod: {
          startDate: (document.getElementById('edit-start-date') as HTMLInputElement)?.value,
          endDate: (document.getElementById('edit-end-date') as HTMLInputElement)?.value,
          tenure: (document.querySelector('[name="edit-tenure"]') as HTMLSelectElement)?.value || 
                  editingImportedAgreement.agreementPeriod?.tenure || "11_months",
        },
        propertyDetails: {
          address: {
            flatNo: (document.getElementById('edit-flat-no') as HTMLInputElement)?.value,
            society: (document.getElementById('edit-society') as HTMLInputElement)?.value,
            area: (document.getElementById('edit-area') as HTMLInputElement)?.value,
            city: (document.getElementById('edit-city') as HTMLInputElement)?.value,
            state: (document.getElementById('edit-state') as HTMLInputElement)?.value,
            pincode: (document.getElementById('edit-pincode') as HTMLInputElement)?.value,
          },
          purpose: (document.querySelector('[name="edit-purpose"]') as HTMLSelectElement)?.value || 
                   editingImportedAgreement.propertyDetails?.purpose || "residential",
        },
        startDate: (document.getElementById('edit-start-date') as HTMLInputElement)?.value,
        endDate: (document.getElementById('edit-end-date') as HTMLInputElement)?.value,
      };

      await apiRequest(`/api/agreements/${editingImportedAgreement.id}`, "PUT", updateData);

      toast({
        title: "Success",
        description: "Imported agreement updated successfully",
      });

      setEditingImportedAgreement(null);
      queryClient.invalidateQueries({ queryKey: ['/api/agreements'] });
    } catch (error) {
      console.error('Error updating imported agreement:', error);
      toast({
        title: "Error",
        description: "Failed to update imported agreement",
        variant: "destructive",
      });
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
      const data = await apiClient.get(`/api/agreements/${agreement.id}/pdf`);
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
    // Check if agreement is marked as imported (new field)
    return agreement?.isImported === true;
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
            {/* Show customer filter only for admins/staff who can view all agreements */}
            {hasPermission(PERMISSIONS.AGREEMENT_VIEW_ALL) && (
              <Combobox
                options={uniqueCustomers.map((customer) => ({
                  value: customer,
                  label: customer
                }))}
                value={customerFilter === "all" ? "" : customerFilter}
                onValueChange={(value) => setCustomerFilter(value || "all")}
                placeholder="Filter by Customer"
                emptyMessage="No customers found..."
                className="w-full sm:w-48"
                allowCustom={false}
              />
            )}
            <Combobox
              options={uniqueTenants.map((tenant) => ({
                value: tenant,
                label: tenant
              }))}
              value={tenantFilter === "all" ? "" : tenantFilter}
              onValueChange={(value) => setTenantFilter(value || "all")}
              placeholder="Filter by Tenant"
              emptyMessage="No tenants found..."
              className="w-full sm:w-48"
              allowCustom={false}
            />
            <Combobox
              options={uniqueOwners.map((owner) => ({
                value: owner,
                label: owner
              }))}
              value={ownerFilter === "all" ? "" : ownerFilter}
              onValueChange={(value) => setOwnerFilter(value || "all")}
              placeholder="Filter by Owner"
              emptyMessage="No owners found..."
              className="w-full sm:w-48"
              allowCustom={false}
            />
            
            {/* Date Filter */}
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by Date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Dates</SelectItem>
                <SelectItem value="today">Expiring Today</SelectItem>
                <SelectItem value="tomorrow">Expiring Tomorrow</SelectItem>
                <SelectItem value="thisWeek">Expiring This Week</SelectItem>
                <SelectItem value="thisMonth">Expiring This Month</SelectItem>
                <SelectItem value="next3Months">Expiring in 3 Months</SelectItem>
                <SelectItem value="next6Months">Expiring in 6 Months</SelectItem>
                <SelectItem value="thisYear">Expiring This Year</SelectItem>
                <SelectItem value="custom">Custom Expiry Range</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Sort Filter */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-48">
                <span>Sort by</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expiry_status">By Expiry Priority (Default)</SelectItem>
                <SelectItem value="agreement_number_desc">Agreement Number (Newest First)</SelectItem>
                <SelectItem value="agreement_number_asc">Agreement Number (Oldest First)</SelectItem>
                <SelectItem value="expiry_status_asc">Expiry Status (Expired First)</SelectItem>
                <SelectItem value="expiry_status_desc">Expiry Status (Active First)</SelectItem>
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
                  setSortBy("expiry_status");
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
              {/* Create Agreement Button - Show only if user has create permission */}
              {hasPermission(PERMISSIONS.AGREEMENT_CREATE) && (
                <Button onClick={() => setShowWizard(true)} className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Agreement
                </Button>
              )}
              {/* Import Agreement Button - Show only if user has create permission */}
              {hasPermission(PERMISSIONS.AGREEMENT_CREATE) && (
                <Button 
                  onClick={() => setShowImportWizard(true)}
                  variant="outline"
                  className="border-green-600 text-green-600 hover:bg-green-50"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Import Existing Agreement
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Agreements Table */}
        <Card className="border border-gray-200">
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="p-6 text-center text-gray-500">Loading agreements...</div>
            ) : sortedAgreements?.length === 0 ? (
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
                        setSortBy("expiry_status");
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
                    No agreements found. 
                    {hasPermission(PERMISSIONS.AGREEMENT_CREATE) ? (
                      <>
                        Create your first agreement to get started.
                        <Button
                          onClick={() => setShowWizard(true)}
                          className="ml-2 bg-blue-600 hover:bg-blue-700"
                        >
                          Create Agreement
                        </Button>
                      </>
                    ) : (
                      "You don't have permission to create agreements."
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {sortedAgreements?.map((agreement: any, index: number) => (
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
                                <p className="text-xs text-gray-500 mt-1"><SensitivePhone phoneNumber={agreement.customer.mobile} /></p>
                              )}
                            </div>
                            <div>
                              <span className="font-medium text-gray-600">Landlord:</span>
                              <p className="text-gray-900">{agreement.ownerDetails?.name || 'Not provided'}</p>
                              {agreement.ownerDetails?.mobile && (
                                <p className="text-xs text-gray-500 mt-1"><SensitivePhone phoneNumber={agreement.ownerDetails.mobile} /></p>
                              )}
                            </div>
                            <div>
                              <span className="font-medium text-gray-600">Tenant:</span>
                              <p className="text-gray-900">{agreement.tenantDetails?.name || 'Not provided'}</p>
                              {agreement.tenantDetails?.mobile && (
                                <p className="text-xs text-gray-500 mt-1"><SensitivePhone phoneNumber={agreement.tenantDetails.mobile} /></p>
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
                                    return `${formatDateToDDMMYYYY(startDate)} - ${formatDateToDDMMYYYY(endDate)}`;
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
                                      : agreement.notaryStatus === "pending"
                                      ? "bg-amber-100 text-amber-800"
                                      : agreement.notaryStatus === "complete"
                                      ? "bg-green-100 text-green-800"
                                      : agreement.notaryStatus === "expired"
                                      ? "bg-red-100 text-red-800"
                                      : "bg-gray-100 text-gray-800"
                                  }`}
                                >
                                  {agreement.status === "draft"
                                    ? "Complete First"
                                    : agreement.notaryStatus === "pending"
                                    ? "Pending"
                                    : agreement.notaryStatus === "complete"
                                    ? "Complete"
                                    : agreement.notaryStatus === "expired"
                                    ? "Expired"
                                    : "Pending"
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
                          {/* View Button - Show only if user has view permission */}
                          {(hasPermission(PERMISSIONS.AGREEMENT_VIEW_ALL) || hasPermission(PERMISSIONS.AGREEMENT_VIEW_OWN)) && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-10 w-10 p-0 text-blue-600 hover:text-blue-900 hover:bg-blue-100 rounded-full border border-gray-200"
                              onClick={() => isImportedAgreement(agreement) ? setViewingImportedAgreement(agreement) : handleViewAgreement(agreement.id)}
                              title="View Agreement"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                          {/* Download Button - Show only if user has download permission */}
                          {(hasPermission(PERMISSIONS.DOWNLOAD_AGREEMENT_ALL) || hasPermission(PERMISSIONS.DOWNLOAD_AGREEMENT_OWN)) && 
                           agreement.status !== "draft" && (agreement.notarizedDocument?.url || agreement.notarizedDocumentUrl || isImportedAgreement(agreement)) ? (
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
                              <PopoverContent className={isImportedAgreement(agreement) ? "w-64 p-2" : "w-56 p-2"}>
                                <div className="space-y-2">
                                  {isImportedAgreement(agreement) ? (
                                    <>
                                      {/* For imported agreements, show notarized PDF and police verification */}
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-full justify-start text-green-600 hover:text-green-700 hover:bg-green-50"
                                        onClick={() => handleDownloadNotarizedFromTable(agreement)}
                                      >
                                        <Award className="h-4 w-4 mr-2" />
                                        Notarized Agreement PDF
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-full justify-start text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                        onClick={() => handleDownloadPoliceVerification(agreement)}
                                      >
                                        <FileText className="h-4 w-4 mr-2" />
                                        Police Verification
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      {/* For regular agreements, show agreement PDF and notarized document */}
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
                                    </>
                                  )}
                                </div>
                              </PopoverContent>
                            </Popover>
                          ) : (hasPermission(PERMISSIONS.DOWNLOAD_AGREEMENT_ALL) || hasPermission(PERMISSIONS.DOWNLOAD_AGREEMENT_OWN)) && agreement.status !== "draft" ? (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-10 w-10 p-0 text-green-600 hover:text-green-900 hover:bg-green-100 rounded-full border border-gray-200"
                              onClick={() => handleDownloadAgreement(agreement)}
                              title="Download PDF"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          ) : null}
                          {/* Edit Button - Show only if user has edit permission and can edit this agreement */}
                          {(hasPermission(PERMISSIONS.AGREEMENT_EDIT_ALL) || hasPermission(PERMISSIONS.AGREEMENT_EDIT_OWN)) && canEditNotarizedAgreement(agreement) && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-10 w-10 p-0 text-amber-600 hover:text-amber-900 hover:bg-amber-100 rounded-full border border-gray-200"
                              onClick={() => isImportedAgreement(agreement) ? setEditingImportedAgreement(agreement) : setEditingAgreement(agreement)}
                              title="Edit Agreement"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {/* Upload Notarized Button - Show only if user has notarize permission */}
                          {hasPermission(PERMISSIONS.AGREEMENT_NOTARIZE) && agreement.status === "active" && agreement.notaryStatus === "pending" && !(agreement.notarizedDocument?.url || agreement.notarizedDocumentUrl) && (
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
                          {agreement.status !== "draft" && (
                            <>
                              {/* Renew Button - Show only if user has edit permission */}
                              {(hasPermission(PERMISSIONS.AGREEMENT_EDIT_ALL) || hasPermission(PERMISSIONS.AGREEMENT_EDIT_OWN)) && (
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  disabled={true}
                                  className="h-10 w-10 p-0 text-gray-400 bg-gray-100 rounded-full border border-gray-200 cursor-not-allowed opacity-50"
                                  title="Renew Agreement (Coming Soon)"
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              )}
                              {/* WhatsApp Send Button - Show only if user has system admin permission */}
                              {hasPermission(PERMISSIONS.SYSTEM_ADMIN) && (
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
                            </>
                          )}
                          
                          {/* Delete Button - Show only if user has delete permission and agreement is draft */}
                          {(hasPermission(PERMISSIONS.AGREEMENT_DELETE_ALL) || hasPermission(PERMISSIONS.AGREEMENT_DELETE_OWN)) && agreement.status === "draft" && (
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

        {/* Enhanced Dynamic Pagination */}
        {agreementsData && agreementsData.total > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
            <div className="text-sm text-gray-700">
              Showing {((currentPage - 1) * 25) + 1} to {Math.min(currentPage * 25, agreementsData.total)} of{" "}
              {agreementsData.total} results
            </div>
            
            {/* Only show pagination controls if there are multiple pages */}
            {Math.ceil(agreementsData.total / 25) > 1 && (
              <Pagination>
                <PaginationContent>
                  {/* Previous Button */}
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
                      className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      data-testid="button-previous-page"
                    />
                  </PaginationItem>
                  
                  {/* Page Numbers */}
                  {generatePageNumbers(currentPage, Math.ceil(agreementsData.total / 25)).map((page, index) => (
                    <PaginationItem key={index}>
                      {page === '...' ? (
                        <PaginationEllipsis />
                      ) : (
                        <PaginationLink
                          onClick={() => setCurrentPage(page as number)}
                          isActive={currentPage === page}
                          className="cursor-pointer"
                          data-testid={`button-page-${page}`}
                        >
                          {page}
                        </PaginationLink>
                      )}
                    </PaginationItem>
                  ))}
                  
                  {/* Next Button */}
                  <PaginationItem>
                    <PaginationNext 
                      onClick={() => setCurrentPage(page => page + 1)}
                      className={currentPage * 25 >= agreementsData.total ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      data-testid="button-next-page"
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
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

      {/* Simplified Edit Wizard for Imported Agreements */}
      {editingImportedAgreement && (
        <Dialog open={!!editingImportedAgreement} onOpenChange={() => setEditingImportedAgreement(null)}>
          <DialogContent className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader className="flex-shrink-0 bg-gradient-to-r from-blue-50 to-slate-50 p-4 rounded-t-lg border-b border-blue-100">
              <DialogTitle className="text-xl font-semibold text-slate-800 flex items-center gap-2">
                <Edit className="h-5 w-5 text-blue-600" />
                Edit Imported Agreement
                <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700 ml-2">
                  Imported
                </Badge>
              </DialogTitle>
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto p-6">
              <form className="space-y-6" onSubmit={(e) => {
                e.preventDefault();
                // Handle form submission
                handleUpdateImportedAgreement();
              }}>
                {/* Customer Information */}
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
                  <div className="p-4 border-b border-slate-100 bg-slate-50">
                    <h3 className="text-lg font-medium text-slate-800">Customer & Language</h3>
                  </div>
                  <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="edit-customer-name">Customer Name</Label>
                      <Input 
                        id="edit-customer-name"
                        defaultValue={editingImportedAgreement.customer?.name || ''}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-customer-mobile">Mobile</Label>
                      <Input 
                        id="edit-customer-mobile"
                        defaultValue={editingImportedAgreement.customer?.mobile || ''}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-language">Language <span className="text-red-500">*</span></Label>
                      <Select defaultValue={editingImportedAgreement.language || "english"}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select language" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="english">English</SelectItem>
                          <SelectItem value="hindi">Hindi</SelectItem>
                          <SelectItem value="gujarati">Gujarati</SelectItem>
                          <SelectItem value="tamil">Tamil</SelectItem>
                          <SelectItem value="marathi">Marathi</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Landlord Information */}
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
                  <div className="p-4 border-b border-slate-100 bg-slate-50">
                    <h3 className="text-lg font-medium text-slate-800">Landlord Details</h3>
                  </div>
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="edit-owner-name">Name</Label>
                      <Input 
                        id="edit-owner-name"
                        defaultValue={editingImportedAgreement.ownerDetails?.name || ''}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-owner-mobile">Mobile</Label>
                      <Input 
                        id="edit-owner-mobile"
                        defaultValue={editingImportedAgreement.ownerDetails?.mobile || ''}
                        className="mt-1"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="edit-owner-address">Address</Label>
                      <Textarea 
                        id="edit-owner-address"
                        defaultValue={editingImportedAgreement.ownerDetails?.address ? 
                          [
                            editingImportedAgreement.ownerDetails.address.flatNo,
                            editingImportedAgreement.ownerDetails.address.society,
                            editingImportedAgreement.ownerDetails.address.area,
                            editingImportedAgreement.ownerDetails.address.city
                          ].filter(Boolean).join(', ') : ''
                        }
                        className="mt-1"
                        rows={2}
                      />
                    </div>
                  </div>
                </div>

                {/* Tenant Information */}
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
                  <div className="p-4 border-b border-slate-100 bg-slate-50">
                    <h3 className="text-lg font-medium text-slate-800">Tenant Details</h3>
                  </div>
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="edit-tenant-name">Name</Label>
                      <Input 
                        id="edit-tenant-name"
                        defaultValue={editingImportedAgreement.tenantDetails?.name || ''}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-tenant-mobile">Mobile</Label>
                      <Input 
                        id="edit-tenant-mobile"
                        defaultValue={editingImportedAgreement.tenantDetails?.mobile || ''}
                        className="mt-1"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="edit-tenant-address">Address</Label>
                      <Textarea 
                        id="edit-tenant-address"
                        defaultValue={editingImportedAgreement.tenantDetails?.address ? 
                          [
                            editingImportedAgreement.tenantDetails.address.flatNo,
                            editingImportedAgreement.tenantDetails.address.society,
                            editingImportedAgreement.tenantDetails.address.area,
                            editingImportedAgreement.tenantDetails.address.city
                          ].filter(Boolean).join(', ') : ''
                        }
                        className="mt-1"
                        rows={2}
                      />
                    </div>
                  </div>
                </div>

                {/* Agreement Period */}
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
                  <div className="p-4 border-b border-slate-100 bg-slate-50">
                    <h3 className="text-lg font-medium text-slate-800">Agreement Period</h3>
                  </div>
                  <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="edit-start-date">Start Date <span className="text-red-500">*</span></Label>
                      <Input 
                        id="edit-start-date"
                        type="date"
                        defaultValue={editingImportedAgreement.startDate || ''}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-tenure">Agreement Tenure <span className="text-red-500">*</span></Label>
                      <Select defaultValue={editingImportedAgreement.agreementPeriod?.tenure || "11_months"}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select tenure" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="11_months">11 Months</SelectItem>
                          <SelectItem value="custom">Custom Duration</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="edit-end-date">End Date <span className="text-red-500">*</span></Label>
                      <Input 
                        id="edit-end-date"
                        type="date"
                        defaultValue={editingImportedAgreement.endDate || ''}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>

                {/* Property Address */}
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
                  <div className="p-4 border-b border-slate-100 bg-slate-50">
                    <h3 className="text-lg font-medium text-slate-800">Property Address</h3>
                  </div>
                  <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="edit-flat-no">Flat/House No <span className="text-red-500">*</span></Label>
                      <Input 
                        id="edit-flat-no"
                        defaultValue={editingImportedAgreement.propertyDetails?.address?.flatNo || ''}
                        className="mt-1"
                        placeholder="e.g., A-101"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-society">Society/Building <span className="text-red-500">*</span></Label>
                      <Input 
                        id="edit-society"
                        defaultValue={editingImportedAgreement.propertyDetails?.address?.society || ''}
                        className="mt-1"
                        placeholder="e.g., ABC Apartments"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-area">Area <span className="text-red-500">*</span></Label>
                      <Input 
                        id="edit-area"
                        defaultValue={editingImportedAgreement.propertyDetails?.address?.area || ''}
                        className="mt-1"
                        placeholder="e.g., Satellite"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-city">City <span className="text-red-500">*</span></Label>
                      <Input 
                        id="edit-city"
                        defaultValue={editingImportedAgreement.propertyDetails?.address?.city || ''}
                        className="mt-1"
                        placeholder="e.g., Ahmedabad"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-state">State <span className="text-red-500">*</span></Label>
                      <Input 
                        id="edit-state"
                        defaultValue={editingImportedAgreement.propertyDetails?.address?.state || ''}
                        className="mt-1"
                        placeholder="e.g., Gujarat"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-pincode">Pincode <span className="text-red-500">*</span></Label>
                      <Input 
                        id="edit-pincode"
                        defaultValue={editingImportedAgreement.propertyDetails?.address?.pincode || ''}
                        className="mt-1"
                        placeholder="e.g., 380015"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-purpose">Property Purpose <span className="text-red-500">*</span></Label>
                      <Select name="edit-purpose" defaultValue={editingImportedAgreement.propertyDetails?.purpose || "residential"}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select property purpose" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="residential">Residential</SelectItem>
                          <SelectItem value="commercial">Commercial</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Upload Documents */}
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
                  <div className="p-4 border-b border-slate-100 bg-slate-50">
                    <h3 className="text-lg font-medium text-slate-800">Upload Documents</h3>
                  </div>
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <FileText className="h-5 w-5 text-blue-600" />
                        <Label className="text-sm font-medium text-gray-700">Notarized Rent Agreement <span className="text-red-500">*</span></Label>
                      </div>
                      {editingImportedAgreement.notarizedDocument?.url ? (
                        <FilePreview
                          fileUrl={editingImportedAgreement.notarizedDocument.url}
                          fileName={editingImportedAgreement.notarizedDocument.originalName || "Notarized Rent Agreement"}
                          fileType="pdf"
                          onRemove={() => {
                            // Handle document removal - set state to manage document updates
                          }}
                          className="w-full"
                        />
                      ) : (
                        <LocalFileUploader
                          maxSize={5242880} // 5MB
                          onUploadComplete={(result: any) => {
                            // Handle document upload - set state to manage document updates
                          }}
                          className="w-full"
                        >
                          <div className="border-2 border-dashed rounded-lg p-6 text-center transition-all cursor-pointer border-gray-300 bg-gray-50 hover:bg-gray-100">
                            <div className="flex flex-col items-center space-y-2">
                              <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                                <FileText className="w-6 h-6 text-gray-500" />
                              </div>
                              <p className="text-sm text-gray-600">Click to upload notarized agreement</p>
                              <p className="text-xs text-gray-500">PDF only (Max 5MB)</p>
                            </div>
                          </div>
                        </LocalFileUploader>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <Label className="text-sm font-medium text-gray-700">Police Verification Certificate <span className="text-red-500">*</span></Label>
                      </div>
                      {editingImportedAgreement.documents?.policeVerificationDocument?.url ? (
                        <FilePreview
                          fileUrl={editingImportedAgreement.documents.policeVerificationDocument.url}
                          fileName={editingImportedAgreement.documents.policeVerificationDocument.originalName || "Police Verification Certificate"}
                          fileType="pdf"
                          onRemove={() => {
                            // Handle document removal - set state to manage document updates
                          }}
                          className="w-full"
                        />
                      ) : (
                        <LocalFileUploader
                          maxSize={5242880} // 5MB
                          onUploadComplete={(result: any) => {
                            // Handle document upload - set state to manage document updates
                          }}
                          className="w-full"
                        >
                          <div className="border-2 border-dashed rounded-lg p-6 text-center transition-all cursor-pointer border-gray-300 bg-gray-50 hover:bg-gray-100">
                            <div className="flex flex-col items-center space-y-2">
                              <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                                <CheckCircle className="w-6 h-6 text-gray-500" />
                              </div>
                              <p className="text-sm text-gray-600">Click to upload police verification</p>
                              <p className="text-xs text-gray-500">PDF only (Max 5MB)</p>
                            </div>
                          </div>
                        </LocalFileUploader>
                      )}
                    </div>
                  </div>

                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mx-4 mb-4">
                    <div className="flex items-start space-x-2">
                      <FileCheck className="w-5 h-5 text-blue-600 mt-0.5" />
                      <div className="text-sm text-blue-800">
                        <p className="font-medium">Document Requirements:</p>
                        <ul className="mt-1 space-y-1 text-blue-700">
                          <li>• Both documents are required and must be in PDF format</li>
                          <li>• Maximum file size: 5MB per document</li>
                          <li>• Documents should be clear and legible</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="bg-gradient-to-r from-slate-50 to-slate-100 p-6 rounded-lg border border-slate-200 shadow-sm">
                  <div className="flex justify-center gap-3">
                    <Button
                      type="submit"
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 shadow-sm"
                    >
                      Save Changes
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEditingImportedAgreement(null)}
                      className="border-slate-300 hover:bg-slate-50 px-6 py-2 shadow-sm"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </form>
            </div>
          </DialogContent>
        </Dialog>
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
              {/* Agreement Details - Moved to top and renamed */}
              <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                <div className="bg-gradient-to-r from-slate-600 to-slate-700 px-6 py-4">
                  <h3 className="text-lg font-semibold text-white flex items-center">
                    <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center mr-3">
                      <span className="text-xs font-bold text-white">📋</span>
                    </div>
                    Agreement Details
                  </h3>
                </div>
                <div className="bg-slate-50 p-6">
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div>
                      <label className="text-sm font-medium text-slate-700">Agreement Number</label>
                      <p className="mt-1 text-sm text-gray-900 font-mono font-bold">{viewingAgreement.agreementNumber || 'Not assigned'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Agreement Date</label>
                      <p className="mt-1 text-sm text-gray-900">{viewingAgreement.agreementDate ? formatDateToDDMMYYYY(viewingAgreement.agreementDate) : 'Not set'}</p>
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

              {/* Customer Details */}
              <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                <div className="bg-gradient-to-r from-slate-600 to-slate-700 px-6 py-4">
                  <h3 className="text-lg font-semibold text-white flex items-center">
                    <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center mr-3">
                      <span className="text-xs font-bold text-white">1</span>
                    </div>
                    Customer Details
                  </h3>
                </div>
                <div className="bg-slate-50 p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div>
                      <label className="text-sm font-medium text-slate-700">Customer Name</label>
                      <p className="mt-1 text-sm text-gray-900 font-medium">{viewingAgreement.customer?.name || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Email</label>
                      <p className="mt-1 text-sm text-gray-900">{viewingAgreement.customer?.email || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Mobile</label>
                      <p className="mt-1 text-sm text-gray-900"><SensitivePhone phoneNumber={viewingAgreement.customer?.mobile || 'Not provided'} /></p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Landlord Details */}
              <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                <div className="bg-gradient-to-r from-slate-600 to-slate-700 px-6 py-4">
                  <h3 className="text-lg font-semibold text-white flex items-center">
                    <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center mr-3">
                      <span className="text-xs font-bold text-white">2</span>
                    </div>
                    Landlord Details
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
                      <p className="mt-1 text-sm text-gray-900"><SensitivePhone phoneNumber={viewingAgreement.ownerDetails?.mobile || 'Not provided'} /></p>
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
                      <span className="text-xs font-bold text-white">3</span>
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
                      <p className="mt-1 text-sm text-gray-900"><SensitivePhone phoneNumber={viewingAgreement.tenantDetails?.mobile || 'Not provided'} /></p>
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
                      <span className="text-xs font-bold text-white">4</span>
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
                        <SensitiveAddress 
                          address={viewingAgreement.propertyDetails?.address ? 
                            `${viewingAgreement.propertyDetails.address.flatNo || ''}, ${viewingAgreement.propertyDetails.address.society || ''}, ${viewingAgreement.propertyDetails.address.area || ''}, ${viewingAgreement.propertyDetails.address.city || ''}, ${viewingAgreement.propertyDetails.address.state || ''} - ${viewingAgreement.propertyDetails.address.pincode || ''}` 
                            : 'Not provided'}
                        />
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
                      <span className="text-xs font-bold text-white">5</span>
                    </div>
                    Rental Terms
                  </h3>
                </div>
                <div className="bg-slate-50 p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div>
                      <label className="text-sm font-medium text-slate-700">Monthly Rent</label>
                      <p className="mt-1 text-lg text-gray-900 font-bold text-green-600"><SensitiveAmount amount={viewingAgreement.rentalTerms?.monthlyRent} /></p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Security Deposit</label>
                      <p className="mt-1 text-lg text-gray-900 font-bold text-blue-600"><SensitiveAmount amount={viewingAgreement.rentalTerms?.securityDeposit} /></p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Duration</label>
                      <p className="mt-1 text-sm text-gray-900">{viewingAgreement.rentalTerms?.duration || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Start Date</label>
                      <p className="mt-1 text-sm text-gray-900">{viewingAgreement.rentalTerms?.startDate ? formatDateToDDMMYYYY(viewingAgreement.rentalTerms.startDate) : 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">End Date</label>
                      <p className="mt-1 text-sm text-gray-900">{viewingAgreement.rentalTerms?.endDate ? formatDateToDDMMYYYY(viewingAgreement.rentalTerms.endDate) : 'Not provided'}</p>
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
                      <span className="text-xs font-bold text-white">6</span>
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


              {/* Documents Section */}
              <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                <div className="bg-gradient-to-r from-slate-600 to-slate-700 px-6 py-4">
                  <h3 className="text-lg font-semibold text-white flex items-center">
                    <FileText className="h-5 w-5 mr-3 text-white" />
                    Documents
                  </h3>
                </div>
                <div className="bg-slate-50 p-6">
                  <div className="space-y-4">
                    {/* Agreement PDF */}
                    <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
                      <div className="p-4 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-green-100 rounded-lg">
                            <FileText className="h-5 w-5 text-green-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">Agreement PDF</p>
                            <p className="text-xs text-gray-500">Generated agreement document</p>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(`/api/agreements/${viewingAgreement.id}/view`, '_blank')}
                            className="border-green-300 hover:bg-green-50"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => downloadAgreementPdf(viewingAgreement)}
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Notarized Document */}
                    {(viewingAgreement.notarizedDocument?.url || viewingAgreement.notarizedDocumentUrl) ? (
                      <div className="bg-white rounded-lg border border-amber-200 shadow-sm">
                        <div className="p-4 flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="p-2 bg-amber-100 rounded-lg">
                              <Award className="h-5 w-5 text-amber-600" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">Notarized Agreement Document</p>
                              <p className="text-xs text-gray-500">Uploaded notarized document</p>
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(viewingAgreement.notarizedDocument?.url || viewingAgreement.notarizedDocumentUrl, '_blank')}
                              className="border-amber-300 hover:bg-amber-50"
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => downloadNotarizedDocument(viewingAgreement)}
                              className="bg-amber-600 hover:bg-amber-700 text-white"
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
                        <div className="p-4 text-center">
                          <div className="flex flex-col items-center space-y-3">
                            <div className="p-3 bg-slate-100 rounded-lg">
                              <Award className="h-6 w-6 text-slate-400" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-900">No notarized document uploaded</p>
                              <p className="text-xs text-slate-500 mt-1">Upload the notarized agreement once available</p>
                            </div>
                            <Button
                              onClick={handleNotarizedFileSelect}
                              disabled={uploadingNotarized}
                              size="sm"
                              className="bg-slate-600 hover:bg-slate-700 text-white"
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              {uploadingNotarized ? 'Uploading...' : 'Upload Notarized Document'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="bg-gradient-to-r from-slate-50 to-slate-100 p-6 rounded-lg border border-slate-200 shadow-sm">
                <div className="flex flex-wrap justify-center gap-3">
                  {canEditNotarizedAgreement(viewingAgreement) && (
                    <Button
                      onClick={() => {
                        if (isImportedAgreement(viewingAgreement)) {
                          setEditingImportedAgreement(viewingAgreement);
                          setViewingAgreement(null);
                        } else {
                          setEditingAgreement(viewingAgreement);
                          setViewingAgreement(null);
                        }
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 shadow-sm"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Agreement
                    </Button>
                  )}
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

      {/* Imported Agreement View Modal - Simplified View */}
      <Dialog open={!!viewingImportedAgreement} onOpenChange={() => setViewingImportedAgreement(null)}>
        <DialogContent className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0 bg-gradient-to-r from-blue-50 to-slate-50 p-4 rounded-t-lg border-b border-blue-100">
            <DialogTitle className="text-xl font-semibold text-slate-800 flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Imported Agreement Details
              <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700 ml-2">
                Imported
              </Badge>
            </DialogTitle>
          </DialogHeader>
          
          {viewingImportedAgreement && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Customer Information */}
              {viewingImportedAgreement.customer && (
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
                  <div className="p-4 border-b border-slate-100 bg-slate-50">
                    <h3 className="text-lg font-medium text-slate-800">Customer Information</h3>
                  </div>
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {viewingImportedAgreement.customer.name && (
                      <div>
                        <span className="text-sm font-medium text-slate-600">Customer Name:</span>
                        <p className="text-slate-900">{viewingImportedAgreement.customer.name}</p>
                      </div>
                    )}
                    {viewingImportedAgreement.customer.mobile && (
                      <div>
                        <span className="text-sm font-medium text-slate-600">Mobile:</span>
                        <p className="text-slate-900"><SensitivePhone phoneNumber={viewingImportedAgreement.customer.mobile} /></p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Landlord Information */}
              {viewingImportedAgreement.ownerDetails && (
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
                  <div className="p-4 border-b border-slate-100 bg-slate-50">
                    <h3 className="text-lg font-medium text-slate-800">Landlord Details</h3>
                  </div>
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {viewingImportedAgreement.ownerDetails.name && (
                      <div>
                        <span className="text-sm font-medium text-slate-600">Name:</span>
                        <p className="text-slate-900">{viewingImportedAgreement.ownerDetails.name}</p>
                      </div>
                    )}
                    {viewingImportedAgreement.ownerDetails.mobile && (
                      <div>
                        <span className="text-sm font-medium text-slate-600">Mobile:</span>
                        <p className="text-slate-900"><SensitivePhone phoneNumber={viewingImportedAgreement.ownerDetails.mobile} /></p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tenant Information */}
              {viewingImportedAgreement.tenantDetails && (
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
                  <div className="p-4 border-b border-slate-100 bg-slate-50">
                    <h3 className="text-lg font-medium text-slate-800">Tenant Details</h3>
                  </div>
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {viewingImportedAgreement.tenantDetails.name && (
                      <div>
                        <span className="text-sm font-medium text-slate-600">Name:</span>
                        <p className="text-slate-900">{viewingImportedAgreement.tenantDetails.name}</p>
                      </div>
                    )}
                    {viewingImportedAgreement.tenantDetails.mobile && (
                      <div>
                        <span className="text-sm font-medium text-slate-600">Mobile:</span>
                        <p className="text-slate-900"><SensitivePhone phoneNumber={viewingImportedAgreement.tenantDetails.mobile} /></p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Property Details */}
              {viewingImportedAgreement.propertyDetails && (
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
                  <div className="p-4 border-b border-slate-100 bg-slate-50">
                    <h3 className="text-lg font-medium text-slate-800">Property Details</h3>
                  </div>
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {viewingImportedAgreement.propertyDetails.address && (
                      <div className="md:col-span-2">
                        <span className="text-sm font-medium text-slate-600">Property Address:</span>
                        <p className="text-slate-900">
                          <SensitiveAddress 
                            address={[
                              viewingImportedAgreement.propertyDetails.address.flatNo,
                              viewingImportedAgreement.propertyDetails.address.society,
                              viewingImportedAgreement.propertyDetails.address.area,
                              viewingImportedAgreement.propertyDetails.address.city
                            ].filter(Boolean).join(', ')}
                          />
                        </p>
                      </div>
                    )}
                    {viewingImportedAgreement.propertyDetails.purpose && (
                      <div>
                        <span className="text-sm font-medium text-slate-600">Purpose:</span>
                        <p className="text-slate-900">{viewingImportedAgreement.propertyDetails.purpose}</p>
                      </div>
                    )}
                    {viewingImportedAgreement.rentalTerms?.monthlyRent && (
                      <div>
                        <span className="text-sm font-medium text-slate-600">Monthly Rent:</span>
                        <p className="text-slate-900"><SensitiveAmount amount={viewingImportedAgreement.rentalTerms.monthlyRent} /></p>
                      </div>
                    )}
                    {viewingImportedAgreement.rentalTerms?.securityDeposit && (
                      <div>
                        <span className="text-sm font-medium text-slate-600">Security Deposit:</span>
                        <p className="text-slate-900"><SensitiveAmount amount={viewingImportedAgreement.rentalTerms.securityDeposit} /></p>
                      </div>
                    )}
                    {(viewingImportedAgreement.startDate || viewingImportedAgreement.endDate) && (
                      <div className="md:col-span-2">
                        <span className="text-sm font-medium text-slate-600">Agreement Period:</span>
                        <p className="text-slate-900">
                          {viewingImportedAgreement.startDate ? formatDateToDDMMYYYY(viewingImportedAgreement.startDate) : 'N/A'} to {viewingImportedAgreement.endDate ? formatDateToDDMMYYYY(viewingImportedAgreement.endDate) : 'N/A'}
                        </p>
                      </div>
                    )}
                    {viewingImportedAgreement.agreementNumber && (
                      <div>
                        <span className="text-sm font-medium text-slate-600">Agreement Number:</span>
                        <p className="text-slate-900 font-mono">{viewingImportedAgreement.agreementNumber}</p>
                      </div>
                    )}
                    {viewingImportedAgreement.status && (
                      <div>
                        <span className="text-sm font-medium text-slate-600">Status:</span>
                        <Badge variant="outline" className={getStatusBadge(viewingImportedAgreement.status)}>
                          {viewingImportedAgreement.status}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Uploaded Documents */}
              <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
                <div className="p-4 border-b border-slate-100 bg-slate-50">
                  <h3 className="text-lg font-medium text-slate-800">Uploaded Documents</h3>
                </div>
                <div className="p-4 space-y-4">
                  {/* Notarized Document */}
                  {viewingImportedAgreement.notarizedDocument?.url && (
                    <div className="border border-green-200 rounded-lg bg-green-50">
                      <div className="p-4 border-b border-green-100">
                        <h4 className="text-sm font-medium text-green-900">Notarized Agreement Document</h4>
                      </div>
                      <div className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-green-100 rounded-lg">
                            <Award className="h-5 w-5 text-green-600" />
                          </div>
                          <span className="text-sm text-green-800">
                            {viewingImportedAgreement.notarizedDocument.originalName || 'Notarized Document'}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(viewingImportedAgreement.notarizedDocument.url, '_blank')}
                            className="border-green-300 hover:bg-green-50"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = viewingImportedAgreement.notarizedDocument.url;
                              link.download = viewingImportedAgreement.notarizedDocument.originalName;
                              link.click();
                            }}
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Police Verification Document */}
                  {viewingImportedAgreement.documents?.policeVerificationDocument?.url && (
                    <div className="border border-blue-200 rounded-lg bg-blue-50">
                      <div className="p-4 border-b border-blue-100">
                        <h4 className="text-sm font-medium text-blue-900">Police Verification Document</h4>
                      </div>
                      <div className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <FileText className="h-5 w-5 text-blue-600" />
                          </div>
                          <span className="text-sm text-blue-800">
                            {viewingImportedAgreement.documents.policeVerificationDocument.originalName || 'Police Verification Document'}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(viewingImportedAgreement.documents.policeVerificationDocument.url, '_blank')}
                            className="border-blue-300 hover:bg-blue-50"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = viewingImportedAgreement.documents.policeVerificationDocument.url;
                              link.download = viewingImportedAgreement.documents.policeVerificationDocument.originalName;
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
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="bg-gradient-to-r from-slate-50 to-slate-100 p-6 rounded-lg border border-slate-200 shadow-sm">
                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    onClick={() => setViewingImportedAgreement(null)}
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
