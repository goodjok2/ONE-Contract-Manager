import type { Express } from "express";
import type { Server } from "http";
import apiRouter from "./routes/index";
import { pool } from "./db";

// =============================================================================
// REGISTER ALL API ROUTES
// =============================================================================

async function seedDefaultOrganization() {
  try {
    await pool.query(
      `INSERT INTO organizations (id, name, slug, created_at)
       VALUES (1, 'Dvele', 'dvele', NOW())
       ON CONFLICT (id) DO NOTHING`
    );
  } catch (err) {
    console.warn("Could not seed default organization:", err);
  }
}

export async function registerRoutes(server: Server, app: Express) {
  await seedDefaultOrganization();

  app.use("/api", apiRouter);
  
  console.log("API routes registered successfully");
}
