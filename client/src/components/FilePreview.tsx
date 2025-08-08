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
        <div className="flex flex-col items-center justify-center h-24 bg-red-50 rounded border-2 border-dashed border-red-200">
          <FileText className="h-8 w-8 text-red-500 mb-1" />
          <span className="text-xs text-red-600 font-medium">PDF Document</span>
          <span className="text-xs text-gray-500 truncate max-w-full px-2">{displayName}</span>
        </div>
      );
    }
    
    if (fileType === 'image' && !imageError) {
      return (
        <div className="relative h-24 bg-gray-50 rounded border overflow-hidden">
          <img
            src={fileUrl}
            alt={displayName}
            className="w-full h-full object-cover"
            onError={handleImageError}
            crossOrigin="anonymous"
          />
          <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-10 transition-all flex items-center justify-center opacity-0 hover:opacity-100">
            <Eye className="h-4 w-4 text-white" />
          </div>
        </div>
      );
    }

    // Fallback for unknown types or image errors
    return (
      <div className="flex flex-col items-center justify-center h-24 bg-gray-50 rounded border-2 border-dashed border-gray-200">
        <FileText className="h-8 w-8 text-gray-400 mb-1" />
        <span className="text-xs text-gray-600 font-medium">Document</span>
        <span className="text-xs text-gray-500 truncate max-w-full px-2">{displayName}</span>
      </div>
    );
  };

  const renderFullPreview = () => {
    if (fileType === 'pdf') {
      return (
        <div className="w-full h-[80vh]">
          <iframe
            src={fileUrl}
            className="w-full h-full border-0 rounded"
            title={displayName}
          />
        </div>
      );
    }
    
    if (fileType === 'image') {
      return (
        <div className="max-w-full max-h-[80vh] overflow-auto">
          <img
            src={fileUrl}
            alt={displayName}
            className="max-w-full max-h-full object-contain"
            crossOrigin="anonymous"
          />
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center h-64">
        <FileText className="h-16 w-16 text-gray-400 mb-4" />
        <p className="text-gray-600">Preview not available for this file type</p>
        <Button
          onClick={() => window.open(fileUrl, '_blank')}
          variant="outline"
          className="mt-4"
        >
          <Download className="h-4 w-4 mr-2" />
          Download File
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{displayName}</span>
              <Button
                onClick={() => window.open(fileUrl, '_blank')}
                variant="outline"
                size="sm"
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </DialogTitle>
          </DialogHeader>
          {renderFullPreview()}
        </DialogContent>
      </Dialog>
    </>
  );
}