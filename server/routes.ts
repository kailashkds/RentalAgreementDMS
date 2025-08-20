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

  // Main agreements endpoint - list all agreements with filtering and pagination
  app.get("/api/agreements", async (req, res) => {
    try {
      const { search, limit, offset, status, customerId, propertyId } = req.query;
      
      const filters: any = {};
      if (status) filters.status = status as string;
      if (customerId) filters.customerId = customerId as string;
      if (propertyId) filters.propertyId = propertyId as string;
      
      const result = await storage.getAgreements({
        ...filters,
        search: search as string,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined
      });
      
      res.json(result);
    } catch (error) {
      console.error("Error fetching agreements:", error);
      res.status(500).json({ message: "Failed to fetch agreements" });
    }
  });

  // Get single agreement by ID
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
      console.log("[Word Generation] About to call generatePdfHtml");
      const processedHtml = await generatePdfHtml(safeAgreementData, template.htmlTemplate, language);
      console.log("[Word Generation] generatePdfHtml completed");
      
      // Create Word document elements that match PDF layout exactly
      const documentParagraphs = [];
      
      // Parse the HTML to extract structured content with proper formatting
      let cleanedHtml = processedHtml
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        // Preserve page breaks and structure
        .replace(/class="page-break-before"/gi, 'data-page-break="true"')
        // Handle center-aligned elements in HTML
        .replace(/<([^>]*?)text-align:\s*center([^>]*?)>/gi, '<$1text-align:center$2>');



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
              font: "Arial",
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
            spacing: options.spacing || { after: 80 },
            indent: options.indent || undefined,
            ...options.paragraphOptions
          });
        }

        return new Paragraph({
          children: [new TextRun({
            text: sanitizedText,
            font: "Arial",
            size: options.size || 24,
            bold: options.bold || false,
            italics: options.italic || false,
          })],
          alignment: options.alignment || AlignmentType.LEFT,
          spacing: options.spacing || { after: 80 },
          indent: options.indent || undefined,
          ...options.paragraphOptions
        });
      };

      // Enhanced HTML to Word conversion that preserves PDF-like structure
      const htmlToWordParagraphs = (html: string) => {
        const paragraphs: any[] = [];
        
        // First, identify and handle major sections
        const sections = [
          { pattern: /<h[1-3][^>]*>(.*?)<\/h[1-3]>/gi, isHeading: true },
          { pattern: /<p[^>]*style="[^"]*text-align:\s*center[^"]*"[^>]*>(.*?)<\/p>/gi, isCenter: true },
          { pattern: /<div[^>]*style="[^"]*text-align:\s*center[^"]*"[^>]*>(.*?)<\/div>/gi, isCenter: true },
          { pattern: /<strong>(.*?)<\/strong>/gi, isBold: true },
          { pattern: /<b>(.*?)<\/b>/gi, isBold: true }
        ];
        
        // Process HTML with better structure preservation
        let processedContent = html
          .replace(/<img[^>]*>/gi, '')  // Remove images for text processing
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')  // Remove styles
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove scripts
          .replace(/<!--[\s\S]*?-->/gi, '') // Remove comments
          .replace(/<br\s*\/?>/gi, '\n')    // Convert <br> to single newlines
          .replace(/<\/div>\s*<div/gi, '</div>\n\n<div') // Add spacing between divs
          .replace(/<\/p>\s*<p/gi, '</p>\n\n<p') // Add spacing between paragraphs
          .replace(/&nbsp;/gi, ' ')         // Convert &nbsp; to spaces
          .replace(/&amp;/gi, '&')          // HTML entity cleanup
          .replace(/&lt;/gi, '<')
          .replace(/&gt;/gi, '>')
          .replace(/&quot;/gi, '"')
          .replace(/&#39;/gi, "'");

        // Parse HTML elements to create structured Word content
        const htmlElements = processedContent.match(/<[^>]+>.*?<\/[^>]+>|[^<]+/gi) || [];
        
        console.log(`[Word Generation] Processing ${htmlElements.length} HTML elements`);
        
        htmlElements.forEach((element, index) => {
          const trimmedElement = element.trim();
          if (!trimmedElement) return;
          
          console.log(`[Word Generation] Element ${index}: "${trimmedElement.substring(0, 100)}${trimmedElement.length > 100 ? '...' : ''}"`);
          
          // Extract text content and determine formatting
          let textContent = trimmedElement.replace(/<[^>]*>/g, '').trim();
          if (!textContent) return;
          
          // Determine paragraph style based on element type and content
          let alignment = AlignmentType.LEFT;
          let bold = false;
          let size = 22; // Default size
          let spacing = { after: 100 };
          
          // Check for centered content
          if (trimmedElement.includes('text-align:center') || 
              trimmedElement.includes('text-align: center') ||
              trimmedElement.match(/<h[1-3]/i)) {
            alignment = AlignmentType.CENTER;
            bold = true;
            size = 24;
            spacing = { before: 200, after: 200 };
          }
          
          // Check for bold content
          if (trimmedElement.includes('<strong>') || 
              trimmedElement.includes('<b>') ||
              trimmedElement.includes('<h')) {
            bold = true;
          }
          
          // Handle section headers
          if (textContent.includes('LANDLORD DOCUMENTS') || 
              textContent.includes('TENANT DOCUMENTS') ||
              textContent.includes('RENT AGREEMENT')) {
            alignment = AlignmentType.CENTER;
            bold = true;
            size = 26;
            spacing = { before: 300, after: 200 };
          }
          
          // Create paragraph with proper formatting
          const paragraph = createParagraph(textContent, {
            alignment: alignment,
            bold: bold,
            size: size,
            spacing: spacing
          });
          
          if (paragraph) {
            paragraphs.push(paragraph);
          }
        });
        
        return paragraphs;
      };

      // Convert the processed HTML to Word paragraphs  
      const convertedParagraphs = htmlToWordParagraphs(cleanedHtml);
      documentParagraphs.push(...convertedParagraphs);

      console.log(`[Word Generation] Template processing complete with ${documentParagraphs.length} elements`);

      // Create the Word document
      const doc = new Document({
        sections: [{
          properties: {},
          children: documentParagraphs
        }]
      });

      // Generate the buffer and send as response
      const buffer = await Packer.toBuffer(doc);
      console.log(`[Word Generation] Buffer created successfully, size: ${buffer.length} bytes`);

      // Set appropriate headers for Word document download
      res.setHeader('Content-Disposition', `attachment; filename="${agreementData.agreementNumber}.docx"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      
      res.send(buffer);
    } catch (error) {
      console.error("Error generating Word document:", error);
      res.status(500).json({ 
        message: "Failed to generate Word document",
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Create and return the HTTP server
  return createServer(app);
}
