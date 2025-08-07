import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { PdfTemplate, InsertPdfTemplate } from "@shared/schema";

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

const DYNAMIC_FIELDS = {
  owner: [
    { key: "{{owner.name}}", label: "Owner Name" },
    { key: "{{owner.email}}", label: "Owner Email" },
    { key: "{{owner.phone}}", label: "Owner Phone" },
    { key: "{{owner.address}}", label: "Owner Address" },
  ],
  tenant: [
    { key: "{{tenant.name}}", label: "Tenant Name" },
    { key: "{{tenant.email}}", label: "Tenant Email" },
    { key: "{{tenant.phone}}", label: "Tenant Phone" },
    { key: "{{tenant.address}}", label: "Tenant Address" },
  ],
  property: [
    { key: "{{property.address}}", label: "Property Address" },
    { key: "{{property.city}}", label: "Property City" },
    { key: "{{property.pincode}}", label: "Property Pincode" },
    { key: "{{property.area}}", label: "Property Area" },
  ],
  rental: [
    { key: "{{rental.amount}}", label: "Rental Amount" },
    { key: "{{rental.securityDeposit}}", label: "Security Deposit" },
    { key: "{{rental.startDate}}", label: "Start Date" },
    { key: "{{rental.endDate}}", label: "End Date" },
    { key: "{{rental.tenure}}", label: "Tenure" },
  ],
  agreement: [
    { key: "{{agreement.id}}", label: "Agreement ID" },
    { key: "{{agreement.createdDate}}", label: "Created Date" },
    { key: "{{agreement.type}}", label: "Agreement Type" },
  ],
};

interface PdfTemplateEditorProps {
  template: PdfTemplate | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: InsertPdfTemplate) => void;
}

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
  const [activeTab, setActiveTab] = useState("basic");
  const { toast } = useToast();

  // Initialize form data when template changes
  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name,
        documentType: template.documentType,
        language: template.language,
        htmlTemplate: template.htmlTemplate,
        dynamicFields: template.dynamicFields,
        conditionalRules: template.conditionalRules,
        isActive: template.isActive,
      });
    } else {
      setFormData({
        name: "",
        documentType: "rental_agreement",
        language: "english",
        htmlTemplate: `<div style="font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto;">
  <h1 style="text-align: center; color: #333; border-bottom: 2px solid #ccc; padding-bottom: 10px;">
    RENTAL AGREEMENT
  </h1>
  
  <p style="margin: 20px 0;">
    This Rental Agreement is made on <strong>{{agreement.createdDate}}</strong> between:
  </p>
  
  <div style="margin: 20px 0;">
    <h3>OWNER (Lessor):</h3>
    <p><strong>Name:</strong> {{owner.name}}</p>
    <p><strong>Email:</strong> {{owner.email}}</p>
    <p><strong>Phone:</strong> {{owner.phone}}</p>
    <p><strong>Address:</strong> {{owner.address}}</p>
  </div>
  
  <div style="margin: 20px 0;">
    <h3>TENANT (Lessee):</h3>
    <p><strong>Name:</strong> {{tenant.name}}</p>
    <p><strong>Email:</strong> {{tenant.email}}</p>
    <p><strong>Phone:</strong> {{tenant.phone}}</p>
    <p><strong>Address:</strong> {{tenant.address}}</p>
  </div>
  
  <div style="margin: 20px 0;">
    <h3>PROPERTY DETAILS:</h3>
    <p><strong>Address:</strong> {{property.address}}, {{property.city}} - {{property.pincode}}</p>
    <p><strong>Area:</strong> {{property.area}}</p>
  </div>
  
  <div style="margin: 20px 0;">
    <h3>RENTAL TERMS:</h3>
    <p><strong>Monthly Rent:</strong> ₹{{rental.amount}}</p>
    <p><strong>Security Deposit:</strong> ₹{{rental.securityDeposit}}</p>
    <p><strong>Lease Period:</strong> {{rental.startDate}} to {{rental.endDate}} ({{rental.tenure}})</p>
  </div>
  
  <div style="margin: 40px 0;">
    <h3>TERMS AND CONDITIONS:</h3>
    <ul style="line-height: 1.6;">
      <li>The tenant agrees to pay rent on or before the 1st of each month.</li>
      <li>The security deposit will be refunded after deducting any damages.</li>
      <li>The property should be maintained in good condition.</li>
      <li>No subletting without written consent of the owner.</li>
    </ul>
  </div>
  
  <div style="margin: 40px 0; display: flex; justify-content: space-between;">
    <div>
      <p><strong>Owner Signature</strong></p>
      <p style="margin-top: 40px;">{{owner.name}}</p>
      <p>Date: ___________</p>
    </div>
    <div>
      <p><strong>Tenant Signature</strong></p>
      <p style="margin-top: 40px;">{{tenant.name}}</p>
      <p>Date: ___________</p>
    </div>
  </div>
</div>`,
        dynamicFields: [],
        conditionalRules: [],
        isActive: true,
      });
    }
  }, [template]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.htmlTemplate) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    onSave(formData);
    toast({
      title: "Success",
      description: template ? "Template updated successfully" : "Template created successfully",
    });
  };

  const insertDynamicField = (fieldKey: string) => {
    const textarea = document.querySelector('textarea[name="htmlTemplate"]') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentValue = formData.htmlTemplate;
      const newValue = currentValue.substring(0, start) + fieldKey + currentValue.substring(end);
      
      setFormData(prev => ({ ...prev, htmlTemplate: newValue }));
      
      // Set cursor position after inserted text
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + fieldKey.length, start + fieldKey.length);
      }, 0);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            {template ? "Edit PDF Template" : "Create New PDF Template"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="editor">Template Editor</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Template Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter template name"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="documentType">Document Type</Label>
                  <Select value={formData.documentType} onValueChange={(value) => setFormData(prev => ({ ...prev, documentType: value }))}>
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
                  <Label htmlFor="language">Language</Label>
                  <Select value={formData.language} onValueChange={(value) => setFormData(prev => ({ ...prev, language: value }))}>
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
                    className="rounded"
                  />
                  <Label htmlFor="isActive">Active Template</Label>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="editor" className="flex-1 flex gap-4">
              <div className="flex-1">
                <Label htmlFor="htmlTemplate">HTML Template</Label>
                <Textarea
                  id="htmlTemplate"
                  name="htmlTemplate"
                  value={formData.htmlTemplate}
                  onChange={(e) => setFormData(prev => ({ ...prev, htmlTemplate: e.target.value }))}
                  placeholder="Enter your HTML template with dynamic fields"
                  className="h-96 font-mono text-sm"
                  required
                />
              </div>
              <div className="w-80 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Dynamic Fields</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {Object.entries(DYNAMIC_FIELDS).map(([category, fields]) => (
                      <div key={category}>
                        <h4 className="font-medium text-sm capitalize mb-2">{category} Fields</h4>
                        <div className="space-y-1">
                          {fields.map((field) => (
                            <Button
                              key={field.key}
                              type="button"
                              variant="outline"
                              size="sm"
                              className="w-full justify-start text-xs"
                              onClick={() => insertDynamicField(field.key)}
                            >
                              <Plus className="h-3 w-3 mr-2" />
                              {field.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="preview" className="flex-1">
              <div className="border rounded-lg p-4 h-96 overflow-auto">
                <div dangerouslySetInnerHTML={{ __html: formData.htmlTemplate }} />
              </div>
            </TabsContent>
          </Tabs>

          <Separator className="my-4" />

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              {template ? "Update Template" : "Create Template"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}