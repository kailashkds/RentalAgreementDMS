import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAgreements } from "@/hooks/useAgreements";
import {
  Upload,
  Search,
  Eye,
  Download,
  File,
  CheckCircle,
  Clock,
  FileText,
  Calendar,
  AlertCircle,
  Trash2
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function NotarizedDocuments() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [uploadingNotarized, setUploadingNotarized] = useState<string | null>(null);
  const [removingNotarized, setRemovingNotarized] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: agreementsData, isLoading } = useAgreements({
    search: searchTerm,
    status: statusFilter === "all" ? "" : statusFilter,
    limit: 20,
    offset: (currentPage - 1) * 20,
  });

  const agreements = agreementsData?.agreements || [];

  const handleUploadNotarizedDocument = async (agreementId: string, file: File) => {
    setUploadingNotarized(agreementId);
    try {
      const formData = new FormData();
      formData.append('notarizedDocument', file);

      const response = await fetch(`/api/agreements/${agreementId}/upload-notarized`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        
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
      setUploadingNotarized(null);
    }
  };

  const handleNotarizedFileSelect = (agreementId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        if (file.type !== 'application/pdf') {
          toast({
            title: "Invalid File Type",
            description: "Please select a PDF file for notarized document.",
            variant: "destructive",
          });
          return;
        }
        handleUploadNotarizedDocument(agreementId, file);
      }
    };
    input.click();
  };

  const handleRemoveNotarizedDocument = async (agreementId: string, agreementNumber: string) => {
    if (!confirm(`Are you sure you want to remove the notarized document for agreement ${agreementNumber}? This action cannot be undone.`)) {
      return;
    }

    setRemovingNotarized(agreementId);
    try {
      const response = await fetch(`/api/agreements/${agreementId}/notarized-document`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Invalidate cache to refresh data
        queryClient.invalidateQueries({ queryKey: ["/api/agreements"] });

        toast({
          title: "Notarized Document Removed",
          description: `Successfully removed notarized document for ${agreementNumber}`,
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove notarized document');
      }
    } catch (error) {
      console.error('Notarized remove error:', error);
      toast({
        title: "Remove Error",
        description: error instanceof Error ? error.message : "Failed to remove notarized document.",
        variant: "destructive",
      });
    } finally {
      setRemovingNotarized(null);
    }
  };

  const getNotarizedStatus = (agreement: any) => {
    if (agreement.notarizedDocument && agreement.notarizedDocument.filename) {
      return 'completed';
    }
    return 'pending';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'pending':
        return <Clock className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const filteredAgreements = agreements.filter(agreement => {
    const matchesSearch = !searchTerm || 
      agreement.agreementNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agreement.ownerDetails?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agreement.tenantDetails?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (statusFilter === 'notarized') {
      return matchesSearch && getNotarizedStatus(agreement) === 'completed';
    } else if (statusFilter === 'pending') {
      return matchesSearch && getNotarizedStatus(agreement) === 'pending';
    }
    
    return matchesSearch;
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Notarized Documents</h1>
            <p className="text-gray-600 mt-2">Manage and track notarized rental agreements</p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by agreement number, owner, or tenant..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Agreements</SelectItem>
                  <SelectItem value="notarized">Notarized</SelectItem>
                  <SelectItem value="pending">Pending Notarization</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Agreements</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{agreements.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Notarized</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {agreements.filter(a => getNotarizedStatus(a) === 'completed').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {agreements.filter(a => getNotarizedStatus(a) === 'pending').length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Agreements List */}
        <Card>
          <CardHeader>
            <CardTitle>Agreements Overview</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Loading agreements...</p>
              </div>
            ) : filteredAgreements.length === 0 ? (
              <div className="text-center py-8">
                <File className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No agreements found</h3>
                <p className="text-gray-600">
                  {searchTerm ? "Try adjusting your search criteria." : "No agreements match the selected filters."}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredAgreements.map((agreement) => {
                  const notarizedStatus = getNotarizedStatus(agreement);
                  const isUploading = uploadingNotarized === agreement.id;
                  const isRemoving = removingNotarized === agreement.id;
                  
                  return (
                    <div key={agreement.id} className="relative border border-gray-200 rounded-lg p-6 bg-white hover:bg-gray-50 transition-colors group">
                      {/* Remove button - top right corner of document card */}
                      {notarizedStatus === 'completed' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveNotarizedDocument(agreement.id, agreement.agreementNumber)}
                          disabled={isUploading || isRemoving}
                          className="absolute -top-2 -right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 hover:bg-red-600 text-white rounded-full z-10"
                          title="Remove notarized document"
                        >
                          <span className="text-xs">×</span>
                        </Button>
                      )}
                      
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {agreement.agreementNumber}
                            </h3>
                            <Badge className={`${getStatusBadge(notarizedStatus)} flex items-center gap-1`}>
                              {getStatusIcon(notarizedStatus)}
                              {notarizedStatus === 'completed' ? 'Notarized' : 'Pending'}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="font-medium text-gray-700">Owner:</span>
                              <p className="text-gray-900">{agreement.ownerDetails?.name || 'Not provided'}</p>
                            </div>
                            <div>
                              <span className="font-medium text-gray-700">Tenant:</span>
                              <p className="text-gray-900">{agreement.tenantDetails?.name || 'Not provided'}</p>
                            </div>
                            <div>
                              <span className="font-medium text-gray-700">Monthly Rent:</span>
                              <p className="text-gray-900 font-semibold text-green-600">
                                ₹{agreement.rentalTerms?.monthlyRent || 'Not set'}
                              </p>
                            </div>
                            <div>
                              <span className="font-medium text-gray-700">Agreement Date:</span>
                              <p className="text-gray-900">
                                {agreement.agreementDate ? new Date(agreement.agreementDate).toLocaleDateString() : 'Not set'}
                              </p>
                            </div>
                            <div>
                              <span className="font-medium text-gray-700">Status:</span>
                              <p className="text-gray-900 capitalize">{agreement.status}</p>
                            </div>
                            {notarizedStatus === 'completed' && (
                              <div>
                                <span className="font-medium text-gray-700">Notarized On:</span>
                                <p className="text-gray-900">
                                  {new Date(agreement.notarizedDocument.uploadDate).toLocaleDateString()}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="lg:min-w-max">
                          {notarizedStatus === 'completed' ? (
                            <div className="flex flex-col gap-2 min-w-32">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(agreement.notarizedDocument.url, '_blank')}
                                className="flex items-center gap-2 w-full justify-start"
                                disabled={isRemoving}
                              >
                                <Eye className="h-4 w-4" />
                                View
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => {
                                  const link = document.createElement('a');
                                  link.href = agreement.notarizedDocument.url;
                                  link.download = agreement.notarizedDocument.originalName;
                                  link.click();
                                }}
                                className="flex items-center gap-2 w-full justify-start bg-slate-600 hover:bg-slate-700"
                                disabled={isRemoving}
                              >
                                <Download className="h-4 w-4" />
                                Download
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleNotarizedFileSelect(agreement.id)}
                                disabled={isUploading || isRemoving}
                                className="flex items-center gap-2 w-full justify-start"
                              >
                                <Upload className="h-4 w-4" />
                                {isUploading ? 'Uploading...' : 'Replace'}
                              </Button>
                            </div>
                          ) : (
                            <Button
                              onClick={() => handleNotarizedFileSelect(agreement.id)}
                              disabled={isUploading}
                              className="flex items-center gap-2 bg-slate-600 hover:bg-slate-700"
                            >
                              <Upload className="h-4 w-4" />
                              {isUploading ? 'Uploading...' : 'Upload Notarized'}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}