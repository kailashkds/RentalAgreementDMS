import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class FileProcessor {
  private uploadsDir: string;

  constructor() {
    this.uploadsDir = path.join(process.cwd(), 'uploads');
    
    // Ensure uploads directory exists
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  /**
   * Process uploaded file and return absolute image path
   * If PDF: converts to image first
   * If image: returns original path
   */
  async processFileToImagePath(fileName: string): Promise<{ 
    success: boolean; 
    imagePath?: string; 
    absolutePath?: string;
    fileType: 'pdf' | 'image' | 'unknown';
    error?: string;
  }> {
    try {
      const filePath = path.join(this.uploadsDir, fileName);
      
      if (!fs.existsSync(filePath)) {
        return {
          success: false,
          fileType: 'unknown',
          error: 'File not found'
        };
      }

      const fileType = this.detectFileType(fileName);
      console.log(`[FileProcessor] Processing file: ${fileName}, detected type: ${fileType}`);

      if (fileType === 'image') {
        // For images, return the absolute path directly
        const absolutePath = path.resolve(filePath);
        return {
          success: true,
          imagePath: `/uploads/${fileName}`,
          absolutePath,
          fileType: 'image'
        };
      } else if (fileType === 'pdf') {
        // For PDFs, convert to image first
        const imageResult = await this.convertPdfToImage(fileName);
        if (imageResult.success && imageResult.imagePath) {
          return {
            success: true,
            imagePath: imageResult.imagePath,
            absolutePath: imageResult.absolutePath,
            fileType: 'pdf'
          };
        } else {
          return {
            success: false,
            fileType: 'pdf',
            error: imageResult.error || 'PDF conversion failed'
          };
        }
      } else {
        return {
          success: false,
          fileType: 'unknown',
          error: 'Unsupported file type'
        };
      }
    } catch (error) {
      console.error('[FileProcessor] Error processing file:', error);
      return {
        success: false,
        fileType: 'unknown',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Convert PDF to image using ImageMagick or similar
   */
  private async convertPdfToImage(pdfFileName: string): Promise<{
    success: boolean;
    imagePath?: string;
    absolutePath?: string;
    error?: string;
  }> {
    try {
      const pdfPath = path.join(this.uploadsDir, pdfFileName);
      const nameWithoutExt = path.parse(pdfFileName).name;
      const imageFileName = `${nameWithoutExt}_page1.png`;
      const imagePath = path.join(this.uploadsDir, imageFileName);

      console.log(`[FileProcessor] Converting PDF to image: ${pdfFileName} -> ${imageFileName}`);

      // Try using ImageMagick first
      try {
        await execAsync(`convert "${pdfPath}[0]" "${imagePath}"`);
        console.log(`[FileProcessor] PDF converted successfully using ImageMagick`);
      } catch (imageMagickError) {
        console.log(`[FileProcessor] ImageMagick failed, trying pdftoppm...`);
        
        // Fallback to pdftoppm
        try {
          const tempPpmPath = path.join(this.uploadsDir, `${nameWithoutExt}_temp`);
          await execAsync(`pdftoppm -f 1 -l 1 -png "${pdfPath}" "${tempPpmPath}"`);
          
          // pdftoppm creates files with -1 suffix
          const generatedFile = `${tempPpmPath}-1.png`;
          if (fs.existsSync(generatedFile)) {
            fs.renameSync(generatedFile, imagePath);
            console.log(`[FileProcessor] PDF converted successfully using pdftoppm`);
          } else {
            throw new Error('pdftoppm did not generate expected output file');
          }
        } catch (pdftoppmError) {
          console.log(`[FileProcessor] pdftoppm also failed, trying ghostscript...`);
          
          // Final fallback to ghostscript
          await execAsync(`gs -dNOPAUSE -dBATCH -sDEVICE=png16m -dFirstPage=1 -dLastPage=1 -r150 -sOutputFile="${imagePath}" "${pdfPath}"`);
          console.log(`[FileProcessor] PDF converted successfully using ghostscript`);
        }
      }

      if (fs.existsSync(imagePath)) {
        const absolutePath = path.resolve(imagePath);
        return {
          success: true,
          imagePath: `/uploads/${imageFileName}`,
          absolutePath
        };
      } else {
        return {
          success: false,
          error: 'Image conversion completed but output file not found'
        };
      }
    } catch (error) {
      console.error('[FileProcessor] PDF conversion error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'PDF conversion failed'
      };
    }
  }

  /**
   * Detect file type based on extension
   */
  private detectFileType(fileName: string): 'pdf' | 'image' | 'unknown' {
    const ext = path.extname(fileName).toLowerCase();
    
    if (ext === '.pdf') {
      return 'pdf';
    } else if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(ext)) {
      return 'image';
    } else {
      return 'unknown';
    }
  }

  /**
   * Get file as base64 for embedding
   */
  async getFileAsBase64(fileName: string): Promise<string | null> {
    try {
      const filePath = path.join(this.uploadsDir, fileName);
      
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const fileBuffer = fs.readFileSync(filePath);
      const mimeType = this.getMimeType(fileName);
      const base64Data = fileBuffer.toString('base64');
      
      return `data:${mimeType};base64,${base64Data}`;
    } catch (error) {
      console.error('[FileProcessor] Error converting file to base64:', error);
      return null;
    }
  }

  /**
   * Get MIME type for file
   */
  private getMimeType(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    
    switch (ext) {
      case '.pdf': return 'application/pdf';
      case '.jpg':
      case '.jpeg': return 'image/jpeg';
      case '.png': return 'image/png';
      case '.gif': return 'image/gif';
      case '.bmp': return 'image/bmp';
      case '.webp': return 'image/webp';
      default: return 'application/octet-stream';
    }
  }

  /**
   * Check if file is an image type
   */
  isImageFile(fileName: string): boolean {
    return this.detectFileType(fileName) === 'image';
  }

  /**
   * Check if file is a PDF
   */
  isPdfFile(fileName: string): boolean {
    return this.detectFileType(fileName) === 'pdf';
  }
}

export const fileProcessor = new FileProcessor();