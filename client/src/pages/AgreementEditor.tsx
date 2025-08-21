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

    // Add global functions for advanced table manipulation
    (window as any).deleteTable = (tableId: string) => {
      const tableWrapper = document.getElementById(tableId)?.closest('.table-wrapper');
      if (tableWrapper) {
        tableWrapper.remove();
        handleContentChange();
      }
    };

    // Add event listeners for drag handles and table interactions
    const setupTableInteractions = () => {
      if (!editorRef.current) return;

      // Handle row addition via drag handles
      editorRef.current.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('row-add-handle')) {
          const table = target.closest('.table-wrapper')?.querySelector('table');
          const rowIndex = parseInt(target.dataset.row || '0');
          
          if (table) {
            const rows = table.querySelectorAll('tr');
            const referenceRow = rows[Math.min(rowIndex, rows.length - 1)];
            const newRow = referenceRow.cloneNode(true) as HTMLElement;
            
            // Clear cell content and add resize handles
            const cells = newRow.querySelectorAll('td, th');
            cells.forEach(cell => {
              (cell as HTMLElement).innerHTML = '<div class="cell-resize-handle" style="position: absolute; bottom: -2px; right: -2px; width: 4px; height: 4px; background: #007bff; opacity: 0; cursor: se-resize;"></div>';
            });
            
            if (rowIndex === 0) {
              table.insertBefore(newRow, table.firstChild);
            } else {
              referenceRow.insertAdjacentElement('afterend', newRow);
            }
            handleContentChange();
          }
        }
        
        if (target.classList.contains('col-add-handle')) {
          const table = target.closest('.table-wrapper')?.querySelector('table');
          const colIndex = parseInt(target.dataset.col || '0');
          
          if (table) {
            const rows = table.querySelectorAll('tr');
            rows.forEach(row => {
              const cells = Array.from(row.children);
              const referenceIndex = Math.min(colIndex, cells.length - 1);
              const newCell = document.createElement('td');
              newCell.style.border = '1px solid #000';
              newCell.style.padding = '8px';
              newCell.style.position = 'relative';
              newCell.contentEditable = 'true';
              newCell.innerHTML = '<div class="cell-resize-handle" style="position: absolute; bottom: -2px; right: -2px; width: 4px; height: 4px; background: #007bff; opacity: 0; cursor: se-resize;"></div>';
              
              if (colIndex === 0) {
                row.insertBefore(newCell, row.firstChild);
              } else {
                cells[referenceIndex].insertAdjacentElement('afterend', newCell);
              }
            });
            handleContentChange();
          }
        }
      });

      // Show/hide handles on hover
      editorRef.current.addEventListener('mouseover', (e) => {
        const tableWrapper = (e.target as HTMLElement).closest('.table-wrapper');
        if (tableWrapper) {
          const handles = tableWrapper.querySelectorAll('.row-add-handle, .col-add-handle, .cell-resize-handle, .table-controls');
          handles.forEach(handle => {
            (handle as HTMLElement).style.opacity = '1';
          });
        }
      });

      editorRef.current.addEventListener('mouseout', (e) => {
        const tableWrapper = (e.target as HTMLElement).closest('.table-wrapper');
        if (tableWrapper && !tableWrapper.contains(e.relatedTarget as Node)) {
          const handles = tableWrapper.querySelectorAll('.row-add-handle, .col-add-handle, .cell-resize-handle, .table-controls');
          handles.forEach(handle => {
            (handle as HTMLElement).style.opacity = '0';
          });
        }
      });
    };

    // Setup interactions after content is loaded
    setTimeout(setupTableInteractions, 100);
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
    const tableId = 'table_' + Date.now();
    const tableHtml = `
      <div class="table-wrapper" style="position: relative; margin: 20px 0;">
        <!-- Row add handles (left side) -->
        <div class="row-handles" style="position: absolute; left: -30px; top: 0; width: 25px; height: 100%;">
          <div class="row-add-handle" data-row="0" style="position: absolute; top: -5px; left: 0; width: 20px; height: 10px; background: #007bff; opacity: 0; cursor: pointer; border-radius: 3px;" title="Add row above">+</div>
          <div class="row-add-handle" data-row="1" style="position: absolute; top: 35px; left: 0; width: 20px; height: 10px; background: #007bff; opacity: 0; cursor: pointer; border-radius: 3px;" title="Add row between">+</div>
          <div class="row-add-handle" data-row="2" style="position: absolute; bottom: -5px; left: 0; width: 20px; height: 10px; background: #007bff; opacity: 0; cursor: pointer; border-radius: 3px;" title="Add row below">+</div>
        </div>
        
        <!-- Column add handles (top) -->
        <div class="col-handles" style="position: absolute; top: -30px; left: 0; width: 100%; height: 25px;">
          <div class="col-add-handle" data-col="0" style="position: absolute; top: 0; left: -5px; width: 10px; height: 20px; background: #007bff; opacity: 0; cursor: pointer; border-radius: 3px;" title="Add column before">+</div>
          <div class="col-add-handle" data-col="1" style="position: absolute; top: 0; left: 47.5%; width: 10px; height: 20px; background: #007bff; opacity: 0; cursor: pointer; border-radius: 3px;" title="Add column between">+</div>
          <div class="col-add-handle" data-col="2" style="position: absolute; top: 0; right: -5px; width: 10px; height: 20px; background: #007bff; opacity: 0; cursor: pointer; border-radius: 3px;" title="Add column after">+</div>
        </div>

        <table id="${tableId}" class="word-table" style="width: 100%; border-collapse: collapse; position: relative; cursor: default;" contenteditable="false">
          <tr>
            <td style="border: 1px solid #000; padding: 8px; min-width: 100px; position: relative;" contenteditable="true">
              Header 1
              <div class="cell-resize-handle" style="position: absolute; bottom: -2px; right: -2px; width: 4px; height: 4px; background: #007bff; opacity: 0; cursor: se-resize;"></div>
            </td>
            <td style="border: 1px solid #000; padding: 8px; min-width: 100px; position: relative;" contenteditable="true">
              Header 2
              <div class="cell-resize-handle" style="position: absolute; bottom: -2px; right: -2px; width: 4px; height: 4px; background: #007bff; opacity: 0; cursor: se-resize;"></div>
            </td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 8px; position: relative;" contenteditable="true">
              Cell 1
              <div class="cell-resize-handle" style="position: absolute; bottom: -2px; right: -2px; width: 4px; height: 4px; background: #007bff; opacity: 0; cursor: se-resize;"></div>
            </td>
            <td style="border: 1px solid #000; padding: 8px; position: relative;" contenteditable="true">
              Cell 2
              <div class="cell-resize-handle" style="position: absolute; bottom: -2px; right: -2px; width: 4px; height: 4px; background: #007bff; opacity: 0; cursor: se-resize;"></div>
            </td>
          </tr>
        </table>
        
        <!-- Table selection and delete controls -->
        <div class="table-controls" style="position: absolute; top: -50px; right: 0; background: white; border: 1px solid #ddd; border-radius: 4px; padding: 5px; opacity: 0; transition: opacity 0.2s;">
          <button onclick="deleteTable('${tableId}')" style="background: #dc3545; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 12px;">Delete Table</button>
        </div>
      </div>
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
        {/* Sticky Toolbar */}
        <Card className="col-span-12 sticky top-4 z-10 bg-white shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Formatting Tools</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
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
        <Card className="col-span-12 mt-4">
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
            
            {/* Enhanced CSS for Microsoft Word-like table manipulation */}
            <style jsx>{`
              .table-wrapper {
                user-select: none;
              }
              
              .table-wrapper:hover {
                background-color: rgba(0, 123, 255, 0.05);
                border-radius: 4px;
              }
              
              .word-table {
                border: 2px solid transparent;
                transition: border-color 0.2s;
              }
              
              .word-table:hover {
                border-color: #007bff;
              }
              
              .row-add-handle, .col-add-handle {
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 10px;
                font-weight: bold;
                color: white;
                transition: opacity 0.2s, transform 0.1s;
                box-shadow: 0 1px 3px rgba(0,0,0,0.2);
              }
              
              .row-add-handle:hover, .col-add-handle:hover {
                transform: scale(1.1);
                opacity: 1 !important;
              }
              
              .cell-resize-handle {
                transition: opacity 0.2s;
              }
              
              .cell-resize-handle:hover {
                opacity: 1 !important;
                transform: scale(1.2);
              }
              
              .signature-section {
                position: relative;
                resize: both;
                overflow: auto;
                min-width: 300px;
                min-height: 150px;
                transition: all 0.2s;
              }
              
              .signature-section:hover {
                border-color: #007bff !important;
                background-color: #f8f9fa;
                transform: scale(1.01);
              }
              
              .table-controls {
                transition: opacity 0.2s;
              }
              
              .table-controls button:hover {
                background: #c82333;
                transform: scale(1.05);
              }
              
              /* Better visual feedback for contenteditable elements */
              [contenteditable="true"]:focus {
                outline: 2px solid #007bff;
                background-color: rgba(0, 123, 255, 0.05);
                box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.1);
              }
              
              /* Table cell selection */
              td:hover {
                background-color: rgba(0, 123, 255, 0.1);
              }
              
              /* Context menu styling */
              .context-menu {
                position: fixed;
                background: white;
                border: 1px solid #ddd;
                border-radius: 4px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                z-index: 1000;
              }
              
              .context-menu button {
                display: block;
                width: 100%;
                padding: 8px 12px;
                background: none;
                border: none;
                text-align: left;
                cursor: pointer;
                font-size: 14px;
              }
              
              .context-menu button:hover {
                background-color: #f8f9fa;
              }
            `}</style>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}