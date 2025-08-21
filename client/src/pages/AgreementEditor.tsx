import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Download, FileText, Bold, Italic, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';

interface EditorProps {
  initialHtml?: string;
  agreementNumber?: string;
  language?: string;
}

export default function AgreementEditor() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const editorRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  
  // Get data from URL params or local storage
  const urlParams = new URLSearchParams(window.location.search);
  const agreementNumber = urlParams.get('agreementNumber') || 'Unknown';
  const language = urlParams.get('language') || 'english';
  
  // Load HTML content from session storage (set by the wizard)
  const [htmlContent, setHtmlContent] = useState(() => {
    return sessionStorage.getItem('editorHtmlContent') || '<p>Loading content...</p>';
  });

  useEffect(() => {
    // Load content into editor when component mounts
    if (editorRef.current && htmlContent) {
      editorRef.current.innerHTML = htmlContent;
    }
  }, [htmlContent]);

  const handleContentChange = () => {
    if (editorRef.current) {
      setIsDirty(true);
    }
  };

  const formatText = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    handleContentChange();
  };

  const insertTable = () => {
    const tableHtml = `
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="border: 1px solid #000; padding: 8px;">Header 1</td>
          <td style="border: 1px solid #000; padding: 8px;">Header 2</td>
        </tr>
        <tr>
          <td style="border: 1px solid #000; padding: 8px;">Cell 1</td>
          <td style="border: 1px solid #000; padding: 8px;">Cell 2</td>
        </tr>
      </table>
    `;
    
    if (editorRef.current) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.insertNode(range.createContextualFragment(tableHtml));
      } else {
        editorRef.current.innerHTML += tableHtml;
      }
      handleContentChange();
    }
  };

  const insertSignatureSection = () => {
    const signatureHtml = `
      <div style="margin: 40px 0; display: flex; justify-content: space-between;">
        <div>
          <p><strong>Owner Signature</strong></p>
          <p style="margin-top: 40px;">_____________________</p>
          <p>Date: ___________</p>
        </div>
        <div>
          <p><strong>Tenant Signature</strong></p>
          <p style="margin-top: 40px;">_____________________</p>
          <p>Date: ___________</p>
        </div>
      </div>
    `;
    
    if (editorRef.current) {
      editorRef.current.innerHTML += signatureHtml;
      handleContentChange();
    }
  };

  const generatePdf = async () => {
    if (!editorRef.current) {
      toast({
        title: "Error",
        description: "No content to generate PDF from",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingPdf(true);
    
    try {
      const editorContent = editorRef.current.innerHTML;
      
      // Open a new window with the content for PDF generation
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Agreement ${agreementNumber}</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                margin: 20px;
                color: #333;
              }
              table {
                border-collapse: collapse;
                width: 100%;
              }
              table, th, td {
                border: 1px solid #000;
              }
              th, td {
                padding: 8px;
                text-align: left;
              }
              @media print {
                .no-print { 
                  display: none; 
                }
                body {
                  margin: 0;
                  font-size: 12pt;
                }
              }
            </style>
          </head>
          <body>
            <div class="no-print" style="margin-bottom: 20px; padding: 10px; background: #f0f0f0; border-radius: 4px;">
              <button onclick="window.print()" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px;">Generate PDF</button>
              <button onclick="window.close()" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 4px; margin-left: 10px;">Close</button>
            </div>
            ${editorContent}
          </body>
          </html>
        `);
        printWindow.document.close();
      }
      
      toast({
        title: "PDF Ready",
        description: "PDF window opened. Use the 'Generate PDF' button in the new window.",
      });
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({
        title: "Error",
        description: "Failed to generate PDF",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const goBack = () => {
    if (isDirty) {
      if (confirm('You have unsaved changes. Are you sure you want to go back?')) {
        navigate('/agreements');
      }
    } else {
      navigate('/agreements');
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button onClick={goBack} variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Agreements
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Agreement Editor</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary">#{agreementNumber}</Badge>
              <Badge variant="outline">{language}</Badge>
              {isDirty && <Badge variant="destructive">Unsaved</Badge>}
            </div>
          </div>
        </div>
        
        <Button 
          onClick={generatePdf} 
          disabled={isGeneratingPdf}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <FileText className="h-4 w-4 mr-2" />
          {isGeneratingPdf ? 'Generating...' : 'Generate PDF'}
        </Button>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Toolbar */}
        <Card className="col-span-12">
          <CardHeader>
            <CardTitle className="text-lg">Formatting Tools</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => formatText('bold')}
                data-testid="button-bold"
              >
                <Bold className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => formatText('italic')}
                data-testid="button-italic"
              >
                <Italic className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => formatText('justifyLeft')}
                data-testid="button-align-left"
              >
                <AlignLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => formatText('justifyCenter')}
                data-testid="button-align-center"
              >
                <AlignCenter className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => formatText('justifyRight')}
                data-testid="button-align-right"
              >
                <AlignRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => formatText('formatBlock', 'h1')}
                data-testid="button-heading-1"
              >
                H1
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => formatText('formatBlock', 'h2')}
                data-testid="button-heading-2"
              >
                H2
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => formatText('formatBlock', 'p')}
                data-testid="button-paragraph"
              >
                P
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={insertTable}
                data-testid="button-insert-table"
              >
                Insert Table
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={insertSignatureSection}
                data-testid="button-insert-signature"
              >
                Insert Signature
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Editor */}
        <Card className="col-span-12">
          <CardHeader>
            <CardTitle className="text-lg">Document Content</CardTitle>
          </CardHeader>
          <CardContent>
            <div 
              ref={editorRef}
              contentEditable
              className="min-h-[600px] p-4 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              style={{
                fontFamily: language === 'gujarati' 
                  ? '"Noto Sans Gujarati", "Shruti", "Lohit Gujarati", system-ui, Arial, sans-serif'
                  : language === 'hindi' || language === 'marathi'
                  ? '"Noto Sans Devanagari", "Mangal", "Lohit Devanagari", system-ui, Arial, sans-serif'
                  : language === 'tamil'
                  ? '"Noto Sans Tamil", "Latha", "Lohit Tamil", system-ui, Arial, sans-serif'
                  : 'Arial, sans-serif',
                lineHeight: '1.6'
              }}
              onInput={handleContentChange}
              data-testid="content-editor"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}