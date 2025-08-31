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
    return res.status(401).json({ 
      message: "Please log in to access this feature",
      error: "authentication_required",
      action: "Please log in with your username and password"
    });
  }
  
  try {
    const user = await storage.getUser(req.session.userId);
    
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ 
        message: "Your account could not be found. Please log in again.",
        error: "user_not_found",
        action: "Log in again with your credentials"
      });
    }
    
    if (!user.isActive) {
      req.session.destroy(() => {});
      return res.status(401).json({ 
        message: "Your account has been deactivated. Please contact an administrator.",
        error: "account_deactivated",
        action: "Contact support to reactivate your account"
      });
    }
    
    req.user = {
      ...user,
      role: user.defaultRole || 'Customer'
    };
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({ 
      message: "We're having trouble verifying your login. Please try again.",
      error: "authentication_service_error",
      action: "Try refreshing the page or logging in again"
    });
  }
};

// Optional auth middleware (doesn't block if not authenticated)
export const optionalAuth: RequestHandler = async (req, res, next) => {
  if (req.session?.userId) {
    try {
      const user = await storage.getUser(req.session.userId);
      
      if (user && user.isActive) {
        req.user = {
          ...user,
          role: user.defaultRole || 'Customer'
        };
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
      const { username, fullName, mobile, password } = req.body;
      console.log('🔐 Login attempt:', { username, fullName, mobile, passwordLength: password?.length });
      
      if ((!username && !fullName && !mobile) || !password) {
        return res.status(400).json({ 
          message: "Please provide both login credentials and password",
          error: "missing_credentials",
          action: "Enter your username, full name, or phone number along with your password",
          details: {
            username: !username ? "Username not provided" : "✓",
            fullName: !fullName ? "Full name not provided" : "✓", 
            mobile: !mobile ? "Phone number not provided" : "✓",
            password: !password ? "Password is required" : "✓"
          }
        });
      }
      
      // Try to find user by username, full name, or mobile
      let user;
      let isCustomer = false;
      
      if (username) {
        user = await storage.getUserByUsername(username);
        console.log('👤 User lookup by username:', user ? 'found' : 'not found');
      } else if (fullName) {
        user = await storage.getUserByFullName(fullName);
        console.log('👤 User lookup by full name:', user ? 'found' : 'not found');
      } else if (mobile) {
        user = await storage.getUserByMobile(mobile);
        console.log('👤 User lookup by mobile:', user ? 'found' : 'not found');
        
        // If not found in users table, try customers table (legacy support)
        if (!user) {
          const customer = await storage.getCustomerByMobile(mobile);
          console.log('👥 Customer lookup by mobile:', customer ? 'found' : 'not found');
          if (customer) {
            console.log('📊 Customer data:', { 
              id: customer.id, 
              name: customer.name, 
              mobile: customer.mobile,
              hasPassword: !!customer.password,
              passwordType: customer.password?.startsWith('$2b$') ? 'bcrypt' : 'plain',
              isActive: customer.isActive 
            });
            user = {
              id: customer.id,
              username: null,
              phone: customer.mobile,
              mobile: customer.mobile,
              password: customer.password,
              name: customer.name,
              email: customer.email,
              firstName: null,
              lastName: null,
              profileImageUrl: null,
              isActive: customer.isActive,
              status: customer.isActive ? 'active' : 'inactive',
              role: 'Customer',
              defaultRole: 'Customer',
              permissions: [],
              createdAt: customer.createdAt,
              updatedAt: customer.updatedAt
            };
            isCustomer = true;
          }
        }
      }
      
      if (!user) {
        console.log('❌ Login failed: user not found');
        return res.status(401).json({ 
          message: "We couldn't find an account with those credentials",
          error: "invalid_credentials",
          action: "Double-check your username/phone number and try again, or contact support if you need help"
        });
      }
      
      if (!user.isActive || user.status === 'inactive') {
        console.log('❌ Login failed: user inactive');
        return res.status(401).json({ 
          message: "Contact administrator for re-activating your account",
          error: "account_inactive", 
          action: "Your account is currently inactive. Please contact an administrator to reactivate your account."
        });
      }
      
      // For customers, use bcrypt comparison; for admin users, use bcrypt
      let validPassword = false;
      console.log('🔒 Password validation starting...', { isCustomer, hasStoredPassword: !!user.password });
      
      if (isCustomer) {
        // Use bcrypt for customer authentication
        validPassword = await bcrypt.compare(password, user.password || '');
        console.log('🔐 Customer bcrypt result:', validPassword);
      } else {
        validPassword = await bcrypt.compare(password, user.password || '');
        console.log('🔐 Admin bcrypt result:', validPassword);
      }
      
      if (!validPassword) {
        console.log('❌ Password validation failed');
        return res.status(401).json({ 
          message: "The password you entered is incorrect",
          error: "invalid_password",
          action: "Please check your password and try again. Make sure Caps Lock is off."
        });
      }
      
      req.session.userId = user.id;
      
      // Ensure session is saved before sending response
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ 
            message: "Login successful, but we're having trouble saving your session",
            error: "session_save_error",
            action: "Please try logging in again. If this continues, contact support."
          });
        }
        
        const { password: _, ...userWithoutPassword } = user;
        res.json({ user: userWithoutPassword });
      });
    } catch (error) {
      console.error("Admin login error:", error);
      res.status(500).json({ 
        message: "We're experiencing technical difficulties with the login system",
        error: "login_system_error",
        action: "Please try again in a moment. If the problem persists, contact support."
      });
    }
  });

  // DEPRECATED: Customer login endpoint - now handled by unified /api/auth/login
  // This endpoint is kept for backward compatibility but will be removed
  
  // Unified logout endpoint
  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ 
          message: "We're having trouble logging you out completely",
          error: "logout_failed",
          action: "Try closing your browser or clearing cookies manually"
        });
      }
      res.clearCookie('connect.sid'); // Clear the session cookie
      res.json({ 
        message: "You have been logged out successfully",
        action: "Redirecting to login page..."
      });
    });
  });
  
  // Create admin user endpoint (protected)
  app.post('/api/admin/users', requireAuth, async (req, res) => {
    try {
      // Only super_admin can create new admin users
      if (req.user!.role !== 'super_admin') {
        return res.status(403).json({ 
          message: "Only Super Administrators can create new admin users",
          error: "insufficient_permissions",
          action: "Contact a Super Administrator to create new admin accounts"
        });
      }
      
      const { username, phone, password, name, role = 'admin' } = req.body;
      
      if (!username || !phone || !password || !name) {
        return res.status(400).json({ 
          message: "Please fill in all required fields",
          error: "missing_required_fields",
          action: "Provide username, phone number, password, and full name",
          missing: {
            username: !username ? "Username is required" : "✓",
            phone: !phone ? "Phone number is required" : "✓",
            password: !password ? "Password is required" : "✓",
            name: !name ? "Full name is required" : "✓"
          }
        });
      }
      
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const newUser = await storage.createUser({
        username,
        mobile: phone,
        password: hashedPassword,
        name,
        defaultRole: role,
      });
      
      const { password: _, ...userWithoutPassword } = newUser;
      res.status(201).json(userWithoutPassword);
    } catch (error: any) {
      console.error("Create admin user error:", error);
      if (error.code === '23505') { // unique constraint violation
        if (error.detail?.includes('phone')) {
          return res.status(400).json({ 
            message: "This phone number is already registered",
            error: "duplicate_phone",
            action: "Use a different phone number or check if the user already exists"
          });
        }
        if (error.detail?.includes('username')) {
          return res.status(400).json({ 
            message: "This username is already taken",
            error: "duplicate_username", 
            action: "Choose a different username"
          });
        }
        return res.status(400).json({ 
          message: "This information is already registered in the system",
          error: "duplicate_data",
          action: "Check if the user already exists or use different information"
        });
      }
      res.status(500).json({ 
        message: "We're having trouble creating the admin user",
        error: "admin_creation_failed",
        action: "Please try again. If the problem persists, contact technical support."
      });
    }
  });
  
  // List admin users endpoint (protected)
  app.get('/api/admin/users', requireAuth, async (req, res) => {
    try {
      if (req.user!.role !== 'super_admin') {
        return res.status(403).json({ 
          message: "Only Super Administrators can view admin users",
          error: "insufficient_permissions",
          action: "Contact a Super Administrator if you need access to this information"
        });
      }
      
      const usersData = await storage.getUsers({ defaultRole: "super_admin" });
      const users = usersData.users;
      const usersWithoutPasswords = users.map(({ password, ...user }: any) => user);
      res.json(usersWithoutPasswords);
    } catch (error) {
      console.error("Get admin users error:", error);
      res.status(500).json({ 
        message: "We're having trouble loading the admin users list",
        error: "admin_list_failed",
        action: "Please try refreshing the page. If the problem persists, contact support."
      });
    }
  });
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: string;
        name: string;
        password: string;
        username: string | null;
        phone: string | null;
        mobile: string | null;
        email: string | null;
        firstName: string | null;
        lastName: string | null;
        profileImageUrl: string | null;
        isActive: boolean | null;
        status: string;
        defaultRole: string;
        permissions: string[] | null;
        createdAt: Date | null;
        updatedAt: Date | null;
      };
    }
  }
}