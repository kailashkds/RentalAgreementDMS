#!/usr/bin/env node

import bcrypt from "bcrypt";
import { db } from "../server/db.js";
import { adminUsers } from "../shared/schema.js";

async function createDefaultAdmin() {
  try {
    const hashedPassword = await bcrypt.hash("admin123", 10);
    
    const [admin] = await db.insert(adminUsers).values({
      username: "admin",
      email: "admin@quickkaraar.com",
      password: hashedPassword,
      name: "System Administrator",
      role: "super_admin",
    }).onConflictDoNothing().returning();

    if (admin) {
      console.log("✅ Default admin user created successfully!");
      console.log("Username: admin");
      console.log("Password: admin123");
      console.log("Email: admin@quickkaraar.com");
    } else {
      console.log("ℹ️  Admin user already exists");
    }
  } catch (error) {
    console.error("❌ Error creating admin user:", error);
  }
  process.exit(0);
}

createDefaultAdmin();