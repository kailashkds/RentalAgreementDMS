import type { AdminUser, Customer } from "@shared/schema";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    customerId?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: AdminUser;
      customer?: Customer;
      userPermissions?: string[];
      customerPermissions?: string[];
      userType?: 'admin' | 'customer';
    }
  }
}

export {};