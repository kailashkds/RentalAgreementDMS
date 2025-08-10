import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

export class LocalFileStorage {
  private uploadsDir = path.join(process.cwd(), 'uploads');

  async ensureUploadsDir() {
    try {
      await fs.access(this.uploadsDir);
    } catch {
      await fs.mkdir(this.uploadsDir, { recursive: true });
    }
  }

  async saveFileFromUrl(url: string, originalFileName?: string): Promise<string | null> {
    try {
      // Fix URL case sensitivity issues (Https -> https) and other URL variations
      const correctedUrl = url.replace(/^Https:\/\//, 'https://').replace(/^Http:\/\//, 'http://');
      console.log(`[LocalStorage] Downloading file from URL: ${correctedUrl}`);
      
      // Download the file from the URL
      const response = await fetch(correctedUrl);
      if (!response.ok) {
        console.error(`[LocalStorage] Failed to fetch file: ${response.status}`);
        return null;
      }

      const buffer = await response.arrayBuffer();
      const fileBuffer = Buffer.from(buffer);
      
      // Generate a unique filename
      const fileId = randomUUID();
      const extension = this.getFileExtension(originalFileName || url);
      const fileName = `${fileId}${extension}`;
      const filePath = path.join(this.uploadsDir, fileName);

      // Ensure uploads directory exists
      await this.ensureUploadsDir();

      // Save the file locally
      await fs.writeFile(filePath, fileBuffer);
      
      console.log(`[LocalStorage] File saved successfully: ${fileName}`);
      return fileName;
      
    } catch (error) {
      console.error(`[LocalStorage] Error saving file from URL ${url}:`, error);
      return null;
    }
  }

  async getFileAsBase64(fileName: string): Promise<string | null> {
    try {
      const filePath = path.join(this.uploadsDir, fileName);
      
      // Check if file exists
      await fs.access(filePath);
      
      // Read file and convert to base64
      const buffer = await fs.readFile(filePath);
      const mimeType = this.getMimeType(fileName);
      const base64 = buffer.toString('base64');
      const dataUrl = `data:${mimeType};base64,${base64}`;
      
      console.log(`[LocalStorage] Successfully converted ${fileName} to base64`);
      return dataUrl;
      
    } catch (error) {
      console.error(`[LocalStorage] Error reading file ${fileName}:`, error);
      return null;
    }
  }

  private getFileExtension(fileName: string): string {
    const match = fileName.match(/\.[^.]*$/);
    return match ? match[0] : '';
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

  isEmbeddableFileType(fileName: string): boolean {
    const ext = fileName.toLowerCase().split('.').pop();
    const embeddableTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf'];
    return embeddableTypes.includes(ext || '');
  }
}

export const localFileStorage = new LocalFileStorage();