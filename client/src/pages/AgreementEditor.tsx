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

    // Add global functions for table manipulation
    (window as any).addTableRow = (button: HTMLElement) => {
      const table = button.closest('table');
      if (table) {
        const tbody = table.querySelector('tbody') || table;
        const firstRow = tbody.querySelector('tr');
        if (firstRow) {
          const newRow = firstRow.cloneNode(true) as HTMLElement;
          const cells = newRow.querySelectorAll('td, th');
          cells.forEach(cell => {
            (cell as HTMLElement).textContent = '';
          });
          tbody.appendChild(newRow);
          handleContentChange();
        }
      }
    };

    (window as any).removeTableRow = (button: HTMLElement) => {
      const table = button.closest('table');
      if (table) {
        const rows = table.querySelectorAll('tr');
        if (rows.length > 1) {
          rows[rows.length - 1].remove();
          handleContentChange();
        }
      }
    };

    (window as any).addTableCol = (button: HTMLElement) => {
      const table = button.closest('table');
      if (table) {
        const rows = table.querySelectorAll('tr');
        rows.forEach(row => {
          const cell = document.createElement('td');
          cell.style.border = '1px solid #000';
          cell.style.padding = '8px';
          cell.contentEditable = 'true';
          cell.textContent = '';
          row.appendChild(cell);
        });
        handleContentChange();
      }
    };

    (window as any).removeTableCol = (button: HTMLElement) => {
      const table = button.closest('table');
      if (table) {
        const rows = table.querySelectorAll('tr');
        const firstRow = rows[0];
        if (firstRow && firstRow.children.length > 1) {
          rows.forEach(row => {
            if (row.children.length > 0) {
              row.removeChild(row.children[row.children.length - 1]);
            }
          });
          handleContentChange();
        }
      }
    };
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

  const insertAtCursor = (html: string) => {
    if (editorRef.current) {
      editorRef.current.focus();
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const fragment = range.createContextualFragment(html);
        range.insertNode(fragment);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      } else {
        // If no selection, insert at end
        editorRef.current.innerHTML += html;
      }
      handleContentChange();
    }
  };

  const insertTable = () => {
    const tableHtml = `
      <table class="editable-table" style="width: 100%; border-collapse: collapse; margin: 20px 0; position: relative;" 
             contenteditable="false" 
             onmouseenter="this.querySelector('.table-controls').style.display='block'"
             onmouseleave="this.querySelector('.table-controls').style.display='none'">
        <div class="table-controls" style="display: none; position: absolute; top: -30px; right: 0; background: #f0f0f0; padding: 5px; border-radius: 4px; font-size: 12px;">
          <button onclick="addTableRow(this)" style="margin-right: 5px; padding: 2px 6px; font-size: 11px;">+Row</button>
          <button onclick="removeTableRow(this)" style="margin-right: 5px; padding: 2px 6px; font-size: 11px;">-Row</button>
          <button onclick="addTableCol(this)" style="margin-right: 5px; padding: 2px 6px; font-size: 11px;">+Col</button>
          <button onclick="removeTableCol(this)" style="padding: 2px 6px; font-size: 11px;">-Col</button>
        </div>
        <tr>
          <td style="border: 1px solid #000; padding: 8px; min-width: 100px;" contenteditable="true">Header 1</td>
          <td style="border: 1px solid #000; padding: 8px; min-width: 100px;" contenteditable="true">Header 2</td>
        </tr>
        <tr>
          <td style="border: 1px solid #000; padding: 8px;" contenteditable="true">Cell 1</td>
          <td style="border: 1px solid #000; padding: 8px;" contenteditable="true">Cell 2</td>
        </tr>
      </table>
    `;
    insertAtCursor(tableHtml);
  };

  const insertSignatureSection = () => {
    const signatureHtml = `
      <div style="margin: 40px 0; display: flex; justify-content: space-between; border: 1px dashed #ccc; padding: 20px; position: relative;" class="signature-section">
        <div style="flex: 1; text-align: center;">
          <p style="font-weight: bold;">Owner Signature</p>
          <div style="margin: 40px 0; border-bottom: 1px solid #000; width: 200px; margin-left: auto; margin-right: auto;"></div>
          <p>Date: ___________</p>
        </div>
        <div style="flex: 1; text-align: center;">
          <p style="font-weight: bold;">Tenant Signature</p>
          <div style="margin: 40px 0; border-bottom: 1px solid #000; width: 200px; margin-left: auto; margin-right: auto;"></div>
          <p>Date: ___________</p>
        </div>
      </div>
    `;
    insertAtCursor(signatureHtml);
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => formatText('insertUnorderedList')}
                data-testid="button-bullet-list"
              >
                • List
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => formatText('insertOrderedList')}
                data-testid="button-numbered-list"
              >
                1. List
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => formatText('outdent')}
                data-testid="button-outdent"
              >
                ← Indent
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => formatText('indent')}
                data-testid="button-indent"
              >
                → Indent
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
            
            {/* Enhanced CSS for better table and element manipulation */}
            <style jsx>{`
              .editable-table {
                position: relative;
                resize: both;
                overflow: auto;
                min-width: 200px;
                min-height: 100px;
              }
              
              .editable-table:hover {
                outline: 2px dashed #007bff;
              }
              
              .signature-section {
                position: relative;
                resize: both;
                overflow: auto;
                min-width: 300px;
                min-height: 150px;
              }
              
              .signature-section:hover {
                border-color: #007bff !important;
                background-color: #f8f9fa;
              }
              
              .table-controls button {
                background: #007bff;
                color: white;
                border: none;
                border-radius: 2px;
                cursor: pointer;
              }
              
              .table-controls button:hover {
                background: #0056b3;
              }
              
              /* Make tables draggable */
              .editable-table {
                cursor: move;
              }
              
              /* Better visual feedback for contenteditable elements */
              [contenteditable="true"]:focus {
                outline: 1px solid #007bff;
                background-color: #f8f9fa;
              }
            `}</style>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}