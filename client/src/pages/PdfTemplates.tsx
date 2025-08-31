import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Eye, Download } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePdfTemplates } from "@/hooks/usePdfTemplates";
import PdfTemplateEditor from "@/components/PdfTemplateEditor";
import AdminLayout from "@/components/AdminLayout";
import type { PdfTemplate } from "@shared/schema";
import { formatDateToDDMMYYYY } from "@/lib/dateUtils";

const DOCUMENT_TYPES = [
  { value: "rental_agreement", label: "Rental Agreement" },
  { value: "promissory_note", label: "Promissory Note" },
  { value: "power_of_attorney", label: "Power of Attorney" },
  { value: "lease_deed", label: "Lease Deed" },
];

const LANGUAGES = [
  { value: "english", label: "English" },
  { value: "hindi", label: "Hindi (हिन्दी)" },
  { value: "gujarati", label: "Gujarati (ગુજરાતી)" },
  { value: "tamil", label: "Tamil (தமிழ்)" },
  { value: "marathi", label: "Marathi (मराठी)" },
];

export default function PdfTemplates() {
  const [selectedTemplate, setSelectedTemplate] = useState<PdfTemplate | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [filters, setFilters] = useState({
    documentType: "all",
    language: "all",
  });
  const { toast } = useToast();

  // Fetch templates with filters
  const { 
    templates, 
    isLoading, 
    createTemplate, 
    updateTemplate, 
    deleteTemplate,
    isCreating,
    isUpdating,
    isDeleting 
  } = usePdfTemplates(
    filters.documentType === "all" ? "" : filters.documentType,
    filters.language === "all" ? "" : filters.language
  );

  // Handle template operations with toast notifications
  const handleDeleteWithToast = (id: string) => {
    if (confirm("Are you sure you want to delete this template?")) {
      deleteTemplate(id, {
        onSuccess: () => {
          toast({
            title: "Success",
            description: "Template deleted successfully",
          });
        },
        onError: (error: Error) => {
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive",
          });
        },
      });
    }
  };

  const handleEdit = (template: PdfTemplate) => {
    setSelectedTemplate(template);
    setShowEditor(true);
  };

  const handleCreate = () => {
    setSelectedTemplate(null);
    setShowEditor(true);
  };



  const handlePreview = (template: PdfTemplate) => {
    // Open preview in new window
    const previewWindow = window.open("", "_blank");
    if (previewWindow) {
      previewWindow.document.write(`
        <html>
          <head>
            <title>Template Preview - ${template.name}</title>
            <meta charset="UTF-8">
            <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Gujarati:wght@300;400;500;600;700&family=Noto+Sans+Devanagari:wght@300;400;500;600;700&family=Noto+Sans+Tamil:wght@300;400;500;600;700&display=swap" rel="stylesheet">
            <style>
              @page {
                margin: 15mm 10mm 15mm 10mm;
                @bottom-center { 
                  content: "Page " counter(page) " of " counter(pages);
                  font-size: 10px;
                  color: #666;
                }
                @bottom-left { content: none; }
                @bottom-right { content: none; }
                @top-center { content: none; }
                @top-left { content: none; }
                @top-right { content: none; }
              }
              
              /* Remove page numbers from document image pages */
              .document-page {
                page: document-pages;
              }
              
              @page document-pages {
                margin: 15mm 10mm 15mm 10mm;
                @bottom-center { content: none; }
                @bottom-left { content: none; }
                @bottom-right { content: none; }
                @top-center { content: none; }
                @top-left { content: none; }
                @top-right { content: none; }
              }
              
              body { 
                font-family: ${template.language === 'gujarati' 
                  ? '"Noto Sans Gujarati", "Shruti", "Lohit Gujarati", system-ui, Arial, sans-serif' 
                  : template.language === 'hindi'
                  ? '"Noto Sans Devanagari", "Mangal", "Lohit Devanagari", system-ui, Arial, sans-serif'
                  : template.language === 'tamil'
                  ? '"Noto Sans Tamil", "Latha", "Lohit Tamil", system-ui, Arial, sans-serif'
                  : template.language === 'marathi'
                  ? '"Noto Sans Devanagari", "Mangal", "Lohit Devanagari", system-ui, Arial, sans-serif'
                  : 'Arial, sans-serif'}; 
                margin: 0;
                padding: 20px;
                font-size: 14px;
                line-height: 1.5;
                font-weight: 400;
                text-rendering: optimizeLegibility;
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
                font-feature-settings: "kern" 1, "liga" 1;
                background: white;
              }
              
              .template-content {
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
                background: white;
                box-shadow: 0 0 10px rgba(0,0,0,0.1);
                min-height: 1056px;
              }
              
              .gujarati-content, .gujarati-content * {
                font-family: "Noto Sans Gujarati", "Shruti", "Lohit Gujarati", system-ui, Arial, sans-serif !important;
              }
              
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
              
              div[style*="party-details"] p {
                margin: 2px 0 !important;
              }
              
              /* Passport photo styling */
              div[style*="130px"][style*="160px"] {
                border: 1px dashed #000 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                background: #f9f9f9 !important;
                font-size: 12px !important;
                text-align: center !important;
              }
              .preview-header { border-bottom: 2px solid #ccc; margin-bottom: 20px; padding-bottom: 10px; }
              
              /* Page break control classes for PDF generation */
              .no-page-break,
              .keep-together,
              .agreement-section,
              .clause-section,
              .signature-section,
              .terms-section {
                page-break-inside: avoid;
                break-inside: avoid;
                border: 1px dashed #ccc;
                margin: 5px 0;
                padding: 5px;
              }
              
              .page-break-before {
                page-break-before: always;
                break-before: page;
                border-top: 2px solid #ff6b6b;
                margin-top: 20px;
              }
              
              .page-break-after {
                page-break-after: always;
                break-after: page;
                border-bottom: 2px solid #ff6b6b;
                margin-bottom: 20px;
              }
              
              @media print {
                .no-page-break,
                .keep-together,
                .agreement-section,
                .clause-section,
                .signature-section,
                .terms-section {
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                  border: none;
                }
                
                .page-break-before {
                  page-break-before: always !important;
                  break-before: page !important;
                  border-top: none;
                }
                
                .page-break-after {
                  page-break-after: always !important;
                  break-after: page !important;
                  border-bottom: none;
                }
              }
            </style>
          </head>
          <body>
            <div class="preview-header">
              <h1>Preview: ${template.name}</h1>
              <p><strong>Type:</strong> ${template.documentType} | <strong>Language:</strong> ${template.language}</p>
            </div>
            <div class="template-content">
              ${template.htmlTemplate}
            </div>
          </body>
        </html>
      `);
    }
  };

  const getDocumentTypeLabel = (type: string) => {
    return DOCUMENT_TYPES.find(dt => dt.value === type)?.label || type;
  };

  const getLanguageLabel = (lang: string) => {
    return LANGUAGES.find(l => l.value === lang)?.label || lang;
  };

  return (
    <AdminLayout title="PDF Templates">
      <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">PDF Templates</h1>
          <p className="text-gray-600 mt-1">Manage document templates for automatic PDF generation</p>
        </div>
        <Button onClick={handleCreate} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="mr-2 h-4 w-4" />
          Create Template
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="documentType">Document Type</Label>
              <Select value={filters.documentType} onValueChange={(value) => 
                setFilters(prev => ({ ...prev, documentType: value }))
              }>
                <SelectTrigger>
                  <SelectValue placeholder="All document types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All document types</SelectItem>
                  {DOCUMENT_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="language">Language</Label>
              <Select value={filters.language} onValueChange={(value) => 
                setFilters(prev => ({ ...prev, language: value }))
              }>
                <SelectTrigger>
                  <SelectValue placeholder="All languages" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All languages</SelectItem>
                  {LANGUAGES.map(lang => (
                    <SelectItem key={lang.value} value={lang.value}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Templates Table */}
      <Card>
        <CardHeader>
          <CardTitle>Templates ({templates.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading templates...</div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No templates found. Create your first template to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Document Type</TableHead>
                  <TableHead>Language</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium">{template.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getDocumentTypeLabel(template.documentType)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {getLanguageLabel(template.language)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={template.isActive ? "default" : "destructive"}>
                        {template.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {template.createdAt ? formatDateToDDMMYYYY(template.createdAt) : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handlePreview(template)}
                          title="Preview Template"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleEdit(template)}
                          title="Edit Template"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDeleteWithToast(template.id)}
                          title="Delete Template"
                          disabled={isDeleting}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Template Editor Modal */}
      {showEditor && (
        <PdfTemplateEditor
          template={selectedTemplate}
          isOpen={showEditor}
          onClose={() => setShowEditor(false)}
          onSave={(templateData) => {
            if (selectedTemplate) {
              updateTemplate({ id: selectedTemplate.id, data: templateData }, {
                onSuccess: () => {
                  toast({
                    title: "Success",
                    description: "Template updated successfully",
                  });
                  setShowEditor(false);
                },
                onError: (error: Error) => {
                  toast({
                    title: "Error", 
                    description: error.message,
                    variant: "destructive",
                  });
                },
              });
            } else {
              createTemplate(templateData, {
                onSuccess: () => {
                  toast({
                    title: "Success",
                    description: "Template created successfully",
                  });
                  setShowEditor(false);
                },
                onError: (error: Error) => {
                  toast({
                    title: "Error",
                    description: error.message, 
                    variant: "destructive",
                  });
                },
              });
            }
          }}
        />
      )}
      </div>
    </AdminLayout>
  );
}