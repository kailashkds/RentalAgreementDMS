import { Storage, File } from "@google-cloud/storage";
import { Response } from "express";
import { randomUUID } from "crypto";
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

// The object storage client is used to interact with the object storage service.
export const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

// The object storage service is used to interact with the object storage service.
export class ObjectStorageService {
  constructor() {}

  // Gets the public object search paths.
  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    const paths = Array.from(
      new Set(
        pathsStr
          .split(",")
          .map((path) => path.trim())
          .filter((path) => path.length > 0)
      )
    );
    if (paths.length === 0) {
      throw new Error(
        "PUBLIC_OBJECT_SEARCH_PATHS not set. Create a bucket in 'Object Storage' " +
          "tool and set PUBLIC_OBJECT_SEARCH_PATHS env var (comma-separated paths)."
      );
    }
    return paths;
  }

  // Gets the private object directory.
  getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!dir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          "tool and set PRIVATE_OBJECT_DIR env var."
      );
    }
    return dir;
  }

  // Search for a public object from the search paths.
  async searchPublicObject(filePath: string): Promise<File | null> {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;

      // Full path format: /<bucket_name>/<object_name>
      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);

      // Check if file exists
      const [exists] = await file.exists();
      if (exists) {
        return file;
      }
    }

    return null;
  }

  // Downloads an object to the response.
  async downloadObject(file: File, res: Response, cacheTtlSec: number = 3600) {
    try {
      // Get file metadata
      const [metadata] = await file.getMetadata();
      // Get the ACL policy for the object.
      const aclPolicy = await getObjectAclPolicy(file);
      const isPublic = aclPolicy?.visibility === "public";
      // Set appropriate headers
      res.set({
        "Content-Type": metadata.contentType || "application/octet-stream",
        "Content-Length": metadata.size,
        "Cache-Control": `${
          isPublic ? "public" : "private"
        }, max-age=${cacheTtlSec}`,
      });

      // Stream the file to the response
      const stream = file.createReadStream();

      stream.on("error", (err) => {
        console.error("Stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Error streaming file" });
        }
      });

      stream.pipe(res);
    } catch (error) {
      console.error("Error downloading file:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }

  // Get file as base64 data URL for embedding in PDFs
  async getFileAsBase64DataURL(objectPath: string): Promise<string | null> {
    try {
      console.log(`[ObjectStorage] Getting file as base64 for path: ${objectPath}`);
      
      const objectFile = await this.getObjectEntityFile(objectPath);
      const [metadata] = await objectFile.getMetadata();
      const contentType = metadata.contentType || 'application/octet-stream';
      
      console.log(`[ObjectStorage] File content type: ${contentType}`);
      
      // Get file buffer
      const [buffer] = await objectFile.download();
      console.log(`[ObjectStorage] Downloaded file, size: ${buffer.length} bytes`);
      
      // Convert to base64
      const base64 = buffer.toString('base64');
      const dataUrl = `data:${contentType};base64,${base64}`;
      
      console.log(`[ObjectStorage] Successfully converted to base64 data URL`);
      return dataUrl;
    } catch (error) {
      console.error(`[ObjectStorage] Error getting file as base64 for path ${objectPath}:`, error);
      return null;
    }
  }

  // Check if a file type is embeddable in PDF
  isEmbeddableFileType(contentType: string): boolean {
    const embeddableTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf'
    ];
    return embeddableTypes.includes(contentType.toLowerCase());
  }

  // Gets the upload URL for an object entity.
  async getObjectEntityUploadURL(): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();
    if (!privateObjectDir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          "tool and set PRIVATE_OBJECT_DIR env var."
      );
    }

    const objectId = randomUUID();
    const fullPath = `${privateObjectDir}/uploads/${objectId}`;

    const { bucketName, objectName } = parseObjectPath(fullPath);

    // Sign URL for PUT method with TTL
    return signObjectURL({
      bucketName,
      objectName,
      method: "PUT",
      ttlSec: 900,
    });
  }

  // Gets the object entity file from the object path.
  async getObjectEntityFile(objectPath: string): Promise<File> {
    console.log(`[ObjectStorage] getObjectEntityFile called with: ${objectPath}`);
    
    if (!objectPath.startsWith("/objects/")) {
      console.log(`[ObjectStorage] Invalid path prefix: ${objectPath}`);
      throw new ObjectNotFoundError();
    }

    const parts = objectPath.slice(1).split("/");
    if (parts.length < 2) {
      console.log(`[ObjectStorage] Invalid path parts: ${parts}`);
      throw new ObjectNotFoundError();
    }

    const entityId = parts.slice(1).join("/");
    console.log(`[ObjectStorage] Extracted entityId: ${entityId}`);
    
    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith("/")) {
      entityDir = `${entityDir}/`;
    }
    
    // The entityId should already include the uploads/ prefix since files are uploaded to /uploads/uuid
    const objectEntityPath = `${entityDir}${entityId}`;
    console.log(`[ObjectStorage] Full object path: ${objectEntityPath}`);
    
    const { bucketName, objectName } = parseObjectPath(objectEntityPath);
    console.log(`[ObjectStorage] Bucket: ${bucketName}, Object: ${objectName}`);
    
    const bucket = objectStorageClient.bucket(bucketName);
    const objectFile = bucket.file(objectName);
    const [exists] = await objectFile.exists();
    
    console.log(`[ObjectStorage] File exists: ${exists}`);
    
    if (!exists) {
      throw new ObjectNotFoundError();
    }
    return objectFile;
  }

  normalizeObjectEntityPath(
    rawPath: string,
  ): string {
    console.log(`[ObjectStorage] Normalizing path: ${rawPath}`);
    
    if (!rawPath.startsWith("https://storage.googleapis.com/")) {
      console.log(`[ObjectStorage] Path doesn't start with GCS URL, returning as-is: ${rawPath}`);
      return rawPath;
    }
  
    // Extract the path from the URL by removing query parameters and domain
    const url = new URL(rawPath);
    const rawObjectPath = url.pathname;
    console.log(`[ObjectStorage] Extracted pathname: ${rawObjectPath}`);
  
    // The private object directory format is like: /replit-objstore-xxx/.private
    // The URL pathname will be like: /replit-objstore-xxx/.private/uploads/file-id
    // We want to convert this to: /objects/uploads/file-id
    
    // Find the `.private/` part and extract everything after it
    const privateIndex = rawObjectPath.indexOf('/.private/');
    if (privateIndex === -1) {
      console.log(`[ObjectStorage] No .private directory found in path: ${rawObjectPath}`);
      return rawObjectPath;
    }
    
    // Extract everything after /.private/
    const entityId = rawObjectPath.slice(privateIndex + '/.private/'.length);
    const normalizedPath = `/objects/${entityId}`;
    
    console.log(`[ObjectStorage] Normalized to: ${normalizedPath}`);
    return normalizedPath;
  }

  // Tries to set the ACL policy for the object entity and return the normalized path.
  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith("/")) {
      return normalizedPath;
    }

    const objectFile = await this.getObjectEntityFile(normalizedPath);
    await setObjectAclPolicy(objectFile, aclPolicy);
    return normalizedPath;
  }

  // Checks if the user can access the object entity.
  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: File;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    return canAccessObject({
      userId,
      objectFile,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }
}

function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }

  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");

  return {
    bucketName,
    objectName,
  };
}

async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  const request = {
    bucket_name: bucketName,
    object_name: objectName,
    method,
    expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
  };
  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    }
  );
  if (!response.ok) {
    throw new Error(
      `Failed to sign object URL, errorcode: ${response.status}, ` +
        `make sure you're running on Replit`
    );
  }

  const { signed_url: signedURL } = await response.json();
  return signedURL;
}
