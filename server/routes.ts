import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import type { Address } from "@shared/schema";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { mapFormDataToTemplateFields, generatePdfHtml, convertPdfToImages } from "./fieldMapping";
import { setupAuth, requireAuth, optionalAuth } from "./auth";
import { insertCustomerSchema, insertSocietySchema, insertPropertySchema, insertAgreementSchema, insertPdfTemplateSchema } from "@shared/schema";
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
      const { search, limit, offset, activeOnly } = req.query;
      const result = await storage.getCustomers(
        search as string,
        limit ? parseInt(limit as string) : undefined,
        offset ? parseInt(offset as string) : undefined,
        activeOnly === 'true'
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

  const validatePasswordStrength = (password: string): string | null => {
    if (!password || password.length < 8) {
      return "Password must be at least 8 characters long";
    }
    if (!/[A-Z]/.test(password)) {
      return "Password must contain at least one uppercase letter";
    }
    if (!/[a-z]/.test(password)) {
      return "Password must contain at least one lowercase letter";
    }
    if (!/[0-9]/.test(password)) {
      return "Password must contain at least one number";
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      return "Password must contain at least one special character";
    }
    return null;
  };

  app.patch("/api/customers/:id/reset-password", async (req, res) => {
    try {
      const { newPassword } = req.body;
      
      const validationError = validatePasswordStrength(newPassword);
      if (validationError) {
        return res.status(400).json({ message: validationError });
      }
      
      const customer = await storage.resetCustomerPassword(req.params.id, newPassword);
      res.json(customer);
    } catch (error) {
      console.error("Error resetting customer password:", error);
      res.status(500).json({ message: "Failed to reset customer password" });
    }
  });

  app.patch("/api/customers/:id/toggle-status", async (req, res) => {
    try {
      const { isActive } = req.body;
      const customer = await storage.toggleCustomerStatus(req.params.id, isActive);
      res.json(customer);
    } catch (error) {
      console.error("Error toggling customer status:", error);
      res.status(500).json({ message: "Failed to toggle customer status" });
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
      if (error instanceof Error && error.message.includes("existing agreements")) {
        return res.status(400).json({ message: "Cannot delete customer with existing agreements" });
      }
      res.status(500).json({ message: "Failed to delete customer" });
    }
  });

  // Property API routes
  app.get("/api/properties/all", async (req, res) => {
    try {
      const properties = await storage.getAllPropertiesWithCustomers();
      res.json(properties);
    } catch (error) {
      console.error("Error fetching all properties:", error);
      res.status(500).json({ message: "Failed to fetch all properties" });
    }
  });

  app.get("/api/properties", async (req, res) => {
    try {
      const { customerId } = req.query;
      if (!customerId) {
        return res.status(400).json({ message: "Customer ID is required" });
      }
      
      const properties = await storage.getProperties(customerId as string);
      res.json(properties);
    } catch (error) {
      console.error("Error fetching properties:", error);
      res.status(500).json({ message: "Failed to fetch properties" });
    }
  });

  app.get("/api/properties/:id", async (req, res) => {
    try {
      const property = await storage.getProperty(req.params.id);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }
      res.json(property);
    } catch (error) {
      console.error("Error fetching property:", error);
      res.status(500).json({ message: "Failed to fetch property" });
    }
  });

  app.post("/api/properties", async (req, res) => {
    try {
      const propertyData = insertPropertySchema.parse(req.body);
      const property = await storage.createProperty(propertyData);
      res.status(201).json(property);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid property data", errors: error.errors });
      }
      console.error("Error creating property:", error);
      res.status(500).json({ message: "Failed to create property" });
    }
  });

  app.get("/api/properties/:propertyId/agreements", async (req, res) => {
    try {
      const { propertyId } = req.params;
      const result = await storage.getAgreements({ propertyId });
      res.json(result);
    } catch (error) {
      console.error("Error fetching property agreements:", error);
      res.status(500).json({ message: "Failed to fetch property agreements" });
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

  // Download agreement PDF
  app.get("/api/agreements/:id/pdf", async (req, res) => {
    try {
      const agreement = await storage.getAgreement(req.params.id);
      if (!agreement) {
        return res.status(404).json({ message: "Agreement not found" });
      }

      // Find template for this agreement
      const templates = await storage.getPdfTemplates('rental_agreement', agreement.language || 'english');
      const template = templates.find(t => t.isActive) || templates[0];
      
      if (!template) {
        return res.status(404).json({ message: "No PDF template found" });
      }

      // Generate PDF HTML content
      const { generatePdfHtml } = await import("./fieldMapping");
      const processedHtml = await generatePdfHtml(agreement, template.htmlTemplate, agreement.language || 'english');
      
      // Return the HTML for client-side PDF generation
      res.json({
        html: processedHtml,
        agreementNumber: agreement.agreementNumber,
        filename: `${agreement.agreementNumber}.pdf`
      });
    } catch (error) {
      console.error("Error generating agreement PDF:", error);
      res.status(500).json({ message: "Failed to generate PDF" });
    }
  });

  // Generate Word document
  app.post("/api/agreements/generate-word", async (req, res) => {
    try {
      const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, Table, TableRow, TableCell, WidthType, Media, ImageRun } = await import('docx');
      
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

      // Use the original language for Word documents and generate the HTML with mapped field values
      const processedHtml = await generatePdfHtml(safeAgreementData, template.htmlTemplate, language);
      
      // Create Word document elements that match PDF layout exactly
      const documentParagraphs = [];
      
      // Parse the HTML to extract structured content with proper formatting
      let cleanedHtml = processedHtml
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

      // Helper function to create paragraph with proper styling
      const createParagraph = (text: string, options: any = {}) => {
        if (!text) return null;
        
        // Ensure text is a string
        const textStr = String(text);
        if (!textStr.trim()) return null;
        
        const sanitizedText = textStr
          .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
          .replace(/\uFFFD/g, '')
          .replace(/[\u2028\u2029]/g, '\n')
          .trim();

        if (!sanitizedText) return null;

        // Handle multi-line text (addresses, etc.)
        if (sanitizedText.includes('\n')) {
          const lines = sanitizedText.split('\n').filter(line => line.trim());
          const textRuns: any[] = [];
          
          lines.forEach((line, index) => {
            textRuns.push(new TextRun({
              text: line.trim(),
              font: "Times New Roman",
              size: options.size || 24,
              bold: options.bold || false,
              italics: options.italic || false,
            }));
            
            // Add line break except for the last line
            if (index < lines.length - 1) {
              textRuns.push(new TextRun({
                text: '',
                break: 1
              }));
            }
          });
          
          return new Paragraph({
            children: textRuns,
            alignment: options.alignment || AlignmentType.LEFT,
            spacing: options.spacing || { after: 120 },
            indent: options.indent || undefined,
            ...options.paragraphOptions
          });
        }

        return new Paragraph({
          children: [new TextRun({
            text: sanitizedText,
            font: "Times New Roman",
            size: options.size || 28,
            bold: options.bold || false,
            italics: options.italic || false,
          })],
          alignment: options.alignment || AlignmentType.LEFT,
          spacing: options.spacing || { after: 120 },
          indent: options.indent || undefined,
          ...options.paragraphOptions
        });
      };

      // Helper function to convert HTML to Word paragraphs, handling bold text and proper formatting
      const htmlToWordParagraphs = (html: string) => {
        const paragraphs = [];
        
        // Remove images from HTML for text processing
        let processedContent = html
          .replace(/<img[^>]*>/gi, '')  // Remove images completely for main text
          .replace(/<br\s*\/?>/gi, '\n\n')  // Convert <br> to double newlines
          .replace(/<\/p>/gi, '\n\n')       // Convert </p> to double newlines
          .replace(/<p[^>]*>/gi, '')        // Remove <p> opening tags
          .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '\n\n$1\n\n') // Handle headings
          .replace(/&nbsp;/gi, ' ')         // Convert &nbsp; to spaces
          .replace(/&amp;/gi, '&')          // Convert &amp; to &
          .replace(/&lt;/gi, '<')           // Convert &lt; to <
          .replace(/&gt;/gi, '>')           // Convert &gt; to >
          .replace(/&quot;/gi, '"')         // Convert &quot; to "
          .replace(/&#39;/gi, "'")          // Convert &#39; to '
          .replace(/\n\s*\n/g, '\n\n')      // Normalize multiple newlines
          .trim();

        // Split by double newlines to create paragraphs
        const textBlocks = processedContent.split('\n\n').filter(block => block.trim());
        
        textBlocks.forEach(block => {
          const trimmedBlock = block.trim();
          if (trimmedBlock) {
            // Check if this looks like a title (all caps, short, centered content)
            const isTitle = trimmedBlock.length < 100 && trimmedBlock === trimmedBlock.toUpperCase() && 
                           (trimmedBlock.includes('RENT AGREEMENT') || trimmedBlock.includes('RENTAL AGREEMENT'));
            
            // Check if this looks like a heading (starts with number, short)
            const isHeading = /^\d+\.?\s/.test(trimmedBlock) && trimmedBlock.length < 200;
            
            // Check for address blocks (contains multiple lines with address components)
            const isAddress = trimmedBlock.includes('\n') && 
                             (trimmedBlock.toLowerCase().includes('address') || 
                              /\d{6}/.test(trimmedBlock) || // Contains pincode
                              trimmedBlock.split('\n').length >= 3); // Multiple lines
            
            // Handle mixed bold/regular text within a paragraph
            if (/<(strong|b)>/i.test(block)) {
              // This paragraph contains bold text - handle it specially
              const textRuns = [];
              let currentText = block;
              
              // Process bold tags
              let match;
              const boldRegex = /<(strong|b)>(.*?)<\/(strong|b)>/gi;
              let lastIndex = 0;
              
              while ((match = boldRegex.exec(currentText)) !== null) {
                // Add regular text before bold
                const beforeText = currentText.substring(lastIndex, match.index).replace(/<[^>]*>/g, '').trim();
                if (beforeText) {
                  textRuns.push(new TextRun({
                    text: beforeText,
                    font: "Times New Roman",
                    size: isTitle ? 28 : (isHeading ? 26 : (isAddress ? 22 : 24)),
                    bold: false
                  }));
                }
                
                // Add bold text
                const boldText = match[2].replace(/<[^>]*>/g, '').trim();
                if (boldText) {
                  textRuns.push(new TextRun({
                    text: boldText,
                    font: "Times New Roman",
                    size: isTitle ? 28 : (isHeading ? 26 : (isAddress ? 22 : 24)),
                    bold: true
                  }));
                }
                
                lastIndex = boldRegex.lastIndex;
              }
              
              // Add remaining regular text after last bold
              const afterText = currentText.substring(lastIndex).replace(/<[^>]*>/g, '').trim();
              if (afterText) {
                textRuns.push(new TextRun({
                  text: afterText,
                  font: "Times New Roman",
                  size: isTitle ? 28 : (isHeading ? 26 : (isAddress ? 22 : 24)),
                  bold: false
                }));
              }
              
              if (textRuns.length > 0) {
                paragraphs.push(new Paragraph({
                  children: textRuns,
                  alignment: isTitle ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
                  spacing: { 
                    before: isTitle ? 240 : (isHeading ? 160 : (isAddress ? 120 : 0)),
                    after: isTitle ? 320 : (isHeading ? 240 : (isAddress ? 240 : 240))
                  }
                }));
              }
            } else {
              // No bold text - handle normally
              const cleanText = trimmedBlock.replace(/<[^>]*>/g, '');
              const para = createParagraph(cleanText, {
                size: isTitle ? 28 : (isHeading ? 26 : (isAddress ? 22 : 24)),
                bold: isTitle || isHeading,
                alignment: isTitle ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
                spacing: { 
                  before: isTitle ? 240 : (isHeading ? 160 : (isAddress ? 120 : 0)),
                  after: isTitle ? 320 : (isHeading ? 240 : (isAddress ? 240 : 240))
                }
              });
              
              if (para) {
                paragraphs.push(para);
              }
            }
          }
        });
        
        return paragraphs;
      };

      // Convert the processed HTML to Word paragraphs
      const convertedParagraphs = htmlToWordParagraphs(cleanedHtml);
      documentParagraphs.push(...convertedParagraphs);







      console.log(`[Word Generation] Template processing complete with ${documentParagraphs.length} elements`);

      // Add document sections if documents exist (matching PDF layout exactly)
      let hasDocuments = false;

      // Landlord documents section
      if (safeAgreementData.ownerDetails?.aadharUrl || safeAgreementData.ownerDetails?.panUrl) {
        hasDocuments = true;
        // Page break for landlord documents
        documentParagraphs.push(new Paragraph({ 
          children: [new TextRun({ text: '' })],
          pageBreakBefore: true
        }));
        
        const landlordDocsTitle = createParagraph("LANDLORD DOCUMENTS", {
          size: 26,
          bold: true,
          alignment: AlignmentType.CENTER,
          spacing: { after: 480 }
        });
        if (landlordDocsTitle) documentParagraphs.push(landlordDocsTitle);

        if (safeAgreementData.ownerDetails?.aadharUrl) {
          const aadharTitle = createParagraph("Aadhaar Card:", {
            size: 24,
            bold: false,
            alignment: AlignmentType.LEFT,
            spacing: { before: 240, after: 240 }
          });
          if (aadharTitle) documentParagraphs.push(aadharTitle);
          
          // Embed actual image instead of file path
          try {
            const imagePath = path.join(process.cwd(), safeAgreementData.ownerDetails.aadharUrl);
            console.log(`[Word Generation] Looking for Landlord Aadhaar image at: ${imagePath}`);
            
            if (fs.existsSync(imagePath)) {
              const imageBuffer = fs.readFileSync(imagePath);
              console.log(`[Word Generation] Loaded Landlord Aadhaar image, size: ${imageBuffer.length} bytes`);
              
              // Add image with proper formatting
              documentParagraphs.push(new Paragraph({
                children: [
                  new ImageRun({
                    data: imageBuffer,
                    transformation: {
                      width: 300,
                      height: 200,
                    }
                  })
                ],
                alignment: AlignmentType.CENTER,
                spacing: { after: 480 }
              }));
              console.log(`[Word Generation] Successfully embedded Landlord Aadhaar image`);
            } else {
              console.log(`[Word Generation] Landlord Aadhaar image not found at path: ${imagePath}`);
              // Fallback to file path if image not found
              const aadharPath = createParagraph(`Image not found: ${safeAgreementData.ownerDetails.aadharUrl}`, {
                size: 24,
                alignment: AlignmentType.CENTER,
                spacing: { after: 480 }
              });
              if (aadharPath) documentParagraphs.push(aadharPath);
            }
          } catch (imageError) {
            console.error('[Word Generation] Error embedding Landlord Aadhaar image:', imageError);
            // Fallback to file path on error
            const aadharPath = createParagraph(`Error loading image: ${safeAgreementData.ownerDetails.aadharUrl}`, {
              size: 24,
              alignment: AlignmentType.CENTER,
              spacing: { after: 480 }
            });
            if (aadharPath) documentParagraphs.push(aadharPath);
          }
        }

        if (safeAgreementData.ownerDetails?.panUrl) {
          // Page break for PAN
          documentParagraphs.push(new Paragraph({ 
            children: [new TextRun({ text: '' })],
            pageBreakBefore: true
          }));
          
          const panTitle = createParagraph("PAN Card:", {
            size: 24,
            bold: false,
            alignment: AlignmentType.LEFT,
            spacing: { before: 240, after: 240 }
          });
          if (panTitle) documentParagraphs.push(panTitle);
          
          // Embed actual PAN image instead of file path
          try {
            const imagePath = path.join(process.cwd(), safeAgreementData.ownerDetails.panUrl);
            console.log(`[Word Generation] Looking for Landlord PAN image at: ${imagePath}`);
            
            if (fs.existsSync(imagePath)) {
              const imageBuffer = fs.readFileSync(imagePath);
              console.log(`[Word Generation] Loaded Landlord PAN image, size: ${imageBuffer.length} bytes`);
              
              documentParagraphs.push(new Paragraph({
                children: [
                  new ImageRun({
                    data: imageBuffer,
                    transformation: {
                      width: 300,
                      height: 200,
                    }
                  })
                ],
                alignment: AlignmentType.CENTER,
                spacing: { after: 480 }
              }));
              console.log(`[Word Generation] Successfully embedded Landlord PAN image`);
            } else {
              console.log(`[Word Generation] Landlord PAN image not found at path: ${imagePath}`);
              const panPath = createParagraph(`Image not found: ${safeAgreementData.ownerDetails.panUrl}`, {
                size: 24,
                alignment: AlignmentType.CENTER,
                spacing: { after: 480 }
              });
              if (panPath) documentParagraphs.push(panPath);
            }
          } catch (imageError) {
            console.error('[Word Generation] Error embedding Landlord PAN image:', imageError);
            const panPath = createParagraph(`Error loading image: ${safeAgreementData.ownerDetails.panUrl}`, {
              size: 24,
              alignment: AlignmentType.CENTER,
              spacing: { after: 480 }
            });
            if (panPath) documentParagraphs.push(panPath);
          }
        }
      }

      // Tenant documents section
      if (safeAgreementData.tenantDetails?.aadharUrl || safeAgreementData.tenantDetails?.panUrl) {
        hasDocuments = true;
        // Page break for tenant documents
        documentParagraphs.push(new Paragraph({ 
          children: [new TextRun({ text: '' })],
          pageBreakBefore: true
        }));
        
        const tenantDocsTitle = createParagraph("TENANT DOCUMENTS", {
          size: 26,
          bold: true,
          alignment: AlignmentType.CENTER,
          spacing: { after: 480 }
        });
        if (tenantDocsTitle) documentParagraphs.push(tenantDocsTitle);

        if (safeAgreementData.tenantDetails?.aadharUrl) {
          const aadharTitle = createParagraph("Aadhaar Card:", {
            size: 24,
            bold: false,
            alignment: AlignmentType.LEFT,
            spacing: { before: 240, after: 240 }
          });
          if (aadharTitle) documentParagraphs.push(aadharTitle);
          
          // Embed actual tenant Aadhaar image instead of file path
          try {
            const imagePath = path.join(process.cwd(), safeAgreementData.tenantDetails.aadharUrl);
            console.log(`[Word Generation] Looking for Tenant Aadhaar image at: ${imagePath}`);
            
            if (fs.existsSync(imagePath)) {
              const imageBuffer = fs.readFileSync(imagePath);
              console.log(`[Word Generation] Loaded Tenant Aadhaar image, size: ${imageBuffer.length} bytes`);
              
              documentParagraphs.push(new Paragraph({
                children: [
                  new ImageRun({
                    data: imageBuffer,
                    transformation: {
                      width: 300,
                      height: 200,
                    }
                  })
                ],
                alignment: AlignmentType.CENTER,
                spacing: { after: 480 }
              }));
              console.log(`[Word Generation] Successfully embedded Tenant Aadhaar image`);
            } else {
              console.log(`[Word Generation] Tenant Aadhaar image not found at path: ${imagePath}`);
              const aadharPath = createParagraph(`Image not found: ${safeAgreementData.tenantDetails.aadharUrl}`, {
                size: 24,
                alignment: AlignmentType.CENTER,
                spacing: { after: 480 }
              });
              if (aadharPath) documentParagraphs.push(aadharPath);
            }
          } catch (imageError) {
            console.error('[Word Generation] Error embedding Tenant Aadhaar image:', imageError);
            const aadharPath = createParagraph(`Error loading image: ${safeAgreementData.tenantDetails.aadharUrl}`, {
              size: 24,
              alignment: AlignmentType.CENTER,
              spacing: { after: 480 }
            });
            if (aadharPath) documentParagraphs.push(aadharPath);
          }
        }

        if (safeAgreementData.tenantDetails?.panUrl) {
          // Page break for PAN
          documentParagraphs.push(new Paragraph({ 
            children: [new TextRun({ text: '' })],
            pageBreakBefore: true
          }));
          
          const panTitle = createParagraph("PAN Card:", {
            size: 24,
            bold: false,
            alignment: AlignmentType.LEFT,
            spacing: { before: 240, after: 240 }
          });
          if (panTitle) documentParagraphs.push(panTitle);
          
          // Embed actual tenant PAN image instead of file path
          try {
            const imagePath = path.join(process.cwd(), safeAgreementData.tenantDetails.panUrl);
            console.log(`[Word Generation] Looking for Tenant PAN image at: ${imagePath}`);
            
            if (fs.existsSync(imagePath)) {
              const imageBuffer = fs.readFileSync(imagePath);
              console.log(`[Word Generation] Loaded Tenant PAN image, size: ${imageBuffer.length} bytes`);
              
              documentParagraphs.push(new Paragraph({
                children: [
                  new ImageRun({
                    data: imageBuffer,
                    transformation: {
                      width: 300,
                      height: 200,
                    }
                  })
                ],
                alignment: AlignmentType.CENTER,
                spacing: { after: 480 }
              }));
              console.log(`[Word Generation] Successfully embedded Tenant PAN image`);
            } else {
              console.log(`[Word Generation] Tenant PAN image not found at path: ${imagePath}`);
              const panPath = createParagraph(`Image not found: ${safeAgreementData.tenantDetails.panUrl}`, {
                size: 24,
                alignment: AlignmentType.CENTER,
                spacing: { after: 480 }
              });
              if (panPath) documentParagraphs.push(panPath);
            }
          } catch (imageError) {
            console.error('[Word Generation] Error embedding Tenant PAN image:', imageError);
            const panPath = createParagraph(`Error loading image: ${safeAgreementData.tenantDetails.panUrl}`, {
              size: 24,
              alignment: AlignmentType.CENTER,
              spacing: { after: 480 }
            });
            if (panPath) documentParagraphs.push(panPath);
          }
        }
      }

      // Property documents section
      if (safeAgreementData.propertyDocuments?.url) {
        hasDocuments = true;
        // Page break for property documents
        documentParagraphs.push(new Paragraph({ 
          children: [new TextRun({ text: '' })],
          pageBreakBefore: true
        }));
        
        const propertyDocsTitle = createParagraph("PROPERTY DOCUMENTS", {
          size: 26,
          bold: true,
          alignment: AlignmentType.CENTER,
          spacing: { after: 480 }
        });
        if (propertyDocsTitle) documentParagraphs.push(propertyDocsTitle);
        
        // Embed actual property document image instead of file path
        try {
          const imagePath = path.join(process.cwd(), safeAgreementData.propertyDocuments.url);
          console.log(`[Word Generation] Looking for Property document image at: ${imagePath}`);
          
          if (fs.existsSync(imagePath)) {
            const imageBuffer = fs.readFileSync(imagePath);
            
            console.log(`[Word Generation] Loaded Property document image, size: ${imageBuffer.length} bytes`);
            
            documentParagraphs.push(new Paragraph({
              children: [
                new ImageRun({
                  data: imageBuffer,
                  transformation: {
                    width: 300,
                    height: 200,
                  }
                })
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 480 }
            }));
            console.log(`[Word Generation] Successfully embedded Property document image`);
          } else {
            console.log(`[Word Generation] Property document image not found at path: ${imagePath}`);
            const propertyPath = createParagraph(`Image not found: ${safeAgreementData.propertyDocuments.url}`, {
              size: 24,
              alignment: AlignmentType.CENTER,
              spacing: { after: 480 }
            });
            if (propertyPath) documentParagraphs.push(propertyPath);
          }
        } catch (imageError) {
          console.error('[Word Generation] Error embedding Property document image:', imageError);
          const propertyPath = createParagraph(`Error loading image: ${safeAgreementData.propertyDocuments.url}`, {
            size: 24,
            alignment: AlignmentType.CENTER,
            spacing: { after: 480 }
          });
          if (propertyPath) documentParagraphs.push(propertyPath);
        }
      }

      console.log(`[Word Generation] Created ${documentParagraphs.length} structured elements for Word document`);

      // Create Word document with professional styling matching the PDF exactly
      const doc = new Document({
        styles: {
          default: {
            document: {
              run: {
                font: "Times New Roman", // Match PDF font
                size: 24, // 12pt font size (24 half-points) 
              },
              paragraph: {
                spacing: {
                  line: 1.5 * 240, // 1.5 line spacing
                  after: 200, // Paragraph spacing
                }
              }
            }
          }
        },
        sections: [{
          properties: {
            page: {
              margin: {
                top: 1440, // 1 inch top margin
                right: 1440, // 1 inch right margin
                bottom: 1440, // 1 inch bottom margin
                left: 1440 // 1 inch left margin
              },
              size: {
                orientation: "portrait",
                width: 12240, // 8.5 inches in twips
                height: 15840 // 11 inches in twips
              }
            }
          },
          children: documentParagraphs
        }],
      });

      console.log(`[Word Generation] Creating document with ${documentParagraphs.length} paragraphs`);
      
      // Generate the Word document buffer with error handling
      let docxBuffer;
      try {
        docxBuffer = await Packer.toBuffer(doc);
        console.log(`[Word Generation] Buffer created successfully, size: ${docxBuffer.length} bytes`);
      } catch (packError) {
        console.error('[Word Generation] Packer error:', packError);
        throw new Error(`Failed to create Word document: ${packError instanceof Error ? packError.message : 'Unknown packing error'}`);
      }

      // Verify buffer is valid
      if (!docxBuffer || docxBuffer.length === 0) {
        throw new Error('Generated Word document buffer is empty or invalid');
      }

      // Set proper response headers for Word document download
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="rental_agreement_${agreementData.agreementNumber || 'draft'}.docx"`);
      res.setHeader('Content-Length', docxBuffer.length.toString());
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      // Send the Word document buffer properly
      res.end(docxBuffer);
      
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

  // Property routes
  app.get("/api/properties", async (req, res) => {
    try {
      const { customerId } = req.query;
      const properties = await storage.getProperties(customerId as string);
      res.json(properties);
    } catch (error) {
      console.error("Error fetching properties:", error);
      res.status(500).json({ message: "Failed to fetch properties" });
    }
  });

  app.get("/api/properties/:id", async (req, res) => {
    try {
      const property = await storage.getProperty(req.params.id);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }
      res.json(property);
    } catch (error) {
      console.error("Error fetching property:", error);
      res.status(500).json({ message: "Failed to fetch property" });
    }
  });

  app.post("/api/properties", async (req, res) => {
    try {
      const propertyData = insertPropertySchema.parse(req.body);
      const property = await storage.createProperty(propertyData);
      res.status(201).json(property);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid property data", errors: error.errors });
      }
      console.error("Error creating property:", error);
      res.status(500).json({ message: "Failed to create property" });
    }
  });

  app.put("/api/properties/:id", async (req, res) => {
    try {
      const propertyData = insertPropertySchema.partial().parse(req.body);
      const property = await storage.updateProperty(req.params.id, propertyData);
      res.json(property);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid property data", errors: error.errors });
      }
      console.error("Error updating property:", error);
      res.status(500).json({ message: "Failed to update property" });
    }
  });

  app.delete("/api/properties/:id", async (req, res) => {
    try {
      await storage.deleteProperty(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting property:", error);
      res.status(500).json({ message: "Failed to delete property" });
    }
  });

  // Get agreements for a specific property
  app.get("/api/properties/:propertyId/agreements", async (req, res) => {
    try {
      const { propertyId } = req.params;
      const { status, search, limit, offset } = req.query;
      const result = await storage.getAgreements({
        propertyId: propertyId as string,
        status: status as string,
        search: search as string,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });
      res.json(result);
    } catch (error) {
      console.error("Error fetching property agreements:", error);
      res.status(500).json({ message: "Failed to fetch property agreements" });
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
      
      // Set proper headers for different file types
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
      } else if (ext === '.pdf') {
        contentType = 'application/pdf';
      }
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.setHeader('Access-Control-Allow-Origin', '*');
      
      // For PDFs, set inline display to prevent auto-download
      if (ext === '.pdf') {
        res.setHeader('Content-Disposition', 'inline');
      }
      
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

  // PDF to images conversion endpoint for preview
  app.post('/api/pdf-to-images', async (req, res) => {
    try {
      const { pdfUrl } = req.body;
      
      if (!pdfUrl) {
        return res.status(400).json({ error: 'pdfUrl is required' });
      }

      console.log(`[PDF-to-Images API] Converting PDF: ${pdfUrl}`);

      // Check if it's a local URL (starts with /objects/ or /uploads/)
      if (pdfUrl.startsWith('/objects/') || pdfUrl.startsWith('/uploads/')) {
        // Handle local files
        const filePath = pdfUrl.startsWith('/objects/') 
          ? pdfUrl.replace('/objects/', 'uploads/')
          : pdfUrl.replace('/uploads/', 'uploads/');
        
        const fullPath = path.join(process.cwd(), filePath);
        
        if (!fs.existsSync(fullPath)) {
          console.error(`[PDF-to-Images API] File not found: ${fullPath}`);
          return res.status(404).json({ error: 'PDF file not found' });
        }

        // Convert PDF to images using the existing function
        const documentType = 'PDF Document';
        const imageHtml = await convertPdfToImages(fullPath, documentType);
        
        if (imageHtml) {
          // Extract base64 image data from HTML
          const base64Pattern = /data:image\/png;base64,([^"]+)/g;
          const images: string[] = [];
          let match;
          
          while ((match = base64Pattern.exec(imageHtml)) !== null) {
            images.push(`data:image/png;base64,${match[1]}`);
          }
          
          console.log(`[PDF-to-Images API] Successfully converted PDF to ${images.length} images`);
          
          res.json({
            success: true,
            images,
            pageCount: images.length
          });
        } else {
          console.error(`[PDF-to-Images API] Failed to convert PDF: ${pdfUrl}`);
          res.status(500).json({ error: 'Failed to convert PDF to images' });
        }
      } else {
        // Handle external URLs or other cases
        res.status(400).json({ error: 'Unsupported PDF URL format' });
      }
    } catch (error) {
      console.error('[PDF-to-Images API] Error:', error);
      res.status(500).json({ error: 'Internal server error while converting PDF' });
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
      const processedHtml = await generatePdfHtml(agreementFormData, template.htmlTemplate, template.language);
      
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
