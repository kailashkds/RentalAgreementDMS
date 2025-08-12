import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import type { Address } from "@shared/schema";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { mapFormDataToTemplateFields, generatePdfHtml } from "./fieldMapping";
import { setupAuth, requireAuth, optionalAuth } from "./auth";
import { insertCustomerSchema, insertSocietySchema, insertAgreementSchema, insertPdfTemplateSchema } from "@shared/schema";
import { directFileUpload } from "./directFileUpload";
import { upload, getFileInfo, deleteFile, readFileAsBase64 } from "./localFileUpload";
import { z } from "zod";
import bcrypt from "bcrypt";
import path from "path";
import fs from "fs";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication system
  await setupAuth(app);
  
  // Debug endpoint to check admin user status (temporary)
  app.get("/api/debug/admin-status", async (req, res) => {
    try {
      const adminUser = await storage.getAdminUserByUsername("admin");
      const allAdmins = await storage.getAdminUsers();
      res.json({
        adminExists: !!adminUser,
        adminUser: adminUser ? { id: adminUser.id, username: adminUser.username, email: adminUser.email } : null,
        totalAdmins: allAdmins.length,
        environment: process.env.NODE_ENV || 'development'
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // Emergency admin creation endpoint
  app.post("/api/create-admin", async (req, res) => {
    try {
      const { secret } = req.body;
      if (secret !== "quickkaraar2024") {
        return res.status(403).json({ message: "Invalid secret" });
      }
      
      const existingAdmin = await storage.getAdminUserByUsername("admin");
      if (existingAdmin) {
        return res.json({ message: "Admin already exists", admin: { username: existingAdmin.username, email: existingAdmin.email } });
      }
      
      const hashedPassword = await bcrypt.hash("admin123", 10);
      const newAdmin = await storage.createAdminUser({
        username: "admin",
        name: "Administrator",
        email: "admin@quickkaraar.com", 
        password: hashedPassword,
        role: "super_admin",
        isActive: true
      });
      
      res.json({ message: "Admin created successfully", admin: { username: newAdmin.username, email: newAdmin.email } });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });
  // Dashboard stats
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Customer routes
  app.get("/api/customers/by-mobile", async (req, res) => {
    try {
      const { mobile } = req.query;
      if (!mobile) {
        return res.status(400).json({ message: "Mobile number is required" });
      }
      
      const customer = await storage.getCustomerByMobile(mobile as string);
      if (customer) {
        res.json(customer);
      } else {
        res.status(404).json({ message: "Customer not found" });
      }
    } catch (error) {
      console.error("Error fetching customer by mobile:", error);
      res.status(500).json({ message: "Failed to fetch customer" });
    }
  });

  app.get("/api/customers", async (req, res) => {
    try {
      const { search, limit, offset } = req.query;
      const result = await storage.getCustomers(
        search as string,
        limit ? parseInt(limit as string) : undefined,
        offset ? parseInt(offset as string) : undefined
      );
      res.json(result);
    } catch (error) {
      console.error("Error fetching customers:", error);
      res.status(500).json({ message: "Failed to fetch customers" });
    }
  });

  app.get("/api/customers/:id", async (req, res) => {
    try {
      const customer = await storage.getCustomer(req.params.id);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      console.error("Error fetching customer:", error);
      res.status(500).json({ message: "Failed to fetch customer" });
    }
  });

  app.post("/api/customers", async (req, res) => {
    try {
      const customerData = insertCustomerSchema.parse(req.body);
      const customer = await storage.createCustomer({
        ...customerData,
        password: customerData.password || undefined
      });
      res.status(201).json(customer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid customer data", errors: error.errors });
      }
      console.error("Error creating customer:", error);
      res.status(500).json({ message: "Failed to create customer" });
    }
  });

  app.put("/api/customers/:id", async (req, res) => {
    try {
      const customerData = insertCustomerSchema.partial().parse(req.body);
      const customer = await storage.updateCustomer(req.params.id, customerData);
      res.json(customer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid customer data", errors: error.errors });
      }
      console.error("Error updating customer:", error);
      res.status(500).json({ message: "Failed to update customer" });
    }
  });

  app.delete("/api/customers/:id", async (req, res) => {
    try {
      await storage.deleteCustomer(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting customer:", error);
      res.status(500).json({ message: "Failed to delete customer" });
    }
  });

  // Quick PDF download endpoint for form data
  app.post("/api/agreements/generate-pdf", async (req, res) => {
    try {

      const agreementData = req.body;
      const language = agreementData.language || 'english';
      
      // Find a default template for rental agreements
      const templates = await storage.getPdfTemplates('rental_agreement', language);
      const template = templates.find(t => t.isActive) || templates[0]; // Use first active or first available template
      
      if (!template) {
        console.error(`No PDF template found for rental agreements in language: ${language}`);
        return res.status(404).json({ 
          message: "No PDF template found for rental agreements",
          language: language,
          availableTemplates: templates.map(t => ({ id: t.id, name: t.name, active: t.isActive }))
        });
      }

      // Ensure all required fields have default values
      const safeAgreementData = {
        ownerDetails: agreementData.ownerDetails || {},
        tenantDetails: agreementData.tenantDetails || {},
        propertyDetails: agreementData.propertyDetails || {},
        rentalTerms: agreementData.rentalTerms || {},
        agreementDate: agreementData.agreementDate,
        createdAt: agreementData.createdAt,
        agreementType: 'rental_agreement',
        additionalClauses: agreementData.additionalClauses || [],
        agreementNumber: agreementData.agreementNumber,
        language: language,
        // Include document data if available
        documents: agreementData.documents || {},
        ownerDocuments: agreementData.ownerDocuments || {},
        tenantDocuments: agreementData.tenantDocuments || {},
        propertyDocuments: agreementData.propertyDocuments || {}
      };

      // Debug: Log the agreement data structure to understand what we're working with
      console.log("Parsed agreement data:", JSON.stringify(safeAgreementData, null, 2));
      
      // Generate the HTML with mapped field values using the enhanced field mapping system (now with document embedding)
      const processedHtml = await generatePdfHtml(safeAgreementData, template.htmlTemplate, language);
      
      // Debug: Log first 500 chars of processed HTML to see if replacement is working
      console.log("First 500 chars of processed HTML:", processedHtml.substring(0, 500));
      
      // Return HTML for client-side PDF generation
      res.json({
        html: processedHtml,
        templateName: template.name,
        agreementNumber: agreementData.agreementNumber,
        message: "PDF content generated successfully"
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      console.error("Error stack:", error instanceof Error ? error.stack : 'No stack trace');
      res.status(500).json({ 
        message: "Failed to generate PDF",
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Generate Word document
  app.post("/api/agreements/generate-word", async (req, res) => {
    try {
      const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');
      
      const agreementData = req.body;
      const language = agreementData.language || 'english';

      // Get the appropriate template
      const templates = await storage.getPdfTemplates('rental_agreement', language);
      const template = templates.length > 0 ? templates[0] : null;
      
      if (!template) {
        return res.status(404).json({ 
          message: "No template found for Word document generation",
          language: language 
        });
      }

      // Ensure all required fields have default values
      const safeAgreementData = {
        ownerDetails: agreementData.ownerDetails || {},
        tenantDetails: agreementData.tenantDetails || {},
        propertyDetails: agreementData.propertyDetails || {},
        rentalTerms: agreementData.rentalTerms || {},
        agreementDate: agreementData.agreementDate,
        createdAt: agreementData.createdAt,
        agreementType: 'rental_agreement',
        additionalClauses: agreementData.additionalClauses || [],
        agreementNumber: agreementData.agreementNumber,
        language: language,
        documents: agreementData.documents || {},
        ownerDocuments: agreementData.ownerDocuments || {},
        tenantDocuments: agreementData.tenantDocuments || {},
        propertyDocuments: agreementData.propertyDocuments || {}
      };

      // Generate the HTML with mapped field values and convert to plain text
      const processedHtml = await generatePdfHtml(safeAgreementData, template.htmlTemplate);
      
      // Convert HTML to plain text for Word document
      let plainText = processedHtml;
      
      // Remove all <style> tags and their contents first
      plainText = plainText.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
      
      // Remove all CSS class definitions that leaked through
      plainText = plainText.replace(/\.[a-zA-Z-_]+\s*{[^}]*}/g, '');
      
      // Replace common HTML structures with appropriate text formatting
      plainText = plainText
        .replace(/<img[^>]*>/gi, '[Document/Image]') // Replace images with placeholder
        .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '$1\n') // Extract heading text
        .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '$1') // Extract bold text
        .replace(/<b[^>]*>(.*?)<\/b>/gi, '$1') // Extract bold text
        .replace(/<em[^>]*>(.*?)<\/em>/gi, '$1') // Extract italic text
        .replace(/<i[^>]*>(.*?)<\/i>/gi, '$1') // Extract italic text
        .replace(/<br\s*\/?>/gi, '\n') // Replace <br> with newlines
        .replace(/<\/p>/gi, '\n\n') // Replace </p> with double newlines
        .replace(/<p[^>]*>/gi, '') // Remove <p> opening tags
        .replace(/<\/div>/gi, '\n') // Replace </div> with newlines
        .replace(/<div[^>]*>/gi, '') // Remove <div> opening tags
        .replace(/<\/li>/gi, '\n') // Replace </li> with newlines
        .replace(/<li[^>]*>/gi, '• ') // Replace <li> with bullet points
        .replace(/<\/ul>/gi, '\n') // Replace </ul> with newlines
        .replace(/<ul[^>]*>/gi, '') // Remove <ul> tags
        .replace(/<\/ol>/gi, '\n') // Replace </ol> with newlines
        .replace(/<ol[^>]*>/gi, '') // Remove <ol> tags
        .replace(/<[^>]*>/g, '') // Remove all remaining HTML tags
        .replace(/&nbsp;/g, ' ') // Replace &nbsp; with spaces
        .replace(/&amp;/g, '&') // Replace HTML entities
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&rsquo;/g, "'")
        .replace(/&lsquo;/g, "'")
        .replace(/&rdquo;/g, '"')
        .replace(/&ldquo;/g, '"')
        .replace(/&#8217;/g, "'")
        .replace(/&#8220;/g, '"')
        .replace(/&#8221;/g, '"')
        .replace(/\n\s*\n\s*\n/g, '\n\n') // Replace triple+ newlines with double
        .replace(/^\s+|\s+$/gm, '') // Trim whitespace from each line
        .trim();

      // Split into paragraphs and filter out empty ones
      const lines = plainText.split('\n').filter(line => line.trim().length > 0);
      
      // Create structured paragraphs with proper formatting
      const documentParagraphs = [];
      
      // Add title
      documentParagraphs.push(new Paragraph({
        text: `RENTAL AGREEMENT${safeAgreementData.agreementNumber ? ` - ${safeAgreementData.agreementNumber}` : ''}`,
        heading: HeadingLevel.TITLE,
        spacing: { after: 400 }
      }));
      
      // Process each line and create appropriate paragraphs
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        if (trimmedLine.match(/^RENT AGREEMENT$/i) || 
            trimmedLine.match(/^LANDLORD DOCUMENTS$/i) ||
            trimmedLine.match(/^TENANT DOCUMENTS$/i) ||
            trimmedLine.match(/^Witnesses$/i)) {
          // Section headers
          documentParagraphs.push(new Paragraph({
            children: [new TextRun({
              text: trimmedLine,
              bold: true,
              size: 26 // 13pt font
            })],
            spacing: { before: 300, after: 200 }
          }));
        } else if (trimmedLine.match(/^\d+\./)) {
          // Numbered clauses
          documentParagraphs.push(new Paragraph({
            children: [new TextRun({
              text: trimmedLine,
              size: 22 // 11pt font
            })],
            spacing: { before: 200, after: 200 },
            indent: { left: 360 } // Indent numbered items
          }));
        } else if (trimmedLine === '[Document/Image]') {
          // Skip document placeholders in Word format
          continue;
        } else if (trimmedLine.length > 0) {
          // Regular paragraphs
          documentParagraphs.push(new Paragraph({
            children: [new TextRun({
              text: trimmedLine,
              size: 22 // 11pt font
            })],
            spacing: { after: 120 }
          }));
        }
      }

      // Create Word document with structured content
      const doc = new Document({
        sections: [{
          properties: {
            page: {
              margin: {
                top: 1440, // 1 inch
                right: 1440,
                bottom: 1440,
                left: 1440
              }
            }
          },
          children: documentParagraphs
        }],
      });

      // Generate the Word document buffer
      const docxBuffer = await Packer.toBuffer(doc);

      // Set response headers for Word document download
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="rental_agreement_${agreementData.agreementNumber || 'draft'}.docx"`);
      
      // Send the Word document
      res.send(docxBuffer);
      
    } catch (error) {
      console.error("Error generating Word document:", error);
      res.status(500).json({ 
        message: "Failed to generate Word document",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Society routes - no auth required for autocomplete
  app.get("/api/societies", async (req, res) => {
    try {
      const { search, limit } = req.query;
      const societies = await storage.getSocieties(
        search as string,
        limit ? parseInt(limit as string) : undefined
      );
      res.json(societies);
    } catch (error) {
      console.error("Error fetching societies:", error);
      res.status(500).json({ message: "Failed to fetch societies" });
    }
  });

  app.post("/api/societies", async (req, res) => {
    try {
      const societyData = insertSocietySchema.parse(req.body);
      const society = await storage.createSociety(societyData);
      res.status(201).json(society);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid society data", errors: error.errors });
      }
      console.error("Error creating society:", error);
      res.status(500).json({ message: "Failed to create society" });
    }
  });

  // Agreement routes
  app.get("/api/agreements", async (req, res) => {
    try {
      const { customerId, status, search, limit, offset } = req.query;
      const result = await storage.getAgreements({
        customerId: customerId as string,
        status: status as string,
        search: search as string,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });
      res.json(result);
    } catch (error) {
      console.error("Error fetching agreements:", error);
      res.status(500).json({ message: "Failed to fetch agreements" });
    }
  });

  app.get("/api/agreements/:id", async (req, res) => {
    try {
      const agreement = await storage.getAgreement(req.params.id);
      if (!agreement) {
        return res.status(404).json({ message: "Agreement not found" });
      }
      res.json(agreement);
    } catch (error) {
      console.error("Error fetching agreement:", error);
      res.status(500).json({ message: "Failed to fetch agreement" });
    }
  });

  app.post("/api/agreements", async (req, res) => {
    try {
      console.log("Received agreement data:", JSON.stringify(req.body, null, 2));
      const agreementData = insertAgreementSchema.parse(req.body);
      console.log("Parsed agreement data:", JSON.stringify(agreementData, null, 2));
      
      const agreement = await storage.createAgreement(agreementData);
      res.status(201).json(agreement);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Validation error:", error.errors);
        return res.status(400).json({ message: "Invalid agreement data", errors: error.errors });
      }
      
      // More detailed error logging
      console.error("Error creating agreement:", {
        message: (error as Error).message,
        stack: (error as Error).stack,
        name: (error as Error).name
      });
      
      // Send a more specific error message based on error type
      if ((error as Error).message.includes('connection') || (error as Error).message.includes('timeout')) {
        return res.status(503).json({ message: "Database connection error. Please try again." });
      }
      
      res.status(500).json({ message: "Failed to create agreement. Please try again." });
    }
  });

  app.put("/api/agreements/:id", async (req, res) => {
    try {
      const agreementData = insertAgreementSchema.partial().parse(req.body);
      const agreement = await storage.updateAgreement(req.params.id, agreementData);
      res.json(agreement);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid agreement data", errors: error.errors });
      }
      console.error("Error updating agreement:", error);
      res.status(500).json({ message: "Failed to update agreement" });
    }
  });

  app.delete("/api/agreements/:id", async (req, res) => {
    try {
      await storage.deleteAgreement(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting agreement:", error);
      res.status(500).json({ message: "Failed to delete agreement" });
    }
  });

  // Agreement renewal
  app.post("/api/agreements/:id/renew", requireAuth, async (req, res) => {
    try {
      const { startDate, endDate } = req.body;
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "Start date and end date are required" });
      }
      
      const renewedAgreement = await storage.renewAgreement(
        req.params.id,
        new Date(startDate),
        new Date(endDate)
      );
      res.status(201).json(renewedAgreement);
    } catch (error) {
      console.error("Error renewing agreement:", error);
      res.status(500).json({ message: "Failed to renew agreement" });
    }
  });

  // Agreement duplication
  app.post("/api/agreements/:id/duplicate", requireAuth, async (req, res) => {
    try {
      const { customerId } = req.body;
      const duplicatedAgreement = await storage.duplicateAgreement(req.params.id, customerId);
      res.status(201).json(duplicatedAgreement);
    } catch (error) {
      console.error("Error duplicating agreement:", error);
      res.status(500).json({ message: "Failed to duplicate agreement" });
    }
  });

  // Address search for intelligent autocomplete - requires authentication
  app.get("/api/addresses", requireAuth, async (req, res) => {
    try {
      const search = req.query.search as string;
      const limit = parseInt(req.query.limit as string) || 10;
      
      if (!search || search.length < 2) {
        return res.json([]);
      }
      
      const addresses = await storage.searchAddresses(search, limit);
      res.json(addresses);
    } catch (error) {
      console.error("Error searching addresses:", error);
      res.status(500).json({ message: "Failed to search addresses" });
    }
  });

  // Save new address - requires authentication  
  app.post("/api/addresses", requireAuth, async (req, res) => {
    try {
      const addressData = req.body;
      const address = await storage.saveAddress(addressData);
      res.status(201).json(address);
    } catch (error) {
      console.error("Error saving address:", error);
      res.status(500).json({ message: "Failed to save address" });
    }
  });

  // Agreement duplication
  app.post("/api/agreements/:id/duplicate", requireAuth, async (req, res) => {
    try {
      const { customerId } = req.body;
      const duplicatedAgreement = await storage.duplicateAgreement(req.params.id, customerId);
      res.status(201).json(duplicatedAgreement);
    } catch (error) {
      console.error("Error duplicating agreement:", error);
      res.status(500).json({ message: "Failed to duplicate agreement" });
    }
  });

  // Object storage routes for document uploads
  app.get("/objects/:objectPath(*)", async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    const objectPath = req.path;
    console.log(`[Object Access] Requested path: ${objectPath}`);
    
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
      console.log(`[Object Access] File found, serving: ${objectFile.name}`);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error(`[Object Access] Error accessing object at path ${objectPath}:`, error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  app.post("/api/objects/upload", async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  // ENHANCED FILE UPLOAD SYSTEM (auto-converts PDFs to images)
  app.post("/api/upload-direct", requireAuth, async (req, res) => {
    try {
      if (!req.body || !req.body.file) {
        return res.status(400).json({ error: "No file data provided" });
      }

      const { file, fileName } = req.body;
      
      // Convert base64 to buffer
      const base64Data = file.replace(/^data:.*,/, '');
      const fileBuffer = Buffer.from(base64Data, 'base64');
      
      // Save file and process for images (PDFs get converted to images)
      const saveResult = await directFileUpload.saveFile(fileBuffer, fileName);
      const fileUrl = directFileUpload.getFileUrl(saveResult.fileName);
      
      console.log(`[DirectUpload] File processed:`, {
        original: fileName,
        saved: saveResult.fileName,
        fileType: saveResult.fileType,
        imagePath: saveResult.imagePath,
        absolutePath: saveResult.absolutePath
      });
      
      res.json({ 
        success: true,
        fileName: saveResult.fileName,
        fileUrl: fileUrl,
        imagePath: saveResult.imagePath, // Use this path in <img> tags
        absolutePath: saveResult.absolutePath, // Full system path
        fileType: saveResult.fileType, // 'pdf', 'image', or 'unknown'
        message: `File uploaded successfully. ${saveResult.fileType === 'pdf' ? 'PDF converted to image for display.' : 'Image ready for use.'}`
      });
    } catch (error) {
      console.error("Error in direct file upload:", error);
      res.status(500).json({ error: "Failed to upload and process file" });
    }
  });

  // Serve uploaded files from local uploads folder with proper headers
  app.get("/uploads/:fileName", (req, res) => {
    try {
      const fileName = req.params.fileName;
      const filePath = path.join(process.cwd(), 'uploads', fileName);
      
      // Set proper headers for images to work in PDF generation
      const ext = path.extname(fileName).toLowerCase();
      let contentType = 'application/octet-stream';
      
      if (ext === '.jpg' || ext === '.jpeg') {
        contentType = 'image/jpeg';
      } else if (ext === '.png') {
        contentType = 'image/png';
      } else if (ext === '.gif') {
        contentType = 'image/gif';
      } else if (ext === '.webp') {
        contentType = 'image/webp';
      }
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.setHeader('Access-Control-Allow-Origin', '*');
      
      // Check if file exists and serve it
      res.sendFile(filePath, (err) => {
        if (err) {
          console.error("Error serving file:", err);
          res.status(404).json({ error: "File not found" });
        }
      });
    } catch (error) {
      console.error("Error serving uploaded file:", error);
      res.status(500).json({ error: "Failed to serve file" });
    }
  });

  // Local file upload endpoint - simple multipart upload
  app.post('/api/upload-local', upload.single('document'), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      console.log(`[Local Upload] File uploaded: ${req.file.filename}, Original: ${req.file.originalname}, Size: ${req.file.size}`);
      
      res.json({
        success: true,
        filename: req.file.filename,
        originalName: req.file.originalname,
        url: `/uploads/${req.file.filename}`,
        size: req.file.size,
        mimetype: req.file.mimetype
      });
    } catch (error) {
      console.error('[Local Upload] Error:', error);
      res.status(500).json({ error: 'Upload failed' });
    }
  });

  // Upload notarized document for a specific agreement
  app.post('/api/agreements/:agreementId/upload-notarized', upload.single('notarizedDocument'), async (req, res) => {
    try {
      const { agreementId } = req.params;
      
      if (!req.file) {
        return res.status(400).json({ error: 'No notarized document uploaded' });
      }

      // Validate it's a PDF file
      if (req.file.mimetype !== 'application/pdf') {
        return res.status(400).json({ error: 'Only PDF files are allowed for notarized documents' });
      }

      const agreement = await storage.getAgreement(agreementId);
      if (!agreement) {
        return res.status(404).json({ error: 'Agreement not found' });
      }

      // Create a proper naming convention: AGR-XXXX-notarized-YYYY-MM-DD.pdf
      const currentDate = new Date().toISOString().split('T')[0];
      const notarizedFileName = `${agreement.agreementNumber}-notarized-${currentDate}.pdf`;
      const notarizedFilePath = path.join('uploads', 'notarized', notarizedFileName);
      
      // Create notarized directory if it doesn't exist
      const notarizedDir = path.join(process.cwd(), 'uploads', 'notarized');
      if (!fs.existsSync(notarizedDir)) {
        fs.mkdirSync(notarizedDir, { recursive: true });
      }

      // Move file to proper location with proper name
      const finalPath = path.join(process.cwd(), 'uploads', 'notarized', notarizedFileName);
      fs.renameSync(req.file.path, finalPath);

      // Update agreement with notarized document details
      const notarizedDocData = {
        filename: notarizedFileName,
        originalName: req.file.originalname,
        uploadDate: new Date().toISOString(),
        url: `/uploads/notarized/${notarizedFileName}`,
        size: req.file.size,
        mimetype: req.file.mimetype
      };

      await storage.updateAgreementNotarizedDocument(agreementId, notarizedDocData);

      console.log(`[Notarized Upload] Document uploaded for agreement ${agreement.agreementNumber}: ${notarizedFileName}`);
      
      res.json({
        success: true,
        message: 'Notarized document uploaded successfully',
        filename: notarizedFileName,
        originalName: req.file.originalname,
        url: `/uploads/notarized/${notarizedFileName}`,
        size: req.file.size,
        uploadDate: notarizedDocData.uploadDate
      });

    } catch (error) {
      console.error('[Notarized Upload] Error:', error);
      res.status(500).json({ error: 'Failed to upload notarized document' });
    }
  });

  // Get notarized document for an agreement
  app.get('/api/agreements/:agreementId/notarized-document', async (req, res) => {
    try {
      const { agreementId } = req.params;
      const agreement = await storage.getAgreement(agreementId);
      
      if (!agreement) {
        return res.status(404).json({ error: 'Agreement not found' });
      }

      if (!agreement.notarizedDocument || !agreement.notarizedDocument.filename) {
        return res.status(404).json({ error: 'No notarized document found for this agreement' });
      }

      res.json({
        success: true,
        notarizedDocument: agreement.notarizedDocument
      });

    } catch (error) {
      console.error('[Notarized Download] Error:', error);
      res.status(500).json({ error: 'Failed to get notarized document' });
    }
  });

  // Remove notarized document for an agreement
  app.delete('/api/agreements/:agreementId/notarized-document', async (req, res) => {
    try {
      const { agreementId } = req.params;
      const agreement = await storage.getAgreement(agreementId);
      
      if (!agreement) {
        return res.status(404).json({ error: 'Agreement not found' });
      }

      if (!agreement.notarizedDocument || !agreement.notarizedDocument.filename) {
        return res.status(404).json({ error: 'No notarized document found for this agreement' });
      }

      // Delete the physical file
      const filePath = path.join(process.cwd(), 'uploads', 'notarized', agreement.notarizedDocument.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[Notarized Remove] File deleted: ${agreement.notarizedDocument.filename}`);
      }

      // Clear notarized document from database
      await storage.updateAgreementNotarizedDocument(agreementId, null);

      console.log(`[Notarized Remove] Document removed for agreement ${agreement.agreementNumber}`);
      
      res.json({
        success: true,
        message: 'Notarized document removed successfully'
      });

    } catch (error) {
      console.error('[Notarized Remove] Error:', error);
      res.status(500).json({ error: 'Failed to remove notarized document' });
    }
  });

  // Serve notarized documents
  app.get("/uploads/notarized/:fileName", (req, res) => {
    try {
      const fileName = req.params.fileName;
      const filePath = path.join(process.cwd(), 'uploads', 'notarized', fileName);
      
      // Set proper headers for PDF files
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      
      // Check if file exists and serve it
      res.sendFile(filePath, (err) => {
        if (err) {
          console.error("Error serving notarized document:", err);
          res.status(404).json({ error: "Notarized document not found" });
        }
      });
    } catch (error) {
      console.error("Error serving notarized document:", error);
      res.status(500).json({ error: "Failed to serve notarized document" });
    }
  });

  // Update agreement with document URLs
  app.put("/api/agreements/:id/documents", async (req, res) => {
    try {
      const { documents } = req.body;
      if (!documents) {
        return res.status(400).json({ error: "Documents data is required" });
      }

      const objectStorageService = new ObjectStorageService();
      const normalizedDocuments: any = {};

      // Normalize document paths
      for (const [key, url] of Object.entries(documents)) {
        if (typeof url === 'string' && url) {
          normalizedDocuments[key] = objectStorageService.normalizeObjectEntityPath(url);
        }
      }

      const agreement = await storage.updateAgreement(req.params.id, {
        documents: normalizedDocuments,
      });

      res.json({ agreement, documents: normalizedDocuments });
    } catch (error) {
      console.error("Error updating agreement documents:", error);
      res.status(500).json({ error: "Failed to update documents" });
    }
  });

  // PDF Template routes
  app.get("/api/pdf-templates", requireAuth, async (req, res) => {
    try {
      const { documentType, language } = req.query;
      const templates = await storage.getPdfTemplates(
        documentType as string,
        language as string
      );
      res.json(templates);
    } catch (error) {
      console.error("Error fetching PDF templates:", error);
      res.status(500).json({ message: "Failed to fetch PDF templates" });
    }
  });

  app.get("/api/pdf-templates/:id", requireAuth, async (req, res) => {
    try {
      const template = await storage.getPdfTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ message: "PDF template not found" });
      }
      res.json(template);
    } catch (error) {
      console.error("Error fetching PDF template:", error);
      res.status(500).json({ message: "Failed to fetch PDF template" });
    }
  });

  app.post("/api/pdf-templates", requireAuth, async (req, res) => {
    try {
      const templateData = insertPdfTemplateSchema.parse(req.body);
      const template = await storage.createPdfTemplate(templateData);
      res.status(201).json(template);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid template data", errors: error.errors });
      }
      console.error("Error creating PDF template:", error);
      res.status(500).json({ message: "Failed to create PDF template" });
    }
  });

  app.put("/api/pdf-templates/:id", requireAuth, async (req, res) => {
    try {
      const templateData = insertPdfTemplateSchema.partial().parse(req.body);
      const template = await storage.updatePdfTemplate(req.params.id, templateData);
      res.json(template);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid template data", errors: error.errors });
      }
      console.error("Error updating PDF template:", error);
      res.status(500).json({ message: "Failed to update PDF template" });
    }
  });

  app.delete("/api/pdf-templates/:id", requireAuth, async (req, res) => {
    try {
      await storage.deletePdfTemplate(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting PDF template:", error);
      res.status(500).json({ message: "Failed to delete PDF template" });
    }
  });

  // Test field mapping (temporary endpoint for debugging)
  app.post("/api/test-field-mapping", requireAuth, async (req, res) => {
    try {
      const { agreementData } = req.body;
      const mappedFields = mapFormDataToTemplateFields(agreementData);
      
      res.json({
        originalData: agreementData,
        mappedFields: mappedFields,
        message: "Field mapping test completed"
      });
    } catch (error) {
      console.error("Error testing field mapping:", error);
      res.status(500).json({ message: "Failed to test field mapping" });
    }
  });

  // Generate PDF from template using new field mapping system
  app.post("/api/generate-pdf", requireAuth, async (req, res) => {
    try {
      const { templateId, agreementData } = req.body;
      
      if (!templateId || !agreementData) {
        return res.status(400).json({ message: "Template ID and agreement data are required" });
      }

      const template = await storage.getPdfTemplate(templateId);
      if (!template) {
        return res.status(404).json({ message: "PDF template not found" });
      }

      // Use the new field mapping system to generate PDF HTML (now with document embedding)
      const processedHtml = await generatePdfHtml(agreementData, template.htmlTemplate);

      res.json({ 
        html: processedHtml,
        templateName: template.name,
        mappedFields: mapFormDataToTemplateFields(agreementData), // Include mapped fields for debugging
        message: "PDF generated successfully with field mapping" 
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ message: "Failed to generate PDF" });
    }
  });

  // Generate PDF from existing agreement
  app.post("/api/agreements/:id/generate-pdf", requireAuth, async (req, res) => {
    try {
      const { templateId } = req.body;
      
      // Get the agreement data
      const agreement = await storage.getAgreement(req.params.id);
      if (!agreement) {
        return res.status(404).json({ message: "Agreement not found" });
      }

      // Get the PDF template
      const template = await storage.getPdfTemplate(templateId);
      if (!template) {
        return res.status(404).json({ message: "PDF template not found" });
      }

      // Map agreement data to template fields
      const agreementFormData = {
        ownerDetails: agreement.ownerDetails,
        tenantDetails: agreement.tenantDetails,
        propertyDetails: agreement.propertyDetails,
        rentalTerms: agreement.rentalTerms,
        agreementDate: agreement.agreementDate,
        createdAt: agreement.createdAt,
        agreementType: 'rental_agreement'
      };

      // Generate the HTML with mapped field values (now with document embedding)
      const processedHtml = await generatePdfHtml(agreementFormData, template.htmlTemplate);
      
      res.json({
        html: processedHtml,
        templateName: template.name,
        agreementNumber: agreement.agreementNumber,
        message: "PDF generated from existing agreement"
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ message: "Failed to generate PDF" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Helper function to get nested object values
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}
