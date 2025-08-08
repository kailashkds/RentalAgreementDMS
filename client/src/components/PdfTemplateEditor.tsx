import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Plus, Code, Eye, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Editor from "@monaco-editor/react";
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
    { key: "{{OWNER_NAME}}", label: "Owner Name" },
    { key: "{{OWNER_COMPANY}}", label: "Owner Company" },
    { key: "{{OWNER_AGE}}", label: "Owner Age" },
    { key: "{{OWNER_OCCUPATION}}", label: "Owner Occupation" },
    { key: "{{OWNER_HOUSE_NUMBER}}", label: "Owner House Number" },
    { key: "{{OWNER_SOCIETY}}", label: "Owner Society" },
    { key: "{{OWNER_AREA}}", label: "Owner Area" },
    { key: "{{OWNER_CITY}}", label: "Owner City" },
    { key: "{{OWNER_STATE}}", label: "Owner State" },
    { key: "{{OWNER_PINCODE}}", label: "Owner Pincode" },
  ],
  tenant: [
    { key: "{{TENANT_NAME}}", label: "Tenant Name" },
    { key: "{{TENANT_COMPANY}}", label: "Tenant Company" },
    { key: "{{TENANT_AGE}}", label: "Tenant Age" },
    { key: "{{TENANT_OCCUPATION}}", label: "Tenant Occupation" },
    { key: "{{TENANT_HOUSE_NUMBER}}", label: "Tenant House Number" },
    { key: "{{TENANT_SOCIETY}}", label: "Tenant Society" },
    { key: "{{TENANT_AREA}}", label: "Tenant Area" },
    { key: "{{TENANT_CITY}}", label: "Tenant City" },
    { key: "{{TENANT_STATE}}", label: "Tenant State" },
    { key: "{{TENANT_PINCODE}}", label: "Tenant Pincode" },
  ],
  property: [
    { key: "{{PROPERTY_HOUSE_NUMBER}}", label: "Property House Number" },
    { key: "{{PROPERTY_SOCIETY}}", label: "Property Society" },
    { key: "{{PROPERTY_AREA}}", label: "Property Area" },
    { key: "{{PROPERTY_CITY}}", label: "Property City" },
    { key: "{{PROPERTY_STATE}}", label: "Property State" },
    { key: "{{PROPERTY_PINCODE}}", label: "Property Pincode" },
    { key: "{{PROPERTY_AREA_SQFT}}", label: "Property Area (Sq Ft)" },
    { key: "{{PROPERTY_PURPOSE}}", label: "Property Purpose (Resident/Commercial)" },
    { key: "{{PROPERTY_FURNISHED_STATUS}}", label: "Furnished Status" },
    { key: "{{ADDITIONAL_ITEMS}}", label: "Additional Items to Handover" },
  ],
  rental: [
    { key: "{{RENT_AMOUNT}}", label: "Rent Amount (Number)" },
    { key: "{{RENT_AMOUNT_WORDS}}", label: "Rent Amount (Words)" },
    { key: "{{SECURITY_DEPOSIT}}", label: "Security Deposit (Number)" },
    { key: "{{SECURITY_DEPOSIT_WORDS}}", label: "Security Deposit (Words)" },
    { key: "{{MAINTENANCE_CHARGE}}", label: "Maintenance Charge" },
    { key: "{{MAINTENANCE_INCLUSION}}", label: "Maintenance Inclusion (Conditional)" },
    { key: "{{MAINTENANCE_EXCLUSION}}", label: "Maintenance Exclusion (Conditional)" },
    { key: "{{TENURE}}", label: "Tenure (11 Month)" },
    { key: "{{START_DATE}}", label: "Start Date" },
    { key: "{{END_DATE}}", label: "End Date" },
    { key: "{{PAYMENT_DUE_DATE_FROM}}", label: "Payment Due Date From (8)" },
    { key: "{{PAYMENT_DUE_DATE_TO}}", label: "Payment Due Date To (15)" },
    { key: "{{MINIMUM_STAY}}", label: "Minimum Stay Period" },
    { key: "{{NOTICE_PERIOD}}", label: "Notice Period (2 month)" },
    { key: "{{RENEWAL_PERIOD}}", label: "Renewal Period" },
  ],
  agreement: [
    { key: "{{AGREEMENT_DATE}}", label: "Agreement Creation Date" },
    { key: "{{AGREEMENT_TYPE}}", label: "Agreement Type" },
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
  const [editorTheme, setEditorTheme] = useState("light");
  const editorRef = useRef<any>(null);
  const { toast } = useToast();

  // Initialize form data when template changes
  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name,
        documentType: template.documentType,
        language: template.language,
        htmlTemplate: template.htmlTemplate,
        dynamicFields: (template.dynamicFields || []) as string[],
        conditionalRules: (template.conditionalRules || []) as string[],
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
    This Rental Agreement is made on <strong>{{AGREEMENT_DATE}}</strong> between:
  </p>
  
  <div style="margin: 20px 0;">
    <h3>OWNER (Lessor):</h3>
    <p><strong>Name:</strong> {{OWNER_NAME}}</p>
    <p><strong>Company:</strong> {{OWNER_COMPANY}}</p>
    <p><strong>Age:</strong> {{OWNER_AGE}}</p>
    <p><strong>Occupation:</strong> {{OWNER_OCCUPATION}}</p>
    <p><strong>Address:</strong> {{OWNER_HOUSE_NUMBER}}, {{OWNER_SOCIETY}}, {{OWNER_AREA}}, {{OWNER_CITY}}, {{OWNER_STATE}} - {{OWNER_PINCODE}}</p>
  </div>
  
  <div style="margin: 20px 0;">
    <h3>TENANT (Lessee):</h3>
    <p><strong>Name:</strong> {{TENANT_NAME}}</p>
    <p><strong>Company:</strong> {{TENANT_COMPANY}}</p>
    <p><strong>Age:</strong> {{TENANT_AGE}}</p>
    <p><strong>Occupation:</strong> {{TENANT_OCCUPATION}}</p>
    <p><strong>Address:</strong> {{TENANT_HOUSE_NUMBER}}, {{TENANT_SOCIETY}}, {{TENANT_AREA}}, {{TENANT_CITY}}, {{TENANT_STATE}} - {{TENANT_PINCODE}}</p>
  </div>
  
  <div style="margin: 20px 0;">
    <h3>PROPERTY DETAILS:</h3>
    <p><strong>Address:</strong> {{PROPERTY_HOUSE_NUMBER}}, {{PROPERTY_SOCIETY}}, {{PROPERTY_AREA}}, {{PROPERTY_CITY}}, {{PROPERTY_STATE}} - {{PROPERTY_PINCODE}}</p>
    <p><strong>Property Type:</strong> {{PROPERTY_TYPE}}</p>
    <p><strong>Area:</strong> {{PROPERTY_AREA_SQFT}} sq ft</p>
    <p><strong>Purpose:</strong> {{PROPERTY_PURPOSE}}</p>
    <p><strong>Furnished Status:</strong> {{PROPERTY_FURNISHED_STATUS}}</p>
    <p><strong>Furniture/Items:</strong> {{ADDITIONAL_ITEMS}}</p>
  </div>
  
  <div style="margin: 20px 0;">
    <h3>RENTAL TERMS:</h3>
    <p><strong>Monthly Rent:</strong> ₹{{RENT_AMOUNT}} ({{RENT_AMOUNT_WORDS}})</p>
    <p><strong>Security Deposit:</strong> ₹{{SECURITY_DEPOSIT}} ({{SECURITY_DEPOSIT_WORDS}})</p>
    <p><strong>Maintenance Charge:</strong> ₹{{MAINTENANCE_CHARGE}} {{MAINTENANCE_INCLUSION}}</p>
    <p><strong>Lease Period:</strong> {{START_DATE}} to {{END_DATE}} ({{TENURE}})</p>
    <p><strong>Payment Due:</strong> {{PAYMENT_DUE_DATE_FROM}} to {{PAYMENT_DUE_DATE_TO}} of each month</p>
    <p><strong>Notice Period:</strong> {{NOTICE_PERIOD}} months</p>
  </div>
  
  <div style="margin: 40px 0;">
    <h3>TERMS AND CONDITIONS:</h3>
    <ul style="line-height: 1.6;">
      <li>The tenant agrees to pay rent on or before the due date of each month.</li>
      <li>The security deposit will be refunded after deducting any damages.</li>
      <li>The property should be maintained in good condition.</li>
      <li>No subletting without written consent of the owner.</li>
      <li>The minimum stay period is {{MINIMUM_STAY}}.</li>
      <li>{{NOTICE_PERIOD}} notice is required for termination.</li>
      <li>{{MAINTENANCE_INCLUSION}}</li>
    </ul>
  </div>
  
  <div style="margin: 40px 0; display: flex; justify-content: space-between;">
    <div>
      <p><strong>Owner Signature</strong></p>
      <p style="margin-top: 40px;">{{OWNER_NAME}}</p>
      <p>Date: ___________</p>
    </div>
    <div>
      <p><strong>Tenant Signature</strong></p>
      <p style="margin-top: 40px;">{{TENANT_NAME}}</p>
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
    if (editorRef.current) {
      const editor = editorRef.current;
      const selection = editor.getSelection();
      const range = selection || { 
        startLineNumber: 1, 
        startColumn: 1, 
        endLineNumber: 1, 
        endColumn: 1 
      };
      
      editor.executeEdits("insert-field", [{
        range,
        text: fieldKey,
        forceMoveMarkers: true
      }]);
      
      // Focus the editor and position cursor after inserted text
      editor.focus();
      const newPosition = {
        lineNumber: range.startLineNumber,
        column: range.startColumn + fieldKey.length
      };
      editor.setPosition(newPosition);
    }
  };

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    
    // Configure HTML language features
    monaco.languages.html.htmlDefaults.setOptions({
      format: {
        tabSize: 2,
        insertSpaces: true,
        wrapLineLength: 120,
        wrapAttributes: 'auto',
        unformatted: 'default',
        contentUnformatted: 'pre,code,textarea',
        endWithNewline: false,
        extraLiners: 'head, body, /html',
        indentHandlebars: false,
        indentInnerHtml: false,
        insertFinalNewline: false,
        maxPreserveNewLines: 2,
        preserveNewLines: true,
        unformattedContentDelimiter: ''
      }
    });

    // Add custom dynamic field highlighting
    monaco.editor.defineTheme('dynamic-fields-theme', {
      base: editorTheme === 'dark' ? 'vs-dark' : 'vs',
      inherit: true,
      rules: [
        {
          token: 'dynamic-field',
          foreground: '28a745',
          fontStyle: 'bold'
        }
      ],
      colors: {}
    });
    
    monaco.editor.setTheme('dynamic-fields-theme');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>
            {template ? "Edit PDF Template" : "Create New PDF Template"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-3 flex-shrink-0">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="editor">Template Editor</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="flex-1 space-y-4 overflow-auto">
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
                    checked={formData.isActive ?? true}
                    onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                    className="rounded"
                  />
                  <Label htmlFor="isActive">Active Template</Label>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="editor" className="flex-1 flex gap-4 overflow-hidden">
              <div className="flex-1 space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="htmlTemplate" className="text-lg font-medium">HTML Template Editor</Label>
                  <div className="flex items-center space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEditorTheme(editorTheme === 'light' ? 'dark' : 'light')}
                    >
                      {editorTheme === 'light' ? '🌙' : '☀️'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (editorRef.current) {
                          editorRef.current.getAction('editor.action.formatDocument').run();
                        }
                      }}
                    >
                      <Code className="h-4 w-4 mr-2" />
                      Format
                    </Button>
                  </div>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <Editor
                    height="400px"
                    language="html"
                    theme={editorTheme === 'dark' ? 'vs-dark' : 'vs'}
                    value={formData.htmlTemplate}
                    onChange={(value) => setFormData(prev => ({ ...prev, htmlTemplate: value || '' }))}
                    onMount={handleEditorDidMount}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      lineNumbers: 'on',
                      wordWrap: 'bounded',
                      wordWrapColumn: 120,
                      automaticLayout: true,
                      scrollBeyondLastLine: false,
                      folding: true,
                      renderLineHighlight: 'line',
                      cursorBlinking: 'blink',
                      cursorSmoothCaretAnimation: 'on',
                      suggest: {
                        showKeywords: true,
                        showSnippets: true,
                      },
                      bracketPairColorization: {
                        enabled: true
                      }
                    }}
                  />
                </div>
                <div className="text-sm text-muted-foreground">
                  💡 Tip: Use Ctrl+Space for auto-completion, Ctrl+Shift+F for formatting
                </div>
              </div>
              <div className="w-80 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center">
                      <Plus className="h-4 w-4 mr-2" />
                      Dynamic Fields
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 max-h-96 overflow-y-auto">
                    {Object.entries(DYNAMIC_FIELDS).map(([category, fields]) => (
                      <div key={category}>
                        <h4 className="font-medium text-sm capitalize mb-2 text-primary border-b pb-1">
                          {category} Fields
                        </h4>
                        <div className="space-y-1">
                          {fields.map((field) => (
                            <Button
                              key={field.key}
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start text-xs hover:bg-accent hover:text-accent-foreground"
                              onClick={() => insertDynamicField(field.key)}
                            >
                              <Plus className="h-3 w-3 mr-2 text-green-600" />
                              <span className="truncate">{field.label}</span>
                            </Button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center">
                      <Settings className="h-4 w-4 mr-2" />
                      Editor Help
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground space-y-2">
                    <div><strong>Ctrl+Space:</strong> Auto-complete</div>
                    <div><strong>Ctrl+Shift+F:</strong> Format code</div>
                    <div><strong>Ctrl+F:</strong> Find & replace</div>
                    <div><strong>Ctrl+/:</strong> Comment/uncomment</div>
                    <div><strong>Alt+Shift+F:</strong> Format selection</div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="preview" className="flex-1 space-y-4 overflow-auto">
              <div className="flex items-center justify-between">
                <Label className="text-lg font-medium flex items-center">
                  <Eye className="h-5 w-5 mr-2" />
                  Live Preview
                </Label>
                <Badge variant="secondary" className="text-xs">
                  Real-time HTML rendering
                </Badge>
              </div>
              <div className="border rounded-lg p-4 h-96 overflow-auto bg-white">
                <div 
                  dangerouslySetInnerHTML={{ __html: formData.htmlTemplate }}
                  style={{ 
                    fontFamily: 'Arial, sans-serif',
                    lineHeight: '1.4',
                    color: '#333'
                  }}
                />
              </div>
              <div className="text-sm text-muted-foreground">
                💡 This preview shows how your template will look when printed as PDF
              </div>
            </TabsContent>
          </Tabs>

          <Separator className="flex-shrink-0" />

          <div className="flex justify-end space-x-2 flex-shrink-0 pt-4">
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