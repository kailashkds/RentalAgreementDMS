import fs from 'fs';
import path from 'path';
import { ObjectStorageService } from './objectStorage';

interface NotarizedDocument {
  url: string;
  filename: string;
  size: number;
  mimetype: string;
  uploadDate: string;
  originalName: string;
}

interface ValidationResult {
  exists: boolean;
  location: 'local' | 'object-storage' | 'none';
  actualPath?: string;
}

export class NotarizedDocumentValidator {
  private objectStorageService: ObjectStorageService;

  constructor() {
    this.objectStorageService = new ObjectStorageService();
  }

  /**
   * Validates if a notarized document actually exists on the server
   * Checks both local file system and object storage for backward compatibility
   */
  async validateNotarizedDocument(notarizedDoc: NotarizedDocument): Promise<ValidationResult> {
    if (!notarizedDoc || !notarizedDoc.filename) {
      return { exists: false, location: 'none' };
    }

    console.log(`[Validator] Checking notarized document: ${notarizedDoc.filename}`);

    // Try multiple file path formats for backward compatibility
    const possiblePaths = this.generatePossibleFilePaths(notarizedDoc);

    // Check local file system first (most common for existing files)
    for (const localPath of possiblePaths.local) {
      if (fs.existsSync(localPath)) {
        console.log(`[Validator] Found in local file system: ${localPath}`);
        return { 
          exists: true, 
          location: 'local', 
          actualPath: localPath.replace(process.cwd() + '/', '') 
        };
      }
    }

    // Check object storage for newer files
    for (const objectPath of possiblePaths.objectStorage) {
      try {
        const objectFile = await this.objectStorageService.getObjectEntityFile(objectPath);
        const [exists] = await objectFile.exists();
        if (exists) {
          console.log(`[Validator] Found in object storage: ${objectPath}`);
          return { 
            exists: true, 
            location: 'object-storage', 
            actualPath: objectPath 
          };
        }
      } catch (error) {
        // File doesn't exist in object storage, continue checking
        continue;
      }
    }

    console.log(`[Validator] File not found anywhere: ${notarizedDoc.filename}`);
    return { exists: false, location: 'none' };
  }

  /**
   * Generate possible file paths for both old and new formats
   */
  private generatePossibleFilePaths(notarizedDoc: NotarizedDocument): {
    local: string[];
    objectStorage: string[];
  } {
    const { filename, url } = notarizedDoc;

    const localPaths: string[] = [];
    const objectStoragePaths: string[] = [];

    // Standard notarized directory format
    localPaths.push(path.join(process.cwd(), 'uploads', 'notarized', filename));

    // Direct uploads directory (old format)
    localPaths.push(path.join(process.cwd(), 'uploads', filename));

    // Extract filename from URL if different
    if (url && url !== `/uploads/notarized/${filename}`) {
      const urlFilename = path.basename(url);
      if (urlFilename !== filename) {
        localPaths.push(path.join(process.cwd(), 'uploads', 'notarized', urlFilename));
        localPaths.push(path.join(process.cwd(), 'uploads', urlFilename));
      }
    }

    // Object storage paths
    objectStoragePaths.push(`/objects/uploads/notarized/${filename}`);
    objectStoragePaths.push(`/objects/uploads/${filename}`);

    // Extract from URL for object storage too
    if (url && url !== `/uploads/notarized/${filename}`) {
      const urlFilename = path.basename(url);
      if (urlFilename !== filename) {
        objectStoragePaths.push(`/objects/uploads/notarized/${urlFilename}`);
        objectStoragePaths.push(`/objects/uploads/${urlFilename}`);
      }
    }

    return { local: localPaths, objectStorage: objectStoragePaths };
  }

  /**
   * Validate all notarized documents in the database and return results
   */
  async validateAllNotarizedDocuments(): Promise<{
    valid: Array<{ agreementId: string; agreementNumber: string; document: NotarizedDocument; result: ValidationResult }>;
    invalid: Array<{ agreementId: string; agreementNumber: string; document: NotarizedDocument }>;
  }> {
    const { storage } = await import('./storage');
    const result = await storage.getAgreements({ limit: 10000 }); // Get all agreements
    const agreements = result.agreements;

    const valid: Array<{ agreementId: string; agreementNumber: string; document: NotarizedDocument; result: ValidationResult }> = [];
    const invalid: Array<{ agreementId: string; agreementNumber: string; document: NotarizedDocument }> = [];

    console.log(`[Validator] Starting validation of notarized documents for ${agreements.length} agreements`);

    for (const agreement of agreements) {
      if (agreement.notarizedDocument) {
        try {
          // Handle both JSON string and object formats
          let notarizedDoc: NotarizedDocument;
          if (typeof agreement.notarizedDocument === 'string') {
            notarizedDoc = JSON.parse(agreement.notarizedDocument) as NotarizedDocument;
          } else {
            notarizedDoc = agreement.notarizedDocument as any;
          }
          
          const result = await this.validateNotarizedDocument(notarizedDoc);

          if (result.exists) {
            valid.push({
              agreementId: agreement.id,
              agreementNumber: agreement.agreementNumber,
              document: notarizedDoc,
              result
            });
          } else {
            invalid.push({
              agreementId: agreement.id,
              agreementNumber: agreement.agreementNumber,
              document: notarizedDoc
            });
          }
        } catch (error) {
          console.error(`[Validator] Error parsing notarized document for ${agreement.agreementNumber}:`, error);
          invalid.push({
            agreementId: agreement.id,
            agreementNumber: agreement.agreementNumber,
            document: {} as NotarizedDocument
          });
        }
      }
    }

    console.log(`[Validator] Validation complete: ${valid.length} valid, ${invalid.length} invalid`);
    return { valid, invalid };
  }

  /**
   * Clean up invalid notarized document entries from database
   */
  async cleanupInvalidNotarizedDocuments(): Promise<{
    cleanedCount: number;
    validCount: number;
  }> {
    const { valid, invalid } = await this.validateAllNotarizedDocuments();

    if (invalid.length === 0) {
      console.log(`[Validator] No invalid notarized documents found`);
      return { cleanedCount: 0, validCount: valid.length };
    }

    const { storage } = await import('./storage');

    console.log(`[Validator] Cleaning up ${invalid.length} invalid notarized document entries`);

    for (const invalidEntry of invalid) {
      try {
        await storage.updateAgreementNotarizedDocument(invalidEntry.agreementId, null);
        console.log(`[Validator] Cleaned up notarized document for ${invalidEntry.agreementNumber}`);
      } catch (error) {
        console.error(`[Validator] Error cleaning up ${invalidEntry.agreementNumber}:`, error);
      }
    }

    console.log(`[Validator] Cleanup complete: ${invalid.length} entries cleaned, ${valid.length} valid documents remain`);
    return { cleanedCount: invalid.length, validCount: valid.length };
  }
}