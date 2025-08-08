import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, FileText, Image, Eye, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface FilePreviewProps {
  fileUrl: string;
  fileName?: string;
  onRemove?: () => void;
  className?: string;
}

export function FilePreview({ fileUrl, fileName, onRemove, className = "" }: FilePreviewProps) {
  const [showFullPreview, setShowFullPreview] = useState(false);
  const [imageError, setImageError] = useState(false);

  if (!fileUrl) return null;

  // Determine file type from URL or fileName
  const getFileType = (url: string, name?: string) => {
    const fullString = (url + (name || "")).toLowerCase();
    if (fullString.includes('pdf') || fullString.endsWith('.pdf')) return 'pdf';
    if (fullString.includes('jpg') || fullString.includes('jpeg') || fullString.includes('png') || 
        fullString.includes('gif') || fullString.includes('webp') || 
        fullString.endsWith('.jpg') || fullString.endsWith('.jpeg') || 
        fullString.endsWith('.png') || fullString.endsWith('.gif') || fullString.endsWith('.webp')) return 'image';
    return 'unknown';
  };

  const fileType = getFileType(fileUrl, fileName);
  const displayName = fileName || fileUrl.split('/').pop() || 'Document';

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
            src={fileUrl}
            alt={displayName}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            onError={handleImageError}
            crossOrigin="anonymous"
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
    if (fileType === 'pdf') {
      return (
        <div className="w-full h-[80vh] space-y-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-600">PDF Preview</span>
            <Button
              onClick={() => window.open(fileUrl, '_blank')}
              variant="outline"
              size="sm"
            >
              <Download className="h-4 w-4 mr-2" />
              Open in New Tab
            </Button>
          </div>
          <iframe
            src={`${fileUrl}#toolbar=1&navpanes=1&scrollbar=1`}
            className="w-full h-full border border-gray-200 rounded"
            title={displayName}
            style={{ minHeight: '600px' }}
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          />
        </div>
      );
    }
    
    if (fileType === 'image') {
      return (
        <div className="max-w-full max-h-[80vh] overflow-auto flex items-center justify-center bg-gray-50 rounded">
          <img
            src={fileUrl}
            alt={displayName}
            className="max-w-full max-h-full object-contain shadow-lg"
            style={{ maxHeight: '70vh' }}
          />
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center h-64">
        <FileText className="h-16 w-16 text-gray-400 mb-4" />
        <p className="text-gray-600 mb-2">Preview not available for this file type</p>
        <p className="text-sm text-gray-500 mb-4">Click below to download and view the file</p>
        <Button
          onClick={() => window.open(fileUrl, '_blank')}
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
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden">
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
                  onClick={() => window.open(fileUrl, '_blank')}
                  variant="outline"
                  size="sm"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-auto" style={{ maxHeight: 'calc(95vh - 100px)' }}>
            {renderFullPreview()}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}