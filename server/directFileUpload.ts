import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

export class DirectFileUploadService {
  private uploadsDir = path.join(process.cwd(), 'uploads');

  constructor() {
    this.ensureUploadsDirectory();
  }

  private async ensureUploadsDirectory() {
    try {
      await fs.access(this.uploadsDir);
    } catch {
      await fs.mkdir(this.uploadsDir, { recursive: true });
      console.log('[DirectUpload] Created uploads directory:', this.uploadsDir);
    }
  }

  async saveFile(fileBuffer: Buffer, originalName: string): Promise<string> {
    const fileExtension = path.extname(originalName);
    const fileName = `${randomUUID()}${fileExtension}`;
    const filePath = path.join(this.uploadsDir, fileName);
    
    await fs.writeFile(filePath, fileBuffer);
    console.log('[DirectUpload] Saved file:', fileName);
    
    return fileName; // Return just the filename, not full path
  }

  async getFile(fileName: string): Promise<Buffer | null> {
    try {
      const filePath = path.join(this.uploadsDir, fileName);
      return await fs.readFile(filePath);
    } catch (error) {
      console.error('[DirectUpload] Error reading file:', error);
      return null;
    }
  }

  getFileUrl(fileName: string): string {
    return `/uploads/${fileName}`;
  }

  async getFileAsBase64(fileName: string): Promise<string | null> {
    try {
      const buffer = await this.getFile(fileName);
      if (!buffer) return null;

      const mimeType = this.getMimeType(fileName);
      const base64 = buffer.toString('base64');
      return `data:${mimeType};base64,${base64}`;
    } catch (error) {
      console.error('[DirectUpload] Error converting to base64:', error);
      return null;
    }
  }

  private getMimeType(fileName: string): string {
    const ext = fileName.toLowerCase().split('.').pop();
    const mimeTypes: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'pdf': 'application/pdf'
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  }

  isImageFile(fileName: string): boolean {
    const ext = fileName.toLowerCase().split('.').pop();
    const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    return imageTypes.includes(ext || '');
  }
}

export const directFileUpload = new DirectFileUploadService();