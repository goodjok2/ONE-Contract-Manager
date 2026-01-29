import type { Express } from "express";
import type { Server } from "http";
import apiRouter from "./routes/index";

// =============================================================================
// REGISTER ALL API ROUTES
// =============================================================================

export async function registerRoutes(server: Server, app: Express) {
  // Mount all modular routes under /api
  app.use("/api", apiRouter);
  
  console.log("API routes registered successfully");
}
