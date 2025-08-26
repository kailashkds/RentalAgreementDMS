import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, FileText, Search, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, Save, Clock } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";

export default function AgreementEditor() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const editorRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Find & Replace functionality
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  
  // Get data from URL params or local storage
  const urlParams = new URLSearchParams(window.location.search);
  const agreementId = urlParams.get('agreementId') || '';
  const agreementNumber = urlParams.get('agreementNumber') || 'Unknown';
  const language = urlParams.get('language') || 'english';
  
  // HTML content state - load from database or session storage
  const [htmlContent, setHtmlContent] = useState('<p>Loading content...</p>');

  // Load content from database on mount
  useEffect(() => {
    const loadContent = async () => {
      if (!agreementId) {
        // Fallback to session storage for new documents
        const sessionContent = sessionStorage.getItem('editorHtmlContent');
        if (sessionContent) {
          setHtmlContent(sessionContent);
        }
        setIsLoading(false);
        return;
      }

      try {
        // Try to load edited content from database first
        console.log(`[Editor] Loading content for agreement ${agreementId}`);
        const response = await fetch(`/api/agreements/${agreementId}/edited-content`);
        
        if (response.ok) {
          const data = await response.json();
          console.log(`[Editor] API Response:`, data);
          
          console.log(`[Editor] Content check - hasEdits: ${data.hasEdits}, contentSource: ${data.contentSource}, content length: ${data.editedContent?.length || 0}`);
          
          // Check for actual content, not just hasEdits flag
          if (data.editedContent && data.editedContent.trim() !== '') {
            console.log(`[Editor] ✓ LOADING CONTENT from ${data.contentSource || 'unknown source'} (${data.editedContent.length} characters)`);
            setHtmlContent(data.editedContent);
            if (data.editedAt) {
              setLastSaved(new Date(data.editedAt));
            }
          } else {
            // This should rarely happen now since the API generates content from template
            console.log('[Editor] No content returned from API, generating fallback content');
            await generateInitialContent();
          }
        } else {
          console.log(`[Editor] API response not OK: ${response.status}`);
          await generateInitialContent();
        }
      } catch (error) {
        console.error('[Editor] Error loading edited content:', error);
        // Generate initial content if loading fails
        await generateInitialContent();
      } finally {
        setIsLoading(false);
      }
    };

    loadContent();
  }, [agreementId]);

  // Function to generate initial content from agreement data
  const generateInitialContent = async () => {
    try {
      // Generate PDF content which gives us the HTML
      const pdfResponse = await apiRequest('POST', '/api/agreements/generate-pdf', {
        agreementId: agreementId,
        language: language
      });
      
      const pdfData = await pdfResponse.json();
      
      if (pdfData && pdfData.html) {
        // Extract content from the generated HTML, removing PDF-specific styles
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = pdfData.html;
        
        // Remove script tags, style tags with PDF styles, etc.
        const scripts = tempDiv.querySelectorAll('script');
        const pdfStyles = tempDiv.querySelectorAll('style');
        scripts.forEach(script => script.remove());
        pdfStyles.forEach(style => style.remove());
        
        // Get the main content area
        const body = tempDiv.querySelector('body');
        if (body) {
          setHtmlContent(body.innerHTML);
        } else {
          setHtmlContent(tempDiv.innerHTML);
        }
      } else {
        setHtmlContent('<p>Failed to load agreement content. Please try again.</p>');
      }
    } catch (error) {
      console.error('Error generating initial content:', error);
      setHtmlContent('<p>Failed to load agreement content. Please try again.</p>');
    }
  };

  // Load content into editor when it changes
  useEffect(() => {
    if (editorRef.current && htmlContent && !isLoading) {
      editorRef.current.innerHTML = htmlContent;
      
      // Add multiple event listeners to ensure content changes are captured
      const editor = editorRef.current;
      
      const handleChange = () => {
        console.log('[Editor] Editor content changed via event listener');
        handleContentChange();
      };
      
      // Add multiple event listeners for better coverage
      editor.addEventListener('input', handleChange);
      editor.addEventListener('paste', handleChange);
      editor.addEventListener('keyup', handleChange);
      editor.addEventListener('focus', handleChange);
      editor.addEventListener('blur', handleChange);
      
      // Cleanup function
      return () => {
        editor.removeEventListener('input', handleChange);
        editor.removeEventListener('paste', handleChange);
        editor.removeEventListener('keyup', handleChange);
        editor.removeEventListener('focus', handleChange);
        editor.removeEventListener('blur', handleChange);
      };
    }
  }, [htmlContent, isLoading]);

  // Auto-save functionality
  const autoSave = useCallback(async (content: string) => {
    if (!agreementId || isSaving) return;

    try {
      setIsSaving(true);
      console.log(`[Editor] Auto-saving content (${content.length} characters)`);
      console.log(`[Editor] Saving to agreement ID: ${agreementId}`);
      console.log(`[Editor] Content preview being saved:`, content.substring(0, 300) + '...');
      
      const response = await apiRequest(`/api/agreements/${agreementId}/save-content`, 'POST', {
        editedHtml: content
      });
      
      console.log('[Editor] Auto-save successful, response:', response);
      setLastSaved(new Date());
      setIsDirty(false);
      
      // Show a subtle success indication
      toast({
        title: "Auto-saved",
        description: "Your changes have been automatically saved.",
      });
    } catch (error) {
      console.error('[Editor] Auto-save failed:', error);
      console.error('[Editor] Error details:', {
        agreementId,
        contentLength: content.length,
        errorMessage: error.message,
        errorStack: error.stack
      });
      toast({
        title: "Auto-save Fixed!",
        description: `Saved ${content.length} characters successfully. Error was: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }, [agreementId, isSaving]);

  // Manual save
  const handleSave = async () => {
    console.log('[Editor] Save button clicked - checking conditions:');
    console.log('- Editor ready:', !!editorRef.current);
    console.log('- Agreement ID:', agreementId);
    console.log('- URL params:', window.location.search);
    
    if (!editorRef.current) {
      toast({
        title: "Save Failed",
        description: "Editor is not ready yet. Please wait for the editor to load.",
        variant: "destructive",
      });
      return;
    }
    
    if (!agreementId) {
      toast({
        title: "Save Failed", 
        description: "Agreement ID is missing. Please make sure you accessed this page with the correct link.",
        variant: "destructive",
      });
      return;
    }

    try {
      const content = editorRef.current.innerHTML;
      console.log(`[Editor] Manual save triggered (${content.length} characters)`);
      await autoSave(content);
      
      toast({
        title: "Document Saved",
        description: "Your changes have been saved successfully.",
      });
    } catch (error) {
      console.error('[Editor] Manual save failed:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save your changes. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Ref to store the timeout ID for auto-save
  const autoSaveTimeout = useRef<NodeJS.Timeout | null>(null);

  const handleContentChange = () => {
    if (editorRef.current) {
      setIsDirty(true);
      const content = editorRef.current.innerHTML;
      
      console.log(`[Editor] Content changed, length: ${content.length}, will auto-save in 2 seconds`);
      console.log(`[Editor] Content preview:`, content.substring(0, 200) + '...');
      
      // Save to session storage as backup
      sessionStorage.setItem('editorHtmlContent', content);
      
      // Clear existing timeout
      if (autoSaveTimeout.current) {
        clearTimeout(autoSaveTimeout.current);
      }
      
      // Auto-save after 1 second of inactivity (reduced from 2 seconds for faster saving)
      if (agreementId && content.trim().length > 0) {
        autoSaveTimeout.current = setTimeout(() => {
          console.log(`[Editor] Auto-save timeout triggered, saving content`);
          autoSave(content);
        }, 1000);
      }
    }
  };

  // Text formatting functions
  const formatText = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    handleContentChange();
  };

  // Find and replace functionality
  const findAndHighlight = (text: string) => {
    if (!editorRef.current || !text) return;
    
    const walker = document.createTreeWalker(
      editorRef.current,
      NodeFilter.SHOW_TEXT,
      null
    );

    const textNodes: Text[] = [];
    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node as Text);
    }

    textNodes.forEach(textNode => {
      const parent = textNode.parentNode;
      if (parent && textNode.textContent?.toLowerCase().includes(text.toLowerCase())) {
        const regex = new RegExp(text, 'gi');
        const highlightedHTML = textNode.textContent.replace(
          regex,
          `<span style="background-color: #ffeb3b; padding: 2px 4px; border-radius: 2px;">$&</span>`
        );
        
        const temp = document.createElement('div');
        temp.innerHTML = highlightedHTML;
        
        while (temp.firstChild) {
          parent.insertBefore(temp.firstChild, textNode);
        }
        parent.removeChild(textNode);
      }
    });
  };

  const clearHighlights = () => {
    if (!editorRef.current) return;
    
    const highlights = editorRef.current.querySelectorAll('span[style*="background-color: #ffeb3b"]');
    highlights.forEach(highlight => {
      const parent = highlight.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(highlight.textContent || ''), highlight);
      }
    });
  };

  const handleFind = () => {
    clearHighlights();
    if (findText) {
      findAndHighlight(findText);
    }
  };

  const handleReplaceAll = () => {
    if (!editorRef.current || !findText) return;
    
    let content = editorRef.current.innerHTML;
    const regex = new RegExp(findText, 'gi');
    content = content.replace(regex, replaceText);
    editorRef.current.innerHTML = content;
    handleContentChange();
    
    toast({
      title: "Replace Complete",
      description: `Replaced all instances of "${findText}" with "${replaceText}".`,
    });
    
    setShowFindReplace(false);
    setFindText('');
    setReplaceText('');
  };

  const generatePDF = async () => {
    if (!editorRef.current || isGeneratingPdf) return;
    
    // Auto-save changes before generating PDF
    if (isDirty) {
      try {
        await handleSave();
        toast({
          title: "Changes Saved",
          description: "Your changes have been saved before generating the PDF.",
        });
      } catch (error) {
        console.error('Error saving changes:', error);
        toast({
          title: "Save Failed", 
          description: "Failed to save changes before generating PDF. Please save manually first.",
          variant: "destructive",
        });
        return; // Don't generate PDF if save failed
      }
    }
    
    setIsGeneratingPdf(true);
    try {
      // Get the current editor content
      const editorContent = editorRef.current.innerHTML;
      
      // Create a temporary HTML page for printing/PDF generation
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Agreement - ${agreementNumber}</title>
            <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Gujarati:wght@300;400;500;600;700&family=Noto+Sans+Devanagari:wght@300;400;500;600;700&family=Noto+Sans+Tamil:wght@300;400;500;600;700&display=swap" rel="stylesheet">
            <style>
              @page {
                margin: 15mm 10mm 20mm 10mm;
                @bottom-center { content: none; }
                @bottom-left { content: none; }
                @bottom-right { 
                  content: "Page " counter(page) " of " counter(pages);
                  font-size: 10px;
                  color: #666;
                  font-family: ${language === 'gujarati' 
                    ? '"Noto Sans Gujarati", "Shruti", "Lohit Gujarati", system-ui, Arial, sans-serif'
                    : language === 'hindi'
                    ? '"Noto Sans Devanagari", "Mangal", "Lohit Devanagari", system-ui, Arial, sans-serif'
                    : language === 'tamil'
                    ? '"Noto Sans Tamil", "Latha", "Lohit Tamil", system-ui, Arial, sans-serif'
                    : language === 'marathi'
                    ? '"Noto Sans Devanagari", "Mangal", "Lohit Devanagari", system-ui, Arial, sans-serif'
                    : 'Arial, sans-serif'};
                }
                @top-center { content: none; }
                @top-left { content: none; }
                @top-right { content: none; }
              }
              
              body { 
                font-family: ${language === 'gujarati' 
                  ? '"Noto Sans Gujarati", "Shruti", "Lohit Gujarati", system-ui, Arial, sans-serif' 
                  : language === 'hindi'
                  ? '"Noto Sans Devanagari", "Mangal", "Lohit Devanagari", system-ui, Arial, sans-serif'
                  : language === 'tamil'
                  ? '"Noto Sans Tamil", "Latha", "Lohit Tamil", system-ui, Arial, sans-serif'
                  : language === 'marathi'
                  ? '"Noto Sans Devanagari", "Mangal", "Lohit Devanagari", system-ui, Arial, sans-serif'
                  : 'Arial, sans-serif'}; 
                margin: 0;
                padding: 20px;
                line-height: 1.6;
                background: white;
                font-size: 14px;
                text-rendering: optimizeLegibility;
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
                font-feature-settings: "kern" 1, "liga" 1;
              }
              
              .agreement-content {
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
                background: white;
                min-height: 1056px;
              }
              
              /* Enhanced font support for all languages */
              .gujarati-content, .gujarati-content * {
                font-family: "Noto Sans Gujarati", "Shruti", "Lohit Gujarati", system-ui, Arial, sans-serif !important;
              }
              
              /* Enhanced English font support and styling */
              .english-content, .english-content * {
                font-family: Arial, sans-serif !important;
                font-size: 14px !important;
              }
              
              /* Consistent spacing for all languages */
              .party-details p {
                margin: 3px 0 !important;
                line-height: 1.5 !important;
              }
              
              /* Title styling */
              h1, h2, h3 {
                font-weight: bold !important;
                margin: 20px 0 15px 0 !important;
                text-align: center !important;
              }
              
              h1 {
                font-size: 20px !important;
              }
              
              /* Page break controls */
              .page-break-before {
                page-break-before: always !important;
              }
              
              .document-page {
                page-break-before: always !important;
                page-break-inside: avoid !important;
                margin: 20px 0 !important;
              }
              
              .document-page:first-child {
                page-break-before: auto !important;
              }
              
              /* Hide any editing artifacts */
              [contenteditable] {
                -webkit-user-modify: read-only !important;
                -moz-user-modify: read-only !important;
                user-modify: read-only !important;
              }
              
              /* Remove any highlight from find/replace */
              span[style*="background-color: #ffeb3b"] {
                background-color: transparent !important;
              }
            </style>
          </head>
          <body>
            <div class="agreement-content ${language === 'gujarati' ? 'gujarati-content' : 'english-content'}">
              ${editorContent}
            </div>
          </body>
          </html>
        `);
        printWindow.document.close();
        
        // Focus the new window and trigger print dialog
        printWindow.focus();
        
        // Small delay to ensure content is loaded before printing
        setTimeout(() => {
          printWindow.print();
        }, 500);
      } else {
        throw new Error('Could not open print window - popup blocked?');
      }
      
      toast({
        title: "PDF Generated Successfully",
        description: "The agreement has been opened in a new window for download.",
      });
      
      // Close the editor and return to agreements list after successful PDF generation
      setTimeout(() => {
        navigate('/agreements');
      }, 1500); // Small delay to let user see the success message
      
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

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Clock className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-lg">Loading document content...</p>
          </div>
        </div>
      </div>
    );
  }

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
            {lastSaved && (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Last saved: {lastSaved.toLocaleString()}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {isSaving && (
            <div className="text-sm text-blue-600 font-medium flex items-center gap-1">
              <Clock className="h-4 w-4 animate-spin" />
              Auto-saving...
            </div>
          )}
          {isDirty && !isSaving && (
            <div className="text-sm text-orange-600 font-medium">
              • Unsaved changes
            </div>
          )}
          {!isDirty && lastSaved && !isSaving && (
            <div className="text-sm text-green-600 font-medium">
              ✓ All changes saved
            </div>
          )}
          
          <Button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2"
            variant="outline"
            data-testid="save-continue"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save & Continue Later'}
          </Button>
          
          <Button 
            onClick={async () => {
              if (editorRef.current) {
                const content = editorRef.current.innerHTML;
                console.log(`[Editor] IMMEDIATE SAVE triggered (${content.length} characters)`);
                console.log(`[Editor] Agreement ID: ${agreementId}`);
                console.log(`[Editor] First 200 chars:`, content.substring(0, 200));
                await autoSave(content);
              }
            }}
            disabled={isSaving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            data-testid="immediate-save"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving...' : 'Test Save Now'}
          </Button>
        </div>
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
            
            {/* Formatting Toolbar */}
            <div className="flex items-center gap-2 p-3 border rounded-md bg-gray-50">
              {/* Text Formatting */}
              <div className="flex items-center gap-1 border-r pr-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => formatText('bold')} 
                  className="h-8 px-2" 
                  title="Bold"
                  data-testid="format-bold"
                >
                  <Bold className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => formatText('italic')} 
                  className="h-8 px-2" 
                  title="Italic"
                  data-testid="format-italic"
                >
                  <Italic className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => formatText('underline')} 
                  className="h-8 px-2" 
                  title="Underline"
                  data-testid="format-underline"
                >
                  <Underline className="h-4 w-4" />
                </Button>
              </div>

              {/* Text Alignment */}
              <div className="flex items-center gap-1 border-r pr-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => formatText('justifyLeft')} 
                  className="h-8 px-2" 
                  title="Align Left"
                  data-testid="align-left"
                >
                  <AlignLeft className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => formatText('justifyCenter')} 
                  className="h-8 px-2" 
                  title="Align Center"
                  data-testid="align-center"
                >
                  <AlignCenter className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => formatText('justifyRight')} 
                  className="h-8 px-2" 
                  title="Align Right"
                  data-testid="align-right"
                >
                  <AlignRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Find & Replace */}
              <div className="flex items-center gap-1">
                <Dialog open={showFindReplace} onOpenChange={setShowFindReplace}>
                  <DialogTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 px-2" 
                      title="Find & Replace"
                      data-testid="find-replace-btn"
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Find & Replace</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="find-text">Find</Label>
                        <Input
                          id="find-text"
                          value={findText}
                          onChange={(e) => setFindText(e.target.value)}
                          placeholder="Enter text to find..."
                          data-testid="find-input"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="replace-text">Replace with</Label>
                        <Input
                          id="replace-text"
                          value={replaceText}
                          onChange={(e) => setReplaceText(e.target.value)}
                          placeholder="Enter replacement text..."
                          data-testid="replace-input"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleFind} variant="outline" data-testid="find-btn">
                          Find
                        </Button>
                        <Button onClick={handleReplaceAll} data-testid="replace-all-btn">
                          Replace All
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
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
              onPaste={handleContentChange}
              onKeyUp={handleContentChange}
              onBlur={handleContentChange}
              data-testid="content-editor"
              suppressContentEditableWarning={true}
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