import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, FileText } from "lucide-react";
import { useState, useEffect, useRef } from "react";

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
      sessionStorage.setItem('editorHtmlContent', editorRef.current.innerHTML);
    }
  };

  const generatePDF = async () => {
    if (!editorRef.current || isGeneratingPdf) return;
    
    setIsGeneratingPdf(true);
    try {
      const editorContent = editorRef.current.innerHTML;
      
      const response = await fetch('/api/agreements/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          content: editorContent,
          agreementNumber,
          language 
        }),
      });

      if (!response.ok) throw new Error('Failed to generate PDF');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `Agreement_${agreementNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "PDF Generated Successfully",
        description: "The agreement has been downloaded as a PDF.",
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
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
    <div className="container mx-auto py-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            onClick={goBack}
            className="flex items-center gap-2"
            data-testid="back-button"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Agreements
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Agreement Editor</h1>
            <p className="text-muted-foreground">Agreement #{agreementNumber}</p>
          </div>
        </div>
        
        {isDirty && (
          <div className="text-sm text-orange-600 font-medium">
            • Unsaved changes
          </div>
        )}
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Document Editor</span>
              <Button 
                onClick={generatePDF}
                disabled={isGeneratingPdf}
                className="flex items-center gap-2"
                data-testid="generate-pdf"
              >
                <FileText className="h-4 w-4" />
                {isGeneratingPdf ? 'Generating...' : 'Generate PDF'}
              </Button>
            </CardTitle>
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
                  ? '"Noto Sans Tamil", "Lohit Tamil", system-ui, Arial, sans-serif'
                  : '"Times New Roman", serif'
              }}
              onInput={handleContentChange}
              data-testid="content-editor"
            />
            
            <style>{`
              /* WYSIWYG Editor Styles */
              .editor-content {
                font-family: 'Times New Roman', serif;
                line-height: 1.6;
                color: #000;
              }
              
              .editor-content p {
                margin-bottom: 1em;
              }
              
              .editor-content h1,
              .editor-content h2,
              .editor-content h3,
              .editor-content h4,
              .editor-content h5,
              .editor-content h6 {
                font-weight: bold;
                margin-top: 1.5em;
                margin-bottom: 0.5em;
              }
              
              .editor-content h1 {
                font-size: 2em;
                text-align: center;
                text-transform: uppercase;
              }
              
              .editor-content h2 {
                font-size: 1.5em;
              }
              
              .editor-content h3 {
                font-size: 1.25em;
              }
              
              .editor-content ul,
              .editor-content ol {
                padding-left: 2em;
                margin-bottom: 1em;
              }
              
              .editor-content li {
                margin-bottom: 0.5em;
              }
              
              .editor-content strong,
              .editor-content b {
                font-weight: bold;
              }
              
              .editor-content em,
              .editor-content i {
                font-style: italic;
              }
              
              .editor-content u {
                text-decoration: underline;
              }
              
              .editor-content table {
                border-collapse: collapse;
                width: 100%;
                margin: 1em 0;
              }
              
              .editor-content table,
              .editor-content td,
              .editor-content th {
                border: 1px solid #000;
              }
              
              .editor-content th,
              .editor-content td {
                padding: 8px;
                text-align: left;
              }
              
              .editor-content th {
                background-color: #f0f0f0;
                font-weight: bold;
              }
              
              /* Print styles */
              @media print {
                .no-print {
                  display: none !important;
                }
                
                .editor-content {
                  font-size: 12pt;
                  line-height: 1.4;
                }
                
                .editor-content h1 {
                  font-size: 16pt;
                }
                
                .editor-content h2 {
                  font-size: 14pt;
                }
                
                .editor-content h3 {
                  font-size: 13pt;
                }
              }
            `}</style>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}