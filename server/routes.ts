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
      const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, Table, TableRow, TableCell, WidthType, Media, ImageRun, VerticalAlign } = await import('docx');
      
      // Helper function to detect Gujarati text and return appropriate font
      const getFontForText = (text: string): string => {
        if (!text || text.trim() === '') return "Arial";
        
        // Comprehensive Gujarati Unicode detection
        // U+0A80-U+0AFF: Gujarati block
        // U+0964-U+0965: Devanagari/Gujarati punctuation (।॥)  
        // U+0AE6-U+0AEF: Gujarati digits
        const gujaratiRegex = /[\u0A80-\u0AFF\u0964-\u0965]/;
        
        if (gujaratiRegex.test(text)) {
          console.log(`[Word Generation] Detected Gujarati text: "${text.substring(0, 50)}..." - applying Gujarati font`);
          return "Shruti"; // Primary Gujarati Unicode font (fallback: Nirmala UI)
        }
        
        return "Arial"; // Default for English and other text
      };

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
        // Remove signature section checkmarks that create duplicate document titles
        .replace(/<p[^>]*>\s*✓\s*(Aadhar Card Attached|PAN Card Attached|Aadhaar Card Attached)\s*<\/p>/gi, '')
        .replace(/<p[^>]*color:\s*#666[^>]*>\s*✓[^<]*<\/p>/gi, '') // Remove checkmark paragraphs
        // Handle center-aligned elements in HTML
        .replace(/<([^>]*?)text-align:\s*center([^>]*?)>/gi, '<$1text-align:center$2>');
      
      // Debug: Show structure of HTML before table conversion
      console.log('[Word Generation] HTML structure analysis:');
      const htmlLines = cleanedHtml.split('\n').slice(0, 50);
      htmlLines.forEach((line, index) => {
        if (line.includes('Passport Size Photo') || line.includes('Landlord') || line.includes('Tenant')) {
          console.log(`[Word Generation] Line ${index}: ${line.trim().substring(0, 100)}`);
        }
      });
      
      // Convert signature sections to table format for better Word layout
      console.log('[Word Generation] Looking for signature sections to convert...');
      
      // Track converted sections to avoid duplicates
      const convertedSections = new Set();
      let conversionCount = 0;
      
      // Log actual HTML content to debug signature sections
      console.log('[Word Generation] Scanning HTML for signature patterns...');
      const sampleLines = cleanedHtml.split('\n').slice(0, 200);
      sampleLines.forEach((line, index) => {
        if (line.includes('NIKHILESH') || line.includes('KAILASH') || line.includes('Landlord') || line.includes('Tenant') || line.includes('Passport Size Photo')) {
          console.log(`[Word Generation] Line ${index}: ${line.trim()}`);
        }
      });
      
      // Simple pattern to detect and replace signature sections
      // Replace landlord signature section
      cleanedHtml = cleanedHtml.replace(
        /<p style="font-style: italic;">Landlord<\/p>[\s\S]*?Passport Size Photo/gi,
        (match) => {
          const ownerName = safeAgreementData.ownerDetails?.fullName || "LANDLORD";
          const role = "Landlord";
          const sectionId = `${ownerName}-${role}`;
          
          if (!convertedSections.has(sectionId)) {
            convertedSections.add(sectionId);
            conversionCount++;
            console.log(`[Word Generation] ✓ Converting landlord signature to table: ${ownerName}`);
            
            return `
<table border="1" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse; margin: 20px 0;">
  <tr>
    <td width="60%" style="padding: 15px; vertical-align: top;">
      <p style="font-size: 16px; font-weight: bold; text-transform: uppercase; margin: 0 0 5px 0; color: green;">${ownerName}</p>
      <p style="font-size: 14px; font-style: italic; margin: 0 0 60px 0; color: green;">${role}</p>
      <div style="margin: 20px 0;">
        <p style="margin: 0 0 5px 0; font-size: 12px; border-bottom: 1px solid #000; width: 200px; height: 15px;">&nbsp;</p>
        <p style="margin: 0; font-size: 12px; text-align: center; width: 200px;">Signature</p>
      </div>
    </td>
    <td width="40%" style="padding: 15px; text-align: center; vertical-align: top;">
      <div style="border: 1px dashed #000; width: 120px; height: 140px; margin: 0 auto; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #666;">
        Passport Size Photo
      </div>
    </td>
  </tr>
</table>

<div style="margin: 30px 0 20px 0;">
  <p style="font-size: 14px; font-weight: bold; margin: 0 0 10px 0;">Witnesses</p>
  <div style="display: flex; justify-content: space-between; margin-top: 20px;">
    <div style="width: 45%;">
      <p style="margin: 0; border-bottom: 1px solid #000; height: 15px;">&nbsp;</p>
    </div>
    <div style="width: 45%;">
      <p style="margin: 0; border-bottom: 1px solid #000; height: 15px;">&nbsp;</p>
    </div>
  </div>
</div>`;
          }
          
          return match;
        }
      );
      
      // Replace tenant signature section
      cleanedHtml = cleanedHtml.replace(
        /<p style="font-style: italic;">Tenant<\/p>[\s\S]*?Passport Size Photo/gi,
        (match) => {
          const tenantName = safeAgreementData.tenantDetails?.fullName || "TENANT";
          const role = "Tenant";
          const sectionId = `${tenantName}-${role}`;
          
          if (!convertedSections.has(sectionId)) {
            convertedSections.add(sectionId);
            conversionCount++;
            console.log(`[Word Generation] ✓ Converting tenant signature to table: ${tenantName}`);
            
            return `
<table border="1" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse; margin: 20px 0;">
  <tr>
    <td width="60%" style="padding: 15px; vertical-align: top;">
      <p style="font-size: 16px; font-weight: bold; text-transform: uppercase; margin: 0 0 5px 0; color: green;">${tenantName}</p>
      <p style="font-size: 14px; font-style: italic; margin: 0 0 60px 0; color: green;">${role}</p>
      <div style="margin: 20px 0;">
        <p style="margin: 0 0 5px 0; font-size: 12px; border-bottom: 1px solid #000; width: 200px; height: 15px;">&nbsp;</p>
        <p style="margin: 0; font-size: 12px; text-align: center; width: 200px;">Signature</p>
      </div>
    </td>
    <td width="40%" style="padding: 15px; text-align: center; vertical-align: top;">
      <div style="border: 1px dashed #000; width: 120px; height: 140px; margin: 0 auto; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #666;">
        Passport Size Photo
      </div>
    </td>
  </tr>
</table>

<div style="margin: 30px 0 20px 0;">
  <p style="font-size: 14px; font-weight: bold; margin: 0 0 10px 0;">Witnesses</p>
  <div style="display: flex; justify-content: space-between; margin-top: 20px;">
    <div style="width: 45%;">
      <p style="margin: 0; border-bottom: 1px solid #000; height: 15px;">&nbsp;</p>
    </div>
    <div style="width: 45%;">
      <p style="margin: 0; border-bottom: 1px solid #000; height: 15px;">&nbsp;</p>
    </div>
  </div>
</div>`;
          }
          
          return match;
        }
      );
      
      // Generic pattern for any signature with "Passport Size Photo"
      cleanedHtml = cleanedHtml.replace(
        /([A-Z\s]{8,30}[\s\S]{1,300}?Passport Size Photo)/gi,
        (match) => {
          // Extract potential name from the match
          const nameMatch = match.match(/([A-Z]{2,}(?:\s+[A-Z]{2,})*)/);
          const roleMatch = match.match(/(Landlord|Tenant|Witness)/i);
          
          if (nameMatch && roleMatch) {
            const name = nameMatch[1].trim();
            const role = roleMatch[1].trim();
            const sectionId = `${name}-${role}`;
            
            if (!convertedSections.has(sectionId)) {
              convertedSections.add(sectionId);
              conversionCount++;
              console.log(`[Word Generation] ✓ Converting generic signature to table: ${name} (${role})`);
              
              return `
<br><br>
<table border="1" style="width: 100%; border-collapse: collapse;">
  <tr height="200">
    <td width="70%" style="padding: 10px; vertical-align: top;">
      <b style="font-size: 16px; text-transform: uppercase;">${name}</b>
      <br><br>
      <i style="font-size: 14px;">${role}</i>
      <br><br><br><br><br><br><br><br>
      ________________________
    </td>
    <td width="30%" style="padding: 10px; text-align: center; vertical-align: middle; border-left: 1px solid #000;">
      <div style="border: 1px dashed #000; width: 120px; height: 150px; margin: 0 auto; font-size: 12px; padding-top: 65px;">
        Passport Size Photo
      </div>
    </td>
  </tr>
</table>
<br><br>`;
            }
          }
          
          return match;
        }
      );
      
      console.log(`[Word Generation] Converted ${conversionCount} unique signature sections to tables`);
      
      // Debug: Show where signature sections appear in HTML
      console.log('[Word Generation] Checking HTML structure for signature positioning...');
      const signatureMatches = cleanedHtml.match(/<div[^>]*class="no-page-break"[^>]*style="[^"]*display:\s*flex[^"]*"[^>]*>[\s\S]*?Passport Size Photo[\s\S]*?<\/div>/gi);
      if (signatureMatches) {
        console.log(`[Word Generation] Found ${signatureMatches.length} signature sections in HTML`);
        signatureMatches.forEach((match, index) => {
          const position = cleanedHtml.indexOf(match);
          const before = cleanedHtml.substring(Math.max(0, position - 100), position);
          console.log(`[Word Generation] Signature ${index + 1} context: ...${before.replace(/\n/g, ' ')}[SIGNATURE SECTION]`);
        });
      }



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
              font: getFontForText(line.trim()),
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
            font: getFontForText(sanitizedText),
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

      // Helper function to process text content and convert to Word paragraphs
      const processTextContent = (htmlContent: string) => {
        const paragraphs: any[] = [];
        
        // Clean HTML and extract text content
        let processedContent = htmlContent
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
        
        textBlocks.forEach((block) => {
          const trimmedBlock = block.trim();
          if (trimmedBlock) {
            // Check if this looks like a title (rent agreement or rental agreement)
            const isTitle = (trimmedBlock.toUpperCase().includes('RENT AGREEMENT') || 
                           trimmedBlock.toUpperCase().includes('RENTAL AGREEMENT'));
            
            // Check if the original HTML has center alignment for this text
            const isCenterAligned = htmlContent.includes('text-align: center') && 
                                  htmlContent.includes(trimmedBlock);
            
            // Final title detection
            const shouldCenter = isTitle || isCenterAligned;
            
            // Check if this looks like a heading (starts with number)
            const isHeading = /^\d+\.?\s/.test(trimmedBlock) && trimmedBlock.length < 200;
            
            // Check for party designation lines that should be right-aligned
            const isPartyDesignation = trimmedBlock.includes('Hereinafter called the LANDLORD') || 
                                     trimmedBlock.includes('Hereinafter called the TENANT');
            
            // Handle mixed bold/regular text within a paragraph
            if (/<(strong|b)>/i.test(block)) {
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
                    font: getFontForText(beforeText),
                    size: isTitle ? 28 : (isHeading ? 26 : 24),
                    bold: false
                  }));
                }
                
                // Add bold text
                const boldText = match[2].replace(/<[^>]*>/g, '').trim();
                if (boldText) {
                  textRuns.push(new TextRun({
                    text: boldText,
                    font: getFontForText(boldText),
                    size: isTitle ? 28 : (isHeading ? 26 : 24),
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
                  font: getFontForText(afterText),
                  size: isTitle ? 28 : (isHeading ? 26 : 24),
                  bold: false
                }));
              }
              
              if (textRuns.length > 0) {
                const alignment = shouldCenter ? AlignmentType.CENTER : 
                               isPartyDesignation ? AlignmentType.RIGHT : 
                               AlignmentType.LEFT;
                
                paragraphs.push(new Paragraph({
                  children: textRuns,
                  alignment: alignment,
                  spacing: { 
                    before: shouldCenter ? 120 : (isHeading ? 80 : 0),
                    after: shouldCenter ? 160 : (isHeading ? 120 : 120)
                  }
                }));
              }
            } else {
              // No bold text - handle normally
              const cleanText = trimmedBlock.replace(/<[^>]*>/g, '');
              
              const para = createParagraph(cleanText, {
                size: shouldCenter ? 28 : (isHeading ? 26 : 24),
                bold: shouldCenter, // Bold titles/centered content
                alignment: shouldCenter ? AlignmentType.CENTER : 
                          isPartyDesignation ? AlignmentType.RIGHT : 
                          AlignmentType.LEFT,
                spacing: { 
                  before: shouldCenter ? 120 : (isHeading ? 80 : 0),
                  after: shouldCenter ? 160 : (isHeading ? 120 : 120)
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

      // Helper function to create Word table from HTML table content
      const createWordTable = (tableContent: string) => {
        try {
          // Extract table rows
          const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
          const rows = [];
          let rowMatch;
          
          while ((rowMatch = rowRegex.exec(tableContent)) !== null) {
            const rowContent = rowMatch[1];
            const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
            const cells = [];
            let cellMatch;
            
            while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
              const cellContent = cellMatch[1]
                .replace(/<[^>]*>/g, '')  // Remove HTML tags
                .replace(/&nbsp;/gi, ' ')
                .trim();
              
              const cellParagraphs = [];
              
              if (cellContent.includes('Passport Size Photo')) {
                // Create passport photo cell
                cellParagraphs.push(new Paragraph({
                  children: [new TextRun({
                    text: "Passport Size Photo",
                    font: getFontForText("Passport Size Photo"),
                    size: 20
                  })],
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 500, after: 500 }
                }));
              } else if (cellContent.includes('_')) {
                // This is a signature cell with name and signature line
                const lines = cellContent.split('\n').filter(line => line.trim());
                lines.forEach((line, index) => {
                  const trimmedLine = line.trim();
                  if (trimmedLine && !trimmedLine.match(/^_+$/)) {
                    const isName = index === 0 || trimmedLine.toUpperCase() === trimmedLine;
                    const isRole = trimmedLine.toLowerCase().includes('landlord') || 
                                 trimmedLine.toLowerCase().includes('tenant') || 
                                 trimmedLine.toLowerCase().includes('witness');
                    
                    cellParagraphs.push(new Paragraph({
                      children: [new TextRun({
                        text: trimmedLine,
                        font: getFontForText(trimmedLine),
                        size: isName ? 28 : 24,
                        bold: isName,
                        italics: isRole
                      })],
                      alignment: AlignmentType.LEFT,
                      spacing: { after: isRole ? 80 : 40 }
                    }));
                  }
                });
                
                // Add signature line
                cellParagraphs.push(new Paragraph({
                  children: [new TextRun({
                    text: "________________________",
                    font: getFontForText("________________________"),
                    size: 22
                  })],
                  alignment: AlignmentType.LEFT,
                  spacing: { before: 600, after: 100 }
                }));
              } else if (cellContent) {
                // Regular text cell
                cellParagraphs.push(new Paragraph({
                  children: [new TextRun({
                    text: cellContent,
                    font: getFontForText(cellContent),
                    size: 22
                  })],
                  alignment: AlignmentType.LEFT
                }));
              }
              
              cells.push(new TableCell({
                children: cellParagraphs.length > 0 ? cellParagraphs : [new Paragraph({
                  children: [new TextRun({ text: '' })]
                })],
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 1 },
                  bottom: { style: BorderStyle.SINGLE, size: 1 },
                  left: { style: BorderStyle.SINGLE, size: 1 },
                  right: { style: BorderStyle.SINGLE, size: 1 }
                },
                verticalAlign: VerticalAlign.TOP
              }));
            }
            
            if (cells.length > 0) {
              rows.push(new TableRow({ children: cells }));
            }
          }
          
          if (rows.length > 0) {
            return new Table({
              rows: rows,
              width: {
                size: 100,
                type: WidthType.PERCENTAGE
              },
              margins: {
                top: 200,
                bottom: 200
              }
            });
          }
        } catch (error) {
          console.error('[Word Generation] Error creating table:', error);
        }
        
        return null;
      };


      
      // Process HTML sequentially to maintain exact order (tables exactly where they appear)
      console.log('[Word Generation] Processing HTML sequentially to maintain order...');
      
      const processHtmlSequentially = (html: string) => {
        const elements: any[] = [];
        
        // Find all table positions in the HTML
        const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
        const tablePositions = [];
        let match;
        
        while ((match = tableRegex.exec(html)) !== null) {
          tablePositions.push({
            start: match.index,
            end: match.index + match[0].length,
            content: match[1],
            fullMatch: match[0]
          });
        }
        
        console.log(`[Word Generation] Found ${tablePositions.length} tables in HTML`);
        
        let currentPos = 0;
        
        // Process content between tables
        for (let i = 0; i <= tablePositions.length; i++) {
          const tableStart = i < tablePositions.length ? tablePositions[i].start : html.length;
          
          // Process text content before this table
          if (tableStart > currentPos) {
            const textContent = html.slice(currentPos, tableStart);
            if (textContent.trim()) {
              console.log(`[Word Generation] Processing text content: "${textContent.substring(0, 50)}..."`);
              const textElements = processTextContent(textContent);
              elements.push(...textElements);
            }
          }
          
          // Process the table if it exists
          if (i < tablePositions.length) {
            const table = tablePositions[i];
            console.log(`[Word Generation] Processing table at position ${table.start}`);
            
            // Create Word table from HTML table content
            const wordTable = createWordTable(table.content);
            if (wordTable) {
              elements.push(wordTable);
            }
            
            currentPos = table.end;
          }
        }
        
        return elements;
      };
      
      const processedElements = processHtmlSequentially(cleanedHtml);
      documentParagraphs.push(...processedElements);
      
      console.log(`[Word Generation] Created ${documentParagraphs.length} Word elements`);
      
      // Add embedded document images if they exist
      const addDocumentImages = async () => {
        let hasDocuments = false;
        
        // Process owner documents
        if (safeAgreementData.ownerDocuments?.aadharUrl || safeAgreementData.ownerDocuments?.panUrl) {
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

          // Add Aadhaar if exists
          if (safeAgreementData.ownerDocuments?.aadharUrl) {
            const aadharTitle = createParagraph("Aadhaar Card:", {
              size: 22,
              bold: true,
              alignment: AlignmentType.LEFT,
              spacing: { before: 240, after: 120 }
            });
            if (aadharTitle) documentParagraphs.push(aadharTitle);
            await addDocumentImage(safeAgreementData.ownerDocuments.aadharUrl, "Landlord Aadhaar");
          }
          
          // Add PAN if exists
          if (safeAgreementData.ownerDocuments?.panUrl) {
            const panTitle = createParagraph("PAN Card:", {
              size: 22,
              bold: true,
              alignment: AlignmentType.LEFT,
              spacing: { before: 240, after: 120 }
            });
            if (panTitle) documentParagraphs.push(panTitle);
            await addDocumentImage(safeAgreementData.ownerDocuments.panUrl, "Landlord PAN");
          }
        }
        
        // Process tenant documents
        if (safeAgreementData.tenantDocuments?.aadharUrl || safeAgreementData.tenantDocuments?.panUrl) {
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

          // Add Aadhaar if exists
          if (safeAgreementData.tenantDocuments?.aadharUrl) {
            const aadharTitle = createParagraph("Aadhaar Card:", {
              size: 22,
              bold: true,
              alignment: AlignmentType.LEFT,
              spacing: { before: 240, after: 120 }
            });
            if (aadharTitle) documentParagraphs.push(aadharTitle);
            await addDocumentImage(safeAgreementData.tenantDocuments.aadharUrl, "Tenant Aadhaar");
          }
          
          // Add PAN if exists
          if (safeAgreementData.tenantDocuments?.panUrl) {
            const panTitle = createParagraph("PAN Card:", {
              size: 22,
              bold: true,
              alignment: AlignmentType.LEFT,
              spacing: { before: 240, after: 120 }
            });
            if (panTitle) documentParagraphs.push(panTitle);
            await addDocumentImage(safeAgreementData.tenantDocuments.panUrl, "Tenant PAN");
          }
        }
        
        return hasDocuments;
      };
      
      // Helper function to add document image
      const addDocumentImage = async (docUrl: string, logName: string) => {
        
        try {
          // Handle different URL formats
          let imagePath = docUrl;
          if (docUrl.startsWith('/uploads/')) {
            imagePath = path.join(process.cwd(), docUrl.substring(1)); // Remove leading slash
          }
          
          console.log(`[Word Generation] Looking for ${logName} document at: ${imagePath}`);
          
          if (fs.existsSync(imagePath)) {
            console.log(`[Word Generation] Found ${logName} document, size: ${fs.statSync(imagePath).size} bytes`);
            
            let imageBuffer: Buffer;
            let imageType: "jpg" | "png" | "gif" | "bmp" | "svg" = 'jpg';
            
            // Handle PDF files by converting to images
            if (imagePath.toLowerCase().endsWith('.pdf')) {
              try {
                console.log(`[Word Generation] Converting PDF to images for ${logName}...`);
                const pdfImages = await convertPdfToImages(imagePath, logName);
                
                if (pdfImages && pdfImages.length > 0) {
                  // Use the first page of the PDF
                  const firstPageBase64 = pdfImages[0].replace(/^data:image\/[^;]+;base64,/, '');
                  imageBuffer = Buffer.from(firstPageBase64, 'base64');
                  imageType = 'png'; // PDF conversion typically produces PNG
                  console.log(`[Word Generation] Successfully converted PDF to image for ${logName}, size: ${imageBuffer.length} bytes`);
                } else {
                  throw new Error('PDF conversion returned no images');
                }
              } catch (pdfError) {
                console.error(`[Word Generation] Failed to convert PDF to image for ${logName}:`, pdfError);
                const errorPara = createParagraph(`PDF conversion failed: ${docUrl}`, {
                  size: 24,
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 480 }
                });
                if (errorPara) documentParagraphs.push(errorPara);
                return;
              }
            } else {
              // Handle regular image files
              imageBuffer = fs.readFileSync(imagePath);
              console.log(`[Word Generation] Loaded ${logName} image, size: ${imageBuffer.length} bytes`);
              
              // Determine image type
              if (imagePath.toLowerCase().endsWith('.png')) {
                imageType = 'png';
              } else if (imagePath.toLowerCase().endsWith('.gif')) {
                imageType = 'gif';
              } else if (imagePath.toLowerCase().endsWith('.bmp')) {
                imageType = 'bmp';
              } else if (imagePath.toLowerCase().endsWith('.svg')) {
                imageType = 'svg';
              }
            }
            
            // Create image run with proper type handling
            const imageRunOptions: any = {
              data: imageBuffer,
              transformation: {
                width: 300,
                height: 200,
              },
              type: imageType
            };
            
            // Add fallback for SVG images
            if (imageType === 'svg') {
              imageRunOptions.fallback = {
                data: imageBuffer,
                transformation: {
                  width: 300,
                  height: 200,
                },
                type: 'png'
              };
            }
            
            documentParagraphs.push(new Paragraph({
              children: [new ImageRun(imageRunOptions)],
              alignment: AlignmentType.CENTER,
              spacing: { after: 480 }
            }));
            console.log(`[Word Generation] Successfully embedded ${logName} image`);
          } else {
            console.log(`[Word Generation] ${logName} image not found at path: ${imagePath}`);
            const errorPara = createParagraph(`Image not found: ${docUrl}`, {
              size: 24,
              alignment: AlignmentType.CENTER,
              spacing: { after: 480 }
            });
            if (errorPara) documentParagraphs.push(errorPara);
          }
        } catch (imageError) {
          console.error(`[Word Generation] Error embedding ${logName} image:`, imageError);
          const errorPara = createParagraph(`Error loading image: ${docUrl}`, {
            size: 24,
            alignment: AlignmentType.CENTER,
            spacing: { after: 480 }
          });
          if (errorPara) documentParagraphs.push(errorPara);
        }
      };
      
      // Add document images
      await addDocumentImages();
      
      console.log(`[Word Generation] Final document has ${documentParagraphs.length} elements`);
      
      // Create the Word document
      console.log(`[Word Generation] Creating document with ${documentParagraphs.length} paragraphs`);
      
      const doc = new Document({
        sections: [{
          properties: {},
          children: documentParagraphs
        }]
      });
      
      // Generate and send Word document buffer
      const buffer = await Packer.toBuffer(doc);
      
      const filename = `${agreementData.agreementNumber || 'agreement'}.docx`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.send(buffer);
      
    } catch (error) {
      console.error("Error generating Word document:", error);
      res.status(500).json({ message: "Failed to generate Word document" });
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
