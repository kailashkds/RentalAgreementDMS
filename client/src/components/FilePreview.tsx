import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, FileText, Image, Eye, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// PDF Preview Component
interface PDFPreviewProps {
  fileUrl: string;
  fileName: string;
  onDownload: () => void;
}

function PDFPreview({ fileUrl, fileName, onDownload }: PDFPreviewProps) {
  const [pdfPages, setPdfPages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Convert PDF to images for preview
  const convertPdfToImages = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log(`PDFPreview - Converting PDF to images: ${fileUrl}`);
      
      const response = await fetch('/api/pdf-to-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfUrl: fileUrl })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to convert PDF: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.images) {
        setPdfPages(data.images);
        console.log(`PDFPreview - Successfully converted PDF to ${data.images.length} pages`);
      } else {
        throw new Error(data.error || 'PDF conversion failed');
      }
    } catch (err) {
      console.error('PDFPreview - Error converting PDF:', err);
      setError(err instanceof Error ? err.message : 'Failed to load PDF preview');
    } finally {
      setLoading(false);
    }
  };

  // Convert PDF when component mounts
  useEffect(() => {
    convertPdfToImages();
  }, [fileUrl]);

  if (loading) {
    return (
      <div className="w-full h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Converting PDF for preview...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <FileText className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <p className="text-red-600 mb-2">Failed to load PDF preview</p>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <Button onClick={onDownload} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-gray-600">PDF Preview ({pdfPages.length} pages)</span>
        <Button onClick={onDownload} variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Download PDF
        </Button>
      </div>
      
      <div className="space-y-4 max-h-[70vh] overflow-y-auto">
        {pdfPages.map((pageImageUrl, index) => (
          <div key={index} className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
            <div className="bg-gray-50 px-3 py-2 text-xs text-gray-600">
              Page {index + 1}
            </div>
            <div className="p-2 bg-white">
              <img
                src={pageImageUrl}
                alt={`${fileName} - Page ${index + 1}`}
                className="w-full h-auto rounded border"
                style={{ maxWidth: '100%' }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface FilePreviewProps {
  fileUrl: string;
  fileName?: string;
  fileType?: string;
  onRemove?: () => void;
  className?: string;
}

export function FilePreview({ fileUrl, fileName, fileType: providedFileType, onRemove, className = "" }: FilePreviewProps) {
  const [showFullPreview, setShowFullPreview] = useState(false);
  const [imageError, setImageError] = useState(false);

  if (!fileUrl) return null;

  // Convert Google Cloud Storage URLs to our server proxy URLs
  const getProxyUrl = (url: string) => {
    if (url.includes('storage.googleapis.com')) {
      // Extract the path after the bucket name and convert to our object route
      const match = url.match(/storage\.googleapis\.com\/([^\/]+)\/(.+)/);
      if (match) {
        const [, bucket, objectPath] = match;
        // Remove any query parameters
        const cleanObjectPath = objectPath.split('?')[0];
        
        // The uploaded files are in the format: /bucketname/uploads/uuid
        // We need to extract just the uploads/uuid part for our proxy route
        if (cleanObjectPath.includes('/uploads/')) {
          const uploadsIndex = cleanObjectPath.indexOf('/uploads/');
          const relativePath = cleanObjectPath.substring(uploadsIndex + 1); // Remove leading slash from /uploads/
          return `/objects/${relativePath}`;
        } else {
          return `/objects/${cleanObjectPath}`;
        }
      }
    }
    return url;
  };

  const proxyUrl = getProxyUrl(fileUrl);
  console.log(`FilePreview - Original URL: ${fileUrl}`);
  console.log(`FilePreview - Proxy URL: ${proxyUrl}`);

  // Determine file type from provided type, URL, or fileName
  const getFileType = (url: string, name?: string, providedType?: string) => {
    console.log(`FilePreview - Detecting file type for URL: ${url}, fileName: ${name}, providedType: ${providedType}`);
    
    // Use provided file type if available
    if (providedType) {
      const lowerType = providedType.toLowerCase();
      if (lowerType.includes('pdf') || lowerType === 'application/pdf') {
        console.log('FilePreview - Using provided PDF type');
        return 'pdf';
      }
      if (lowerType.startsWith('image/') || lowerType.includes('image')) {
        console.log('FilePreview - Using provided image type');
        return 'image';
      }
    }
    
    const fullString = (url + (name || "")).toLowerCase();
    
    // Check for PDF
    if (fullString.includes('pdf') || fullString.endsWith('.pdf')) {
      console.log('FilePreview - Detected as PDF from URL/name');
      return 'pdf';
    }
    
    // Check for images
    if (fullString.includes('jpg') || fullString.includes('jpeg') || fullString.includes('png') || 
        fullString.includes('gif') || fullString.includes('webp') || 
        fullString.endsWith('.jpg') || fullString.endsWith('.jpeg') || 
        fullString.endsWith('.png') || fullString.endsWith('.gif') || fullString.endsWith('.webp')) {
      console.log('FilePreview - Detected as image from URL/name');
      return 'image';
    }
    
    // Additional check for common image MIME types in Google Cloud URLs
    if (fullString.includes('image') || url.includes('content-type=image')) {
      console.log('FilePreview - Detected as image from MIME type in URL');
      return 'image';
    }
    
    // Additional check for PDF MIME types in Google Cloud URLs
    if (url.includes('content-type=application/pdf') || url.includes('pdf')) {
      console.log('FilePreview - Detected as PDF from MIME type in URL');
      return 'pdf';
    }
    
    // For Google Cloud Storage URLs without clear indicators, try to make an educated guess
    if (url.includes('storage.googleapis.com')) {
      console.log('FilePreview - Google Cloud Storage URL detected, defaulting to image for preview attempt');
      return 'image'; // Default to image to attempt preview
    }
    
    console.log('FilePreview - File type unknown, defaulting to unknown');
    return 'unknown';
  };

  const fileType = getFileType(fileUrl, fileName, providedFileType);
  const displayName = fileName || fileUrl.split('/').pop() || 'Document';
  
  console.log(`FilePreview - Final file type: ${fileType}, displayName: ${displayName}, providedFileType: ${providedFileType}`);

  const handleImageError = () => {
    setImageError(true);
  };

  const renderPreviewContent = () => {
    if (fileType === 'pdf') {
      return (
        <div className="flex flex-col items-center justify-center h-24 bg-red-50 rounded border-2 border-dashed border-red-200 hover:bg-red-100 transition-all cursor-pointer group">
          <FileText className="h-8 w-8 text-red-500 mb-1 group-hover:scale-110 transition-transform" />
          <span className="text-xs text-red-600 font-medium">PDF Document</span>
          <span className="text-xs text-gray-500 truncate max-w-full px-2">{displayName}</span>
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="bg-red-600 text-white px-2 py-1 rounded text-xs">Click to view</div>
          </div>
        </div>
      );
    }
    
    if (fileType === 'image' && !imageError) {
      return (
        <div className="relative h-24 bg-gray-50 rounded border overflow-hidden group cursor-pointer">
          <img
            src={proxyUrl}
            alt={displayName}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            onError={handleImageError}
          />
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
            <div className="bg-blue-600 text-white px-2 py-1 rounded text-xs flex items-center">
              <Eye className="h-3 w-3 mr-1" />
              View Image
            </div>
          </div>
        </div>
      );
    }

    // Fallback for unknown types or image errors
    return (
      <div className="flex flex-col items-center justify-center h-24 bg-gray-50 rounded border-2 border-dashed border-gray-200 hover:bg-gray-100 transition-all cursor-pointer group">
        <FileText className="h-8 w-8 text-gray-400 mb-1 group-hover:text-gray-600 transition-colors" />
        <span className="text-xs text-gray-600 font-medium">Document</span>
        <span className="text-xs text-gray-500 truncate max-w-full px-2">{displayName}</span>
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-gray-600 text-white px-2 py-1 rounded text-xs">Click to view</div>
        </div>
      </div>
    );
  };

  const renderFullPreview = () => {
    console.log(`FilePreview - Rendering full preview for fileType: ${fileType}, URL: ${fileUrl}`);
    
    if (fileType === 'pdf') {
      return (
        <PDFPreview 
          fileUrl={proxyUrl} 
          fileName={displayName}
          onDownload={() => window.open(proxyUrl, '_blank')}
        />
      );
    }
    
    if (fileType === 'image') {
      return (
        <div className="w-full h-full flex items-center justify-center bg-white rounded">
          <img
            src={proxyUrl}
            alt={displayName}
            className="max-w-full max-h-full object-contain shadow-lg rounded-lg border"
            style={{ maxHeight: '500px', maxWidth: '100%' }}
            onError={() => {
              console.error(`Failed to load image from: ${proxyUrl}`);
              setImageError(true);
            }}
          />
        </div>
      );
    }

    // For unknown file types, try to determine what to show based on URL patterns
    if (fileUrl.includes('storage.googleapis.com')) {
      return (
        <div className="flex flex-col items-center justify-center h-64">
          <FileText className="h-16 w-16 text-gray-400 mb-4" />
          <p className="text-gray-600 mb-2">Unable to preview this file type</p>
          <p className="text-sm text-gray-500 mb-2">File URL: <code className="bg-gray-100 px-1 rounded text-xs">{fileUrl.substring(0, 100)}...</code></p>
          <p className="text-sm text-gray-500 mb-4">Detected type: <strong>{fileType}</strong></p>
          <div className="space-y-2">
            <Button
              onClick={() => window.open(proxyUrl, '_blank')}
              variant="outline"
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              Download & View File
            </Button>
            <Button
              onClick={() => {
                // Try to force image view
                const img = document.createElement('img');
                img.onload = () => {
                  console.log('File is actually an image, updating preview');
                  setImageError(false);
                  // Force a re-render by toggling the modal
                  setShowFullPreview(false);
                  setTimeout(() => setShowFullPreview(true), 100);
                };
                img.onerror = () => {
                  console.log('File is not an image');
                };
                img.src = proxyUrl;
              }}
              variant="secondary"
              size="sm"
              className="w-full"
            >
              Try Image Preview
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center h-64">
        <FileText className="h-16 w-16 text-gray-400 mb-4" />
        <p className="text-gray-600 mb-2">Preview not available for this file type</p>
        <p className="text-sm text-gray-500 mb-4">Click below to download and view the file</p>
        <Button
          onClick={() => window.open(proxyUrl, '_blank')}
          variant="outline"
          className="mt-4"
        >
          <Download className="h-4 w-4 mr-2" />
          Download & View File
        </Button>
      </div>
    );
  };

  return (
    <>
      <Card className={`relative group ${className}`}>
        <CardContent className="p-3">
          {onRemove && (
            <Button
              onClick={onRemove}
              size="sm"
              variant="destructive"
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
          
          <div 
            className="cursor-pointer"
            onClick={() => setShowFullPreview(true)}
          >
            {renderPreviewContent()}
          </div>
          
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-gray-600 truncate flex-1">
              {displayName}
            </span>
            <div className="flex items-center gap-1 ml-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowFullPreview(true);
                }}
              >
                <Eye className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(fileUrl, '_blank');
                }}
              >
                <Download className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showFullPreview} onOpenChange={setShowFullPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {fileType === 'pdf' && <FileText className="h-5 w-5 text-red-500" />}
                {fileType === 'image' && <Image className="h-5 w-5 text-blue-500" />}
                <span className="truncate">{displayName}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-500 uppercase">{fileType}</span>
                <Button
                  onClick={() => window.open(proxyUrl, '_blank')}
                  variant="outline"
                  size="sm"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-auto bg-gray-50 rounded-lg border" style={{ maxHeight: 'calc(90vh - 120px)', minHeight: '500px' }}>
            <div className="p-4 flex items-center justify-center min-h-full">
              {renderFullPreview()}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}