import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import type { Address } from "@shared/schema";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { setupAuth, requireAuth, optionalAuth } from "./auth";
import { insertCustomerSchema, insertSocietySchema, insertAgreementSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication system
  await setupAuth(app);
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
      const customer = await storage.createCustomer(customerData);
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

  // Society routes
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
  app.post("/api/agreements/:id/renew", async (req, res) => {
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

  // Address search for intelligent autocomplete
  app.get("/api/addresses", async (req, res) => {
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

  // Save new address
  app.post("/api/addresses", async (req, res) => {
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
  app.post("/api/agreements/:id/duplicate", async (req, res) => {
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
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error accessing object:", error);
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

  const httpServer = createServer(app);
  return httpServer;
}
