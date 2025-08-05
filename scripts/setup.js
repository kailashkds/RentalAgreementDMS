import bcrypt from "bcrypt";
import { db } from "../server/db.js";
import { adminUsers } from "../shared/schema.js";

async function setup() {  
  console.log("🚀 Setting up QuickKaraar DMS...");
  
  try {
    // Create default admin user
    const hashedPassword = await bcrypt.hash("admin123", 10);
    
    const [admin] = await db.insert(adminUsers).values({
      username: "admin",
      email: "admin@quickkaraar.com", 
      password: hashedPassword,
      name: "System Administrator",
      role: "super_admin",
    }).onConflictDoNothing().returning();

    if (admin) {
      console.log("✅ Default admin user created:");
      console.log("   Username: admin");
      console.log("   Password: admin123"); 
      console.log("   Email: admin@quickkaraar.com");
      console.log("   Role: super_admin");
    } else {
      console.log("ℹ️  Admin user already exists");
    }
    
    console.log("✅ Setup completed successfully!");
    console.log("🌐 You can now access the admin panel and login");
    
  } catch (error) {
    console.error("❌ Setup failed:", error);
  }
}

setup();