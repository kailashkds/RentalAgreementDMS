import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, File, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface DirectFileUploaderProps {
  onUpload: (fileUrl: string, fileName: string) => void;
  accept?: string;
  maxSize?: number; // in MB
  label?: string;
  disabled?: boolean;
}

interface UploadResponse {
  success: boolean;
  fileName: string;
  fileUrl: string;
  imagePath?: string; // Path to use in <img> tags (for PDFs this will be the converted image)
  absolutePath?: string; // Full system path
  fileType?: 'pdf' | 'image' | 'unknown';
  message: string;
}

export function DirectFileUploader({ 
  onUpload, 
  accept = "image/*,application/pdf", 
  maxSize = 10,
  label = "Upload Document",
  disabled = false 
}: DirectFileUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; url: string } | null>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > maxSize * 1024 * 1024) {
      alert(`File size must be less than ${maxSize}MB`);
      return;
    }

    setIsUploading(true);

    try {
      // Convert file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Upload to server
      const response = await apiRequest("/api/upload-direct", "POST", {
        file: base64,
        fileName: file.name
      }) as UploadResponse;

      console.log("Direct upload response:", response);

      if (response.success) {
        const fileInfo = {
          name: response.fileName,
          url: response.imagePath || response.fileUrl // Use imagePath if available (for PDFs converted to images)
        };
        
        setUploadedFile(fileInfo);
        // Pass the image path for embedding in PDFs
        onUpload(response.imagePath || response.fileUrl, response.fileName);
        
        console.log(`File uploaded and processed:`, {
          fileName: response.fileName,
          fileType: response.fileType,
          imagePath: response.imagePath,
          message: response.message
        });
      } else {
        throw new Error("Upload failed");
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to upload file. Please try again.");
    } finally {
      setIsUploading(false);
      // Reset input
      event.target.value = '';
    }
  };

  const handleRemove = () => {
    setUploadedFile(null);
    onUpload('', '');
  };

  if (uploadedFile) {
    return (
      <div className="flex items-center gap-3 p-3 border border-green-200 bg-green-50 rounded-lg">
        <File className="w-5 h-5 text-green-600" />
        <div className="flex-1">
          <p className="text-sm font-medium text-green-800">{uploadedFile.name}</p>
          <p className="text-xs text-green-600">✅ Uploaded to local storage</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleRemove}
          className="text-red-600 hover:text-red-700"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="relative">
        <input
          type="file"
          accept={accept}
          onChange={handleFileSelect}
          disabled={disabled || isUploading}
          className="sr-only"
        />
        <Button
          type="button"
          variant="outline"
          disabled={disabled || isUploading}
          className="w-full justify-center gap-2"
          asChild
        >
          <span>
            <Upload className="w-4 h-4" />
            {isUploading ? "Uploading..." : label}
          </span>
        </Button>
      </label>
      <p className="text-xs text-gray-500">
        Max size: {maxSize}MB. Accepts: {accept.replace(/,/g, ', ')}
      </p>
    </div>
  );
}