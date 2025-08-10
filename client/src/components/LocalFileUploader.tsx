import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Upload, File, X } from "lucide-react";

interface LocalFileUploaderProps {
  onUploadComplete: (result: { url: string; filename: string; originalName: string; size: number }) => void;
  accept?: string;
  maxSize?: number; // in bytes
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export function LocalFileUploader({
  onUploadComplete,
  accept = "image/*,application/pdf",
  maxSize = 10 * 1024 * 1024, // 10MB default
  children,
  className = "",
  disabled = false
}: LocalFileUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const validateFile = (file: File): string | null => {
    if (file.size > maxSize) {
      return `File size (${Math.round(file.size / 1024 / 1024)}MB) exceeds maximum allowed size (${Math.round(maxSize / 1024 / 1024)}MB)`;
    }

    const allowedTypes = accept.split(',').map(type => type.trim());
    const isAllowed = allowedTypes.some(type => {
      if (type === 'image/*') return file.type.startsWith('image/');
      if (type === 'application/pdf') return file.type === 'application/pdf';
      return file.type === type;
    });

    if (!isAllowed) {
      return `File type "${file.type}" is not allowed. Allowed types: ${accept}`;
    }

    return null;
  };

  const uploadFile = async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      toast({
        title: "Upload Error",
        description: validationError,
        variant: "destructive"
      });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('document', file);

      const response = await fetch('/api/upload-local', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        onUploadComplete({
          url: result.url,
          filename: result.filename,
          originalName: result.originalName,
          size: result.size
        });
        
        toast({
          title: "Upload Successful",
          description: `${result.originalName} uploaded successfully`
        });
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "An error occurred during upload",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadFile(file);
    }
    // Reset the input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    
    const file = event.dataTransfer.files[0];
    if (file) {
      uploadFile(file);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
  };

  const triggerFileSelect = () => {
    if (!disabled && !uploading) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className={`relative ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || uploading}
      />
      
      <div
        onClick={triggerFileSelect}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          cursor-pointer transition-all duration-200
          ${dragOver ? 'bg-blue-50 border-blue-300' : ''}
          ${disabled || uploading ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80'}
        `}
      >
        {children || (
          <Button 
            type="button"
            variant="outline" 
            disabled={disabled || uploading}
            className="w-full"
          >
            {uploading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                Uploading...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Upload Document
              </div>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}