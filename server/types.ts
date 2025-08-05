import type { AdminUser } from "@shared/schema";

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: AdminUser;
    }
  }
}

export {};