import bcrypt from "bcrypt";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import "./types"; // Import session types

// Session configuration
export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true, // Allow table creation in production
    ttl: sessionTtl,
    tableName: "sessions",
  });
  
  return session({
    secret: process.env.SESSION_SECRET || "your-super-secret-session-key",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Allow cross-site cookies in production
      maxAge: sessionTtl,
    },
  });
}

// Unified auth middleware - works for all users
export const requireAuth: RequestHandler = async (req, res, next) => {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Authentication required" });
  }
  
  try {
    const user = await storage.getUser(req.session.userId);
    
    if (!user || !user.isActive) {
      req.session.destroy(() => {});
      return res.status(401).json({ message: "Invalid session" });
    }
    
    req.user = user;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({ message: "Authentication error" });
  }
};

// Optional auth middleware (doesn't block if not authenticated)
export const optionalAuth: RequestHandler = async (req, res, next) => {
  if (req.session?.userId) {
    try {
      const user = await storage.getUser(req.session.userId);
      
      if (user && user.isActive) {
        req.user = user;
      }
    } catch (error) {
      console.error("Optional auth error:", error);
    }
  }
  next();
};

// Setup authentication
export async function setupAuth(app: Express) {
  app.use(getSession());
  
  // Current user endpoint
  app.get('/api/auth/me', requireAuth, (req, res) => {
    const { password, ...userWithoutPassword } = req.user!;
    res.json(userWithoutPassword);
  });
  
  // Test endpoint to check session status
  app.get('/api/auth/session-status', (req, res) => {
    res.json({
      hasSession: !!req.session,
      sessionId: req.sessionID,
      userId: req.session?.userId,
      nodeEnv: process.env.NODE_ENV,
      cookies: req.headers.cookie || 'no cookies',
    });
  });
  
  // Unified login endpoint - supports both username/phone and mobile login
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, mobile, password } = req.body;
      
      if ((!username && !mobile) || !password) {
        return res.status(400).json({ message: "Username/mobile and password required" });
      }
      
      // Try to find user by username or mobile
      let user;
      let isCustomer = false;
      
      if (username) {
        user = await storage.getUserByUsername(username);
      } else if (mobile) {
        user = await storage.getUserByMobile(mobile);
        
        // If not found in users table, try customers table (legacy support)
        if (!user) {
          const customer = await storage.getCustomerByMobile(mobile);
          if (customer) {
            user = {
              id: customer.id,
              name: customer.name,
              mobile: customer.mobile,
              email: customer.email,
              password: customer.password,
              isActive: customer.isActive,
              defaultRole: 'Customer',
              createdAt: customer.createdAt,
              updatedAt: customer.updatedAt
            };
            isCustomer = true;
          }
        }
      }
      
      if (!user || !user.isActive) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      // For customers, use plain text comparison; for admin users, use bcrypt
      let validPassword = false;
      if (isCustomer) {
        validPassword = password === user.password;
      } else {
        validPassword = await bcrypt.compare(password, user.password);
      }
      
      if (!validPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      req.session.userId = user.id;
      
      // Ensure session is saved before sending response
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ message: "Session error" });
        }
        
        const { password: _, ...userWithoutPassword } = user;
        res.json({ user: userWithoutPassword });
      });
    } catch (error) {
      console.error("Admin login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // DEPRECATED: Customer login endpoint - now handled by unified /api/auth/login
  // This endpoint is kept for backward compatibility but will be removed
  
  // Unified logout endpoint
  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie('connect.sid'); // Clear the session cookie
      res.json({ message: "Logged out successfully" });
    });
  });
  
  // Create admin user endpoint (protected)
  app.post('/api/admin/users', requireAuth, async (req, res) => {
    try {
      // Only super_admin can create new admin users
      if (req.user!.role !== 'super_admin') {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      
      const { username, phone, password, name, role = 'admin' } = req.body;
      
      if (!username || !phone || !password || !name) {
        return res.status(400).json({ message: "All fields are required" });
      }
      
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const newUser = await storage.createAdminUser({
        username,
        phone,
        password: hashedPassword,
        name,
        role,
      });
      
      const { password: _, ...userWithoutPassword } = newUser;
      res.status(201).json(userWithoutPassword);
    } catch (error: any) {
      console.error("Create admin user error:", error);
      if (error.code === '23505') { // unique constraint violation
        return res.status(400).json({ message: "Phone number already exists" });
      }
      res.status(500).json({ message: "Failed to create admin user" });
    }
  });
  
  // List admin users endpoint (protected)
  app.get('/api/admin/users', requireAuth, async (req, res) => {
    try {
      if (req.user!.role !== 'super_admin') {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      
      const users = await storage.getAdminUsers();
      const usersWithoutPasswords = users.map(({ password, ...user }) => user);
      res.json(usersWithoutPasswords);
    } catch (error) {
      console.error("Get admin users error:", error);
      res.status(500).json({ message: "Failed to get admin users" });
    }
  });
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}