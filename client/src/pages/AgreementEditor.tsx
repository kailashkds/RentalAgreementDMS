import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  Download, 
  FileText, 
  Bold, 
  Italic, 
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Table,
  Type,
  Heading1,
  Heading2,
  Indent,
  Outdent,
  Undo,
  Redo,
  Search,
  Replace,
  Upload,
  Image,
  Plus,
  Minus,
  Move,
  X
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';

// HTML2PDF with proper typing
declare const html2pdf: any;

interface EditorProps {
  initialHtml?: string;
  agreementNumber?: string;
  language?: string;
}

// Advanced WYSIWYG Editor implementation

export default function AgreementEditor() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const editorRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  
  // Find & Replace functionality
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  
  // Image upload functionality
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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

    (window as any).addTableRow = (tableId: string) => {
      const table = document.getElementById(tableId);
      if (table) {
        const tbody = table.querySelector('tbody') || table;
        const firstRow = tbody.querySelector('tr');
        if (firstRow) {
          const newRow = firstRow.cloneNode(true) as HTMLElement;
          const cells = newRow.querySelectorAll('td, th');
          cells.forEach((cell, index) => {
            (cell as HTMLElement).innerHTML = `<div class="cell-resize-handle" style="position: absolute; bottom: -2px; right: -2px; width: 6px; height: 6px; background: #007bff; opacity: 0; cursor: se-resize; border-radius: 1px;"></div>${index === 0 ? (tbody.children.length + 1) + '.' : 'New content...'}`;
          });
          tbody.appendChild(newRow);
          handleContentChange();
        }
      }
    };

    (window as any).addTableCol = (tableId: string) => {
      const table = document.getElementById(tableId);
      if (table) {
        const rows = table.querySelectorAll('tr');
        rows.forEach((row, rowIndex) => {
          const newCell = document.createElement(rowIndex === 0 ? 'th' : 'td');
          newCell.style.border = '1px solid #ddd';
          newCell.style.padding = '12px';
          newCell.style.position = 'relative';
          newCell.contentEditable = 'true';
          if (rowIndex === 0) {
            newCell.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            newCell.style.color = 'white';
            newCell.style.fontWeight = 'bold';
            newCell.style.textAlign = 'center';
            newCell.innerHTML = 'New Column';
          } else {
            newCell.style.background = rowIndex % 2 === 0 ? '#fff' : '#f8f9fa';
            newCell.innerHTML = '<div class="cell-resize-handle" style="position: absolute; bottom: -2px; right: -2px; width: 6px; height: 6px; background: #007bff; opacity: 0; cursor: se-resize; border-radius: 1px;"></div>New content...';
          }
          row.appendChild(newCell);
        });
        handleContentChange();
      }
    };

    (window as any).removeTableRow = (tableId: string) => {
      const table = document.getElementById(tableId);
      if (table) {
        const tbody = table.querySelector('tbody') || table;
        const rows = tbody.querySelectorAll('tr');
        if (rows.length > 1) {
          rows[rows.length - 1].remove();
          handleContentChange();
        }
      }
    };

    (window as any).removeTableCol = (tableId: string) => {
      const table = document.getElementById(tableId);
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

    // Setup table interactions
    const setupTableInteractions = () => {
      if (!editorRef.current) return;

      editorRef.current.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('row-add-handle')) {
          const table = target.closest('.table-wrapper')?.querySelector('table');
          const rowIndex = parseInt(target.dataset.row || '0');
          
          if (table) {
            const rows = table.querySelectorAll('tr');
            const referenceRow = rows[Math.min(rowIndex, rows.length - 1)];
            const newRow = referenceRow.cloneNode(true) as HTMLElement;
            
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

    setTimeout(setupTableInteractions, 100);
  }, [htmlContent]);

  const handleContentChange = () => {
    if (editorRef.current) {
      setIsDirty(true);
      // Auto-save to session storage
      sessionStorage.setItem('editorHtmlContent', editorRef.current.innerHTML);
    }
  };

  // Export to PDF functionality
  const exportToPDF = async () => {
    if (!editorRef.current) {
      toast({
        title: "No content to export",
        description: "Please add some content before exporting to PDF.",
        variant: "destructive"
      });
      return;
    }

    setIsGeneratingPdf(true);
    try {
      // Load html2pdf dynamically
      const html2pdfModule = await import('html2pdf.js');
      const html2pdf = html2pdfModule.default;

      // Create a clean copy of the content for PDF
      const contentClone = editorRef.current.cloneNode(true) as HTMLElement;
      
      // Remove editor-specific elements (handles, controls)
      const elementsToRemove = contentClone.querySelectorAll('.row-add-handle, .col-add-handle, .cell-resize-handle, .table-controls, .row-handles, .col-handles');
      elementsToRemove.forEach(el => el.remove());

      // Create container with proper PDF styling
      const pdfContainer = document.createElement('div');
      pdfContainer.style.padding = '20px';
      pdfContainer.style.fontFamily = 'Arial, sans-serif';
      pdfContainer.style.lineHeight = '1.6';
      pdfContainer.style.color = '#000';
      pdfContainer.style.backgroundColor = '#fff';
      pdfContainer.appendChild(contentClone);

      const opt = {
        margin: [10, 10, 10, 10],
        filename: `${agreementNumber}_edited.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          letterRendering: true
        },
        jsPDF: { 
          unit: 'mm', 
          format: 'a4', 
          orientation: 'portrait',
          compress: true
        }
      };

      await html2pdf().set(opt).from(pdfContainer).save();
      
      toast({
        title: "PDF Export Successful",
        description: `Document exported as ${agreementNumber}_edited.pdf`,
      });
    } catch (error) {
      console.error('PDF export failed:', error);
      toast({
        title: "PDF Export Failed", 
        description: "There was an error generating the PDF. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Find & Replace functionality
  const handleFind = () => {
    if (!findText || !editorRef.current) return;
    
    const content = editorRef.current.innerHTML;
    const searchRegex = new RegExp(findText, 'gi');
    const matches = content.match(searchRegex);
    
    if (matches) {
      // Highlight found text
      const highlightedContent = content.replace(searchRegex, `<mark style="background-color: yellow;">$&</mark>`);
      editorRef.current.innerHTML = highlightedContent;
      
      toast({
        title: "Search Complete",
        description: `Found ${matches.length} instances of "${findText}"`,
      });
    } else {
      toast({
        title: "No matches found",
        description: `No instances of "${findText}" were found.`,
        variant: "destructive"
      });
    }
  };

  const handleReplace = () => {
    if (!findText || !editorRef.current) return;
    
    const content = editorRef.current.innerHTML;
    // Remove existing highlights first
    const cleanContent = content.replace(/<mark[^>]*>(.*?)<\/mark>/gi, '$1');
    
    const searchRegex = new RegExp(findText, 'gi');
    const matches = cleanContent.match(searchRegex);
    
    if (matches) {
      const replacedContent = cleanContent.replace(searchRegex, replaceText);
      editorRef.current.innerHTML = replacedContent;
      handleContentChange();
      
      toast({
        title: "Replace Complete",
        description: `Replaced ${matches.length} instances of "${findText}" with "${replaceText}"`,
      });
    } else {
      toast({
        title: "No matches found",
        description: `No instances of "${findText}" were found to replace.`,
        variant: "destructive"
      });
    }
    
    // Clear search state
    setFindText('');
    setReplaceText('');
    setShowFindReplace(false);
  };

  // Image upload functionality
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const imageUrl = e.target?.result as string;
          setUploadedImages(prev => [...prev, imageUrl]);
          insertImage(imageUrl);
        };
        reader.readAsDataURL(file);
      } else {
        toast({
          title: "Invalid file type",
          description: "Please select image files only (JPG, PNG, GIF, etc.)",
          variant: "destructive"
        });
      }
    });
  };

  const insertImage = (imageUrl: string) => {
    if (!editorRef.current) return;
    
    const imageHtml = `
      <div class="image-container" style="margin: 20px 0; text-align: center;">
        <img src="${imageUrl}" 
             style="max-width: 100%; height: auto; border: 1px solid #ccc; cursor: pointer;" 
             onclick="this.style.maxWidth = this.style.maxWidth === '50%' ? '100%' : '50%'"
             alt="Uploaded image" />
        <div style="font-size: 10px; color: #666; margin-top: 5px;">
          Click image to resize • Drag to reposition
        </div>
      </div>
    `;
    
    // Insert at cursor position
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createRange().createContextualFragment(imageHtml));
    } else {
      // Append to end if no selection
      editorRef.current.insertAdjacentHTML('beforeend', imageHtml);
    }
    
    handleContentChange();
    setShowImageUpload(false);
    
    toast({
      title: "Image Added",
      description: "Image inserted successfully. Click to resize.",
    });
  };

  // Enhanced signature section management
  const addSignatureSection = () => {
    if (!editorRef.current) return;
    
    const signatureHtml = `
      <div class="signature-section" style="margin: 40px 0; border: 1px dashed #007bff; padding: 20px; position: relative;">
        <div style="position: absolute; top: 5px; right: 5px;">
          <button onclick="this.parentElement.parentElement.remove(); handleContentChange();" 
                  style="background: #dc3545; color: white; border: none; border-radius: 3px; padding: 2px 6px; cursor: pointer; font-size: 12px;">
            ×
          </button>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: end; margin-top: 20px;">
          <div style="text-align: left; width: 45%;">
            <div style="border-bottom: 1px solid #000; width: 200px; height: 40px; margin-bottom: 10px;"></div>
            <div contenteditable="true" style="font-weight: bold; outline: none; border: 1px dashed #ccc; padding: 4px;">
              [Name]
            </div>
            <div contenteditable="true" style="font-size: 12px; outline: none; border: 1px dashed #ccc; padding: 4px; margin-top: 2px;">
              [Role/Title]
            </div>
            <div style="font-size: 12px; margin-top: 5px;">Date: ___________</div>
          </div>
          <div style="text-align: right; width: 45%;">
            <div style="border-bottom: 1px solid #000; width: 200px; height: 40px; margin-bottom: 10px; margin-left: auto;"></div>
            <div contenteditable="true" style="font-weight: bold; outline: none; border: 1px dashed #ccc; padding: 4px; text-align: center;">
              [Name]
            </div>
            <div contenteditable="true" style="font-size: 12px; outline: none; border: 1px dashed #ccc; padding: 4px; margin-top: 2px; text-align: center;">
              [Role/Title]
            </div>
            <div style="font-size: 12px; margin-top: 5px; text-align: center;">Date: ___________</div>
          </div>
        </div>
      </div>
    `;
    
    // Insert at cursor position or at end
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createRange().createContextualFragment(signatureHtml));
    } else {
      editorRef.current.insertAdjacentHTML('beforeend', signatureHtml);
    }
    
    handleContentChange();
    
    toast({
      title: "Signature Section Added",
      description: "Click on the name/role fields to edit them.",
    });
  };

  const formatText = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    handleContentChange();
  };

  // Apply predefined styles for agreements
  const applyStyle = (styleName: string) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const element = document.createElement('div');
    
    switch (styleName) {
      case 'agreement-title':
        element.style.fontSize = '18pt';
        element.style.fontWeight = 'bold';
        element.style.textAlign = 'center';
        element.style.marginBottom = '20px';
        element.style.textTransform = 'uppercase';
        break;
      case 'clause-heading':
        element.style.fontSize = '14pt';
        element.style.fontWeight = 'bold';
        element.style.marginTop = '16px';
        element.style.marginBottom = '8px';
        break;
      case 'body-text':
        element.style.fontSize = '12pt';
        element.style.lineHeight = '1.5';
        element.style.textAlign = 'justify';
        break;
      case 'h1':
        formatText('formatBlock', 'h1');
        return;
      case 'h2':
        formatText('formatBlock', 'h2');
        return;
    }

    if (styleName !== 'h1' && styleName !== 'h2') {
      element.innerHTML = range.toString();
      range.deleteContents();
      range.insertNode(element);
      handleContentChange();
    }
  };

  // Set line spacing for paragraphs
  const setLineSpacing = (spacing: string) => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const parentElement = range.commonAncestorContainer.nodeType === Node.TEXT_NODE 
        ? range.commonAncestorContainer.parentElement 
        : range.commonAncestorContainer as HTMLElement;
      
      if (parentElement && editorRef.current?.contains(parentElement)) {
        parentElement.style.lineHeight = spacing;
        handleContentChange();
      }
    }
  };

  // Insert page break
  const insertPageBreak = () => {
    const pageBreakHtml = `<div style="page-break-before: always; border-top: 2px dashed #ccc; margin: 20px 0; padding: 10px; text-align: center; color: #666; background: #f9f9f9;">── Page Break ──</div>`;
    insertAtCursor(pageBreakHtml);
  };

  // Insert image placeholder
  const insertImagePlaceholder = () => {
    const imagePlaceholderHtml = `
      <div style="border: 2px dashed #007bff; padding: 20px; margin: 10px 0; text-align: center; background: #f8f9fa; border-radius: 4px;">
        <div style="font-size: 48px; color: #007bff; margin-bottom: 10px;">🖼</div>
        <div style="color: #666; font-size: 14px;">
          <strong>Image Placeholder</strong><br>
          (Passport photo, seal, or document image)
        </div>
      </div>
    `;
    insertAtCursor(imagePlaceholderHtml);
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
      <div class="table-wrapper" style="position: relative; margin: 30px 0; border: 2px solid transparent; border-radius: 8px; background: #f8f9fa; padding: 15px;">
        <!-- Enhanced Table Controls -->
        <div class="table-controls" style="position: absolute; top: -50px; right: 0; background: white; border: 1px solid #ddd; border-radius: 6px; padding: 6px; opacity: 0; transition: opacity 0.3s; display: flex; gap: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.15);">
          <button onclick="addTableRow('${tableId}')" style="background: #28a745; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: bold;" title="Add Row">+ Row</button>
          <button onclick="addTableCol('${tableId}')" style="background: #007bff; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: bold;" title="Add Column">+ Col</button>
          <button onclick="removeTableRow('${tableId}')" style="background: #ffc107; color: #212529; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: bold;" title="Remove Row">- Row</button>
          <button onclick="removeTableCol('${tableId}')" style="background: #fd7e14; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: bold;" title="Remove Column">- Col</button>
          <button onclick="deleteTable('${tableId}')" style="background: #dc3545; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: bold;" title="Delete Table">🗑 Delete</button>
        </div>

        <!-- Row/Column Add Handles -->
        <div class="row-handles" style="position: absolute; left: -25px; top: 15px; bottom: 15px; width: 20px; opacity: 0; transition: opacity 0.3s;">
          <div class="row-add-handle" data-row="0" style="position: absolute; top: 0; width: 20px; height: 20px; background: #28a745; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold;" title="Add row above">+</div>
          <div class="row-add-handle" data-row="1" style="position: absolute; bottom: 0; width: 20px; height: 20px; background: #28a745; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold;" title="Add row below">+</div>
        </div>
        
        <div class="col-handles" style="position: absolute; top: -25px; left: 15px; right: 15px; height: 20px; opacity: 0; transition: opacity 0.3s;">
          <div class="col-add-handle" data-col="0" style="position: absolute; left: 0; width: 20px; height: 20px; background: #007bff; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold;" title="Add column left">+</div>
          <div class="col-add-handle" data-col="1" style="position: absolute; right: 0; width: 20px; height: 20px; background: #007bff; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold;" title="Add column right">+</div>
        </div>

        <table id="${tableId}" class="agreement-table" style="width: 100%; border-collapse: collapse; position: relative; background: white; border-radius: 4px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);" contenteditable="false">
          <thead>
            <tr style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
              <th style="border: 1px solid #333; padding: 15px; color: white; font-weight: bold; text-align: center;" contenteditable="true">Clause</th>
              <th style="border: 1px solid #333; padding: 15px; color: white; font-weight: bold; text-align: center;" contenteditable="true">Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border: 1px solid #ddd; padding: 12px; position: relative; background: #fff;" contenteditable="true">
                <div class="cell-resize-handle" style="position: absolute; bottom: -2px; right: -2px; width: 6px; height: 6px; background: #007bff; opacity: 0; cursor: se-resize; border-radius: 1px;"></div>
                1.
              </td>
              <td style="border: 1px solid #ddd; padding: 12px; position: relative; background: #fff;" contenteditable="true">
                <div class="cell-resize-handle" style="position: absolute; bottom: -2px; right: -2px; width: 6px; height: 6px; background: #007bff; opacity: 0; cursor: se-resize; border-radius: 1px;"></div>
                Enter clause details here...
              </td>
            </tr>
            <tr style="background: #f8f9fa;">
              <td style="border: 1px solid #ddd; padding: 12px; position: relative;" contenteditable="true">
                <div class="cell-resize-handle" style="position: absolute; bottom: -2px; right: -2px; width: 6px; height: 6px; background: #007bff; opacity: 0; cursor: se-resize; border-radius: 1px;"></div>
                2.
              </td>
              <td style="border: 1px solid #ddd; padding: 12px; position: relative;" contenteditable="true">
                <div class="cell-resize-handle" style="position: absolute; bottom: -2px; right: -2px; width: 6px; height: 6px; background: #007bff; opacity: 0; cursor: se-resize; border-radius: 1px;"></div>
                Enter additional clause details...
              </td>
            </tr>
          </tbody>
        </table>
        
        <div style="text-align: center; margin-top: 10px; color: #6c757d; font-size: 11px;">
          Hover to show controls • Click cells to edit • Drag corners to resize
        </div>
      </div>
    `;
    insertAtCursor(tableHtml);
    
    toast({
      title: "Advanced Table Added",
      description: "Professional table with enhanced controls inserted.",
    });
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

  // Utility functions already defined above


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
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Microsoft Word-Style Editor</CardTitle>
              <div className="flex items-center gap-2">
                {isDirty && <Badge variant="destructive" className="animate-pulse">Unsaved</Badge>}
                <Button 
                  onClick={exportToPDF}
                  disabled={isGeneratingPdf}
                  className="bg-blue-600 hover:bg-blue-700"
                  size="sm"
                >
                  {isGeneratingPdf ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                      Generating PDF...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Export PDF
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            {/* Agreement-Focused Document Editor Toolbar */}
            <div className="bg-gray-50 border rounded-lg p-3">
              {/* Row 1: Styles and Font Settings */}
              <div className="flex flex-wrap items-center gap-2 mb-2 pb-2 border-b border-gray-200">
                <div className="flex items-center gap-1 border-r pr-2">
                  <select 
                    className="text-sm border rounded px-3 py-1 min-w-[140px]"
                    onChange={(e) => applyStyle(e.target.value)}
                    defaultValue="body-text"
                  >
                    <option value="agreement-title">Agreement Title</option>
                    <option value="clause-heading">Clause Heading</option>
                    <option value="body-text">Body Text</option>
                    <option value="h1">Heading 1</option>
                    <option value="h2">Heading 2</option>
                  </select>
                  
                  <select 
                    className="text-sm border rounded px-2 py-1 ml-1"
                    onChange={(e) => formatText('fontName', e.target.value)}
                    defaultValue="Times New Roman"
                  >
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Arial">Arial</option>
                    <option value="Calibri">Calibri</option>
                  </select>
                  
                  <select 
                    className="text-sm border rounded px-2 py-1 ml-1"
                    onChange={(e) => formatText('fontSize', e.target.value)}
                    defaultValue="4"
                  >
                    <option value="3">12pt</option>
                    <option value="4">14pt</option>
                    <option value="5">16pt</option>
                    <option value="6">18pt</option>
                    <option value="7">24pt</option>
                  </select>
                </div>

                <div className="flex items-center gap-1 border-r pr-2">
                  <Button variant="ghost" size="sm" onClick={() => formatText('bold')} className="h-8 w-8 p-0" title="Bold">
                    <Bold className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => formatText('italic')} className="h-8 w-8 p-0" title="Italic">
                    <Italic className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => formatText('underline')} className="h-8 w-8 p-0" title="Underline">
                    <Underline className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center gap-1">
                  <select 
                    className="text-sm border rounded px-2 py-1"
                    onChange={(e) => formatText('foreColor', e.target.value)}
                    defaultValue="#000000"
                    title="Text Color"
                  >
                    <option value="#000000">Black</option>
                    <option value="#6B7280">Gray</option>
                    <option value="#2563EB">Blue</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Paragraph Formatting */}
              <div className="flex flex-wrap items-center gap-2 mb-2 pb-2 border-b border-gray-200">
                <div className="flex items-center gap-1 border-r pr-2">
                  <Button variant="ghost" size="sm" onClick={() => formatText('justifyLeft')} className="h-8 w-8 p-0" title="Align Left">
                    <AlignLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => formatText('justifyCenter')} className="h-8 w-8 p-0" title="Center">
                    <AlignCenter className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => formatText('justifyRight')} className="h-8 w-8 p-0" title="Align Right">
                    <AlignRight className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => formatText('justifyFull')} className="h-8 w-8 p-0" title="Justify">
                    <Type className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center gap-1 border-r pr-2">
                  <select 
                    className="text-sm border rounded px-2 py-1"
                    onChange={(e) => setLineSpacing(e.target.value)}
                    defaultValue="1.5"
                    title="Line Spacing"
                  >
                    <option value="1.0">1.0</option>
                    <option value="1.5">1.5</option>
                    <option value="2.0">2.0</option>
                  </select>
                  
                  <Button variant="ghost" size="sm" onClick={() => formatText('outdent')} className="h-8 w-8 p-0" title="Decrease Indent">
                    <Outdent className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => formatText('indent')} className="h-8 w-8 p-0" title="Increase Indent">
                    <Indent className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => formatText('insertUnorderedList')} className="h-8 w-8 p-0" title="Bullet List">
                    <List className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => formatText('insertOrderedList')} className="h-8 w-8 p-0" title="Numbered List">
                    <ListOrdered className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Row 3: Advanced Features */}
              <div className="flex flex-wrap items-center gap-2 mb-2 pb-2 border-b border-gray-200">
                <div className="flex items-center gap-1 border-r pr-2">
                  <Dialog open={showFindReplace} onOpenChange={setShowFindReplace}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 px-2" title="Find & Replace">
                        <Search className="h-4 w-4 mr-1" />
                        Find
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Find & Replace</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <div>
                          <Label htmlFor="find-text">Find:</Label>
                          <Input
                            id="find-text"
                            value={findText}
                            onChange={(e) => setFindText(e.target.value)}
                            placeholder="Enter text to find..."
                            onKeyDown={(e) => e.key === 'Enter' && handleFind()}
                          />
                        </div>
                        <div>
                          <Label htmlFor="replace-text">Replace with:</Label>
                          <Input
                            id="replace-text"
                            value={replaceText}
                            onChange={(e) => setReplaceText(e.target.value)}
                            placeholder="Enter replacement text..."
                            onKeyDown={(e) => e.key === 'Enter' && handleReplace()}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={handleFind} variant="outline" className="flex-1">
                            <Search className="h-4 w-4 mr-2" />
                            Find All
                          </Button>
                          <Button onClick={handleReplace} className="flex-1">
                            <Replace className="h-4 w-4 mr-2" />
                            Replace All
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 px-2" 
                    title="Upload Image"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 mr-1" />
                    Image
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    style={{ display: 'none' }}
                  />
                </div>

                <div className="flex items-center gap-1 border-r pr-2">
                  <Button variant="ghost" size="sm" onClick={insertTable} className="h-8 px-2" title="Insert Advanced Table">
                    <Table className="h-4 w-4 mr-1" />
                    Table
                  </Button>
                  <Button variant="ghost" size="sm" onClick={addSignatureSection} className="h-8 px-2" title="Add Enhanced Signature">
                    <FileText className="h-4 w-4 mr-1" />
                    Signature
                  </Button>
                </div>

                <div className="flex items-center gap-1 border-r pr-2">
                  <Button variant="ghost" size="sm" onClick={insertPageBreak} className="h-8 px-2" title="Page Break">
                    ⏎ Page Break
                  </Button>
                </div>

                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => formatText('undo')} className="h-8 w-8 p-0" title="Undo">
                    <Undo className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => formatText('redo')} className="h-8 w-8 p-0" title="Redo">
                    <Redo className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {/* Row 4: Document Elements */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                  Professional Legal Editor • Advanced Table Controls • Multiple Signatures • Image Upload • Find & Replace
                </div>
              </div>
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
            
            <style>{`
              /* WYSIWYG Editor Styles */
              .table-wrapper {
                user-select: none;
              }
              
              .table-wrapper:hover .word-table {
                background-color: rgba(0, 123, 255, 0.02);
                border-radius: 4px;
              }
              
              .word-table {
                border: 2px solid transparent;
                transition: border-color 0.2s, background-color 0.2s;
                background-color: transparent;
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
              
              /* WYSIWYG Editor Content Area */
              .wysiwyg-editor {
                min-height: 600px;
                padding: 40px;
                background: white;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                font-family: 'Times New Roman', serif;
                font-size: 14px;
                line-height: 1.6;
                color: #000;
                outline: none;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
              }
              
              .wysiwyg-editor:focus {
                outline: none;
                border-color: #007bff;
                box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
              }
              
              /* Better visual feedback for contenteditable elements */
              [contenteditable="true"]:focus {
                outline: 1px solid #007bff;
                background-color: transparent;
              }
              
              /* Table cell selection - only for table cells */
              .word-table td:hover {
                background-color: rgba(0, 123, 255, 0.1);
              }
              
              /* Remove blue tint from general content */
              div[contenteditable="true"] {
                background-color: transparent !important;
              }
              
              div[contenteditable="true"]:focus {
                background-color: transparent !important;
              }
            `}</style>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}