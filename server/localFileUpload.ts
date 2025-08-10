import multer from 'multer';
import path from 'path';
import { randomUUID } from 'crypto';
import fs from 'fs';

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for local file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with original extension
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// File filter to accept common document types
const fileFilter = (req: any, file: any, cb: any) => {
  const allowedTypes = /jpeg|jpg|png|pdf|gif/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only images (JPEG, JPG, PNG, GIF) and PDF files are allowed'));
  }
};

export const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: fileFilter
});

// Helper function to get file info
export function getFileInfo(filename: string) {
  const filePath = path.join(uploadsDir, filename);
  
  if (!fs.existsSync(filePath)) {
    return null;
  }
  
  const stats = fs.statSync(filePath);
  return {
    filename,
    path: filePath,
    size: stats.size,
    url: `/uploads/${filename}`,
    exists: true
  };
}

// Helper function to delete file
export function deleteFile(filename: string): boolean {
  try {
    const filePath = path.join(uploadsDir, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
}

// Helper function to read file as base64
export function readFileAsBase64(filename: string): string | null {
  try {
    const filePath = path.join(uploadsDir, filename);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    
    const fileBuffer = fs.readFileSync(filePath);
    const ext = path.extname(filename).toLowerCase();
    
    let mimeType = 'application/octet-stream';
    if (ext === '.jpg' || ext === '.jpeg') {
      mimeType = 'image/jpeg';
    } else if (ext === '.png') {
      mimeType = 'image/png';
    } else if (ext === '.pdf') {
      mimeType = 'application/pdf';
    } else if (ext === '.gif') {
      mimeType = 'image/gif';
    }
    
    return `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
  } catch (error) {
    console.error('Error reading file as base64:', error);
    return null;
  }
}