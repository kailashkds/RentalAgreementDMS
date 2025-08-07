import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Plus, X, Code, Eye, Type, Calendar, User, Home, FileText, DollarSign } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { PdfTemplate, InsertPdfTemplate } from "@shared/schema";

interface PdfTemplateEditorProps {
  template?: PdfTemplate | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

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

// Dynamic field options with categories
const DYNAMIC_FIELDS = {
  'Owner Details': [
    { key: 'ownerDetails.name', label: 'Owner Name', icon: User },
    { key: 'ownerDetails.mobile', label: 'Owner Mobile', icon: User },
    { key: 'ownerDetails.age', label: 'Owner Age', icon: User },
    { key: 'ownerDetails.occupation', label: 'Owner Occupation', icon: User },
    { key: 'ownerDetails.aadhar', label: 'Owner Aadhar', icon: FileText },
    { key: 'ownerDetails.pan', label: 'Owner PAN', icon: FileText },
    { key: 'ownerDetails.address.flatNo', label: 'Owner Flat No', icon: Home },
    { key: 'ownerDetails.address.society', label: 'Owner Society', icon: Home },
    { key: 'ownerDetails.address.area', label: 'Owner Area', icon: Home },
    { key: 'ownerDetails.address.city', label: 'Owner City', icon: Home },
    { key: 'ownerDetails.address.pincode', label: 'Owner Pincode', icon: Home },
  ],
  'Tenant Details': [
    { key: 'tenantDetails.name', label: 'Tenant Name', icon: User },
    { key: 'tenantDetails.mobile', label: 'Tenant Mobile', icon: User },
    { key: 'tenantDetails.age', label: 'Tenant Age', icon: User },
    { key: 'tenantDetails.occupation', label: 'Tenant Occupation', icon: User },
    { key: 'tenantDetails.aadhar', label: 'Tenant Aadhar', icon: FileText },
    { key: 'tenantDetails.pan', label: 'Tenant PAN', icon: FileText },
    { key: 'tenantDetails.address.flatNo', label: 'Tenant Flat No', icon: Home },
    { key: 'tenantDetails.address.society', label: 'Tenant Society', icon: Home },
    { key: 'tenantDetails.address.area', label: 'Tenant Area', icon: Home },
    { key: 'tenantDetails.address.city', label: 'Tenant City', icon: Home },
    { key: 'tenantDetails.address.pincode', label: 'Tenant Pincode', icon: Home },
  ],
  'Property Details': [
    { key: 'propertyDetails.type', label: 'Property Type', icon: Home },
    { key: 'propertyDetails.address.flatNo', label: 'Property Flat No', icon: Home },
    { key: 'propertyDetails.address.society', label: 'Property Society', icon: Home },
    { key: 'propertyDetails.address.area', label: 'Property Area', icon: Home },
    { key: 'propertyDetails.address.city', label: 'Property City', icon: Home },
    { key: 'propertyDetails.address.pincode', label: 'Property Pincode', icon: Home },
    { key: 'propertyDetails.buildup', label: 'Property Buildup', icon: Home },
    { key: 'propertyDetails.carpet', label: 'Property Carpet Area', icon: Home },
  ],
  'Rental Terms': [
    { key: 'rentalTerms.monthlyRent', label: 'Monthly Rent', icon: DollarSign },
    { key: 'rentalTerms.deposit', label: 'Security Deposit', icon: DollarSign },
    { key: 'rentalTerms.dueDate', label: 'Due Date', icon: Calendar },
    { key: 'rentalTerms.startDate', label: 'Start Date', icon: Calendar },
    { key: 'rentalTerms.endDate', label: 'End Date', icon: Calendar },
    { key: 'rentalTerms.tenure', label: 'Tenure', icon: Calendar },
    { key: 'rentalTerms.maintenance', label: 'Maintenance', icon: DollarSign },
    { key: 'rentalTerms.noticePeriod', label: 'Notice Period', icon: Calendar },
    { key: 'rentalTerms.furniture', label: 'Furniture Details', icon: Home },
  ],
  'Agreement Info': [
    { key: 'agreementNumber', label: 'Agreement Number', icon: FileText },
    { key: 'agreementDate', label: 'Agreement Date', icon: Calendar },
    { key: 'startDate', label: 'Agreement Start Date', icon: Calendar },
    { key: 'endDate', label: 'Agreement End Date', icon: Calendar },
    { key: 'language', label: 'Language', icon: Type },
  ]
};

export default function PdfTemplateEditor({ template, isOpen, onClose, onSave }: PdfTemplateEditorProps) {
  const [formData, setFormData] = useState<InsertPdfTemplate>({
    name: "",
    documentType: "rental_agreement",
    language: "english",
    htmlTemplate: "",
    dynamicFields: [],
    conditionalRules: [],
    isActive: true,
  });
  
  const [activeTab, setActiveTab] = useState("editor");
  const { toast } = useToast();
  const editorRef = useRef<HTMLTextAreaElement>(null);

  // Initialize form data when template changes
  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name,
        documentType: template.documentType,
        language: template.language,
        htmlTemplate: template.htmlTemplate,
        dynamicFields: template.dynamicFields as any[] || [],
        conditionalRules: template.conditionalRules as any[] || [],
        isActive: template.isActive,
      });
    } else {
      setFormData({
        name: "",
        documentType: "rental_agreement",
        language: "english",
        htmlTemplate: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rental Agreement</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        .header { text-align: center; margin-bottom: 30px; }
        .title { font-size: 24px; font-weight: bold; text-decoration: underline; }
        .section { margin: 20px 0; }
        .field { font-weight: bold; }
        .signature-section { margin-top: 50px; display: flex; justify-content: space-between; }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">RENTAL AGREEMENT</div>
        <p>Agreement No: <span class="field">{{agreementNumber}}</span></p>
        <p>Date: <span class="field">{{agreementDate}}</span></p>
    </div>
    
    <div class="section">
        <h3>LANDLORD DETAILS:</h3>
        <p>Name: <span class="field">{{ownerDetails.name}}</span></p>
        <p>Mobile: <span class="field">{{ownerDetails.mobile}}</span></p>
        <p>Age: <span class="field">{{ownerDetails.age}}</span></p>
        <p>Address: <span class="field">{{ownerDetails.address.flatNo}}, {{ownerDetails.address.society}}, {{ownerDetails.address.area}}, {{ownerDetails.address.city}} - {{ownerDetails.address.pincode}}</span></p>
    </div>
    
    <div class="section">
        <h3>TENANT DETAILS:</h3>
        <p>Name: <span class="field">{{tenantDetails.name}}</span></p>
        <p>Mobile: <span class="field">{{tenantDetails.mobile}}</span></p>
        <p>Age: <span class="field">{{tenantDetails.age}}</span></p>
        <p>Address: <span class="field">{{tenantDetails.address.flatNo}}, {{tenantDetails.address.society}}, {{tenantDetails.address.area}}, {{tenantDetails.address.city}} - {{tenantDetails.address.pincode}}</span></p>
    </div>
    
    <div class="section">
        <h3>PROPERTY DETAILS:</h3>
        <p>Type: <span class="field">{{propertyDetails.type}}</span></p>
        <p>Address: <span class="field">{{propertyDetails.address.flatNo}}, {{propertyDetails.address.society}}, {{propertyDetails.address.area}}, {{propertyDetails.address.city}} - {{propertyDetails.address.pincode}}</span></p>
        <p>Buildup Area: <span class="field">{{propertyDetails.buildup}}</span> sq ft</p>
    </div>
    
    <div class="section">
        <h3>RENTAL TERMS:</h3>
        <p>Monthly Rent: <span class="field">₹{{rentalTerms.monthlyRent}}</span></p>
        <p>Security Deposit: <span class="field">₹{{rentalTerms.deposit}}</span></p>
        <p>Agreement Period: <span class="field">{{startDate}} to {{endDate}}</span></p>
        <p>Due Date: <span class="field">{{rentalTerms.dueDate}}</span> of every month</p>
    </div>
    
    <div class="signature-section">
        <div>
            <br><br><br>
            _____________________<br>
            Landlord Signature<br>
            {{ownerDetails.name}}
        </div>
        <div>
            <br><br><br>
            _____________________<br>
            Tenant Signature<br>
            {{tenantDetails.name}}
        </div>
    </div>
</body>
</html>`,
        dynamicFields: [],
        conditionalRules: [],
        isActive: true,
      });
    }
  }, [template]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: InsertPdfTemplate) => {
      if (template) {
        return await apiRequest("PUT", `/api/pdf-templates/${template.id}`, data);
      } else {
        return await apiRequest("POST", "/api/pdf-templates", data);
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `Template ${template ? 'updated' : 'created'} successfully`,
      });
      onSave();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!formData.name || !formData.htmlTemplate) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    saveMutation.mutate(formData);
  };

  const insertDynamicField = (fieldKey: string) => {
    const textarea = editorRef.current;
    if (textarea) {
      const cursorPos = textarea.selectionStart;
      const textBefore = formData.htmlTemplate.substring(0, cursorPos);
      const textAfter = formData.htmlTemplate.substring(cursorPos);
      const newText = `${textBefore}{{${fieldKey}}}${textAfter}`;
      
      setFormData(prev => ({ ...prev, htmlTemplate: newText }));
      
      // Set cursor position after the inserted text
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(cursorPos + fieldKey.length + 4, cursorPos + fieldKey.length + 4);
      }, 0);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {template ? 'Edit PDF Template' : 'Create PDF Template'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="editor">Template Editor</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-hidden">
              {/* Template Details */}
              <TabsContent value="details" className="h-full overflow-auto">
                <div className="space-y-6 p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Template Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Enter template name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="documentType">Document Type *</Label>
                      <Select value={formData.documentType} onValueChange={(value) => 
                        setFormData(prev => ({ ...prev, documentType: value }))
                      }>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DOCUMENT_TYPES.map(type => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="language">Language *</Label>
                      <Select value={formData.language} onValueChange={(value) => 
                        setFormData(prev => ({ ...prev, language: value }))
                      }>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LANGUAGES.map(lang => (
                            <SelectItem key={lang.value} value={lang.value}>
                              {lang.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="isActive"
                        checked={formData.isActive}
                        onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                      />
                      <Label htmlFor="isActive">Template is active</Label>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Template Editor */}
              <TabsContent value="editor" className="h-full flex gap-4 p-4">
                {/* Dynamic Fields Panel */}
                <Card className="w-80 flex-shrink-0">
                  <CardHeader>
                    <CardTitle className="text-sm">Dynamic Fields</CardTitle>
                  </CardHeader>
                  <CardContent className="p-2 max-h-96 overflow-y-auto">
                    {Object.entries(DYNAMIC_FIELDS).map(([category, fields]) => (
                      <div key={category} className="mb-4">
                        <h4 className="font-semibold text-xs text-gray-600 mb-2">{category}</h4>
                        <div className="space-y-1">
                          {fields.map((field) => {
                            const IconComponent = field.icon;
                            return (
                              <button
                                key={field.key}
                                onClick={() => insertDynamicField(field.key)}
                                className="w-full flex items-center gap-2 p-2 text-xs bg-gray-50 hover:bg-gray-100 rounded border text-left"
                              >
                                <IconComponent className="h-3 w-3 text-gray-500" />
                                <span className="truncate">{field.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* HTML Editor */}
                <div className="flex-1 flex flex-col">
                  <Label htmlFor="htmlTemplate" className="mb-2">HTML Template *</Label>
                  <Textarea
                    ref={editorRef}
                    id="htmlTemplate"
                    value={formData.htmlTemplate}
                    onChange={(e) => setFormData(prev => ({ ...prev, htmlTemplate: e.target.value }))}
                    placeholder="Enter your HTML template here..."
                    className="flex-1 font-mono text-sm resize-none"
                    style={{ minHeight: '400px' }}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Click on dynamic fields to insert them at cursor position. Use format: {`{{fieldName}}`}
                  </p>
                </div>
              </TabsContent>

              {/* Preview */}
              <TabsContent value="preview" className="h-full p-4">
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle>Template Preview</CardTitle>
                  </CardHeader>
                  <CardContent className="h-full overflow-auto">
                    <div
                      className="border rounded p-4 bg-white"
                      dangerouslySetInnerHTML={{ __html: formData.htmlTemplate }}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end space-x-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving...' : template ? 'Update' : 'Create'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}