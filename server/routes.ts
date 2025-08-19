import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import type { Address } from "@shared/schema";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { mapFormDataToTemplateFields, generatePdfHtml, convertPdfToImages } from "./fieldMapping";
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
      const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, Table, TableRow, TableCell, WidthType } = await import('docx');
      
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

        return new Paragraph({
          children: [new TextRun({
            text: sanitizedText,
            font: "Arial",
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

      // 1. Title
      const titlePara = createParagraph("RENT AGREEMENT", {
        size: 44, // 22pt for title
        bold: true,
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 240 }
      });
      if (titlePara) documentParagraphs.push(titlePara);

      // 2. Opening statement
      const openingText = `This Agreement of Rent is made on ${safeAgreementData.agreementDate || '[DATE]'} by and between`;
      const openingPara = createParagraph(openingText, {
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 120 }
      });
      if (openingPara) documentParagraphs.push(openingPara);

      // 3. Owner details
      const ownerDetails = `${(safeAgreementData.ownerDetails?.name || '[OWNER_NAME]').toUpperCase()}
Age:${safeAgreementData.ownerDetails?.age || '[AGE]'}, Occupation:${safeAgreementData.ownerDetails?.occupation || '[OCCUPATION]'}
Address:${[
        safeAgreementData.ownerDetails?.houseNumber,
        safeAgreementData.ownerDetails?.society,
        safeAgreementData.ownerDetails?.area,
        safeAgreementData.ownerDetails?.city,
        safeAgreementData.ownerDetails?.state,
        safeAgreementData.ownerDetails?.pincode
      ].filter(Boolean).join(',').toUpperCase() || '[ADDRESS]'}`;
      
      const ownerPara = createParagraph(ownerDetails, {
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 80 }
      });
      if (ownerPara) documentParagraphs.push(ownerPara);

      const landlordLabel = createParagraph("Hereinafter called the LANDLORD of the FIRST PART", {
        bold: true,
        italic: true,
        alignment: AlignmentType.RIGHT,
        spacing: { after: 160 }
      });
      if (landlordLabel) documentParagraphs.push(landlordLabel);

      // 4. Tenant details
      const tenantDetails = `${(safeAgreementData.tenantDetails?.name || '[TENANT_NAME]').toUpperCase()}
Age:${safeAgreementData.tenantDetails?.age || '[AGE]'}, Occupation:${(safeAgreementData.tenantDetails?.occupation || '[OCCUPATION]').toUpperCase()}
Address:${[
        safeAgreementData.tenantDetails?.houseNumber,
        safeAgreementData.tenantDetails?.society,
        safeAgreementData.tenantDetails?.area,
        safeAgreementData.tenantDetails?.city,
        safeAgreementData.tenantDetails?.state,
        safeAgreementData.tenantDetails?.pincode
      ].filter(Boolean).join(',') || '[ADDRESS]'}`;
      
      const tenantPara = createParagraph(tenantDetails, {
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 80 }
      });
      if (tenantPara) documentParagraphs.push(tenantPara);

      const tenantLabel = createParagraph("Hereinafter called the TENANT of the SECOND PART", {
        bold: true,
        italic: true,
        alignment: AlignmentType.RIGHT,
        spacing: { after: 160 }
      });
      if (tenantLabel) documentParagraphs.push(tenantLabel);

      // 5. Property details
      const propertyDetails = `Property Address:${[
        safeAgreementData.propertyDetails?.houseNumber,
        safeAgreementData.propertyDetails?.society,
        safeAgreementData.propertyDetails?.area,
        safeAgreementData.propertyDetails?.city,
        safeAgreementData.propertyDetails?.state,
        safeAgreementData.propertyDetails?.pincode
      ].filter(Boolean).join(',').toUpperCase() || '[PROPERTY_ADDRESS]'}
Property Purpose:${safeAgreementData.propertyDetails?.purpose || '[PURPOSE]'}
Rent Amount:Rs.${safeAgreementData.rentalTerms?.monthlyRent || '[AMOUNT]'} (Rupees ${safeAgreementData.rentalTerms?.monthlyRentWords || '[AMOUNT_WORDS]'}) Per Month`;
      
      const propertyPara = createParagraph(propertyDetails, {
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 160 }
      });
      if (propertyPara) documentParagraphs.push(propertyPara);

      // 6. Agreement header
      const agreementHeader = createParagraph("NOW THIS AGREEMENT WITNESSETH AND IT IS HEREBY AGREED BY AND BETWEEN THE PARTIES AS UNDER:", {
        size: 32, // 16pt
        bold: true,
        alignment: AlignmentType.LEFT,
        spacing: { before: 160, after: 160 }
      });
      if (agreementHeader) documentParagraphs.push(agreementHeader);

      // 7. Agreement clauses (numbered list)
      const clauses = [
        `That the tenancy shall be initially for the period of with effect from ${safeAgreementData.rentalTerms?.startDate || '[START_DATE]'} to ${safeAgreementData.rentalTerms?.endDate || '[END_DATE]'} and will be renewed every 11 months with mutual consent of both the landlord and tenant.`,
        
        `That the rent payable by the tenant to the landlord or his/her Authorized person, in respect of the said premises, shall be ₹${safeAgreementData.rentalTerms?.monthlyRent || '[AMOUNT]'} (${safeAgreementData.rentalTerms?.monthlyRentWords || '[AMOUNT_WORDS]'}) per month which shall be payable on or before ${safeAgreementData.rentalTerms?.paymentDueDateFrom || '[DATE_FROM]'} - ${safeAgreementData.rentalTerms?.paymentDueDateTo || '[DATE_TO]'} date of every succeeding month of the rental period.`,
        
        `That the tenant has paid a sum of ₹${safeAgreementData.rentalTerms?.securityDeposit || '[DEPOSIT]'}/- (Rupees ${safeAgreementData.rentalTerms?.securityDepositWords || '[DEPOSIT_WORDS]'} only) as interest-free security deposit, the receipt of which is hereby acknowledged by the landlord. This advance amount shall be returned to the tenant by the landlord at the time of vacating the said premises after adjusting the dues such as rent, water charges, maintenance charges, electricity dues, and cost of damages if any.`,
        
        `All the expenses on the said premises such as electric power, water, gas, professional tax, municipal tax, and GST (relating to the tenant business) shall be paid by the tenant. All the above-mentioned paid receipts shall be handed over to the landlord by the Tenant.`,
        
        `That the furniture, fittings and fixtures in the house premises are in good condition, and the tenant shall return the same to the landlord in good condition except for normal wear and tear before vacating the house premises. Any damage shall be reimbursed by the tenant to the landlord.`,
        
        `That the tenant has agreed to ensure a minimum stay of ${safeAgreementData.rentalTerms?.minimumStay || '[MINIMUM_STAY]'} months. Both parties agree to provide a notice period of ${safeAgreementData.rentalTerms?.noticePeriod || '[NOTICE_PERIOD]'} month(s) before vacating the premises.`,
        
        `Tenant affirm that there is no pending or any criminal antecedent against him and he is responsible to file police verification document before appropriate authority within 15 days from the date of this agreement.`,
        
        `That the tenant shall not sub-rent or sublet either the entire or any part of the said premises. The premises shall be used only for ${safeAgreementData.propertyDetails?.purpose || '[PURPOSE]'} purposes.`,
        
        `That the tenant has agreed to keep the house premises clean and in hygienic condition including the surrounding areas and the tenant has agreed not to do any action that would cause permanent / structural damages / changes without obtaining prior consent from the owner on impact and costs.`,
        
        `That the landlord shall be at liberty to inspect the house premises personally or through any authorized person(s) as and when necessary.`,
        
        `It is hereby agreed that if default is made by the tenant in payment of the rent for a period of three months, or in observance and performance of any of the covenants and stipulations hereby contained, then on such default, the landlord shall be entitled in addition to or in the alternative to any other remedy that may be available to him at this discretion, to terminate the Rent and eject the tenant from the said premises; and to take possession thereof as full and absolute owner thereof.`,
        
        `That the landlord shall be responsible for the payment of all taxes and levies pertaining to the said premises including but not limited to House Tax, Property Tax, other ceases, if any, and any other statutory taxes, levied by the Government or Governmental Departments. During the term of this Agreement, the landlord shall comply with all rules, regulations and requirements of any statutory authority, local, state and central government and governmental departments in respect of the said premises.`
      ];

      // Add commercial clause if applicable
      if (safeAgreementData.propertyDetails?.purpose && safeAgreementData.propertyDetails.purpose !== 'Residential') {
        clauses.push(`The Licensee shall be solely responsible for cancelling or surrendering any registration number, GST number, or any other licenses, permissions, or registrations obtained on the basis of the licensed premises, within one (1) month from the date of vacating the said premises. Deposit shall withhold till the evidence for cancellation of all the documents.`);
      }

      // Generate numbered clauses
      clauses.forEach((clause, index) => {
        const clausePara = createParagraph(`${index + 1}. ${clause}`, {
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 160 },
          indent: { left: 720 } // 0.5 inch indent
        });
        if (clausePara) documentParagraphs.push(clausePara);
      });

      // Add additional clauses if present
      if (safeAgreementData.additionalClauses && safeAgreementData.additionalClauses !== 'No additional clauses specified.') {
        const additionalTitle = createParagraph("Additional Clause:", {
          bold: true,
          spacing: { before: 160, after: 80 }
        });
        if (additionalTitle) documentParagraphs.push(additionalTitle);
        
        const additionalPara = createParagraph(safeAgreementData.additionalClauses, {
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 160 }
        });
        if (additionalPara) documentParagraphs.push(additionalPara);
      }

      // 8. Witness statement
      const witnessStatement = createParagraph("IN WITNESS WHEREOF, the parties have set their hands on the day and year first above written, without any external influence or pressure from anybody.", {
        size: 32, // 16pt
        bold: true,
        alignment: AlignmentType.LEFT,
        spacing: { before: 240, after: 320 }
      });
      if (witnessStatement) documentParagraphs.push(witnessStatement);

      // 9. Signature sections
      // Create signature table for landlord
      const landlordSigTable = new Table({
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1 },
          bottom: { style: BorderStyle.SINGLE, size: 1 },
          left: { style: BorderStyle.SINGLE, size: 1 },
          right: { style: BorderStyle.SINGLE, size: 1 },
        },
        width: {
          size: 100,
          type: WidthType.PERCENTAGE,
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: (safeAgreementData.ownerDetails?.name || '[OWNER_NAME]').toUpperCase(), font: "Arial", size: 28, bold: true })],
                    spacing: { after: 80 }
                  }),
                  new Paragraph({
                    children: [new TextRun({ text: "Landlord", font: "Arial", size: 28, italics: true })],
                    spacing: { after: 400 }
                  }),
                  new Paragraph({
                    children: [new TextRun({ text: "________________________", font: "Arial", size: 24 })],
                  })
                ],
                width: { size: 70, type: WidthType.PERCENTAGE }
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: "Passport Size Photo", font: "Arial", size: 20 })],
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 800, after: 800 }
                  })
                ],
                borders: {
                  top: { style: BorderStyle.DOT_DASH, size: 1 },
                  bottom: { style: BorderStyle.DOT_DASH, size: 1 },
                  left: { style: BorderStyle.DOT_DASH, size: 1 },
                  right: { style: BorderStyle.DOT_DASH, size: 1 },
                },
                width: { size: 30, type: WidthType.PERCENTAGE }
              })
            ]
          })
        ]
      });
      documentParagraphs.push(landlordSigTable);

      // Add spacing
      documentParagraphs.push(new Paragraph({ spacing: { after: 320 } }));

      // Create signature table for tenant
      const tenantSigTable = new Table({
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1 },
          bottom: { style: BorderStyle.SINGLE, size: 1 },
          left: { style: BorderStyle.SINGLE, size: 1 },
          right: { style: BorderStyle.SINGLE, size: 1 },
        },
        width: {
          size: 100,
          type: WidthType.PERCENTAGE,
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: (safeAgreementData.tenantDetails?.name || '[TENANT_NAME]').toUpperCase(), font: "Arial", size: 28, bold: true })],
                    spacing: { after: 80 }
                  }),
                  new Paragraph({
                    children: [new TextRun({ text: "Tenant", font: "Arial", size: 28, italics: true })],
                    spacing: { after: 400 }
                  }),
                  new Paragraph({
                    children: [new TextRun({ text: "________________________", font: "Arial", size: 24 })],
                  })
                ],
                width: { size: 70, type: WidthType.PERCENTAGE }
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: "Passport Size Photo", font: "Arial", size: 20 })],
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 800, after: 800 }
                  })
                ],
                borders: {
                  top: { style: BorderStyle.DOT_DASH, size: 1 },
                  bottom: { style: BorderStyle.DOT_DASH, size: 1 },
                  left: { style: BorderStyle.DOT_DASH, size: 1 },
                  right: { style: BorderStyle.DOT_DASH, size: 1 },
                },
                width: { size: 30, type: WidthType.PERCENTAGE }
              })
            ]
          })
        ]
      });
      documentParagraphs.push(tenantSigTable);

      // Add spacing
      documentParagraphs.push(new Paragraph({ spacing: { after: 320 } }));

      // Witnesses section
      const witnessTable = new Table({
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1 },
          bottom: { style: BorderStyle.SINGLE, size: 1 },
          left: { style: BorderStyle.SINGLE, size: 1 },
          right: { style: BorderStyle.SINGLE, size: 1 },
        },
        width: {
          size: 100,
          type: WidthType.PERCENTAGE,
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: "Witnesses", font: "Arial", size: 28, bold: true })],
                    spacing: { after: 240 }
                  }),
                  new Paragraph({
                    children: [new TextRun({ text: "_______________________          _______________________", font: "Arial", size: 24 })],
                    spacing: { after: 240 }
                  })
                ],
              })
            ]
          })
        ]
      });
      documentParagraphs.push(witnessTable);

      console.log(`[Word Generation] Created ${documentParagraphs.length} structured elements for Word document`);

      // Create Word document with structured content and proper styling
      const doc = new Document({
        styles: {
          default: {
            document: {
              run: {
                font: "Arial", // Use Arial to match PDF
                size: 28, // 14pt font size (28 half-points)
              },
              paragraph: {
                spacing: {
                  line: 1.6 * 240, // 1.6 line spacing to match PDF
                  after: 160, // Paragraph spacing to match PDF
                }
              }
            }
          }
        },
        sections: [{
          properties: {
            page: {
              margin: {
                top: 1080, // 0.75 inch to match PDF
                right: 720, // 0.5 inch to match PDF
                bottom: 1080, // 0.75 inch to match PDF  
                left: 720 // 0.5 inch to match PDF
              },
              size: {
                orientation: "portrait",
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

  app.delete("/api/agreements/:id", async (req, res) => {
    try {
      await storage.deleteAgreement(req.params.id);
      res.json({ message: "Agreement deleted successfully" });
    } catch (error) {
      console.error("Error deleting agreement:", error);
      res.status(500).json({ message: "Failed to delete agreement" });
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
