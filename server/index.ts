import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { storage } from "./storage";
import { seedRBAC, assignDefaultRoleToUser } from "./rbacSeed";
import bcrypt from "bcrypt";

const app = express();
app.set('trust proxy', 1); // Trust first proxy for cookies to work properly

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Initialize default admin user
async function initializeAdminUser() {
  try {
    log("Checking for admin user...");
    const adminUser = await storage.getAdminUserByPhone("9999999999");
    if (!adminUser) {
      log("Creating admin user...");
      const hashedPassword = await bcrypt.hash("admin123", 10);
      await storage.createAdminUser({
        phone: "9999999999",
        name: "Administrator",
        password: hashedPassword,
        role: "super_admin", // Changed to match existing role
        isActive: true
      });
      log("✓ Default admin user created: admin/admin123");
    } else {
      log("✓ Admin user already exists");
    }
  } catch (error) {
    log("❌ Error initializing admin user:", String(error));
    // Force retry once more in case of connection issues
    try {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      const adminUser2 = await storage.getAdminUserByPhone("9999999999");
      if (!adminUser2) {
        const hashedPassword = await bcrypt.hash("admin123", 10);
        await storage.createAdminUser({
          phone: "9999999999",
          name: "Administrator", 
          password: hashedPassword,
          role: "super_admin",
          isActive: true
        });
        log("✓ Admin user created on retry");
      }
    } catch (retryError) {
      log("❌ Retry failed:", String(retryError));
    }
  }
}

// Initialize RBAC system
async function initializeRBAC() {
  try {
    log("Initializing RBAC system...");
    await seedRBAC();
    
    // Assign Super Admin role to the admin user
    const adminUser = await storage.getAdminUserByPhone("9999999999");
    if (adminUser) {
      try {
        await assignDefaultRoleToUser(adminUser.id, "Super Admin");
        log("✓ Super Admin role assigned to admin user");
      } catch (roleError) {
        // Role might already be assigned
        if (!String(roleError).includes('unique') && !String(roleError).includes('duplicate')) {
          log("❌ Error assigning role to admin:", String(roleError));
        } else {
          log("✓ Super Admin role already assigned to admin user");
        }
      }
    }
    
    log("✓ RBAC system initialized successfully");
  } catch (error) {
    log("❌ Error initializing RBAC:", String(error));
  }
}

(async () => {
  // Initialize admin user before starting server
  await initializeAdminUser();
  
  // Initialize RBAC system
  await initializeRBAC();
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  
  // Production-specific middleware should be added BEFORE the server starts listening
  // but AFTER routes are registered
  
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    log(`serving on ${protocol}://0.0.0.0:${port}`);
  });
})();
