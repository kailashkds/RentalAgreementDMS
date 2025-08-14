import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Eye, 
  FileText, 
  Download,
  Copy,
  Settings,
  AlertCircle,
  CheckCircle
} from "lucide-react";
import type { WordTemplate, InsertWordTemplate } from "@shared/schema";
import { z } from "zod";

const wordTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  documentType: z.string().min(1, "Document type is required"),
  language: z.string().min(1, "Language is required"),
  templateStructure: z.any(),
  dynamicFields: z.any().optional(),
  conditionalRules: z.any().optional(),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
});

interface TemplateSection {
  type: 'title' | 'paragraph' | 'signature' | 'table' | 'witness' | 'documents';
  content: string;
  formatting: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    alignment?: 'left' | 'center' | 'right' | 'justify';
    fontSize?: number;
    spacing?: { before?: number; after?: number };
    indent?: number;
  };
  fields?: string[]; // Dynamic field placeholders
  conditional?: string; // Condition for display
}

interface WordTemplateStructure {
  sections: TemplateSection[];
  pageSettings: {
    margins: { top: number; right: number; bottom: number; left: number };
    orientation: 'portrait' | 'landscape';
  };
  defaultFont: string;
  defaultSize: number;
}

export default function WordTemplates() {
  const [editingTemplate, setEditingTemplate] = useState<WordTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<WordTemplate | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof wordTemplateSchema>>({
    resolver: zodResolver(wordTemplateSchema),
    defaultValues: {
      name: "",
      documentType: "rental_agreement",
      language: "english",
      templateStructure: {
        sections: [],
        pageSettings: {
          margins: { top: 1080, right: 720, bottom: 1080, left: 720 },
          orientation: 'portrait'
        },
        defaultFont: "Arial",
        defaultSize: 28
      },
      dynamicFields: [],
      conditionalRules: [],
      isActive: true,
      isDefault: false,
    },
  });

  const { data: templates, isLoading } = useQuery<WordTemplate[]>({
    queryKey: ["/api/word-templates"],
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (data: InsertWordTemplate) => {
      return apiRequest("POST", "/api/word-templates", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/word-templates"] });
      toast({ title: "Word template created successfully" });
      setShowCreateDialog(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create template",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<WordTemplate> }) => {
      return apiRequest("PUT", `/api/word-templates/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/word-templates"] });
      toast({ title: "Template updated successfully" });
      setEditingTemplate(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update template",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/word-templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/word-templates"] });
      toast({ title: "Template deleted successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete template",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredTemplates = templates?.filter(
    template => selectedLanguage === "all" || template.language === selectedLanguage
  ) || [];

  const onSubmit = (data: z.infer<typeof wordTemplateSchema>) => {
    createTemplateMutation.mutate({
      ...data,
      templateStructure: data.templateStructure || {
        sections: [],
        pageSettings: {
          margins: { top: 1080, right: 720, bottom: 1080, left: 720 },
          orientation: 'portrait'
        },
        defaultFont: "Arial",
        defaultSize: 28
      }
    });
  };

  const toggleTemplateStatus = (template: WordTemplate) => {
    updateTemplateMutation.mutate({
      id: template.id,
      data: { isActive: !template.isActive }
    });
  };

  const setAsDefault = (template: WordTemplate) => {
    updateTemplateMutation.mutate({
      id: template.id,
      data: { isDefault: true }
    });
  };

  const duplicateTemplate = (template: WordTemplate) => {
    const duplicatedData = {
      name: `${template.name} - Copy`,
      documentType: template.documentType,
      language: template.language,
      templateStructure: template.templateStructure as any,
      dynamicFields: template.dynamicFields as any,
      conditionalRules: template.conditionalRules as any,
      isActive: false,
      isDefault: false,
    };
    createTemplateMutation.mutate(duplicatedData);
  };

  const generateDefaultTemplate = (language: string) => {
    const defaultStructure: WordTemplateStructure = {
      sections: [
        {
          type: 'title',
          content: 'RENT AGREEMENT',
          formatting: {
            bold: true,
            alignment: 'center',
            fontSize: 44,
            spacing: { after: 240 }
          },
          fields: []
        },
        {
          type: 'paragraph',
          content: 'This Agreement of Rent is made on {{AGREEMENT_DATE}} by and between',
          formatting: {
            alignment: 'justify',
            spacing: { after: 120 }
          },
          fields: ['AGREEMENT_DATE']
        },
        {
          type: 'paragraph',
          content: '{{OWNER_NAME}}\nAge:{{OWNER_AGE}}, Occupation:{{OWNER_OCCUPATION}}\nAddress:{{OWNER_ADDRESS}}',
          formatting: {
            alignment: 'justify',
            spacing: { after: 80 }
          },
          fields: ['OWNER_NAME', 'OWNER_AGE', 'OWNER_OCCUPATION', 'OWNER_ADDRESS']
        },
        {
          type: 'paragraph',
          content: 'Hereinafter called the LANDLORD of the FIRST PART',
          formatting: {
            bold: true,
            italic: true,
            alignment: 'right',
            spacing: { after: 160 }
          },
          fields: []
        },
        {
          type: 'signature',
          content: 'Signature Section for {{OWNER_NAME}} and {{TENANT_NAME}}',
          formatting: {
            spacing: { before: 320, after: 160 }
          },
          fields: ['OWNER_NAME', 'TENANT_NAME']
        },
        {
          type: 'witness',
          content: 'Witnesses Section',
          formatting: {
            spacing: { before: 160, after: 160 }
          },
          fields: []
        }
      ],
      pageSettings: {
        margins: { top: 1080, right: 720, bottom: 1080, left: 720 },
        orientation: 'portrait'
      },
      defaultFont: "Arial",
      defaultSize: 28
    };

    const newTemplate = {
      name: `Default ${language} Template`,
      documentType: "rental_agreement",
      language: language,
      templateStructure: defaultStructure,
      dynamicFields: [
        'AGREEMENT_DATE', 'OWNER_NAME', 'OWNER_AGE', 'OWNER_OCCUPATION', 'OWNER_ADDRESS',
        'TENANT_NAME', 'TENANT_AGE', 'TENANT_OCCUPATION', 'TENANT_ADDRESS',
        'PROPERTY_ADDRESS', 'RENT_AMOUNT', 'SECURITY_DEPOSIT'
      ],
      conditionalRules: [],
      isActive: true,
      isDefault: false,
    };

    createTemplateMutation.mutate(newTemplate);
  };

  return (
    <div className="space-y-6" data-testid="word-templates-page">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Word Document Templates</h1>
          <p className="text-muted-foreground">
            Manage Word document templates for generating agreements
          </p>
        </div>
        
        <div className="flex gap-2">
          <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Languages</SelectItem>
              <SelectItem value="english">English</SelectItem>
              <SelectItem value="gujarati">Gujarati</SelectItem>
              <SelectItem value="hindi">Hindi</SelectItem>
            </SelectContent>
          </Select>

          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button data-testid="create-template-btn">
                <Plus className="h-4 w-4 mr-2" />
                Create Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Word Template</DialogTitle>
              </DialogHeader>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Template Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="My Word Template" data-testid="template-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="documentType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Document Type</FormLabel>
                          <FormControl>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <SelectTrigger data-testid="document-type">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="rental_agreement">Rental Agreement</SelectItem>
                                <SelectItem value="promissory_note">Promissory Note</SelectItem>
                                <SelectItem value="power_of_attorney">Power of Attorney</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="language"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Language</FormLabel>
                        <FormControl>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <SelectTrigger data-testid="language-select">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="english">English</SelectItem>
                              <SelectItem value="gujarati">Gujarati</SelectItem>
                              <SelectItem value="hindi">Hindi</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-4">
                    <Label>Quick Start Options</Label>
                    <div className="flex gap-2">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => generateDefaultTemplate(form.getValues("language"))}
                        data-testid="generate-default"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Generate Default Template
                      </Button>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setShowCreateDialog(false)}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createTemplateMutation.isPending}
                      data-testid="save-template"
                    >
                      {createTemplateMutation.isPending ? "Creating..." : "Create Template"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8">Loading templates...</div>
      ) : filteredTemplates.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Word Templates Found</h3>
            <p className="text-muted-foreground mb-4">
              {selectedLanguage === "all" 
                ? "Create your first Word template to get started" 
                : `No templates found for ${selectedLanguage}`}
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {filteredTemplates.map((template) => (
            <Card key={template.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-xl">{template.name}</CardTitle>
                      <div className="flex gap-2">
                        {template.isDefault && (
                          <Badge variant="default">Default</Badge>
                        )}
                        <Badge 
                          variant={template.isActive ? "default" : "secondary"}
                        >
                          {template.isActive ? "Active" : "Inactive"}
                        </Badge>
                        <Badge variant="outline">
                          {template.language}
                        </Badge>
                        <Badge variant="outline">
                          {template.documentType.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Created: {new Date(template.createdAt!).toLocaleDateString()}
                      {template.updatedAt !== template.createdAt && (
                        <span className="ml-2">
                          • Updated: {new Date(template.updatedAt!).toLocaleDateString()}
                        </span>
                      )}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPreviewTemplate(template)}
                      data-testid={`preview-template-${template.id}`}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => duplicateTemplate(template)}
                      data-testid={`duplicate-template-${template.id}`}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    
                    {!template.isDefault && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAsDefault(template)}
                        data-testid={`set-default-${template.id}`}
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                    )}
                    
                    <Switch
                      checked={template.isActive ?? true}
                      onCheckedChange={() => toggleTemplateStatus(template)}
                      data-testid={`toggle-status-${template.id}`}
                    />
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingTemplate(template)}
                      data-testid={`edit-template-${template.id}`}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteTemplateMutation.mutate(template.id)}
                      disabled={template.isDefault ?? false}
                      data-testid={`delete-template-${template.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <div className="text-sm">
                    <strong>Template Structure:</strong>
                    <div className="mt-1 p-2 bg-muted rounded text-xs">
                      {template.templateStructure && typeof template.templateStructure === 'object' ? 
                        `${(template.templateStructure as any).sections?.length || 0} sections defined` :
                        "Template structure not configured"
                      }
                    </div>
                  </div>
                  
                  {template.dynamicFields && Array.isArray(template.dynamicFields) && template.dynamicFields.length > 0 && (
                    <div className="text-sm">
                      <strong>Dynamic Fields ({template.dynamicFields.length}):</strong>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(template.dynamicFields as string[]).slice(0, 8).map((field: string, idx: number) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {field}
                          </Badge>
                        ))}
                        {template.dynamicFields.length > 8 && (
                          <Badge variant="secondary" className="text-xs">
                            +{template.dynamicFields.length - 8} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Template Preview Dialog */}
      {previewTemplate && (
        <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Preview: {previewTemplate.name}</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded">
                <h4 className="font-semibold mb-2">Template Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Language:</span> {previewTemplate.language}
                  </div>
                  <div>
                    <span className="font-medium">Document Type:</span> {previewTemplate.documentType}
                  </div>
                  <div>
                    <span className="font-medium">Status:</span> {previewTemplate.isActive ? "Active" : "Inactive"}
                  </div>
                  <div>
                    <span className="font-medium">Default:</span> {previewTemplate.isDefault ? "Yes" : "No"}
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold mb-2">Template Structure</h4>
                <div className="border rounded p-4 bg-white">
                  {previewTemplate.templateStructure && typeof previewTemplate.templateStructure === 'object' ? (
                    <div className="space-y-3">
                      {((previewTemplate.templateStructure as any).sections || []).map((section: TemplateSection, idx: number) => (
                        <div key={idx} className="border-l-2 border-blue-200 pl-3">
                          <div className="text-sm font-medium text-blue-600 mb-1">
                            {section.type.toUpperCase()}
                          </div>
                          <div className="text-sm text-gray-700">
                            {section.content.substring(0, 100)}
                            {section.content.length > 100 && "..."}
                          </div>
                          {section.fields && section.fields.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {section.fields.map((field, fieldIdx) => (
                                <Badge key={fieldIdx} variant="outline" className="text-xs">
                                  {field}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-muted-foreground">
                      Template structure not configured
                    </div>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}